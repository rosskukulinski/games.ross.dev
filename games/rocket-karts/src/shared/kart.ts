/**
 * Kart handling. A pure fixed-step function of (state, input) so the same
 * code drives the local player, the bots on the server and the bots in-page.
 *
 * Numbers are tuned by feel for a family arcade: forgiving off-road, generous
 * drift windows, boosts that feel big.
 */
import { type TrackGeom, PAD_LENGTH, clamp, deltaS, headingOf, lerpAngle, locate } from './track.ts';
import type { KartStats } from './karts.ts';
import type { ItemId } from './items.ts';

export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;

export const BASE_MAX_SPEED = 30;
export const ACCEL = 15;
export const BRAKE = 30;
export const COAST_DRAG = 7;
export const REVERSE_MAX = 7;
export const TURN_RATE = 2.3;
export const DRIFT_TIERS = [0.75, 1.6, 2.6];
export const DRIFT_BOOSTS = [0.6, 1.0, 1.5];
export const DRIFT_MIN_SPEED = 0.45 * BASE_MAX_SPEED;
export const OFFROAD_SPEED_FRAC = 0.5;
export const BOOST_SPEED_FRAC = 1.32;
export const STAR_SPEED_FRAC = 1.18;
export const SPIN_TIME = 1.15;
export const HIT_COOLDOWN = 1.7;
export const KART_RADIUS = 0.95;
export const SLIDE_ANGLE = 0.32;
export const PAD_BOOST = 0.9;

export interface KartInput {
  /** -1 (brake/reverse) .. 1 (accelerate). */
  throttle: number;
  /** -1 (left) .. 1 (right). */
  steer: number;
  drift: boolean;
}

export const IDLE_INPUT: KartInput = { throttle: 0, steer: 0, drift: false };

export interface KartState {
  x: number;
  z: number;
  heading: number;
  speed: number;
  /** Smoothed steering for the front wheels, -1..1. */
  steer: number;
  /** 0 when not drifting, otherwise the direction (-1 left, 1 right). */
  drift: number;
  driftCharge: number;
  boostTime: number;
  spinTime: number;
  spinDir: number;
  starTime: number;
  bumpTime: number;
  offroad: boolean;

  // --- Race bookkeeping (owned by the race, not the driver) ---
  /** Closest track sample; a hint for the next lookup. */
  index: number;
  /** Distance along the lap. */
  prog: number;
  prevProg: number;
  lateral: number;
  /** Laps started: 0 before the first crossing of the line, 1 on lap one. */
  lap: number;
  /** Index of the next checkpoint to cross. */
  next: number;
  wrongWayTime: number;
  item: ItemId | null;
  finished: boolean;
  finishTime: number;
  /** 1-based standing. */
  place: number;
  hitCooldown: number;
  padCooldown: number;
}

export type KartStepEvent =
  | { kind: 'driftBoost'; tier: number }
  | { kind: 'pad' }
  | { kind: 'bump' }
  | { kind: 'driftStart' };

export function createKart(): KartState {
  return {
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    steer: 0,
    drift: 0,
    driftCharge: 0,
    boostTime: 0,
    spinTime: 0,
    spinDir: 1,
    starTime: 0,
    bumpTime: 0,
    offroad: false,
    index: -1,
    prog: 0,
    prevProg: 0,
    lateral: 0,
    lap: 0,
    next: 0,
    wrongWayTime: 0,
    item: null,
    finished: false,
    finishTime: 0,
    place: 1,
    hitCooldown: 0,
    padCooldown: 0,
  };
}

export function driftTier(charge: number): number {
  let tier = 0;
  for (const t of DRIFT_TIERS) if (charge >= t) tier++;
  return tier;
}

function releaseDrift(k: KartState, events: KartStepEvent[]): void {
  const tier = driftTier(k.driftCharge);
  if (tier > 0) {
    k.boostTime = Math.max(k.boostTime, DRIFT_BOOSTS[tier - 1]);
    events.push({ kind: 'driftBoost', tier });
  }
  k.drift = 0;
  k.driftCharge = 0;
}

