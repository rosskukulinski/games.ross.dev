import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { CreatePolyhedron } from "@babylonjs/core/Meshes/Builders/polyhedronBuilder";
import { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Animation } from "@babylonjs/core/Animations/animation";
import { CubicEase, EasingFunction } from "@babylonjs/core/Animations/easing";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

import {
  LANE_X, SHIP_BASE_Y, SPEED_START, SPEED_MAX, SPEED_RAMP,
  JUMP_VELOCITY, GRAVITY, SPAWN_Z, KILL_Z, SEGMENT_COUNT, SEGMENT_LENGTH,
  PICKUP_SCORE, PALETTE, hex,
} from "./config";
import { buildWorld, type World } from "./world";
import { buildShip, type Ship } from "./ship";
import {
  createEngineTrail, createSpeedLines, createPickupBurst, createExplosion, type Explosion,
} from "./fx";
import { GameAudio } from "./audio";
import { Hud } from "./hud";

type GameState = "ready" | "playing" | "dead";

interface Obstacle {
  root: TransformNode;
  type: "pillar" | "barrier";
  lane: number;
  active: boolean;
}

interface Pickup {
  mesh: Mesh;
  active: boolean;
  baseY: number;
  phase: number;
}

interface RingGate {
  mesh: Mesh;
  active: boolean;
}

export class Game {
  readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly world: World;
  private readonly ship: Ship;
  private readonly explosion: Explosion;
  private readonly pickupBurst: ReturnType<typeof createPickupBurst>;
  private readonly trail: ReturnType<typeof createEngineTrail>;
  private readonly speedLines: ReturnType<typeof createSpeedLines>;
  private readonly audio = new GameAudio();
  private readonly hud = new Hud();
  private readonly flashLight: PointLight;

  private state: GameState = "ready";
  private paused = false;

  private lane = 1;
  private shipY = SHIP_BASE_Y;
  private velY = 0;
  private airborne = false;
  private roll = 0;

  private speed = SPEED_START;
  private distance = 0;
  private score = 0;
  private best: number;
  private combo = 0;
  private untilNextPattern = 30;
  private untilNextRing = 90;
  private shakeTime = 0;
  private deadTimer = 0;
  private elapsed = 0;

  private pillars: Obstacle[] = [];
  private barriers: Obstacle[] = [];
  private pickups: Pickup[] = [];
  private rings: RingGate[] = [];

  constructor(private engine: Engine) {
    this.best = Number(localStorage.getItem("cometDash.best") ?? 0);

    const scene = new Scene(engine);
    this.scene = scene;

    this.camera = new UniversalCamera("cam", new Vector3(0, 5.2, -11), scene);
    this.camera.fov = 0.95;
    this.camera.minZ = 0.5;
    this.camera.maxZ = 1200;

    this.world = buildWorld(scene);
    this.ship = buildShip(scene);
    this.ship.root.position.set(LANE_X[this.lane], SHIP_BASE_Y, 0);

    // neon glow for every emissive surface
    const glow = new GlowLayer("glow", scene, { mainTextureRatio: 0.5 });
    glow.intensity = 0.75;
    glow.blurKernelSize = 24; // tight halo — distant shapes stay readable

    // light post-processing — bloom handled by GlowLayer, keep the rest subtle
    try {
      const pipe = new DefaultRenderingPipeline("pp", false, scene, [this.camera]);
      pipe.fxaaEnabled = true;
      pipe.imageProcessingEnabled = true;
      pipe.imageProcessing.contrast = 1.12;
      pipe.imageProcessing.exposure = 1.02;
      pipe.imageProcessing.vignetteEnabled = true;
      pipe.imageProcessing.vignetteWeight = 1.4;
      pipe.chromaticAberrationEnabled = true;
      pipe.chromaticAberration.aberrationAmount = 4;
    } catch {
      // post-processing is optional — GlowLayer alone still looks good
    }

    // particles
    this.trail = createEngineTrail(scene, this.ship.engineAnchor);
    this.speedLines = createSpeedLines(scene);
    this.pickupBurst = createPickupBurst(scene);
    this.explosion = createExplosion(scene);

    // crash flash light
    this.flashLight = new PointLight("flash", new Vector3(0, 3, 0), scene);
    this.flashLight.diffuse = hex(PALETTE.orange);
    this.flashLight.intensity = 0;
    this.flashLight.range = 40;

    this.buildPools(scene);

    // HUD
    this.hud.setBest(this.best);
    this.hud.setMuted(this.audio.muted);
    this.hud.showStart();
    this.hud.onMuteToggle = () => {
      this.audio.unlock();
      this.audio.setMuted(!this.audio.muted);
      this.hud.setMuted(this.audio.muted);
    };

    scene.onBeforeRenderObservable.add(() => this.update());
  }

