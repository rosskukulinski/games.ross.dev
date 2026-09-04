/**
 * The race itself: lobby, countdown, laps, standings, item boxes, projectiles
 * and the bots. One instance lives in the Durable Object for online play and
 * one lives in the page for solo play, so the two modes cannot drift apart.
 *
 * Human karts are driven by their own browser and *reported* here; bots are
 * stepped here. Anything a driver cannot decide for itself (being hit,
 * receiving an item, finishing) leaves as an event.
 */
import {
  type KartState,
  type KartStepEvent,
  BASE_MAX_SPEED,
  HIT_COOLDOWN,
  KART_RADIUS,
  SPIN_TIME,
  applyKinematics,
  applySpin,
  createKart,
  pushApart,
  stepKart,
} from './kart.ts';
import {
  type TrackGeom,
  BOX_RADIUS,
  CHECKPOINT_COUNT,
  buildTrack,
  deltaS,
  headingOf,
  locate,
  pointAt,
  angleDiff,
} from './track.ts';
import { TRACKS, findTrack } from './tracks.ts';
import { BOT_NAMES, KARTS, findKart, type KartDef } from './karts.ts';
import {
  type ItemId,
  BOX_RESPAWN,
  ROCKET_HIT_RADIUS,
  ROCKET_LIFE,
  ROCKET_SPEED,
  STAR_TIME,
  TRAP_HIT_RADIUS,
  TRAP_LIFE,
  TURBO_TIME,
  rollItem,
} from './items.ts';
import { type BotBrain, type BotContext, botInput, botUseItem, createBrain, resetItemTimer } from './bot.ts';

export const MAX_KARTS = 4;
export const COUNTDOWN_TIME = 3.7;
/** Seconds after the first finisher before the race is called regardless. */
export const FINISH_GRACE = 35;
export const RESULTS_DELAY = 1.6;

export type Phase = 'lobby' | 'countdown' | 'racing' | 'finished';
export const PHASE_INDEX: Phase[] = ['lobby', 'countdown', 'racing', 'finished'];
export type Difficulty = 'easy' | 'normal' | 'hard';
export type SlotKind = 'empty' | 'human' | 'bot';

export interface Slot {
  kind: SlotKind;
  name: string;
  kartId: string;
  ready: boolean;
  host: boolean;
}

export interface Projectile {
  id: number;
  owner: number;
  target: number;
  x: number;
  z: number;
  heading: number;
  s: number;
  lateral: number;
  life: number;
  index: number;
}

export interface Trap {
  id: number;
  owner: number;
  x: number;
  z: number;
  s: number;
  lateral: number;
  life: number;
  /** The dropper drives clear of it before it becomes live for them. */
  armed: number;
}

export type RaceEvent =
  | { k: 'go' }
  | { k: 'hit'; slot: number; by: number; cause: 'rocket' | 'bubble' | 'zap' | 'star' }
  | { k: 'boost'; slot: number; tier: number }
  | { k: 'pad'; slot: number }
  | { k: 'item'; slot: number; item: ItemId }
  | { k: 'box'; box: number }
  | { k: 'use'; slot: number; item: ItemId }
  | { k: 'star'; slot: number }
  | { k: 'lap'; slot: number; lap: number }
  | { k: 'finish'; slot: number; place: number; time: number }
  | { k: 'rocketPop'; x: number; z: number }
  | { k: 'trapPop'; x: number; z: number }
  | { k: 'over' };

const BOT_SKILL: Record<Difficulty, number> = { easy: 0.35, normal: 0.65, hard: 0.9 };
const BOT_SPEED: Record<Difficulty, number> = { easy: 0.82, normal: 0.92, hard: 0.99 };