export function maxSpeedFor(k: KartState, stats: KartStats, speedMul: number): number {
  let max = BASE_MAX_SPEED * stats.speed * speedMul;
  if (k.boostTime > 0) max *= BOOST_SPEED_FRAC;
  else if (k.starTime > 0) max *= STAR_SPEED_FRAC;
  else if (k.offroad) max *= OFFROAD_SPEED_FRAC;
  return max;
}

/**
 * Advance one kart by `dt`. `speedMul` is the race's rubber-band factor for
 * bots (1 for humans).
 */
export function stepKart(
  k: KartState,
  input: KartInput,
  dt: number,
  geom: TrackGeom,
  stats: KartStats,
  speedMul = 1
): KartStepEvent[] {
  const events: KartStepEvent[] = [];

  k.hitCooldown = Math.max(0, k.hitCooldown - dt);
  k.padCooldown = Math.max(0, k.padCooldown - dt);
  k.bumpTime = Math.max(0, k.bumpTime - dt);
  k.starTime = Math.max(0, k.starTime - dt);
  k.boostTime = Math.max(0, k.boostTime - dt);

  const halfW = geom.def.width / 2;
  let loc = locate(geom, k.x, k.z, k.index);
  k.index = loc.index;
  k.lateral = loc.lateral;
  k.offroad = Math.abs(loc.lateral) > halfW;

  const boosted = k.boostTime > 0;
  const maxSpeed = maxSpeedFor(k, stats, speedMul);

  if (k.spinTime > 0) {
    k.spinTime = Math.max(0, k.spinTime - dt);
    k.speed *= Math.exp(-3.5 * dt);
    k.drift = 0;
    k.driftCharge = 0;
  } else {
    // --- Throttle ---
    const accel = ACCEL * stats.accel;
    if (boosted) {
      k.speed = Math.min(maxSpeed, k.speed + accel * 2.2 * dt);
    } else if (input.throttle > 0.05) {
      if (k.speed < maxSpeed) k.speed = Math.min(maxSpeed, k.speed + accel * input.throttle * dt);
    } else if (input.throttle < -0.05) {
      if (k.speed > 0.5) k.speed = Math.max(0, k.speed - BRAKE * dt);
      else k.speed = Math.max(-REVERSE_MAX, k.speed - accel * 0.6 * dt);
    } else {
      const drag = Math.min(Math.abs(k.speed), COAST_DRAG * dt);
      k.speed -= Math.sign(k.speed) * drag;
    }
    if (k.speed > maxSpeed) {
      // Over the limit (boost ended, drove onto grass): bleed off smoothly.
      k.speed = Math.max(maxSpeed, k.speed - (k.speed - maxSpeed) * Math.min(1, 2.5 * dt) - 4 * dt);
    }

    // --- Steering & drift ---
    const frac = Math.abs(k.speed) / BASE_MAX_SPEED;
    const f = Math.min(1, frac * 2.6) * (1 - 0.3 * clamp((frac - 0.7) / 0.6, 0, 1));
    let turn = 0;
    if (k.drift === 0) {
      turn = TURN_RATE * stats.handling * input.steer * f;
      if (input.drift && k.speed > DRIFT_MIN_SPEED && Math.abs(input.steer) > 0.25) {
        k.drift = input.steer > 0 ? 1 : -1;
        k.driftCharge = 0;
        events.push({ kind: 'driftStart' });
      }
    } else if (!input.drift || k.speed < DRIFT_MIN_SPEED * 0.6) {
      releaseDrift(k, events);
      turn = TURN_RATE * stats.handling * input.steer * f;
    } else {
      const into = clamp(input.steer * k.drift, -1, 1);
      k.driftCharge += dt * (0.6 + 0.7 * Math.max(0, into));
      turn = k.drift * TURN_RATE * stats.handling * f * (0.65 + 0.85 * (0.5 + 0.5 * into));
      k.speed -= 1.2 * dt;
    }
    if (k.speed < 0) turn = -turn * 0.7;
    k.heading += turn * dt;
  }

  // --- Move ---
  const slide = k.drift * SLIDE_ANGLE * Math.min(1, 0.4 + k.driftCharge);
  const dir = k.heading - slide;
  k.x += Math.sin(dir) * k.speed * dt;
  k.z += Math.cos(dir) * k.speed * dt;

  // --- Barrier ---
  loc = locate(geom, k.x, k.z, k.index);
  k.index = loc.index;
  k.prevProg = k.prog;
  k.prog = loc.s;
  k.lateral = loc.lateral;
  const limit = halfW + geom.def.shoulder;
  if (Math.abs(loc.lateral) > limit) {
    const smp = geom.samples[loc.index];
    const sign = loc.lateral > 0 ? 1 : -1;
    const push = Math.abs(loc.lateral) - limit;
    k.x -= smp.nx * sign * push;
    k.z -= smp.nz * sign * push;
    k.lateral = sign * limit;
    const tangent = headingOf(smp.tx, smp.tz);
    if (k.bumpTime <= 0) {
      k.speed *= 0.55;
      k.bumpTime = 0.35;
      k.drift = 0;
      k.driftCharge = 0;
      events.push({ kind: 'bump' });
    }
    k.heading = lerpAngle(k.heading, tangent, Math.min(1, 6 * dt));
  }
  k.offroad = Math.abs(k.lateral) > halfW;

  // --- Boost pads ---
  if (k.padCooldown <= 0 && k.speed > 2) {
    for (const pad of geom.pads) {
      const ds = deltaS(geom, pad.s, k.prog);
      if (Math.abs(ds) < PAD_LENGTH / 2 + 0.6 && Math.abs(k.lateral) < pad.halfWidth) {
        k.boostTime = Math.max(k.boostTime, PAD_BOOST);
        k.padCooldown = 1.0;
        events.push({ kind: 'pad' });
        break;
      }
    }
  }

  k.steer += (input.steer - k.steer) * Math.min(1, 14 * dt);
  return events;
}

