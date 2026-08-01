import type { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

import { buildWorld, type World } from "./world";
import { createBursts, PopupManager, type Bursts } from "./fx";
import { GameAudio } from "./audio";
import { Hud } from "./hud";
import { setupInput, type InputController } from "./input";
import { BOARD_N, boardDistance, boardPoint, boardUV } from "./board";
import {
  BALL_R,
  BALLS_PER_GAME,
  BALL_START_Z,
  BOARD_HALF_W,
  BOARD_TOP_V,
  FLAT_FRICTION,
  GRAVITY,
  HS_KEY,
  LANE_HALF,
  MAX_AIM,
  POCKET_R,
  POCKET_U,
  POCKET_V,
  RACK_SPACING,
  RACK_Z0,
  RAIL_RESTITUTION,
  RAMP_END_Z,
  RAMP_START_Z,
  RETURN_X,
  RIM_BAND,
  RING_POINTS,
  RING_RADII,
  powerToSpeed,
  rampH,
  rampSlope,
  scoreColor,
} from "./config";

type Phase = "idle" | "aiming" | "rolling" | "flying" | "sinking" | "returning" | "over";

interface Waypoint {
  p: Vector3;
  t: number;
}

export interface DebugState {
  phase: Phase;
  score: number;
  ballsUsed: number;
  shots: number[];
  streak: number;
  best: number;
  ballPos: [number, number, number];
  /** Board-space landing spot of the last shot (null before the first roll). */
  lastHit: { u: number; v: number } | null;
}

const EXIT_SLOPE = rampSlope(RAMP_END_Z);

export class Game {
  readonly scene: Scene;
  readonly camera: UniversalCamera;
  private world: World;
  private audio = new GameAudio();
  private hud: Hud;
  private bursts: Bursts;
  private popups: PopupManager;
  private input: InputController;
  private glow: GlowLayer;

  private phase: Phase = "idle";
  private score = 0;
  private ballsUsed = 0;
  private streak = 0;
  private shots: number[] = [];
  private best = 0;

  // ball kinematics
  private pos = new Vector3(0, BALL_R, BALL_START_Z);
  private vel = new Vector3(0, 0, 0);
  private aimBias = 0;

  // tween/animation bookkeeping
  private timer = 0;
  private path: Waypoint[] = [];
  private pathTime = 0;
  private sinkFrom = new Vector3();
  private sinkTo = new Vector3();
  private lastAimPower = 0;
  private camBase = new Vector3(0, 2.1, -1.85);
  private camTarget = new Vector3(0, 0.6, 5.25);
  private camPunch = 0;
  private shake = 0;
  private clock = 0;
  private lastHit: { u: number; v: number } | null = null;

  constructor(engine: Engine) {
    this.scene = new Scene(engine);
    this.scene.autoClear = true;

    this.camera = new UniversalCamera("cam", this.camBase.clone(), this.scene);
    this.camera.setTarget(this.camTarget);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 60;
    this.camera.fov = 0.70;
    this.applyFov();

    this.world = buildWorld(this.scene);
    this.world.ball.rotationQuaternion = Quaternion.Identity();

    this.glow = new GlowLayer("glow", this.scene, { blurKernelSize: 40 });
    this.glow.intensity = 0.7;
    // big emissive-tinted surfaces would smear a flat haze across the frame
    for (const m of this.world.glowExcluded) this.glow.addExcludedMesh(m);

    const pipeline = new DefaultRenderingPipeline("post", true, this.scene, [this.camera]);
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.86;
    pipeline.bloomWeight = 0.34;
    pipeline.bloomKernel = 48;
    pipeline.imageProcessing.contrast = 1.32;
    pipeline.imageProcessing.exposure = 1.06;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 2.2;
    pipeline.imageProcessing.vignetteColor.set(0.02, 0, 0.06, 1);

    this.bursts = createBursts(this.scene);
    this.popups = new PopupManager(this.scene);

    this.best = parseInt(localStorage.getItem(HS_KEY) ?? "0", 10) || 0;

    this.hud = new Hud({
      onPlay: () => {
        this.audio.unlock();
        this.startGame();
      },
      onMute: () => {
        this.audio.unlock();
        this.audio.setMuted(!this.audio.muted);
        this.hud.setMuted(this.audio.muted);
      },
    });
    this.hud.setMuted(this.audio.muted);
    this.hud.setBest(this.best);
    this.hud.setScore(0, true);
    this.hud.setBallsUsed(0);
    this.hud.setPower(null);
    this.hud.setHint("");

    this.input = setupInput(engine.getRenderingCanvas() as HTMLCanvasElement, {
      onGesture: () => this.audio.unlock(),
      onAim: (p, a) => this.onAim(p, a),
      onRelease: (p, a) => this.roll(p, a),
      onCancel: () => this.cancelAim(),
    });

    this.resetBall();
  }

  // ------------------------------------------------------------ lifecycle

  applyFov(): void {
    const eng = this.scene.getEngine();
    const aspect = eng.getRenderWidth() / Math.max(1, eng.getRenderHeight());
    this.camera.fov = aspect < 1.35 ? Math.min(1.12, 0.7 * (1.35 / aspect)) : 0.7;
  }

  startGame(): void {
    this.score = 0;
    this.ballsUsed = 0;
    this.streak = 0;
    this.shots = [];
    this.popups.clear();
    for (const b of this.world.rackBalls) b.isVisible = false;
    this.hud.hideOverlays();
    this.hud.setScore(0, true);
    this.hud.setBallsUsed(0);
    this.hud.setStreak(0);
    this.hud.setHint("Drag back and release to roll");
    this.beginTurn();
  }

  private beginTurn(): void {
    this.resetBall();
    this.phase = "aiming";
    this.input.enabled = true;
    this.lastAimPower = 0;
    this.updateAimIndicator(0, 0, false);
  }

  private resetBall(): void {
    this.pos.set(0, BALL_R, BALL_START_Z);
    this.vel.setAll(0);
    this.aimBias = 0;
    const b = this.world.ball;
    b.isVisible = true;
    b.scaling.setAll(1);
    b.position.copyFrom(this.pos);
    b.rotationQuaternion = Quaternion.Identity();
  }

  // --------------------------------------------------------------- input

  private onAim(power: number, aim: number): void {
    if (this.phase !== "aiming") return;
    const prev = this.lastAimPower;
    this.lastAimPower = power;
    this.hud.setPower(power);
    this.updateAimIndicator(power, aim, true);
    if (Math.abs(power - prev) > 0.02) this.audio.charge(power);
  }

  private cancelAim(): void {
    if (this.phase !== "aiming") return;
    this.hud.setPower(null);
    this.updateAimIndicator(0, 0, false);
  }

  /** Launch the ball. power 0..1, aim -1..1. */
  roll(power: number, aim: number): void {
    if (this.phase !== "aiming") return;
    this.input.enabled = false;
    this.hud.setPower(null);
    this.updateAimIndicator(0, 0, false);
    this.hud.setHint("");

    const speed = powerToSpeed(power);
    const angle = aim * MAX_AIM;
    this.aimBias = aim;
    this.vel.set(Math.sin(angle) * speed * 0.55, 0, Math.cos(angle) * speed);
    this.phase = "rolling";
    this.audio.startRoll();
    this.audio.updateRoll(power);
  }

  // ------------------------------------------------------------- updating

  update(dtRaw: number): void {
    const dt = Math.min(dtRaw, 0.05);
    this.clock += dt;
    this.input.update(dt);
    this.hud.tick(dt);
    this.popups.update(dt);
    this.animateDecor(dt);
    this.updateCamera(dt);

    switch (this.phase) {
      case "rolling":
        this.stepRolling(dt);
        break;
      case "flying":
        this.stepFlying(dt);
        break;
      case "sinking":
        this.stepSinking(dt);
        break;
      case "returning":
        this.stepReturning(dt);
        break;
      default:
        break;
    }
  }

  private stepRolling(dt: number): void {
    const steps = Math.max(1, Math.ceil(dt / 0.003));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const slope = rampSlope(this.pos.z);
      const c2 = 1 / (1 + slope * slope);
      const dir = Math.sign(this.vel.z) || 1;
      const az = -c2 * (GRAVITY * slope + FLAT_FRICTION * dir);
      this.vel.z += az * h;
      this.pos.z += this.vel.z * h;

      this.vel.x *= 1 - 0.55 * h;
      this.pos.x += this.vel.x * h;

      const lim = LANE_HALF - BALL_R;
      if (Math.abs(this.pos.x) > lim) {
        this.pos.x = Math.sign(this.pos.x) * lim;
        this.vel.x = -this.vel.x * RAIL_RESTITUTION;
        this.vel.z *= 0.985;
        if (Math.abs(this.vel.x) > 0.25) this.audio.thunk(0.35);
      }

      if (this.pos.z >= RAMP_END_Z) {
        // crest of the hump: convert to a ballistic launch
        this.vel.y = this.vel.z * EXIT_SLOPE;
        // the lip kicks the ball toward where the player aimed
        this.vel.x += this.aimBias * 0.75;
        this.pos.y = rampH(RAMP_END_Z) + BALL_R;
        this.phase = "flying";
        this.audio.thunk(0.9);
        break;
      }

      if (this.vel.z <= 0 && this.pos.z <= BALL_START_Z + 0.05) {
        this.settleMiss("Rolled back!");
        return;
      }
      if (Math.abs(this.vel.z) < 0.05 && this.pos.z < RAMP_START_Z) {
        this.settleMiss("Too weak!");
        return;
      }
      this.pos.y = rampH(this.pos.z) + BALL_R;
    }
    this.syncBall(dt);
    this.audio.updateRoll(Math.min(1, this.vel.length() / 7));
  }

  private stepFlying(dt: number): void {
    const steps = Math.max(1, Math.ceil(dt / 0.003));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const before = boardDistance(this.pos);
      this.vel.y -= GRAVITY * h;
      this.pos.x += this.vel.x * h;
      this.pos.y += this.vel.y * h;
      this.pos.z += this.vel.z * h;
      const after = boardDistance(this.pos);

      if (after <= BALL_R * 0.5 && before > after) {
        this.resolveBoardHit();
        return;
      }
      if (this.pos.y < 0.12 || this.pos.z > 8.2) {
        this.settleMiss("Missed!");
        return;
      }
    }
    this.syncBall(dt);
    this.audio.updateRoll(Math.min(1, this.vel.length() / 9));
  }

  /** Work out which ring / pocket the ball dropped into. */
  private resolveBoardHit(): void {
    const { u, v } = boardUV(this.pos);
    this.lastHit = { u, v };

    if (v > BOARD_TOP_V) {
      this.settleMiss("Too strong!");
      return;
    }
    if (Math.abs(u) > BOARD_HALF_W) {
      this.settleMiss("Off the board!");
      return;
    }

    // 100-point corner pockets
    for (const s of [-1, 1]) {
      const du = u - s * POCKET_U;
      const dv = v - POCKET_V;
      if (Math.hypot(du, dv) < POCKET_R + BALL_R * 0.4) {
        const hit = boardPoint(s * POCKET_U, POCKET_V, 0.02);
        this.score100(hit, s < 0 ? 0 : 1);
        return;
      }
    }

    let r = Math.hypot(u, v);
    // rim hits are a coin flip between neighbouring rings
    for (const edge of RING_RADII) {
      if (Math.abs(r - edge) < RIM_BAND) {
        r = edge + (Math.random() - 0.5) * RIM_BAND * 2.4;
        this.audio.thunk(0.4);
        break;
      }
    }

    for (let i = 0; i < RING_RADII.length; i++) {
      if (r < RING_RADII[i]) {
        const angle = Math.atan2(v, u);
        const hitR = i === 0 ? 0 : (RING_RADII[i] + RING_RADII[i - 1]) / 2;
        const hit = boardPoint(Math.cos(angle) * hitR, Math.sin(angle) * hitR, 0.02);
        this.endTurn(RING_POINTS[i], hit, i);
        return;
      }
    }
    this.settleMiss("Off the rings!");
  }

  private score100(hit: Vector3, idx: number): void {
    this.flashRing(this.world.pockets[idx], 3.4);
    this.camPunch = 1;
    this.shake = 1;
    this.audio.fanfare();
    this.bursts.confetti();
    this.endTurn(100, hit, -1, true);
  }

  private settleMiss(label: string): void {
    this.audio.miss();
    this.popups.spawn(
      new Vector3(this.pos.x, Math.max(this.pos.y, 0.5) + 0.28, this.pos.z - 0.7),
      label,
      "#ff7d7d",
      0.85
    );
    this.endTurnCommon(0, this.pos.clone(), false);
  }

  private endTurn(points: number, hit: Vector3, ringIdx: number, celebrate = false): void {
    if (ringIdx >= 0) this.flashRing(this.world.rings[ringIdx], points >= 40 ? 2.8 : 1.8);
    this.audio.ding(points);
    this.bursts.score(hit, points);
    if (points >= 40 && !celebrate) {
      this.camPunch = 0.4;
      this.bursts.confetti();
    }

    this.streak++;
    let text = `+${points}`;
    if (this.streak >= 3) text = `+${points}  ${this.streak}×`;
    else if (this.streak === 2) text = `+${points}  DOUBLE`;
    this.popups.spawn(
      hit.add(new Vector3(0, 0.12, -0.85)),
      text,
      scoreColor(points),
      points >= 100 ? 1.5 : points >= 40 ? 1.2 : 1
    );
    this.hud.setStreak(this.streak);
    this.endTurnCommon(points, hit, true);
  }

  private endTurnCommon(points: number, hit: Vector3, scored: boolean): void {
    if (!scored) {
      this.streak = 0;
      this.hud.setStreak(0);
    }
    this.score += points;
    this.shots.push(points);
    this.hud.setScore(this.score);
    this.audio.stopRoll();

    this.ballsUsed++;
    this.hud.setBallsUsed(this.ballsUsed);

    // sink tween: into the hole, or a drop into the catch pit
    this.sinkFrom.copyFrom(this.world.ball.position);
    if (scored) {
      this.sinkTo.copyFrom(hit).addInPlace(BOARD_N.scale(-0.16));
    } else {
      this.sinkTo.set(this.pos.x * 0.4, 0.12, Math.min(Math.max(this.pos.z, 6.7), 7.3));
    }
    this.timer = 0;
    this.phase = "sinking";
  }

  private stepSinking(dt: number): void {
    this.timer += dt;
    const t = Math.min(1, this.timer / 0.34);
    const e = t * t * (3 - 2 * t);
    Vector3.LerpToRef(this.sinkFrom, this.sinkTo, e, this.world.ball.position);
    this.world.ball.scaling.setAll(1 - 0.35 * e);
    this.world.ball.rotate(Vector3.Up(), dt * 7, Space.WORLD);
    if (t >= 1) this.startReturn();
  }

  private startReturn(): void {
    const slot = Math.min(this.ballsUsed - 1, BALLS_PER_GAME - 1);
    const rackZ = RACK_Z0 + slot * RACK_SPACING;
    const y = -0.005;
    this.path = [
      { p: this.world.ball.position.clone(), t: 0 },
      { p: new Vector3(RETURN_X, y + 0.05, 6.9), t: 0.32 },
      { p: new Vector3(RETURN_X, y, 3.6), t: 0.78 },
      { p: new Vector3(RETURN_X, y, rackZ), t: 1.18 },
    ];
    this.pathTime = 0;
    this.phase = "returning";
    this.world.ball.scaling.setAll(1);
    this.audio.startRoll();
  }

  private stepReturning(dt: number): void {
    this.pathTime += dt;
    const total = this.path[this.path.length - 1].t;
    const t = Math.min(this.pathTime, total);
    let i = 0;
    while (i < this.path.length - 2 && t > this.path[i + 1].t) i++;
    const a = this.path[i];
    const b = this.path[i + 1];
    const k = (t - a.t) / Math.max(0.001, b.t - a.t);
    const e = k * k * (3 - 2 * k);
    Vector3.LerpToRef(a.p, b.p, e, this.world.ball.position);
    this.world.ball.rotate(Vector3.Left(), dt * 14, Space.WORLD);
    this.audio.updateRoll(0.25);

    if (this.pathTime >= total + 0.12) {
      this.audio.stopRoll();
      this.audio.thunk(0.3);
      const slot = Math.min(this.ballsUsed - 1, BALLS_PER_GAME - 1);
      const rb = this.world.rackBalls[slot];
      rb.position.copyFrom(this.world.ball.position);
      rb.isVisible = true;
      this.world.ball.isVisible = false;

      if (this.ballsUsed >= BALLS_PER_GAME) this.finish();
      else this.beginTurn();
    }
  }

  private finish(): void {
    this.phase = "over";
    this.input.enabled = false;
    const newBest = this.score > this.best;
    if (newBest) {
      this.best = this.score;
      localStorage.setItem(HS_KEY, String(this.score));
      this.hud.setBest(this.best);
      this.bursts.confetti();
    }
    // Global from /arcade/arcade.js — absent when this game runs standalone.
    (window as any).Arcade?.submit({ game: "skee-ball", value: this.score });
    this.audio.gameOver(newBest);
    this.hud.setHint("");
    this.hud.showGameOver(this.score, this.best, newBest, this.shots);
  }

  // ------------------------------------------------------------- visuals

  private syncBall(dt: number): void {
    const b = this.world.ball;
    b.position.copyFrom(this.pos);
    const speed = this.vel.length();
    if (speed > 0.01) {
      const dir = this.vel.normalizeToNew();
      const axis = Vector3.Cross(Vector3.Up(), dir);
      if (axis.lengthSquared() > 1e-6) {
        axis.normalize();
        b.rotate(axis, (speed / BALL_R) * dt, Space.WORLD);
      }
    }
  }

  private flashRing(ring: World["rings"][number], amount: number): void {
    ring.glow = amount;
  }

  private animateDecor(dt: number): void {
    // ring glow decay
    for (const r of [...this.world.rings, ...this.world.pockets]) {
      if (r.glow > 0) {
        r.glow = Math.max(0, r.glow - dt * 3.2);
      }
      const pulse = 0.85 + Math.sin(this.clock * 2.1 + r.mesh.position.x * 4) * 0.15;
      const k = pulse + r.glow;
      r.mat.emissiveColor.copyFrom(r.base.scale(k));
      const s = 1 + r.glow * 0.05;
      r.mesh.scaling.set(s, 1, s);
    }

    // chasing marquee bulbs
    const n = this.world.bulbs.length;
    for (let i = 0; i < n; i++) {
      const phase = (this.clock * 2.4 - i * 0.35) % (Math.PI * 2);
      const lit = 0.45 + 0.85 * Math.pow(Math.max(0, Math.sin(phase)), 6);
      this.world.bulbs[i].mat.emissiveColor.set(lit * 1.15, lit * 0.98, lit * 0.62);
    }

    // slow neon breathing
    const breathe = 1 + Math.sin(this.clock * 1.3) * 0.08;
    this.world.boardLight.intensity = 1.6 * breathe;
  }

  private updateAimIndicator(power: number, aim: number, visible: boolean): void {
    const a = this.world.aim;
    a.root.setEnabled(visible);
    if (!visible) return;
    a.root.position.set(this.pos.x, 0.02, this.pos.z + 0.14);
    a.root.rotation.y = aim * MAX_AIM * 2.2;
    const len = 0.5 + power * 2.4;
    a.shaft.scaling.z = len;
    a.shaft.position.z = len / 2;
    a.tip.position.z = len + 0.1;
    const col =
      power < 0.45
        ? Color3.FromHexString("#44dd66")
        : power < 0.78
          ? Color3.FromHexString("#ffd54a")
          : Color3.FromHexString("#ff5d5d");
    a.mat.emissiveColor.copyFrom(col.scale(0.5 + power * 0.55));
  }

  private updateCamera(dt: number): void {
    if (this.camPunch > 0) this.camPunch = Math.max(0, this.camPunch - dt * 2.6);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
    const push = this.camPunch * this.camPunch * 0.55;
    const sx = (Math.random() - 0.5) * this.shake * 0.045;
    const sy = (Math.random() - 0.5) * this.shake * 0.045;
    this.camera.position.set(
      this.camBase.x + sx,
      this.camBase.y + sy - push * 0.12,
      this.camBase.z + push
    );
    this.camera.setTarget(this.camTarget);
  }

  // ------------------------------------------------------------ app hooks

  onVisibilityChange(hidden: boolean): void {
    if (hidden) this.audio.suspend();
    else this.audio.resume();
  }

  onResize(): void {
    this.applyFov();
  }

  // --------------------------------------------------- debug / test hooks

  getState(): DebugState {
    return {
      phase: this.phase,
      score: this.score,
      ballsUsed: this.ballsUsed,
      shots: [...this.shots],
      streak: this.streak,
      best: this.best,
      ballPos: [this.world.ball.position.x, this.world.ball.position.y, this.world.ball.position.z],
      lastHit: this.lastHit ? { ...this.lastHit } : null,
    };
  }

  /** Advance the simulation without waiting on real frames (tests). */
  simulate(seconds: number, step = 1 / 120): void {
    const n = Math.ceil(seconds / step);
    for (let i = 0; i < n; i++) this.update(step);
  }

  /** Force a shot from the current aiming state (tests). */
  debugRoll(power: number, aim = 0): void {
    if (this.phase !== "aiming") return;
    this.roll(power, aim);
  }
}