  // ------------------------------------------------------------- pools

  private buildPools(scene: Scene): void {
    const pillarBody = new PBRMetallicRoughnessMaterial("pillarBody", scene);
    pillarBody.baseColor = new Color3(0.07, 0.06, 0.16);
    pillarBody.metallic = 0.5;
    pillarBody.roughness = 0.42;
    pillarBody.emissiveColor = new Color3(0.03, 0.025, 0.08); // silhouette never goes fully black

    const pillarEdge = new PBRMetallicRoughnessMaterial("pillarEdge", scene);
    pillarEdge.baseColor = new Color3(0.08, 0.03, 0.02);
    pillarEdge.metallic = 0.2;
    pillarEdge.roughness = 0.5;
    pillarEdge.emissiveColor = hex(PALETTE.orange).scale(0.95);

    const barrierBar = new PBRMetallicRoughnessMaterial("barrierBar", scene);
    barrierBar.baseColor = new Color3(0.09, 0.02, 0.07);
    barrierBar.metallic = 0.2;
    barrierBar.roughness = 0.45;
    barrierBar.emissiveColor = hex(PALETTE.magenta);

    const barrierPost = new PBRMetallicRoughnessMaterial("barrierPost", scene);
    barrierPost.baseColor = new Color3(0.05, 0.05, 0.12);
    barrierPost.metallic = 0.85;
    barrierPost.roughness = 0.4;

    const starMat = new PBRMetallicRoughnessMaterial("starMat", scene);
    starMat.baseColor = new Color3(0.12, 0.09, 0.02);
    starMat.metallic = 0.3;
    starMat.roughness = 0.35;
    starMat.emissiveColor = hex(PALETTE.gold).scale(0.5);

    const ringMatA = new PBRMetallicRoughnessMaterial("ringMatA", scene);
    ringMatA.baseColor = new Color3(0.04, 0.03, 0.1);
    ringMatA.metallic = 0.3;
    ringMatA.roughness = 0.45;
    ringMatA.emissiveColor = hex(PALETTE.violet).scale(0.9);

    // pillars — tall, must dodge sideways
    for (let i = 0; i < 10; i++) {
      const root = new TransformNode(`pillar${i}`, scene);
      const body = CreateBox("pb", { width: 1.7, height: 3.6, depth: 1.3 }, scene);
      body.position.y = 1.55;
      body.material = pillarBody;
      body.parent = root;
      for (const sx of [-1, 1]) {
        const edge = CreateBox("pe", { width: 0.1, height: 3.6, depth: 0.1 }, scene);
        edge.position.set(sx * 0.84, 1.55, -0.64);
        edge.material = pillarEdge;
        edge.parent = root;
      }
      const cap = CreateBox("pc", { width: 1.85, height: 0.2, depth: 1.45 }, scene);
      cap.position.y = 3.45;
      cap.material = pillarEdge;
      cap.parent = root;
      // single warning stripe on the face toward the player
      const stripe = CreateBox("ps", { width: 1.4, height: 0.14, depth: 0.05 }, scene);
      stripe.position.set(0, 1.0, -0.68);
      stripe.material = pillarEdge;
      stripe.parent = root;
      root.setEnabled(false);
      this.pillars.push({ root, type: "pillar", lane: 0, active: false });
    }

    // barriers — low glowing gates, jump over
    for (let i = 0; i < 10; i++) {
      const root = new TransformNode(`barrier${i}`, scene);
      const bar = CreateBox("bb", { width: 2.7, height: 0.42, depth: 0.35 }, scene);
      bar.position.y = 0.95;
      bar.material = barrierBar;
      bar.parent = root;
      for (const sx of [-1, 1]) {
        const post = CreateBox("bp", { width: 0.28, height: 1.25, depth: 0.34 }, scene);
        post.position.set(sx * 1.33, 0.55, 0);
        post.material = barrierPost;
        post.parent = root;
        const tip = CreateBox("bt", { width: 0.3, height: 0.14, depth: 0.36 }, scene);
        tip.position.set(sx * 1.33, 1.24, 0);
        tip.material = barrierBar;
        tip.parent = root;
      }
      root.setEnabled(false);
      this.barriers.push({ root, type: "barrier", lane: 0, active: false });
    }

    // star pickups
    for (let i = 0; i < 30; i++) {
      const star = CreatePolyhedron(`star${i}`, { type: 1, size: 0.4 }, scene);
      star.material = starMat;
      star.setEnabled(false);
      this.pickups.push({ mesh: star, active: false, baseY: 1.2, phase: Math.random() * Math.PI * 2 });
    }

    // giant decorative ring gates around the whole track
    for (let i = 0; i < 3; i++) {
      const ring = CreateTorus(`gate${i}`, { diameter: 17, thickness: 0.42, tessellation: 40 }, scene);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0;
      ring.material = ringMatA;
      ring.setEnabled(false);
      this.rings.push({ mesh: ring, active: false });
    }
  }