export class Race {
  geom: TrackGeom;
  trackId: string;
  difficulty: Difficulty;
  slots: Slot[] = [];
  karts: KartState[] = [];
  brains: (BotBrain | null)[] = [];
  phase: Phase = 'lobby';
  /** Countdown remaining, or seconds since the first finisher. */
  timer = 0;
  /** Race clock in seconds since GO. */
  time = 0;
  projectiles: Projectile[] = [];
  traps: Trap[] = [];
  boxes: { active: boolean; respawn: number }[] = [];
  events: RaceEvent[] = [];
  finishers = 0;
  private nextId = 1;
  private rand: () => number;
  private resultsTimer = -1;

  constructor(trackId: string, difficulty: Difficulty = 'normal', rand: () => number = Math.random) {
    this.rand = rand;
    this.difficulty = difficulty;
    this.trackId = trackId;
    this.geom = buildTrack(findTrack(trackId));
    for (let i = 0; i < MAX_KARTS; i++) {
      this.slots.push({ kind: 'empty', name: '', kartId: KARTS[i].id, ready: false, host: false });
      this.karts.push(createKart());
      this.brains.push(null);
    }
    this.resetBoxes();
  }

  // --- Lobby -------------------------------------------------------------

  setTrack(id: string): void {
    if (this.phase !== 'lobby') return;
    if (!TRACKS.some((t) => t.id === id)) return;
    this.trackId = id;
    this.geom = buildTrack(findTrack(id));
    this.resetBoxes();
  }

  setDifficulty(d: Difficulty): void {
    if (this.phase !== 'lobby') return;
    this.difficulty = d;
  }

  /** Returns the slot index, or -1 when the room is full. */
  addHuman(name: string, kartId: string, host: boolean): number {
    const slot = this.slots.findIndex((s) => s.kind === 'empty');
    if (slot === -1) return -1;
    const s = this.slots[slot];
    s.kind = 'human';
    s.name = name;
    s.kartId = this.freeKart(kartId, slot);
    s.ready = false;
    s.host = host;
    this.karts[slot] = createKart();
    this.brains[slot] = null;
    return slot;
  }

  /** A human left. Mid-race their kart carries on as a bot so the race stays a race. */
  removeHuman(slot: number): void {
    const s = this.slots[slot];
    if (s.kind !== 'human') return;
    if (this.phase === 'countdown' || this.phase === 'racing') {
      s.kind = 'bot';
      s.name = `${s.name} (auto)`;
      s.host = false;
      this.brains[slot] = createBrain(BOT_SKILL[this.difficulty], this.rand);
    } else {
      s.kind = 'empty';
      s.name = '';
      s.ready = false;
      s.host = false;
      this.brains[slot] = null;
    }
  }

  setKart(slot: number, kartId: string): void {
    if (this.phase !== 'lobby') return;
    if (!KARTS.some((k) => k.id === kartId)) return;
    this.slots[slot].kartId = kartId;
  }

  setReady(slot: number, ready: boolean): void {
    if (this.phase !== 'lobby') return;
    this.slots[slot].ready = ready;
  }

  humans(): number[] {
    const out: number[] = [];
    this.slots.forEach((s, i) => {
      if (s.kind === 'human') out.push(i);
    });
    return out;
  }

  private freeKart(preferred: string, self: number): string {
    const taken = new Set(this.slots.filter((s, i) => i !== self && s.kind !== 'empty').map((s) => s.kartId));
    if (!taken.has(preferred)) return preferred;
    return KARTS.find((k) => !taken.has(k.id))?.id ?? preferred;
  }

  fillBots(): void {
    let n = 0;
    const usedNames = new Set(this.slots.map((s) => s.name));
    for (let i = 0; i < MAX_KARTS; i++) {
      const s = this.slots[i];
      if (s.kind !== 'empty') continue;
      s.kind = 'bot';
      let name = BOT_NAMES[(i + n) % BOT_NAMES.length];
      while (usedNames.has(name)) name = BOT_NAMES[Math.floor(this.rand() * BOT_NAMES.length)];
      usedNames.add(name);
      s.name = name;
      s.kartId = this.freeKart(KARTS[(i + 2) % KARTS.length].id, i);
      s.ready = true;
      s.host = false;
      this.brains[i] = createBrain(BOT_SKILL[this.difficulty], this.rand);
      n++;
    }
  }

