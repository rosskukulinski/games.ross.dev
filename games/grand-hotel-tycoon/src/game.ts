/**
 * The hotel.
 *
 * One class owns the whole simulation: arriving guests, the queue, rooms,
 * cash, mess, staff and the economy. It reads like a lot, but the loop itself
 * is small — every frame we move everyone, decide what job the manager is
 * standing next to, and let money change hands.
 *
 * Design rule throughout: this is for a five-year-old. Nothing here can end
 * the game. An impatient guest costs you a fare and a sliver of star rating,
 * both of which come straight back. There is no lose state to find.
 */
import type { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import {
  PALETTE as P,
  hex,
  SPAWN,
  DESK,
  DESK_STATION,
  QUEUE_HEAD,
  QUEUE_SPACING,
  QUEUE_MAX,
  queueCap,
  PLOT_WEST,
  PLOT_TIERS,
  PLOT_Z_HALF,
  PLAYER_SPEED,
  PLAYER_ACCEL,
  GUEST_SPEED,
  STAFF_SPEED,
  GUEST_H,
  ROOM_W,
  ROOM_D,
  PATIENCE_BASE,
  ROOM_STAY,
  TIP_PERIOD,
  ACT_CHECKIN,
  ACT_CLEAN,
  ACT_SCOOP,
  CART_STOP,
  INTERACT_R,
  CHECKIN_REACH,
  MAGNET_R,
  MAGNET_PERK_MUL,
  BASE_ROOM_RATE,
  TIP_VALUE,
  ARRIVE_BASE,
  ARRIVE_MIN,
  STAR_GAIN,
  STAR_LOSS,
  FOCUS_W,
  AUTOSAVE_EVERY,
  lotById,
  lotDoor,
} from "./config";
import { BUILDS, buildById, TOTAL_BUILDS, type BuildDef, type StaffRole } from "./content";
import { World, ROOM_ICON, type RoomVisual } from "./world";
import {
  CharacterFactory,
  ManagerRig,
  MoodPool,
  animateWalker,
  type Mood,
} from "./agents";
import { makeMoodTexture } from "./textures";
import { routeTo, followRoute, settle, laneFor, SpatialHash, type Route, type Steerable } from "./nav";
import { PadManager } from "./pads";
import { Fx, ProgressRing } from "./fx";
import { Hud, type RoomChipState } from "./hud";
import { Input } from "./input";
import { audio } from "./audio";
import { updateTweens, tween, Ease, clamp, damp } from "./tween";
import * as save from "./save";

export type Phase = "title" | "playing" | "paused";

/* ------------------------------------------------------------------ types */

type GuestPhase = "arriving" | "queue" | "toRoom" | "inRoom" | "toPool" | "atPool" | "toCart" | "atCart" | "leaving";

interface Guest extends Steerable {
  id: number;
  inst: InstancedMesh;
  route: Route;
  lane: number;
  phase: GuestPhase;
  patience: number;
  maxPatience: number;
  roomIdx: number;
  timer: number;
  variant: number;
  seed: number;
  speed: number;
  /** Smoothed 0..1 for the walk animation. */
  moving: number;
}

interface Room {
  id: string;
  vis: RoomVisual;
  /**
   * `reserved` covers the gap between a guest being checked in and actually
   * reaching the door. Without it the room still reads `free` for the whole
   * walk, so the next check-in hands out the same room again.
   */
  state: "free" | "reserved" | "busy" | "dirty";
  occupant: Guest | null;
  stayLeft: number;
  tipTimer: number;
  /** Wall opacity, 1 normally, dropping while the manager is inside. */
  fade: number;
}

interface CashPile {
  inst: InstancedMesh;
  x: number;
  y: number;
  z: number;
  value: number;
  seed: number;
  age: number;
}

type MessKind = "floatie" | "plate";

interface Mess {
  kind: MessKind;
  inst: InstancedMesh;
  x: number;
  z: number;
  seed: number;
}

interface Staff extends Steerable {
  role: StaffRole;
  inst: InstancedMesh;
  route: Route;
  lane: number;
  state: "idle" | "moving" | "working";
  work: number;
  targetRoom: number;
  targetPile: CashPile | null;
  targetMess: Mess | null;
  carried: number;
  seed: number;
  moving: number;
}

/** What the manager is currently standing next to. */
type JobKind = "none" | "checkin" | "clean" | "mess" | "pad";

interface Job {
  kind: JobKind;
  /** Room index / mess index, depending on kind. */
  index: number;
  /** Where the progress ring floats. */
  x: number;
  z: number;
  /** Where the manager has to stand — not always the same place. */
  atX: number;
  atZ: number;
  duration: number;
}

const NO_JOB: Job = { kind: "none", index: -1, x: 0, z: 0, atX: 0, atZ: 0, duration: 1 };

/* ========================================================================= */

export class Game {
  engine: Engine;
  world: World;
  scene;
  private hud = new Hud();
  private fx: Fx;
  private ring: ProgressRing;
  private chars: CharacterFactory;
  private manager: ManagerRig;
  private moods: MoodPool;
  private pads: PadManager;
  private input: Input;
  private hash = new SpatialHash(1.7);

  phase: Phase = "title";
  private time = 0;
  private saveTimer = 0;

  // ------------------------------------------------------------- economy
  /** The manager simply carries everything. No safe, no cap, no banking trip. */
  private money = 0;
  private baseStars = 3;
  private served = 0;
  private walkouts = 0;
  private pickupStreak = 0;
  private streakTimer = 0;

  // -------------------------------------------------------------- content
  private built = new Set<string>();
  private payProgress: Record<string, number> = {};
  private rooms: Room[] = [];
  private staff: Staff[] = [];
  private guests: Guest[] = [];
  private queue: Guest[] = [];
  private piles: CashPile[] = [];
  private mess: Mess[] = [];
  private spawnTimer = 2.5;
  private messTimer = 9;
  private tier = 0;

  // --------------------------------------------------------------- player
  private px = DESK.x + 2;
  private pz = -4;
  private pvx = 0;
  private pvz = 0;
  private pHeading = 0;
  private job: Job = NO_JOB;
  private jobProgress = 0;
  private lastJobKey = "";
  private hitstop = 0;
  private guideArrow!: Mesh;
  private guideMat!: StandardMaterial;

  // camera basis, derived once from the locked camera angle
  private camRight = { x: 1, z: 0 };
  private camFwd = { x: 0, z: 1 };

  private nextId = 1;

  constructor(engine: Engine) {
    this.engine = engine;
    this.world = new World(engine);
    this.scene = this.world.scene;

    this.fx = new Fx(this.scene, {
      flare: this.world.tex.flare,
      coin: this.world.tex.coin,
      star: this.world.tex.star,
    });
    this.ring = new ProgressRing(this.scene, (m) => this.world.noGlow(m));
    this.chars = new CharacterFactory(this.scene, this.world.shadows);
    this.manager = new ManagerRig(this.scene, this.world.shadows);
    this.moods = new MoodPool(this.scene, () => makeMoodTexture(this.scene), (m) => this.world.noGlow(m), 12);
    this.pads = new PadManager(this.scene, (m) => this.world.noGlow(m));

    this.buildGuideArrow();
    this.computeCameraBasis();

    const canvas = engine.getRenderingCanvas() as HTMLCanvasElement;
    this.input = new Input(canvas, {
      onAny: () => audio.unlock(),
      onPause: () => this.togglePause(),
    });

    this.hud.onMute(() => {
      audio.unlock();
      this.hud.drawMuteIcon(audio.toggleMuted());
    });
    this.hud.drawMuteIcon(audio.muted);
    this.hud.onPause(() => this.togglePause());
    this.hud.onButton("start-btn", () => this.start());
    this.hud.onButton("resume-btn", () => this.setPaused(false));
    this.hud.onButton("reset-btn", () => this.hardReset());
    this.hud.onButton("quit-btn", () => this.hardReset());

    this.loadOrStartFresh();
  }

  /* ===================================================================== */
  /* setup                                                                  */
  /* ===================================================================== */

  /**
   * The camera is locked to a fixed angle, so its screen axes are constants.
   * Derived from the orbit angle directly rather than via `getForwardRay()`,
   * which drags in a Babylon side-effect module for no benefit here.
   */
  private computeCameraBasis(): void {
    const a = this.world.camera.alpha;
    this.camFwd = { x: -Math.cos(a), z: -Math.sin(a) };
    this.camRight = { x: this.camFwd.z, z: -this.camFwd.x };
  }

  private buildGuideArrow(): void {
    const a = CreatePlane("guide", { width: 1.5, height: 2.1 }, this.scene);
    a.rotation.x = Math.PI / 2;
    a.position.y = 0.09;
    a.isPickable = false;
    const m = new StandardMaterial("guideMat", this.scene);
    m.diffuseColor = hex(P.coin);
    m.emissiveColor = hex("#8a6000");
    m.specularColor = Color3.Black();
    m.alpha = 0.75;
    a.material = m;
    this.guideArrow = a;
    this.guideMat = m;
    this.world.noGlow(a);
  }

  private loadOrStartFresh(): void {
    const blob = save.load();
    if (blob) {
      this.money = blob.bank;
      this.baseStars = blob.stars;
      this.served = blob.served;
      this.walkouts = blob.walkouts;
      this.payProgress = blob.payProgress;
      for (const id of blob.built) {
        if (BUILDS.some((b) => b.id === id)) this.built.add(id);
      }
      this.rebuildFromSave();

      const { seconds, coins } = save.offlineEarnings(blob.ts, this.idleRate());
      if (coins > 0) {
        this.money += coins;
        this.pendingWelcome = { coins, seconds };
      }
      this.hud.showStart({ bank: this.money, rooms: this.rooms.length, served: this.served });
    } else {
      this.startFreshHotel();
      this.hud.showStart(null);
    }
    this.hud.setBank(this.money, true);
    this.refreshPads();
  }

  private pendingWelcome: { coins: number; seconds: number } | null = null;

  private startFreshHotel(): void {
    // every hotel begins with exactly one room, as promised
    this.addRoomVisual("n1", 1);
  }

  /** Recreate every purchased structure, in dependency order. */
  private rebuildFromSave(): void {
    this.startFreshHotel();
    // plots first so the camera framing is right before anything else lands
    for (const def of BUILDS) {
      if (def.kind === "plot" && this.built.has(def.id)) {
        this.tier = Math.max(this.tier, def.tier ?? 0);
      }
    }
    this.world.setPlotTier(this.tier, false);

    for (const def of BUILDS) {
      if (!this.built.has(def.id) || def.kind === "plot") continue;
      this.applyBuild(def, false);
    }
  }

  private addRoomVisual(lotId: string, roomNo: number): void {
    const vis = this.world.addRoom(lotId, roomNo);
    this.rooms.push({
      id: lotId,
      vis,
      state: "free",
      occupant: null,
      stayLeft: 0,
      tipTimer: 0,
      fade: 1,
    });
    this.world.setRoomIcon(vis, ROOM_ICON.free);
  }

  /* ===================================================================== */
  /* derived economy                                                        */
  /* ===================================================================== */

  private get stars(): number {
    let bonus = 0;
    for (const id of this.built) bonus += buildById(id).stars ?? 0;
    // heavy mess drags the rating down, but only while it's actually there
    const messPenalty = Math.max(0, this.mess.length - 3) * 0.12;
    return clamp(this.baseStars + bonus - messPenalty, 0.5, 5);
  }

  private get rateMul(): number {
    let m = 1;
    for (const id of this.built) m *= buildById(id).rateMul ?? 1;
    return m;
  }

  private get draw(): number {
    let d = 0;
    for (const id of this.built) d += buildById(id).draw ?? 0;
    return d;
  }

  private get magnetR(): number {
    let r = MAGNET_R;
    for (const id of this.built) if (buildById(id).magnet) r *= MAGNET_PERK_MUL;
    return r;
  }

  /** Job speed multiplier from perks. */
  private get workMul(): number {
    let m = 1;
    for (const id of this.built) m *= buildById(id).workMul ?? 1;
    return m;
  }

  private get playerSpeed(): number {
    let m = 1;
    for (const id of this.built) m *= buildById(id).speedMul ?? 1;
    return PLAYER_SPEED * m;
  }

  /** What one guest is worth on check-in, before tips. */
  private get roomRate(): number {
    return Math.round(BASE_ROOM_RATE * this.rateMul * (0.72 + (this.stars / 5) * 0.56));
  }

  private hasStaff(role: StaffRole): boolean {
    return this.staff.some((s) => s.role === role);
  }

  /**
   * Coins per second the resort makes on its own. Used only for the
   * while-you-were-away payout, and deliberately generous at the bottom end so
   * there is always *something* to come back to.
   */
  private idleRate(): number {
    if (this.rooms.length === 0) return 0;
    const perGuest = this.roomRate + TIP_VALUE * 2;
    const cycle = ROOM_STAY + 14;
    let factor = 0.25;
    if (this.hasStaff("clerk")) factor += 0.25;
    if (this.hasStaff("maid")) factor += 0.25;
    if (this.hasStaff("porter")) factor += 0.25;
    return (this.rooms.length * perGuest * factor) / cycle;
  }

  /* ===================================================================== */
  /* lifecycle                                                              */
  /* ===================================================================== */

  start(): void {
    audio.unlock();
    this.phase = "playing";
    this.hud.showGame();
    audio.blip();

    if (this.pendingWelcome) {
      const { coins, seconds } = this.pendingWelcome;
      this.pendingWelcome = null;
      const mins = Math.round(seconds / 60);
      const when = mins >= 60 ? `${Math.round(mins / 60)} hours` : `${mins} minutes`;
      setTimeout(() => {
        this.hud.toast("💰", `Your staff earned ${coins} while you were away!`, 5200);
        this.fx.coinBurst(this.px, 2, this.pz, 24);
      }, 700);
      this.hud.toast("👋", `Welcome back — you were gone ${when}`, 4200);
    } else if (this.rooms.length === 1 && this.served === 0) {
      this.hud.toast("🛎️", "Walk to the desk to check your first guest in!", 5000);
    }
  }

  togglePause(): void {
    if (this.phase === "playing") this.setPaused(true);
    else if (this.phase === "paused") this.setPaused(false);
  }

  setPaused(p: boolean): void {
    if (this.phase === "title") return;
    if (p) {
      this.phase = "paused";
      this.input.release();
      this.hud.showPause();
      this.persist();
      audio.suspend();
    } else {
      this.phase = "playing";
      this.hud.hidePause();
      audio.resume();
      audio.unlock();
    }
  }

  onVisibilityChange(hidden: boolean): void {
    if (hidden) {
      this.persist();
      if (this.phase === "playing") this.setPaused(true);
      audio.suspend();
    } else {
      audio.resume();
    }
  }

  private hardReset(): void {
    save.disableSaving();
    save.clear();
    // a full reload is by far the safest way to drop every mesh and timer
    setTimeout(() => window.location.reload(), 60);
  }

  persist(): void {
    save.write({
      version: 1,
      ts: Date.now(),
      bank: Math.floor(this.money),
      built: [...this.built],
      payProgress: this.payProgress,
      stars: this.baseStars,
      served: this.served,
      walkouts: this.walkouts,
    });
  }

  /* ===================================================================== */
  /* building                                                               */
  /* ===================================================================== */

  private refreshPads(): void {
    this.pads.refresh(this.built, this.payProgress);
  }

  /** Complete a purchase: create it, bank the effects, throw a party. */
  private completeBuild(id: string): void {
    const def = buildById(id);
    this.built.add(id);
    this.applyBuild(def, true);
    this.pads.dispose(id);
    this.refreshPads();
    this.persist();

    const pos = PadManager.padPos(def);
    audio.build();
    this.fx.confettiBurst(pos.x, 2.5, pos.z, 110);
    this.fx.dustBurst(pos.x, 0.4, pos.z, 46);
    this.fx.shockwave(pos.x, 0.12, pos.z, P.coin, 11, 0.85);
    this.world.camShake = 0.42;
    this.hitstop = 0.05;
    this.hud.toast(def.emoji, `${def.name} built! ${def.blurb}`, 3600);

    if (def.kind === "plot") audio.expand();
    if (def.stars) audio.starUp();
  }

  /** Instantiate a build's world presence and effects. `fresh` = just bought. */
  private applyBuild(def: BuildDef, fresh: boolean): void {
    switch (def.kind) {
      case "room":
        this.addRoomVisual(def.lot!, def.roomNo ?? this.rooms.length + 1);
        break;
      case "amenity":
        if (def.id === "slide") this.world.addSlide();
        else this.world.addAmenity(def.id, def.lot!);
        break;
      case "decor":
        this.world.addDecor(def.id, def.pad!);
        break;
      case "staff":
        this.addStaff(def.role!);
        break;
      case "plot":
        this.tier = Math.max(this.tier, def.tier ?? 0);
        this.world.setPlotTier(this.tier, fresh);
        break;
      case "perk":
        // carry / speed / rate perks are read straight off `built`
        break;
    }
  }

  private addStaff(role: StaffRole): void {
    const inst = this.chars.newStaff(role);
    const home = STAFF_HOME[role];
    // Place them immediately. A fresh instance inherits its prototype's
    // position, and prototypes are parked at y = -500 — so a staff member
    // restored from a save was invisible until the first update tick, which
    // reads as "my employees vanished while I was away".
    inst.position.set(home.x, 0, home.z);
    this.staff.push({
      role,
      inst,
      x: home.x,
      z: home.z,
      heading: 0,
      pushX: 0,
      pushZ: 0,
      route: [],
      lane: laneFor(this.staff.length * 7 + 3),
      state: "idle",
      work: 0,
      targetRoom: -1,
      targetPile: null,
      targetMess: null,
      carried: 0,
      seed: Math.random() * 10,
      moving: 0,
    });
  }

  /* ===================================================================== */
  /* main update                                                            */
  /* ===================================================================== */

  update(rawDt: number): void {
    updateTweens(rawDt);
    this.hud.update(rawDt);

    if (this.phase !== "playing") {
      // the world keeps breathing behind the title card — it sells the place
      this.world.update(rawDt, this.idleCameraTarget());
      this.fx.update(rawDt);
      return;
    }

    // brief freeze on a big impact; UI and tweens keep running
    if (this.hitstop > 0) {
      this.hitstop -= rawDt;
      this.world.update(rawDt, this.cameraTarget());
      this.fx.update(rawDt);
      return;
    }

    const dt = Math.min(rawDt, 1 / 25);
    this.time += dt;

    this.updatePlayer(dt);
    this.updateSpawning(dt);
    this.updateGuests(dt);
    this.updateRooms(dt);
    this.updateMess(dt);
    this.updateStaff(dt);
    this.updateSeparation();
    this.updateCash(dt);
    this.updateJob(dt);
    this.updatePads(dt);

    this.fx.update(dt);
    this.world.update(dt, this.cameraTarget());
    this.updateHud(dt);

    audio.intensity = clamp(this.guests.length / 14, 0, 1);

    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_EVERY) {
      this.saveTimer = 0;
      this.persist();
    }
  }

  /* -------------------------------------------------------------- camera */

  private cameraTarget(): Vector3 {
    const east = PLOT_TIERS[this.tier];
    const cx = (PLOT_WEST + east) / 2;
    // lean toward the player but keep the resort in frame
    const x = cx + (this.px - cx) * FOCUS_W;
    // biased north: the buildings sit at z=±9 but the camera looks from the
    // south, so an unbiased target pushes the north band off the top edge
    const z = this.pz * 0.35 + 1.6;
    return new Vector3(
      clamp(x, PLOT_WEST - 6, east + 4),
      0,
      clamp(z, -PLOT_Z_HALF * 0.55, PLOT_Z_HALF * 0.55),
    );
  }

  private idleCameraTarget(): Vector3 {
    const east = PLOT_TIERS[this.tier];
    const cx = (PLOT_WEST + east) / 2;
    return new Vector3(cx + Math.sin(this.time * 0.12) * 3, 0, Math.cos(this.time * 0.1) * 2);
  }

  /* -------------------------------------------------------------- player */

  private updatePlayer(dt: number): void {
    this.input.update();

    // screen-space stick rotated into world space through the camera basis
    const sx = this.input.x;
    const sy = this.input.y;
    const wantX = this.camRight.x * sx + this.camFwd.x * sy;
    const wantZ = this.camRight.z * sx + this.camFwd.z * sy;
    const mag = Math.min(1, Math.hypot(wantX, wantZ));
    const speed = this.playerSpeed;

    const targetVx = mag > 0.001 ? (wantX / Math.hypot(wantX, wantZ)) * speed * mag : 0;
    const targetVz = mag > 0.001 ? (wantZ / Math.hypot(wantX, wantZ)) * speed * mag : 0;

    this.pvx += (targetVx - this.pvx) * Math.min(1, PLAYER_ACCEL * dt * 0.1);
    this.pvz += (targetVz - this.pvz) * Math.min(1, PLAYER_ACCEL * dt * 0.1);

    this.px += this.pvx * dt;
    this.pz += this.pvz * dt;

    // stay on the island
    const east = PLOT_TIERS[this.tier];
    this.px = clamp(this.px, -34, east + 5);
    this.pz = clamp(this.pz, -PLOT_Z_HALF, PLOT_Z_HALF);
    this.resolveSolids();

    const sp = Math.hypot(this.pvx, this.pvz);
    if (sp > 0.12) this.pHeading = Math.atan2(this.pvx, this.pvz);
    this.manager.update(this.px, this.pz, this.pHeading, clamp(sp / speed, 0, 1), dt);
    this.manager.setMoney(this.money);

    // streak decay — a run of quick pickups raises the pitch and the sparkle
    this.streakTimer -= dt;
    if (this.streakTimer <= 0) this.pickupStreak = 0;
  }

  /**
   * Push the manager out of anything solid. Axis-separated so he slides along
   * a counter rather than sticking to it. Only a handful of props are solid —
   * walking through a guest room is *wanted*, since that is where cleaning
   * happens.
   */
  private resolveSolids(): void {
    const R = 0.45;
    for (const s of this.world.solids) {
      const minX = s.minX - R;
      const maxX = s.maxX + R;
      const minZ = s.minZ - R;
      const maxZ = s.maxZ + R;
      if (this.px <= minX || this.px >= maxX || this.pz <= minZ || this.pz >= maxZ) continue;
      // eject along whichever face is nearest
      const outW = this.px - minX;
      const outE = maxX - this.px;
      const outS = this.pz - minZ;
      const outN = maxZ - this.pz;
      const m = Math.min(outW, outE, outS, outN);
      if (m === outW) {
        this.px = minX;
        this.pvx = Math.min(0, this.pvx);
      } else if (m === outE) {
        this.px = maxX;
        this.pvx = Math.max(0, this.pvx);
      } else if (m === outS) {
        this.pz = minZ;
        this.pvz = Math.min(0, this.pvz);
      } else {
        this.pz = maxZ;
        this.pvz = Math.max(0, this.pvz);
      }
    }
  }

  /* -------------------------------------------------------------- guests */

  private updateSpawning(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    const interval = clamp(ARRIVE_BASE / (1 + this.draw * 0.13), ARRIVE_MIN, 9);
    this.spawnTimer = interval * (0.75 + Math.random() * 0.5);

    // a tiny hotel never gets swamped; the line grows as the resort does
    if (this.queue.length >= queueCap(this.rooms.length)) return;
    if (this.guests.length > 34) return;

    this.spawnGuest();
  }

  private spawnGuest(): void {
    const id = this.nextId++;
    const variant = Math.floor(Math.random() * 8);
    const inst = this.chars.newGuest(variant);
    const patience = PATIENCE_BASE * (0.85 + Math.random() * 0.3);
    const g: Guest = {
      id,
      inst,
      x: SPAWN.x - Math.random() * 6,
      z: SPAWN.z + (Math.random() - 0.5) * 3,
      heading: Math.PI / 2,
      pushX: 0,
      pushZ: 0,
      route: [],
      lane: laneFor(id * 3 + 1),
      phase: "arriving",
      patience,
      maxPatience: patience,
      roomIdx: -1,
      timer: 0,
      variant,
      seed: Math.random() * 100,
      speed: GUEST_SPEED * (0.88 + Math.random() * 0.28),
      moving: 0,
    };
    this.guests.push(g);
    this.queue.push(g);
    g.phase = "queue";
    this.retargetQueue();
  }

  private queueSlotPos(i: number): { x: number; z: number } {
    return { x: QUEUE_HEAD.x - i * QUEUE_SPACING, z: QUEUE_HEAD.z };
  }

  /**
   * The guest who is actually standing at the counter, or null.
   *
   * A guest joins `queue` the moment they spawn — 27 m down the road — so
   * `queue[0]` alone is not a licence to check anyone in. They have to have
   * walked to the front slot first.
   */
  private readyGuest(): Guest | null {
    const g = this.queue[0];
    if (!g || g.phase !== "queue") return null;
    const slot = this.queueSlotPos(0);
    return Math.hypot(g.x - slot.x, g.z - slot.z) <= CHECKIN_REACH ? g : null;
  }

  private retargetQueue(): void {
    for (let i = 0; i < this.queue.length; i++) {
      const g = this.queue[i];
      if (g.phase !== "queue") continue;
      const slot = this.queueSlotPos(i);
      // people shuffle forward within the line rather than re-pathing
      g.route = [{ x: slot.x, z: slot.z }];
    }
  }

  private updateGuests(dt: number): void {
    this.moods.beginFrame();

    for (let i = this.guests.length - 1; i >= 0; i--) {
      const g = this.guests[i];
      const before = { x: g.x, z: g.z };
      let arrived = true;
      if (g.route.length) arrived = followRoute(g, g.route, g.speed, dt);
      else settle(g, dt);

      const moved = Math.hypot(g.x - before.x, g.z - before.z) / Math.max(dt, 1e-4);
      g.moving = damp(g.moving, clamp(moved / g.speed, 0, 1), 9, dt);

      switch (g.phase) {
        case "queue": {
          // shuffling neighbours can nudge someone off their slot; walk back
          // to it, otherwise the front guest can drift out of serving range
          if (g.route.length === 0) {
            const slot = this.queueSlotPos(this.queue.indexOf(g));
            if (Math.hypot(g.x - slot.x, g.z - slot.z) > 0.5) g.route = [slot];
          }
          g.patience -= dt;
          if (g.patience <= 0) {
            this.walkOut(g);
            break;
          }
          const idx = this.queue.indexOf(g);
          if (idx >= 0 && idx < 7) {
            const mood: Mood = g.patience / g.maxPatience > 0.55 ? 0 : g.patience / g.maxPatience > 0.25 ? 1 : 2;
            this.moods.show(g.x, GUEST_H + 0.72, g.z, mood, this.time * 2.4 + g.seed);
          }
          break;
        }
        case "toRoom": {
          this.moods.show(g.x, GUEST_H + 0.72, g.z, 3, this.time * 2.4 + g.seed);
          if (arrived) {
            const room = this.rooms[g.roomIdx];
            // Defensive: the reservation above means this can't normally
            // happen, but silently overwriting an occupant would strand the
            // previous guest in `inRoom` forever, so send this one home
            // instead of leaking them.
            if (!room || (room.occupant && room.occupant !== g)) {
              g.phase = "leaving";
              g.route = routeTo(g, { x: SPAWN.x, z: SPAWN.z }, g.lane);
              break;
            }
            g.phase = "inRoom";
            g.inst.setEnabled(false);
            {
              room.state = "busy";
              room.occupant = g;
              room.stayLeft = ROOM_STAY * (0.85 + Math.random() * 0.3);
              room.tipTimer = TIP_PERIOD;
              room.vis.windowMat.alpha = 0;
              tween(0.5, (t) => (room.vis.windowMat.alpha = t * 0.85), { ease: Ease.outQuad });
              room.vis.windowMat.emissiveColor = hex(P.windowLit).scale(0.7);
              this.world.setRoomIcon(room.vis, ROOM_ICON.busy);
            }
          }
          break;
        }
        case "toPool": {
          if (arrived) {
            g.phase = "atPool";
            g.timer = 5 + Math.random() * 4;
            audio.splash();
            this.fx.splashBurst(g.x, 0.4, g.z, 16);
          }
          break;
        }
        case "atPool": {
          g.timer -= dt;
          // bob in the water
          g.inst.position.y = -0.35 + Math.sin(this.time * 2.4 + g.seed) * 0.09;
          this.moods.show(g.x, GUEST_H + 0.4, g.z, 0, this.time * 2 + g.seed);
          if (g.timer <= 0) {
            g.phase = "leaving";
            g.route = routeTo(g, { x: SPAWN.x, z: SPAWN.z }, g.lane);
            this.fx.splashBurst(g.x, 0.4, g.z, 12);
          }
          break;
        }
        case "toCart": {
          if (arrived) {
            g.phase = "atCart";
            g.timer = CART_STOP * (0.8 + Math.random() * 0.5);
            audio.blip();
          }
          break;
        }
        case "atCart": {
          g.timer -= dt;
          this.moods.show(g.x, GUEST_H + 0.72, g.z, 0, this.time * 2.4 + g.seed);
          if (g.timer <= 0) {
            // They buy an ice cream on the way out. This is the whole point of
            // the cart — a decoration that only moved a hidden stat wasn't
            // worth the 45 coins.
            const tip = Math.round(TIP_VALUE * this.rateMul * 1.3);
            this.dropCash(g.x + (Math.random() - 0.5) * 0.8, 1.1, g.z + 0.9, tip);
            this.fx.sparkleBurst(g.x, 1.5, g.z, 10);
            g.phase = "leaving";
            g.route = routeTo(g, { x: SPAWN.x, z: SPAWN.z }, g.lane);
          }
          break;
        }
        case "leaving": {
          if (arrived) {
            g.inst.dispose();
            this.guests.splice(i, 1);
            continue;
          }
          break;
        }
        case "arriving":
        case "inRoom":
        default:
          break;
      }

      if (g.phase !== "inRoom" && g.phase !== "atPool") {
        animateWalker(g.inst, g.x, g.z, g.heading, g.moving, g.seed, this.time);
      }
    }

    this.moods.endFrame();
  }

  private walkOut(g: Guest): void {
    const qi = this.queue.indexOf(g);
    if (qi >= 0) this.queue.splice(qi, 1);
    g.phase = "leaving";
    g.route = routeTo(g, { x: SPAWN.x, z: SPAWN.z }, g.lane);
    g.speed = GUEST_SPEED * 1.25;
    this.walkouts++;
    this.baseStars = clamp(this.baseStars - STAR_LOSS, 1, 5);
    audio.walkout();
    this.moods.show(g.x, GUEST_H + 0.72, g.z, 2, 0);
    this.retargetQueue();
  }

  /** Serve whoever is standing at the counter. */
  private checkIn(): boolean {
    const g = this.readyGuest();
    if (!g) return false;

    // nearest free room to the desk, so guests don't trek across the resort
    // while a closer room sits empty
    let roomIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.rooms.length; i++) {
      if (this.rooms[i].state !== "free") continue;
      const d = Math.hypot(this.rooms[i].vis.door.x - DESK.x, this.rooms[i].vis.door.z - DESK.z);
      if (d < bestD) {
        bestD = d;
        roomIdx = i;
      }
    }
    if (roomIdx < 0) return false;

    this.queue.shift();
    g.phase = "toRoom";
    g.roomIdx = roomIdx;
    const room = this.rooms[roomIdx];
    // claim it immediately — the guest is still several seconds from the door
    room.state = "reserved";
    room.occupant = g;
    this.world.setRoomIcon(room.vis, ROOM_ICON.reserved);
    const door = lotDoor(lotById(room.id));
    g.route = routeTo(g, door, g.lane);
    this.retargetQueue();

    const fare = this.roomRate;
    this.dropCash(DESK.x + 1.2, 1.45, DESK.z - 1.5, fare);
    audio.deskBell();
    this.fx.sparkleBurst(DESK.x + 1.9, 1.7, DESK.z - 0.3, 18);
    this.popupAt(DESK.x + 1.2, 2.2, DESK.z - 1.5, `+${fare}`, P.coin);
    return true;
  }

  /* --------------------------------------------------------------- rooms */

  private updateRooms(dt: number): void {
    for (let i = 0; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      if (r.state === "busy") {
        r.stayLeft -= dt;
        r.tipTimer -= dt;
        if (r.tipTimer <= 0) {
          r.tipTimer = TIP_PERIOD;
          const tip = Math.round(TIP_VALUE * this.rateMul);
          this.dropCash(r.vis.door.x + (Math.random() - 0.5) * 1.4, 1.1, r.vis.door.z, tip);
        }
        if (r.stayLeft <= 0) this.checkOut(i);
      } else if (r.state === "dirty") {
        // a grubby puff every so often so dirty rooms catch the eye
        if (Math.random() < dt * 0.9) {
          this.fx.smokePuff(r.vis.lot.x, 3.6, r.vis.lot.z, 2);
        }
      }

      // Fade the shell so the manager isn't swallowed by the building they
      // just walked into. Driven per-mesh via `visibility` so every room can
      // keep sharing one wall material.
      const inside = this.distToRoom(r) < 0.4;
      const want = inside ? 0.18 : 1;
      if (Math.abs(r.fade - want) > 0.002) {
        r.fade = damp(r.fade, want, 9, dt);
        for (const m of r.vis.shell) m.visibility = r.fade;
      }
    }
  }

  private checkOut(idx: number): void {
    const r = this.rooms[idx];
    const g = r.occupant;
    r.occupant = null;
    r.state = "dirty";
    this.world.setRoomIcon(r.vis, ROOM_ICON.dirty);
    tween(0.45, (t) => (r.vis.windowMat.alpha = 0.85 * (1 - t)));

    this.served++;
    this.baseStars = clamp(this.baseStars + STAR_GAIN, 1, 5);
    audio.happy();

    if (g) {
      g.inst.setEnabled(true);
      g.x = r.vis.door.x;
      g.z = r.vis.door.z;
      g.inst.position.y = 0;
      if (this.built.has("pool") && Math.random() < 0.5) {
        const pool = lotById("s4");
        g.phase = "toPool";
        g.route = routeTo(
          g,
          { x: pool.x + (Math.random() - 0.5) * 8, z: pool.z + (Math.random() - 0.5) * 4 },
          g.lane,
        );
      } else if (!this.sendToCart(g)) {
        g.phase = "leaving";
        g.route = routeTo(g, { x: SPAWN.x, z: SPAWN.z }, g.lane);
      }
      const tip = Math.round(TIP_VALUE * this.rateMul * 1.4);
      this.dropCash(r.vis.door.x, 1.1, r.vis.door.z + r.vis.lot.facing * 0.8, tip);
      this.fx.sparkleBurst(r.vis.door.x, 1.6, r.vis.door.z, 12);
    }
  }

  /**
   * Send a departing guest past the ice cream cart, if there is one. Returns
   * false when there's no cart (or they aren't in the mood), so the caller can
   * just send them home instead.
   */
  private sendToCart(g: Guest): boolean {
    if (!this.built.has("planters")) return false;
    if (Math.random() > 0.75) return false;
    const cart = buildById("planters").pad!;
    g.phase = "toCart";
    g.route = routeTo(g, { x: cart.x + (Math.random() - 0.5) * 3.2, z: cart.z - 1.9 }, g.lane);
    return true;
  }

  private cleanRoom(idx: number): void {
    const r = this.rooms[idx];
    if (!r || r.state !== "dirty") return;
    r.state = "free";
    this.world.setRoomIcon(r.vis, ROOM_ICON.free);
    audio.sparkle();
    this.fx.sparkleBurst(r.vis.lot.x, 2.4, r.vis.lot.z, 26);
    this.fx.shockwave(r.vis.lot.x, 0.1, r.vis.lot.z, P.padReady, 5, 0.5);
  }

  /* ---------------------------------------------------------------- mess */

  private updateMess(dt: number): void {
    const hasPool = this.built.has("pool");
    const hasRest = this.built.has("restaurant");
    if (!hasPool && !hasRest) return;

    this.messTimer -= dt;
    if (this.messTimer <= 0) {
      this.messTimer = 8 + Math.random() * 6;
      const cap = (hasPool ? 4 : 0) + (hasRest ? 3 : 0);
      if (this.mess.length < cap) {
        const kind: MessKind = hasPool && (!hasRest || Math.random() < 0.6) ? "floatie" : "plate";
        this.spawnMess(kind);
      }
    }

    for (const m of this.mess) {
      m.inst.position.y =
        (m.kind === "floatie" ? 0.16 : 0.92) + Math.sin(this.time * 1.9 + m.seed) * 0.07;
      m.inst.rotation.y = this.time * 0.4 + m.seed;
    }
  }

  private spawnMess(kind: MessKind): void {
    const lot = lotById(kind === "floatie" ? "s4" : "s5");
    const x = lot.x + (Math.random() - 0.5) * (kind === "floatie" ? 9 : 6);
    // floaties stay in the reachable part of the water — the manager is
    // clamped to the plot, so anything further south can never be scooped
    const z = lot.z + (Math.random() - 0.5) * (kind === "floatie" ? 4 : 3) + (kind === "plate" ? 4.2 : 0);
    const inst =
      kind === "floatie"
        ? this.world.protos.floatie.createInstance(`mess${this.nextId++}`)
        : this.makePlate();
    inst.position.set(x, kind === "floatie" ? 0.16 : 0.92, z);
    inst.isPickable = false;
    this.mess.push({ kind, inst, x, z, seed: Math.random() * 10 });
  }

  private plateProto: Mesh | null = null;

  private makePlate(): InstancedMesh {
    if (!this.plateProto) {
      const p = CreateCylinder("plateProto", { diameter: 0.72, height: 0.09, tessellation: 16 }, this.scene);
      const m = new StandardMaterial("plateMat", this.scene);
      m.diffuseColor = hex("#fffaf0");
      m.emissiveColor = hex("#3a3020");
      p.material = m;
      p.position.y = -500;
      p.isPickable = false;
      this.plateProto = p;
    }
    return this.plateProto.createInstance(`plate${this.nextId++}`);
  }

  private clearMess(index: number): void {
    const m = this.mess[index];
    if (!m) return;
    const tip = Math.round(TIP_VALUE * this.rateMul * 0.8);
    this.dropCash(m.x, 1.0, m.z + 1.4, tip);
    if (m.kind === "floatie") {
      audio.splash();
      this.fx.splashBurst(m.x, 0.5, m.z, 18);
    } else {
      audio.sparkle();
      this.fx.sparkleBurst(m.x, 1.2, m.z, 14);
    }
    m.inst.dispose();
    this.mess.splice(index, 1);
  }

  /* ---------------------------------------------------------------- cash */

  private dropCash(x: number, y: number, z: number, value: number): void {
    const inst = this.world.protos.cash.createInstance(`pile${this.nextId++}`);
    inst.position.set(x, y, z);
    inst.isPickable = false;
    const pile: CashPile = { inst, x, y, z, value, seed: Math.random() * 10, age: 0 };
    this.piles.push(pile);
    // little arc as it lands
    const startY = y + 1.1;
    tween(0.45, (t) => {
      inst.position.y = startY + (y - startY) * t;
    }, { ease: Ease.outBounce });
  }

  private updateCash(dt: number): void {
    const magnet = this.magnetR;
    for (let i = this.piles.length - 1; i >= 0; i--) {
      const p = this.piles[i];
      p.age += dt;
      const d = Math.hypot(p.x - this.px, p.z - this.pz);

      // cash flies to the manager well before they touch it — a young player
      // should never have to be precise
      if (d < magnet) {
        const pull = Math.min(1, dt * (7 + (magnet - d) * 4));
        p.x += (this.px - p.x) * pull;
        p.z += (this.pz - p.z) * pull;
        p.y += (1.0 - p.y) * pull;
      }

      p.inst.position.set(p.x, p.y + Math.sin(this.time * 3.2 + p.seed) * 0.07, p.z);
      p.inst.rotation.y = this.time * 1.4 + p.seed;

      if (d < 0.85) {
        this.collectPile(i);
      }
    }
  }

  private collectPile(i: number): void {
    const p = this.piles[i];
    const take = p.value;
    this.money += take;
    p.inst.dispose();
    this.piles.splice(i, 1);

    this.pickupStreak = Math.min(this.pickupStreak + 1, 10);
    this.streakTimer = 1.6;
    audio.coin(this.pickupStreak);
    this.fx.coinBurst(p.x, 1.1, p.z, 6 + this.pickupStreak);
    this.popupAt(p.x, 1.8, p.z, `+${take}`, P.coin);
  }

  /* ----------------------------------------------------------------- job */

  /**
   * Decide what the manager is standing next to, then tick its progress ring.
   * Only one job at a time, and switching away resets it — which is easier to
   * understand than partial progress on five things at once.
   */
  /** Is a job the manager already started still worth finishing? */
  private jobStillValid(j: Job): boolean {
    switch (j.kind) {
      case "clean":
        return this.rooms[j.index]?.state === "dirty";
      case "mess":
        return this.mess[j.index] !== undefined;
      case "checkin":
        return this.readyGuest() !== null && this.rooms.some((r) => r.state === "free");
      default:
        return false;
    }
  }

  private updateJob(dt: number): void {
    let job = this.pickJob();

    // Grace radius. Drifting a few centimetres off the trigger spot used to
    // throw away all progress and restart the ring, so hovering near the edge
    // meant a job could never finish. Once something is underway, keep it
    // until the manager actually walks away or the job stops being real.
    if (job.kind === "none" && this.job.kind !== "none" && this.jobProgress > 0.02) {
      const d = Math.hypot(this.job.atX - this.px, this.job.atZ - this.pz);
      if (d < INTERACT_R * 1.9 && this.jobStillValid(this.job)) job = this.job;
    }

    const key = `${job.kind}:${job.index}`;
    if (key !== this.lastJobKey) {
      this.lastJobKey = key;
      this.jobProgress = 0;
    }

    if (job.kind === "none") {
      this.job = NO_JOB;
      this.ring.hide();
      return;
    }
    this.job = job;

    this.jobProgress += (dt * this.workMul) / job.duration;
    if (Math.random() < dt * 9) audio.workTick(this.jobProgress);

    this.ring.show(
      job.x,
      job.kind === "checkin" ? 2.6 : 2.9,
      job.z,
      Math.min(1, this.jobProgress),
      job.kind === "clean" ? P.padReady : P.coin,
    );

    if (this.jobProgress >= 1) {
      this.jobProgress = 0;
      this.lastJobKey = "";
      switch (job.kind) {
        case "checkin":
          this.checkIn();
          break;
        case "clean":
          this.cleanRoom(job.index);
          break;
        case "mess":
          this.clearMess(job.index);
          break;
      }
    }
  }

  /** Distance from the manager to a room's footprint; 0 when stood inside. */
  private distToRoom(r: Room): number {
    const dx = Math.max(0, Math.abs(this.px - r.vis.lot.x) - ROOM_W / 2);
    const dz = Math.max(0, Math.abs(this.pz - r.vis.lot.z) - ROOM_D / 2);
    return Math.hypot(dx, dz);
  }

  private pickJob(): Job {
    let best: Job = NO_JOB;
    let bestD = INTERACT_R;

    // Check-in. The desk gets a slightly longer reach than everything else so
    // you can stand behind the counter, but only when there is actually
    // somebody at the front of the line to serve.
    const dDesk = Math.hypot(DESK_STATION.x - this.px, DESK_STATION.z - this.pz);
    if (
      dDesk < INTERACT_R + 1.2 &&
      this.readyGuest() !== null &&
      this.rooms.some((r) => r.state === "free") &&
      !this.hasStaff("clerk")
    ) {
      best = {
        kind: "checkin", index: 0, x: DESK.x, z: DESK.z,
        atX: DESK_STATION.x, atZ: DESK_STATION.z, duration: ACT_CHECKIN,
      };
      // clamp: the desk's extra reach must not raise the bar for every job
      // tested below it, or standing near the desk makes rooms uncleanable
      bestD = Math.min(dDesk, INTERACT_R);
    }

    // Dirty rooms. Measured to the room's footprint rather than a point at
    // the door, so standing anywhere inside the room works — which is what you
    // would expect when you have walked in to clean it.
    for (let i = 0; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      if (r.state !== "dirty") continue;
      const d = this.distToRoom(r);
      if (d < bestD) {
        best = {
          kind: "clean", index: i, x: r.vis.lot.x, z: r.vis.lot.z,
          atX: r.vis.lot.x, atZ: r.vis.lot.z, duration: ACT_CLEAN,
        };
        bestD = d;
      }
    }

    // floaties and dirty plates
    for (let i = 0; i < this.mess.length; i++) {
      const m = this.mess[i];
      const d = Math.hypot(m.x - this.px, m.z - this.pz);
      if (d < bestD) {
        best = { kind: "mess", index: i, x: m.x, z: m.z, atX: m.x, atZ: m.z, duration: ACT_SCOOP };
        bestD = d;
      }
    }

    return best;
  }

  /* ---------------------------------------------------------------- pads */

  private updatePads(dt: number): void {
    const done = this.pads.update(
      dt,
      this.px,
      this.pz,
      Math.min(1, Math.hypot(this.pvx, this.pvz) / this.playerSpeed),
      this.payProgress,
      (amount) => {
        const take = Math.min(amount, this.money);
        this.money -= take;
        return take;
      },
      (pad, progress) => {
        audio.drain(progress);
        if (Math.random() < 0.35) {
          this.fx.coinBurst(this.px, 1.4, this.pz, 1);
          this.fx.sparkleBurst(pad.x, 0.6, pad.z, 2);
        }
      },
    );
    if (done) this.completeBuild(done);
  }

  /* --------------------------------------------------------------- staff */

  private updateStaff(dt: number): void {
    for (const s of this.staff) {
      const before = { x: s.x, z: s.z };
      let arrived = true;
      if (s.route.length) arrived = followRoute(s, s.route, STAFF_SPEED, dt);
      else settle(s, dt);
      const moved = Math.hypot(s.x - before.x, s.z - before.z) / Math.max(dt, 1e-4);
      s.moving = damp(s.moving, clamp(moved / STAFF_SPEED, 0, 1), 9, dt);

      switch (s.state) {
        case "idle":
          this.assignStaffJob(s);
          break;
        case "moving":
          if (arrived) {
            s.state = "working";
            s.work = 0;
          }
          break;
        case "working":
          s.work += dt;
          this.tickStaffWork(s);
          break;
      }

      animateWalker(s.inst, s.x, s.z, s.heading, s.moving, s.seed, this.time);
    }
  }

  private assignStaffJob(s: Staff): void {
    switch (s.role) {
      case "maid": {
        const taken = new Set(
          this.staff.filter((o) => o !== s && o.role === "maid").map((o) => o.targetRoom),
        );
        // nearest dirty room, not the lowest-numbered one — on a wide resort
        // that difference is most of a housekeeper's throughput
        let idx = -1;
        let bestD = Infinity;
        for (let i = 0; i < this.rooms.length; i++) {
          if (this.rooms[i].state !== "dirty" || taken.has(i)) continue;
          const d = Math.hypot(this.rooms[i].vis.door.x - s.x, this.rooms[i].vis.door.z - s.z);
          if (d < bestD) {
            bestD = d;
            idx = i;
          }
        }
        if (idx < 0) return this.staffGoHome(s);
        s.targetRoom = idx;
        s.route = routeTo(s, this.rooms[idx].vis.door, s.lane);
        s.state = "moving";
        break;
      }
      case "clerk": {
        const station = STAFF_HOME.clerk;
        if (Math.hypot(s.x - station.x, s.z - station.z) > 1) {
          s.route = routeTo(s, station, s.lane);
          s.state = "moving";
        } else if (this.readyGuest() !== null && this.rooms.some((r) => r.state === "free")) {
          s.state = "working";
          s.work = 0;
        }
        break;
      }
      case "porter": {
        const taken = new Set(
          this.staff.filter((o) => o !== s && o.role === "porter").map((o) => o.targetPile),
        );
        let pile: CashPile | null = null;
        let bestD = Infinity;
        for (const p of this.piles) {
          if (taken.has(p)) continue;
          const d = Math.hypot(p.x - s.x, p.z - s.z);
          if (d < bestD) {
            bestD = d;
            pile = p;
          }
        }
        if (!pile) return this.staffGoHome(s);
        s.targetPile = pile;
        s.route = routeTo(s, { x: pile.x, z: pile.z }, s.lane);
        s.state = "moving";
        break;
      }
      case "lifeguard":
      case "waiter": {
        const want: MessKind = s.role === "lifeguard" ? "floatie" : "plate";
        const taken = new Set(
          this.staff.filter((o) => o !== s && o.role === s.role).map((o) => o.targetMess),
        );
        const m = this.mess.find((v) => v.kind === want && !taken.has(v));
        if (!m) return this.staffGoHome(s);
        s.targetMess = m;
        s.route = routeTo(s, { x: m.x, z: m.z + 1.6 }, s.lane);
        s.state = "moving";
        break;
      }
    }
  }

  private staffGoHome(s: Staff): void {
    const home = STAFF_HOME[s.role];
    if (Math.hypot(s.x - home.x, s.z - home.z) > 1.6) {
      s.route = routeTo(s, home, s.lane);
      s.state = "moving";
    }
  }

  private tickStaffWork(s: Staff): void {
    switch (s.role) {
      case "maid":
        if (s.work >= ACT_CLEAN * 1.5) {
          this.cleanRoom(s.targetRoom);
          s.targetRoom = -1;
          s.state = "idle";
        }
        break;
      case "clerk":
        if (s.work >= ACT_CHECKIN * 1.4) {
          this.checkIn();
          s.state = "idle";
        }
        break;
      case "porter": {
        // arrived at either a pile or the safe
        if (s.targetPile) {
          const idx = this.piles.indexOf(s.targetPile);
          if (idx >= 0) {
            // straight into the manager's pocket — there is nowhere else for
            // it to go now the safe is gone
            this.money += this.piles[idx].value;
            this.popupAt(s.x, 1.9, s.z, `+${this.piles[idx].value}`, P.coin);
            this.piles[idx].inst.dispose();
            this.piles.splice(idx, 1);
            audio.coin(2);
            this.fx.coinBurst(s.x, 1.2, s.z, 4);
          }
          s.targetPile = null;
          s.state = "idle";
        } else {
          s.state = "idle";
        }
        break;
      }
      case "lifeguard":
      case "waiter":
        if (s.work >= ACT_SCOOP * 1.4) {
          if (s.targetMess) {
            const idx = this.mess.indexOf(s.targetMess);
            if (idx >= 0) this.clearMess(idx);
            s.targetMess = null;
          }
          s.state = "idle";
        }
        break;
    }
  }

  /* ---------------------------------------------------------- separation */

  private updateSeparation(): void {
    const all: Steerable[] = [];
    for (const g of this.guests) if (g.phase !== "inRoom") all.push(g);
    for (const s of this.staff) all.push(s);
    this.hash.rebuild(all);
    this.hash.separate(all);
  }

  /* ----------------------------------------------------------------- hud */

  private updateHud(dt: number): void {
    this.hud.setBank(Math.floor(this.money));
    this.hud.setStars(this.stars);
    this.hud.setGuests(this.guests.length, this.served);

    const chips: RoomChipState[] = this.rooms.map((r) => r.state);
    this.hud.setRooms(chips);

    this.updateGuide(dt);
    this.updateHint();

    // minimap, a few times a second is plenty
    this.mmTimer -= dt;
    if (this.mmTimer <= 0) {
      this.mmTimer = 0.12;
      const marks: { x: number; z: number; kind: "job" | "pad" | "guest" }[] = [];
      for (const r of this.rooms) {
        if (r.state === "dirty") marks.push({ x: r.vis.lot.x, z: r.vis.lot.z, kind: "job" });
      }
      for (const m of this.mess) marks.push({ x: m.x, z: m.z, kind: "job" });
      if (this.queue.length > 0 && this.rooms.some((r) => r.state === "free")) {
        marks.push({ x: DESK.x, z: DESK.z, kind: "job" });
      }
      for (const g of this.guests) {
        if (g.phase !== "inRoom") marks.push({ x: g.x, z: g.z, kind: "guest" });
      }
      const near = this.pads.nearest(this.px, this.pz);
      if (near && this.money >= near.def.cost * 0.35) {
        marks.push({ x: near.x, z: near.z, kind: "pad" });
      }
      this.hud.drawMinimap(
        { west: PLOT_WEST - 4, east: PLOT_TIERS[this.tier] + 4, half: PLOT_Z_HALF },
        { x: this.px, z: this.pz },
        marks,
      );
    }
  }

  private mmTimer = 0;

  /** Ground arrow that points at whatever most needs doing. */
  private updateGuide(dt: number): void {
    const target = this.guideTarget();
    if (!target) {
      this.guideMat.alpha = damp(this.guideMat.alpha, 0, 6, dt);
      this.guideArrow.setEnabled(this.guideMat.alpha > 0.03);
      return;
    }
    const dx = target.x - this.px;
    const dz = target.z - this.pz;
    const d = Math.hypot(dx, dz);
    // no point pointing at something you're already standing on
    const want = d < 4 ? 0 : 0.8;
    this.guideMat.alpha = damp(this.guideMat.alpha, want, 6, dt);
    this.guideArrow.setEnabled(this.guideMat.alpha > 0.03);
    this.guideArrow.position.set(this.px + (dx / d) * 2.2, 0.09, this.pz + (dz / d) * 2.2);
    this.guideArrow.rotation.y = Math.atan2(dx, dz);
    this.guideMat.emissiveColor = hex(P.coin).scale(0.4 + Math.sin(this.time * 5) * 0.18);
  }

  private guideTarget(): { x: number; z: number } | null {
    if (this.queue.length > 0 && this.rooms.some((r) => r.state === "free") && !this.hasStaff("clerk")) {
      return DESK_STATION;
    }
    const dirty = this.rooms.find((r) => r.state === "dirty");
    if (dirty && !this.hasStaff("maid")) return dirty.vis.door;
    if (this.mess.length > 0) {
      const m = this.mess[0];
      if ((m.kind === "floatie" && !this.hasStaff("lifeguard")) || (m.kind === "plate" && !this.hasStaff("waiter"))) {
        return { x: m.x, z: m.z };
      }
    }
    if (this.piles.length > 0) return { x: this.piles[0].x, z: this.piles[0].z };
    const near = this.pads.nearest(this.px, this.pz);
    if (near && this.money >= near.def.cost) return { x: near.x, z: near.z };
    return null;
  }

  /** One short, wordless-as-possible instruction at the bottom of the screen. */
  private updateHint(): void {
    const active = this.pads.active;
    if (active) {
      this.hud.setHint(active.def.emoji, `Building ${active.def.name}…`);
      return;
    }
    if (this.job.kind === "checkin") {
      this.hud.setHint("🛎️", "Checking in a guest…");
      return;
    }
    if (this.job.kind === "clean") {
      this.hud.setHint("🧹", "Scrubbing the room…");
      return;
    }
    if (this.job.kind === "mess") {
      this.hud.setHint("🛟", "Tidying up…");
      return;
    }
    if (this.queue.length > 0 && !this.rooms.some((r) => r.state === "free")) {
      const dirty = this.rooms.some((r) => r.state === "dirty");
      this.hud.setHint(dirty ? "🧹" : "🛏️", dirty ? "Clean a room so someone can move in!" : "Every room is full — build another!");
      return;
    }
    // Only claim someone is at the desk once they have actually walked up to
    // it. Guests join the queue the moment they spawn, a long way down the
    // road, so counting the whole queue here reads as a lie.
    if (this.readyGuest() !== null && !this.hasStaff("clerk")) {
      const waiting = this.queue.length;
      this.hud.setHint(
        "🛎️",
        waiting > 1 ? `Someone's at the desk — ${waiting} in the line!` : "Someone's at the desk — check them in!",
      );
      return;
    }
    if (this.piles.length > 0) {
      this.hud.setHint("💰", "Run over the cash to pick it up");
      return;
    }
    // Low priority, and phrased as what it is: they're still walking up.
    if (this.queue.length > 0 && !this.hasStaff("clerk")) {
      this.hud.setHint(
        "👀",
        this.queue.length > 1
          ? `${this.queue.length} guests are walking up to the desk…`
          : "A guest is walking up to the desk…",
      );
      return;
    }
    const near = this.pads.nearest(this.px, this.pz);
    if (near) {
      if (this.money >= near.def.cost) {
        this.hud.setHint("✨", `Stand on the glowing pad to build ${near.def.name}`);
      } else {
        this.hud.setHint("🪙", `${Math.ceil(near.def.cost - this.money)} more for ${near.def.name}`);
      }
      return;
    }
    this.hud.setHint("🌴", "Your resort is looking wonderful");
  }

  /** Project a world point to CSS pixels and float a number there. */
  private popupAt(x: number, y: number, z: number, text: string, color: string): void {
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return;
    const rw = this.engine.getRenderWidth();
    const rh = this.engine.getRenderHeight();
    const p = Vector3.Project(
      new Vector3(x, y, z),
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      this.world.camera.viewport.toGlobal(rw, rh),
    );
    if (p.z < 0 || p.z > 1) return;
    const rect = canvas.getBoundingClientRect();
    this.hud.popup(rect.left + (p.x / rw) * rect.width, rect.top + (p.y / rh) * rect.height, text, color);
  }

  onResize(): void {
    this.computeCameraBasis();
  }

  /* ===================================================================== */
  /* debug hook                                                             */
  /* ===================================================================== */

  debugState() {
    return {
      phase: this.phase,
      money: Math.floor(this.money),
      bank: Math.floor(this.money),
      stars: Number(this.stars.toFixed(2)),
      served: this.served,
      walkouts: this.walkouts,
      rooms: this.rooms.map((r) => r.state),
      /** Room index claimed by each guest heading to or inside a room.
       *  Duplicates here mean two guests were sent to the same room. */
      assignments: this.guests
        .filter((g) => g.phase === "toRoom" || g.phase === "inRoom")
        .map((g) => g.roomIdx),
      inRoom: this.guests.filter((g) => g.phase === "inRoom").length,
      /** How far the front-of-queue guest still is from the counter, or -1. */
      frontDist: (() => {
        const g = this.queue[0];
        if (!g) return -1;
        const slot = this.queueSlotPos(0);
        return Number(Math.hypot(g.x - slot.x, g.z - slot.z).toFixed(2));
      })(),
      guests: this.guests.length,
      queue: this.queue.length,
      piles: this.piles.length,
      mess: this.mess.length,
      staff: this.staff.map((s) => s.role),
      built: [...this.built],
      buildable: BUILDS.filter((b) => this.pads.has(b.id)).map((b) => b.id),
      totalBuilds: TOTAL_BUILDS,
      tier: this.tier,
      player: { x: Number(this.px.toFixed(2)), z: Number(this.pz.toFixed(2)) },
      job: this.job.kind,
      drawCalls: this.scene.getActiveMeshes().length,
    };
  }

  /**
   * Layout self-check. Reports build pads, the safe or the desk station that
   * are buried inside a building, or pads sitting on top of each other.
   *
   * Hand-placing three dozen coordinates against hand-placed geometry is
   * exactly the kind of thing that silently goes wrong — the housekeeper pad
   * and the safe both ended up inside the lobby.
   */
  debugLayoutIssues(): string[] {
    const issues: string[] = [];
    const boxes = this.world.structures
      .filter((m) => !m.isDisposed())
      .map((m) => {
        m.computeWorldMatrix(true);
        const bb = m.getBoundingInfo().boundingBox;
        return { name: m.name, min: bb.minimumWorld, max: bb.maximumWorld };
      });

    const buried = (label: string, x: number, z: number, pad: number): void => {
      for (const b of boxes) {
        if (b.max.y - b.min.y < 1.2) continue; // ground-height things don't hide anything
        if (
          x > b.min.x - pad && x < b.max.x + pad &&
          z > b.min.z - pad && z < b.max.z + pad
        ) {
          issues.push(`${label} at (${x}, ${z}) is inside "${b.name}"`);
          return;
        }
      }
    };

    const spots: { label: string; x: number; z: number }[] = BUILDS.map((d) => {
      const p = PadManager.padPos(d);
      return { label: `pad ${d.id}`, x: p.x, z: p.z };
    }).filter((_, i) => BUILDS[i].kind !== "room" && BUILDS[i].kind !== "amenity");

    spots.push({ label: "DESK_STATION", x: DESK_STATION.x, z: DESK_STATION.z });
    for (let i = 0; i < QUEUE_MAX; i++) {
      const q = this.queueSlotPos(i);
      spots.push({ label: `queue slot ${i}`, x: q.x, z: q.z });
    }

    for (const s of spots) buried(s.label, s.x, s.z, s.label.startsWith("pad") ? 1.6 : 1.2);

    // Two pads can share space if they can never be on screen together —
    // buying one is what makes the other appear.
    const closure = (id: string, acc = new Set<string>()): Set<string> => {
      for (const r of BUILDS.find((d) => d.id === id)?.requires ?? []) {
        if (!acc.has(r)) {
          acc.add(r);
          closure(r, acc);
        }
      }
      return acc;
    };
    const exclusive = (a: string, b: string): boolean =>
      closure(a).has(b) || closure(b).has(a);

    // pads must not overlap each other, or their discs and signs collide
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const a = spots[i];
        const b = spots[j];
        if (!a.label.startsWith("pad") && !b.label.startsWith("pad")) continue;
        if (a.label.startsWith("queue") || b.label.startsWith("queue")) continue;
        if (
          a.label.startsWith("pad") && b.label.startsWith("pad") &&
          exclusive(a.label.slice(4), b.label.slice(4))
        ) continue;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        const need = a.label.startsWith("pad") && b.label.startsWith("pad") ? 4.6 : 3.6;
        if (d < need) issues.push(`${a.label} and ${b.label} are ${d.toFixed(1)} apart (need ${need})`);
      }
    }
    return issues;
  }

  /** Teleport the manager — lets the smoke test drive without a joystick. */
  debugGoto(x: number, z: number): void {
    this.px = x;
    this.pz = z;
    this.pvx = 0;
    this.pvz = 0;
  }

  debugGive(n: number): void {
    this.money += n;
  }

  /** Buy something outright, ignoring pads. */
  debugBuy(id: string): boolean {
    if (this.built.has(id)) return false;
    if (!BUILDS.some((b) => b.id === id)) return false;
    const def = buildById(id);
    for (const r of def.requires) if (!this.built.has(r)) this.debugBuy(r);
    this.completeBuild(id);
    return true;
  }

  /**
   * Fast-forward the simulation. Headless WebGL runs at a fraction of GPU
   * speed, so tests advance time explicitly rather than waiting on frames.
   */
  debugSim(seconds: number): void {
    const step = 1 / 30;
    let left = Math.min(seconds, 600);
    while (left > 0) {
      const dt = Math.min(step, left);
      this.hitstop = 0;
      this.update(dt);
      left -= dt;
    }
  }
}

/** Where each staff member loiters when they have nothing to do. */
const STAFF_HOME: Record<StaffRole, { x: number; z: number }> = {
  maid: { x: -11, z: 3.4 },
  porter: { x: -9.5, z: -3.4 },
  clerk: { x: DESK_STATION.x, z: DESK_STATION.z + 0.6 },
  lifeguard: { x: 16, z: -4.2 },
  waiter: { x: 31, z: -4.2 },
};