/** Nudge `k` out of `other`. Only `k` moves, so remote karts stay where their owner put them. */
export function pushApart(k: KartState, other: KartState): boolean {
  const dx = k.x - other.x;
  const dz = k.z - other.z;
  const d = Math.hypot(dx, dz);
  const min = KART_RADIUS * 2;
  if (d >= min || d < 1e-4) return false;
  const overlap = min - d;
  k.x += (dx / d) * overlap * 0.5;
  k.z += (dz / d) * overlap * 0.5;
  if (k.bumpTime <= 0) {
    k.speed *= 0.88;
    k.bumpTime = 0.25;
  }
  return true;
}

export function applySpin(k: KartState): void {
  k.spinTime = SPIN_TIME;
  k.spinDir = k.steer >= 0 ? 1 : -1;
  k.speed *= 0.3;
  k.drift = 0;
  k.driftCharge = 0;
  k.boostTime = 0;
  k.hitCooldown = HIT_COOLDOWN;
}

/** The fields a driver reports to the race about its own kart. */
export function encodeKinematics(k: KartState): number[] {
  return [
    round(k.x, 3),
    round(k.z, 3),
    round(k.heading, 4),
    round(k.speed, 3),
    round(k.steer, 2),
    k.drift,
    round(k.driftCharge, 2),
    round(k.boostTime, 2),
    round(k.spinTime, 2),
    k.offroad ? 1 : 0,
  ];
}

export function isKinematics(v: unknown): v is number[] {
  return Array.isArray(v) && v.length === 10 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

export function applyKinematics(k: KartState, kin: number[], keepSpin: boolean): void {
  k.x = kin[0];
  k.z = kin[1];
  k.heading = kin[2];
  k.speed = kin[3];
  k.steer = kin[4];
  k.drift = kin[5] > 0 ? 1 : kin[5] < 0 ? -1 : 0;
  k.driftCharge = kin[6];
  k.boostTime = kin[7];
  if (!keepSpin) k.spinTime = kin[8];
  k.offroad = kin[9] === 1;
}

function round(v: number, places: number): number {
  const m = 10 ** places;
  return Math.round(v * m) / m;
}