  clearBots(): void {
    this.slots.forEach((s, i) => {
      if (s.kind === 'bot') {
        s.kind = 'empty';
        s.name = '';
        s.ready = false;
        this.brains[i] = null;
      }
    });
  }

  // --- Lifecycle ---------------------------------------------------------

  beginCountdown(): void {
    if (this.phase !== 'lobby') return;
    this.fillBots();
    this.resetBoxes();
    this.projectiles = [];
    this.traps = [];
    this.finishers = 0;
    this.time = 0;
    this.resultsTimer = -1;
    const w = this.geom.def.width;
    for (let i = 0; i < MAX_KARTS; i++) {
      const k = createKart();
      const row = Math.floor(i / 2);
      const s = -6 - row * 4.5;
      const lat = (i % 2 === 0 ? -1 : 1) * w * 0.2;
      const p = pointAt(this.geom, s, lat);
      k.x = p.x;
      k.z = p.z;
      k.heading = headingOf(p.tx, p.tz);
      const loc = locate(this.geom, k.x, k.z, -1);
      k.index = loc.index;
      k.prog = loc.s;
      k.prevProg = loc.s;
      k.lateral = loc.lateral;
      k.place = i + 1;
      this.karts[i] = k;
    }
    this.phase = 'countdown';
    this.timer = COUNTDOWN_TIME;
  }

  backToLobby(): void {
    this.phase = 'lobby';
    this.clearBots();
    for (const s of this.slots) s.ready = false;
    this.projectiles = [];
    this.traps = [];
    this.resetBoxes();
  }

  private resetBoxes(): void {
    this.boxes = this.geom.boxes.map(() => ({ active: true, respawn: 0 }));
  }

  takeEvents(): RaceEvent[] {
    if (this.events.length === 0) return [];
    const out = this.events;
    this.events = [];
    return out;
  }

  // --- Simulation --------------------------------------------------------

  step(dt: number): void {
    if (this.phase === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = 'racing';
        this.timer = 0;
        this.events.push({ k: 'go' });
      }
      return;
    }
    if (this.phase !== 'racing' && this.phase !== 'finished') return;

    this.time += dt;
    const geom = this.geom;
    const ctx: BotContext = { geom, traps: this.traps, karts: this.karts, self: 0, rand: this.rand };

    for (let i = 0; i < MAX_KARTS; i++) {
      const slot = this.slots[i];
      const k = this.karts[i];
      if (slot.kind === 'bot') {
        const brain = this.brains[i] ?? (this.brains[i] = createBrain(BOT_SKILL[this.difficulty], this.rand));
        ctx.self = i;
        const input = k.finished
          ? { throttle: 0.4, steer: botInput(k, brain, ctx, dt).steer, drift: false }
          : botInput(k, brain, ctx, dt);
        const def = findKart(slot.kartId);
        const ev = stepKart(k, input, dt, geom, def.stats, this.botSpeedMul(i));
        this.relayStepEvents(i, ev);
        for (let j = 0; j < MAX_KARTS; j++) {
          if (j !== i && this.slots[j].kind !== 'empty') this.collide(i, j);
        }
        if (k.item && !k.finished && botUseItem(k, brain, k.item, ctx, dt)) this.useItem(i);
        this.checkPickup(i);
      } else if (slot.kind === 'human') {
        // Timers the race owns for a human kart; the rest arrives in reports.
        k.starTime = Math.max(0, k.starTime - dt);
        k.hitCooldown = Math.max(0, k.hitCooldown - dt);
        if (k.hitCooldown < HIT_COOLDOWN - 0.35) k.spinTime = Math.max(0, k.spinTime - dt);
      }
      if (slot.kind !== 'empty') this.updateProgress(i);
    }

    this.stepProjectiles(dt);
    this.stepTraps(dt);