  // ------------------------------------------------------------- input

  handleAny(): void {
    this.audio.unlock();
    if (this.paused) {
      this.setPaused(false);
      return;
    }
    if (this.state === "ready") {
      this.startRun();
    } else if (this.state === "dead" && this.deadTimer > 0.9) {
      this.restart();
    }
  }

  handleLeft(): void {
    if (this.state !== "playing" || this.paused) return;
    if (this.lane > 0) this.moveToLane(this.lane - 1);
  }

  handleRight(): void {
    if (this.state !== "playing" || this.paused) return;
    if (this.lane < LANE_X.length - 1) this.moveToLane(this.lane + 1);
  }

  handleJump(): void {
    if (this.state !== "playing" || this.paused) return;
    if (!this.airborne) {
      this.airborne = true;
      this.velY = JUMP_VELOCITY;
      this.audio.jump();
    }
  }

  onVisibilityChange(hidden: boolean): void {
    if (hidden) {
      if (this.state === "playing") this.setPaused(true);
      this.audio.suspend();
    } else if (!this.paused) {
      this.audio.resume();
    }
  }

  private setPaused(p: boolean): void {
    this.paused = p;
    this.hud.setPaused(p);
    if (!p) this.audio.resume();
  }

  // ------------------------------------------------------------- state

  private startRun(): void {
    this.state = "playing";
    this.speed = SPEED_START;
    this.primeCourse();
    this.hud.showPlaying();
    this.hud.setScore(0);
  }

  /** Seed some content ahead so the opening seconds aren't an empty track. */
  private primeCourse(): void {
    this.spawnPickupLine(1, 62);
    this.spawnRing(105);
    const lane = Math.floor(Math.random() * 3);
    this.spawnPillar(lane, 140);
    this.spawnPickupLine((lane + 1) % 3, 138);
    this.spawnBarrier(Math.floor(Math.random() * 3), 175);
    this.untilNextPattern = 205 - 175 + 10;
  }

  private restart(): void {
    // clear all live objects
    for (const o of [...this.pillars, ...this.barriers]) {
      o.active = false;
      o.root.setEnabled(false);
    }
    for (const p of this.pickups) {
      p.active = false;
      p.mesh.setEnabled(false);
    }
    for (const r of this.rings) {
      r.active = false;
      r.mesh.setEnabled(false);
    }
    // reset track segments
    this.world.segments.forEach((s, i) => {
      s.root.position.z = i * SEGMENT_LENGTH - SEGMENT_LENGTH;
    });

    this.lane = 1;
    this.shipY = SHIP_BASE_Y;
    this.velY = 0;
    this.airborne = false;
    this.speed = SPEED_START;
    this.distance = 0;
    this.score = 0;
    this.combo = 0;
    this.untilNextPattern = 30;
    this.untilNextRing = 60;
    this.deadTimer = 0;

    this.ship.root.position.set(LANE_X[this.lane], SHIP_BASE_Y, 0);
    this.ship.root.rotation.set(0, 0, 0);
    for (const m of this.ship.meshes) m.setEnabled(true);
    this.ship.engineLight.intensity = 11;
    this.ship.glowLight.intensity = 9;
    this.trail.start();

    this.primeCourse();
    this.state = "playing";
    this.hud.showPlaying();
    this.hud.setScore(0);
    this.hud.setBest(this.best);
  }

  private crash(): void {
    this.state = "dead";
    this.deadTimer = 0;
    this.shakeTime = 0.75;
    this.combo = 0;

    const pos = this.ship.root.position.clone();
    pos.y = Math.max(pos.y, 1.2);
    this.explosion.burst(pos);
    this.flashLight.position.copyFrom(pos);
    this.flashLight.intensity = 90;

    for (const m of this.ship.meshes) m.setEnabled(false);
    this.trail.stop();
    this.ship.engineLight.intensity = 0;
    this.ship.glowLight.intensity = 0;

    this.audio.crash();

    const isNewBest = this.score > this.best;
    if (isNewBest) {
      this.best = Math.floor(this.score);
      localStorage.setItem("cometDash.best", String(this.best));
    }
    window.setTimeout(() => {
      this.hud.showGameOver(this.score, this.best, isNewBest);
    }, 900);
  }

  // ------------------------------------------------------------- lane / spawn helpers

  private moveToLane(target: number): void {
    const dir = target > this.lane ? 1 : -1;
    this.lane = target;
    this.audio.whoosh(dir);

    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    Animation.CreateAndStartAnimation(
      "laneShift", this.ship.root, "position.x",
      60, 12, this.ship.root.position.x, LANE_X[target],
      Animation.ANIMATIONLOOPMODE_CONSTANT, ease
    );
  }

  private spawnPillar(lane: number, z: number): void {
    const o = this.pillars.find((p) => !p.active);
    if (!o) return;
    o.active = true;
    o.lane = lane;
    o.root.position.set(LANE_X[lane], 0, z);
    o.root.setEnabled(true);
  }

  private spawnBarrier(lane: number, z: number): void {
    const o = this.barriers.find((b) => !b.active);
    if (!o) return;
    o.active = true;
    o.lane = lane;
    o.root.position.set(LANE_X[lane], 0, z);
    o.root.setEnabled(true);
  }