    for (const b of this.boxes) {
      if (!b.active) {
        b.respawn -= dt;
        if (b.respawn <= 0) b.active = true;
      }
    }

    this.updateStandings();

    if (this.phase === 'racing') {
      if (this.finishers > 0) this.timer += dt;
      const humans = this.humans();
      const humansDone = humans.length > 0 && humans.every((i) => this.karts[i].finished);
      const everyoneDone = this.slots.every((s, i) => s.kind === 'empty' || this.karts[i].finished);
      if (everyoneDone || humansDone || (this.finishers > 0 && this.timer > FINISH_GRACE)) {
        if (this.resultsTimer < 0) this.resultsTimer = RESULTS_DELAY;
      }
      if (this.resultsTimer >= 0) {
        this.resultsTimer -= dt;
        if (this.resultsTimer <= 0) {
          // Anyone still out there gets ranked by where they are.
          for (let i = 0; i < MAX_KARTS; i++) {
            const k = this.karts[i];
            if (this.slots[i].kind !== 'empty' && !k.finished) {
              k.finished = true;
              k.finishTime = -1;
              k.place = ++this.finishers;
            }
          }
          this.phase = 'finished';
          this.events.push({ k: 'over' });
        }
      }
    }
  }

  private botSpeedMul(slot: number): number {
    let mul = BOT_SPEED[this.difficulty];
    // Rubber band against the best-placed human so the pack stays a pack.
    const humans = this.humans();
    if (humans.length === 0) return mul;
    let lead = -Infinity;
    for (const h of humans) lead = Math.max(lead, this.score(h));
    const gap = lead - this.score(slot);
    if (gap > 30) mul += Math.min(0.14, (gap - 30) / 400);
    else if (gap < -30) mul -= Math.min(0.1, (-gap - 30) / 400);
    return mul;
  }

  private relayStepEvents(slot: number, ev: KartStepEvent[]): void {
    for (const e of ev) {
      if (e.kind === 'driftBoost') this.events.push({ k: 'boost', slot, tier: e.tier });
      else if (e.kind === 'pad') this.events.push({ k: 'pad', slot });
    }
  }

  /** Bot-vs-anything contact. Humans handle their own side in their browser. */
  private collide(i: number, j: number): void {
    const a = this.karts[i];
    const b = this.karts[j];
    if (!pushApart(a, b)) return;
    if (b.starTime > 0 && a.starTime <= 0) this.hit(i, j, 'star');
  }

  /** Score along the race, in track units; higher is further ahead. */
  score(slot: number): number {
    const k = this.karts[slot];
    const L = this.geom.length;
    let rel = k.prog;
    if (k.next === 0 && k.prog > L / 2) rel = k.prog - L;
    else if (k.next === 1 && k.prog > L / 2) rel = 0;
    return k.lap * L + rel;
  }

  private updateProgress(slot: number): void {
    const k = this.karts[slot];
    if (k.finished) return;
    const geom = this.geom;
    const cp = geom.checkpoints[k.next];
    const moved = deltaS(geom, k.prevProg, k.prog);
    const toCp = deltaS(geom, k.prevProg, cp);
    if (moved > 0 && moved < 30 && toCp >= 0 && toCp <= moved) {
      if (k.next === 0) {
        k.lap++;
        if (k.lap > geom.def.laps) {
          k.finished = true;
          k.finishTime = this.time;
          k.place = ++this.finishers;
          this.events.push({ k: 'finish', slot, place: k.place, time: k.finishTime });
        } else {
          this.events.push({ k: 'lap', slot, lap: k.lap });
        }
      }
      k.next = (k.next + 1) % CHECKPOINT_COUNT;
    }
    const smp = geom.samples[k.index];
    const facing = angleDiff(k.heading, headingOf(smp.tx, smp.tz));
    k.wrongWayTime = Math.abs(facing) > 2.1 && k.speed > 4 ? k.wrongWayTime + 1 / 60 : 0;
  }

  private updateStandings(): void {
    const order = this.standings();
    order.forEach((slot, i) => {
      const k = this.karts[slot];
      if (!k.finished) k.place = i + 1;
    });
  }

  /** Slot indices from first to last. */
  standings(): number[] {
    const active: number[] = [];
    for (let i = 0; i < MAX_KARTS; i++) if (this.slots[i].kind !== 'empty') active.push(i);
    return active.sort((a, b) => {
      const ka = this.karts[a];
      const kb = this.karts[b];
      if (ka.finished && kb.finished) return ka.place - kb.place;
      if (ka.finished) return -1;
      if (kb.finished) return 1;
      return this.score(b) - this.score(a);
    });
  }

  // --- Reports from human drivers ------------------------------------------

  reportHuman(slot: number, kin: number[]): void {
    if (this.slots[slot].kind !== 'human') return;
    if (this.phase !== 'racing' && this.phase !== 'finished' && this.phase !== 'countdown') return;
    const k = this.karts[slot];
    // Right after we spun them, trust our own spin timer over a stale report.
    applyKinematics(k, kin, k.hitCooldown > HIT_COOLDOWN - 0.35);
    // Ignore teleports: a report more than a few metres from the last one
    // is a tampered or wildly lagging client. Keep the kart where it was.
    const loc = locate(this.geom, k.x, k.z, k.index);
    k.index = loc.index;
    k.prevProg = k.prog;
    k.prog = loc.s;
    k.lateral = loc.lateral;
  }

  requestPickup(slot: number, box: number): void {
    if (this.phase !== 'racing') return;
    const k = this.karts[slot];
    const b = this.boxes[box];
    const pos = this.geom.boxes[box];
    if (!b || !b.active || !pos || k.item || k.finished) return;
    if (Math.hypot(k.x - pos.x, k.z - pos.z) > BOX_RADIUS + 5) return;
    this.takeBox(slot, box);
  }

  private checkPickup(slot: number): void {
    if (this.phase !== 'racing') return;
    const k = this.karts[slot];
    if (k.item || k.finished) return;
    const boxes = this.geom.boxes;
    for (let i = 0; i < boxes.length; i++) {
      if (!this.boxes[i].active) continue;
      const b = boxes[i];
      if (Math.abs(deltaS(this.geom, b.s, k.prog)) > 4) continue;
      if (Math.hypot(k.x - b.x, k.z - b.z) < BOX_RADIUS) {
        this.takeBox(slot, i);
        return;
      }
    }
  }

  private takeBox(slot: number, box: number): void {
    this.boxes[box].active = false;
    this.boxes[box].respawn = BOX_RESPAWN;
    const k = this.karts[slot];
    const active = this.slots.filter((s) => s.kind !== 'empty').length;
    k.item = rollItem(k.place, active, this.rand);
    this.events.push({ k: 'box', box });
    this.events.push({ k: 'item', slot, item: k.item });
    const brain = this.brains[slot];
    if (brain) resetItemTimer(brain, this.rand);
  }

  useItem(slot: number): void {
    if (this.phase !== 'racing') return;
    const k = this.karts[slot];
    const item = k.item;
    if (!item || k.finished || k.spinTime > 0) return;
    k.item = null;
    this.events.push({ k: 'use', slot, item });
    switch (item) {
      case 'turbo':
        this.events.push({ k: 'boost', slot, tier: 4 });
        if (this.slots[slot].kind === 'bot') k.boostTime = Math.max(k.boostTime, TURBO_TIME);
        break;
      case 'star':
        k.starTime = STAR_TIME;
        this.events.push({ k: 'star', slot });
        break;
      case 'rocket': {
        const order = this.standings();
        const myIdx = order.indexOf(slot);
        const target = myIdx > 0 ? order[myIdx - 1] : -1;
        const p = pointAt(this.geom, k.prog + 2.5, k.lateral);
        this.projectiles.push({
          id: this.nextId++,
          owner: slot,
          target,
          x: p.x,
          z: p.z,
          heading: k.heading,
          s: k.prog + 2.5,
          lateral: k.lateral,
          life: ROCKET_LIFE,
          index: k.index,
        });
        break;
      }
      case 'bubble': {
        const p = pointAt(this.geom, k.prog - 2.8, k.lateral);
        this.traps.push({
          id: this.nextId++,
          owner: slot,
          x: p.x,
          z: p.z,
          s: k.prog - 2.8,
          lateral: k.lateral,
          life: TRAP_LIFE,
          armed: 1.0,
        });
        break;
      }
      case 'zap':
        for (let i = 0; i < MAX_KARTS; i++) {
          if (i !== slot && this.slots[i].kind !== 'empty' && !this.karts[i].finished) this.hit(i, slot, 'zap');
        }
        break;
    }
  }

  /** Knock a kart. Bots spin here; humans are told to spin themselves. */
  hit(slot: number, by: number, cause: 'rocket' | 'bubble' | 'zap' | 'star'): boolean {
    const k = this.karts[slot];
    if (k.starTime > 0 || k.hitCooldown > 0 || k.finished) return false;
    applySpin(k);
    this.events.push({ k: 'hit', slot, by, cause });
    return true;
  }

  private stepProjectiles(dt: number): void {
    const geom = this.geom;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      let speed = ROCKET_SPEED;
      if (p.target >= 0) {
        const t = this.karts[p.target];
        if (t.finished || this.slots[p.target].kind === 'empty') p.target = -1;
        else {
          const behind = deltaS(geom, p.s, t.prog);
          // Close in on the target's lane as it gets near.
          const w = Math.min(1, Math.max(0, 1 - behind / 40));
          p.lateral += (t.lateral - p.lateral) * Math.min(1, (0.8 + 4 * w) * dt);
          if (behind < 0 && behind > -6) speed = ROCKET_SPEED * 0.6;
        }
      } else {
        p.lateral += (0 - p.lateral) * Math.min(1, 0.5 * dt);
      }
      p.s += speed * dt;
      const pos = pointAt(geom, p.s, p.lateral);
      p.heading = Math.atan2(pos.x - p.x, pos.z - p.z);
      p.x = pos.x;
      p.z = pos.z;

      let popped = p.life <= 0;
      for (let j = 0; j < MAX_KARTS && !popped; j++) {
        if (this.slots[j].kind === 'empty') continue;
        if (j === p.owner && p.life > ROCKET_LIFE - 0.5) continue;
        const k = this.karts[j];
        if (Math.hypot(k.x - p.x, k.z - p.z) < ROCKET_HIT_RADIUS) {
          this.hit(j, p.owner, 'rocket');
          popped = true;
        }
      }
      if (popped) {
        this.events.push({ k: 'rocketPop', x: p.x, z: p.z });
        this.projectiles.splice(i, 1);
      }
    }
  }

  private stepTraps(dt: number): void {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      t.life -= dt;
      t.armed = Math.max(0, t.armed - dt);
      let popped = t.life <= 0;
      for (let j = 0; j < MAX_KARTS && !popped; j++) {
        if (this.slots[j].kind === 'empty') continue;
        if (j === t.owner && t.armed > 0) continue;
        const k = this.karts[j];
        if (Math.hypot(k.x - t.x, k.z - t.z) < TRAP_HIT_RADIUS + KART_RADIUS * 0.3) {
          if (k.starTime > 0) popped = true;
          else if (this.hit(j, t.owner, 'bubble')) popped = true;
        }
      }
      if (popped) {
        this.events.push({ k: 'trapPop', x: t.x, z: t.z });
        this.traps.splice(i, 1);
      }
    }
  }

  kartDef(slot: number): KartDef {
    return findKart(this.slots[slot].kartId);
  }
}

export { BASE_MAX_SPEED, SPIN_TIME };