  private spawnPickupLine(lane: number, z: number, arc = false): void {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const p = this.pickups.find((x) => !x.active);
      if (!p) return;
      p.active = true;
      const t = i / (count - 1);
      p.baseY = arc ? 1.2 + Math.sin(t * Math.PI) * 1.9 : 1.2;
      p.phase = Math.random() * Math.PI * 2;
      p.mesh.position.set(LANE_X[lane], p.baseY, z + i * 4.4);
      p.mesh.setEnabled(true);
    }
  }

  private spawnRing(z: number): void {
    const r = this.rings.find((x) => !x.active);
    if (!r) return;
    r.active = true;
    r.mesh.position.set(0, 0, z);
    r.mesh.setEnabled(true);
  }

  private spawnPattern(): void {
    const lanes = [0, 1, 2];
    const pick = (arr: number[]) => arr[Math.floor(Math.random() * arr.length)];
    const roll = Math.random();

    if (roll < 0.24) {
      // one pillar, stars beside it
      const l = pick(lanes);
      this.spawnPillar(l, SPAWN_Z);
      const free = lanes.filter((x) => x !== l);
      this.spawnPickupLine(pick(free), SPAWN_Z - 2);
    } else if (roll < 0.44) {
      // two pillars, stars in the only free lane
      const a = pick(lanes);
      const rest = lanes.filter((x) => x !== a);
      const b = pick(rest);
      this.spawnPillar(a, SPAWN_Z);
      this.spawnPillar(b, SPAWN_Z);
      const free = lanes.find((x) => x !== a && x !== b)!;
      this.spawnPickupLine(free, SPAWN_Z - 2);
    } else if (roll < 0.66) {
      // barrier with a star arc over it — jump!
      const l = pick(lanes);
      this.spawnBarrier(l, SPAWN_Z);
      this.spawnPickupLine(l, SPAWN_Z - 5, true);
      if (Math.random() < 0.5) {
        this.spawnBarrier(pick(lanes.filter((x) => x !== l)), SPAWN_Z);
      }
    } else if (roll < 0.86) {
      // pillar + barrier combo
      const a = pick(lanes);
      const b = pick(lanes.filter((x) => x !== a));
      this.spawnPillar(a, SPAWN_Z);
      this.spawnBarrier(b, SPAWN_Z + 14);
      const free = lanes.find((x) => x !== a && x !== b);
      if (free !== undefined) this.spawnPickupLine(free, SPAWN_Z + 6);
    } else {
      // pure star zigzag
      const a = pick(lanes);
      this.spawnPickupLine(a, SPAWN_Z);
      this.spawnPickupLine(pick(lanes.filter((x) => x !== a)), SPAWN_Z + 16);
    }
  }

  // ------------------------------------------------------------- per-frame update

  private update(): void {
    const rawDt = this.engine.getDeltaTime() / 1000;
    const dt = Math.min(rawDt, 0.05);
    if (this.paused) return;
    this.elapsed += dt;

    // idle scene drift on the start screen
    const idle = this.state === "ready";
    const dead = this.state === "dead";

    if (dead) {
      this.deadTimer += dt;
      this.speed = Math.max(0, this.speed - dt * 60); // world screeches to a halt
    } else if (!idle) {
      this.speed = Math.min(SPEED_MAX, this.speed + SPEED_RAMP * dt);
    } else {
      this.speed = 14; // gentle cruise behind the start screen
    }

    const move = this.speed * dt;
    this.distance += move;

    // --- scroll track segments ---
    for (const seg of this.world.segments) {
      seg.root.position.z -= move;
      if (seg.root.position.z < -SEGMENT_LENGTH * 1.5) {
        seg.root.position.z += SEGMENT_COUNT * SEGMENT_LENGTH;
      }
    }

    // --- sky slowly drifts ---
    this.world.skysphere.rotation.y += dt * 0.004;

    // --- spawn patterns while playing ---
    if (this.state === "playing") {
      this.untilNextPattern -= move;
      if (this.untilNextPattern <= 0) {
        this.spawnPattern();
        this.untilNextPattern = 26 + Math.random() * 14 + this.speed * 0.22;
      }
      this.untilNextRing -= move;
      if (this.untilNextRing <= 0) {
        this.spawnRing(SPAWN_Z + 10);
        this.untilNextRing = 120 + Math.random() * 80;
      }
    }

    // --- move + recycle obstacles ---
    const shipX = this.ship.root.position.x;
    for (const o of [...this.pillars, ...this.barriers]) {
      if (!o.active) continue;
      o.root.position.z -= move;
      const z = o.root.position.z;
      if (z < KILL_Z) {
        o.active = false;
        o.root.setEnabled(false);
        continue;
      }
      // collision window
      if (this.state === "playing" && z > -1.8 && z < 1.8) {
        const dx = Math.abs(shipX - LANE_X[o.lane]);
        if (dx < 1.75) {
          if (o.type === "pillar" || this.shipY < 1.6) {
            this.crash();
          }
        }
      }
    }

    // --- pickups: bob, spin, collect ---
    for (const p of this.pickups) {
      if (!p.active) continue;
      p.mesh.position.z -= move;
      p.mesh.rotation.y += dt * 3.2;
      p.mesh.rotation.x += dt * 1.1;
      p.mesh.position.y = p.baseY + Math.sin(this.elapsed * 3 + p.phase) * 0.16;
      const z = p.mesh.position.z;
      if (z < KILL_Z) {
        p.active = false;
        p.mesh.setEnabled(false);
        continue;
      }
      if (this.state === "playing" && z > -1.6 && z < 1.6) {
        const dx = Math.abs(shipX - p.mesh.position.x);
        const dy = Math.abs(this.shipY + 0.1 - p.mesh.position.y);
        if (dx < 1.5 && dy < 1.35) {
          p.active = false;
          p.mesh.setEnabled(false);
          this.combo++;
          this.score += PICKUP_SCORE;
          (this.pickupBurst.emitter as Vector3).copyFrom(p.mesh.position);
          this.pickupBurst.manualEmitCount = 40;
          this.audio.pickup(this.combo);
        }
      }
    }

    // --- ring gates drift by ---
    for (const r of this.rings) {
      if (!r.active) continue;
      r.mesh.position.z -= move;
      r.mesh.rotation.y = Math.sin(this.elapsed * 0.6) * 0.04;
      if (r.mesh.position.z < KILL_Z - 10) {
        r.active = false;
        r.mesh.setEnabled(false);
      }
    }

    // --- ship vertical physics + hover bob ---
    if (!dead) {
      if (this.airborne) {
        this.velY += GRAVITY * dt;
        this.shipY += this.velY * dt;
        if (this.shipY <= SHIP_BASE_Y) {
          this.shipY = SHIP_BASE_Y;
          this.velY = 0;
          this.airborne = false;
        }
        this.ship.root.position.y = this.shipY;
      } else {
        this.shipY = SHIP_BASE_Y;
        this.ship.root.position.y = SHIP_BASE_Y + Math.sin(this.elapsed * 2.4) * 0.07;
      }

      // bank into lane changes, pitch with jumps
      const targetRoll = Scalar.Clamp((LANE_X[this.lane] - shipX) * 0.38, -0.55, 0.55);
      this.roll = Scalar.Lerp(this.roll, targetRoll, Math.min(1, dt * 10));
      this.ship.root.rotation.z = -this.roll;
      this.ship.root.rotation.y = this.roll * 0.35;
      const targetPitch = this.airborne ? Scalar.Clamp(-this.velY * 0.03, -0.3, 0.35) : 0;
      this.ship.root.rotation.x = Scalar.Lerp(this.ship.root.rotation.x, targetPitch, Math.min(1, dt * 8));
    }

    // --- hover glow pool tracks the ship on the floor ---
    if (!dead) {
      this.ship.glowPool.position.x = shipX;
      const lift = this.shipY - SHIP_BASE_Y;
      const s = Scalar.Clamp(1 - lift * 0.22, 0.45, 1);
      this.ship.glowPool.scaling.set(s, s, s);
      this.ship.glowPool.visibility = s;
    }

    // --- trail + speed lines intensity track the speed ---
    const speedFrac = (this.speed - SPEED_START) / (SPEED_MAX - SPEED_START);
    this.trail.emitRate = 220 + speedFrac * 420;
    this.speedLines.emitRate = idle ? 30 : 40 + speedFrac * 220;

    // --- crash flash decay ---
    if (this.flashLight.intensity > 0) {
      this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 160);
    }

    // --- camera: follow with lag, lean, FOV kick, shake ---
    const camTargetX = shipX * 0.55;
    this.camera.position.x = Scalar.Lerp(this.camera.position.x, camTargetX, Math.min(1, dt * 6));
    this.camera.position.y = Scalar.Lerp(this.camera.position.y, 5.2 + (this.shipY - SHIP_BASE_Y) * 0.35, Math.min(1, dt * 5));
    this.camera.position.z = -11;

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const mag = this.shakeTime * 0.55;
      shakeX = (Math.random() * 2 - 1) * mag;
      shakeY = (Math.random() * 2 - 1) * mag;
    }
    this.camera.setTarget(new Vector3(shipX * 0.6 + shakeX, 2.1 + shakeY, 24));
    this.camera.rotation.z = -this.roll * 0.16;

    const targetFov = 0.95 + Math.max(0, speedFrac) * 0.16;
    this.camera.fov = Scalar.Lerp(this.camera.fov, targetFov, Math.min(1, dt * 3));

    // --- score + HUD ---
    if (this.state === "playing") {
      this.score += move * 0.6;
      this.hud.setScore(this.score);
      this.hud.setSpeed(this.speed / SPEED_START, Scalar.Clamp(speedFrac, 0, 1));
      if (this.score > this.best) this.hud.setBest(this.score);
    }
  }
}
