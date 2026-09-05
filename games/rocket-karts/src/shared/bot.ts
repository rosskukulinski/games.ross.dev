/**
 * Bot driver. Follows the centreline with a look-ahead point, picks a lane,
 * drifts through bends and uses items with a little delay so it looks like it
 * is thinking. Skill (0..1) scales how tidy the line is.
 */
import { type KartInput, type KartState, BASE_MAX_SPEED, DRIFT_MIN_SPEED } from './kart.ts';
import { type TrackGeom, angleDiff, clamp, deltaS, pointAt, sampleAt } from './track.ts';
import type { ItemId } from './items.ts';

export interface BotBrain {
  lane: number;
  laneTimer: number;
  itemTimer: number;
  wobble: number;
  wobbleTimer: number;
  skill: number;
  driftHold: number;
  stuckTime: number;
  reverseTime: number;
}

export interface BotContext {
  geom: TrackGeom;
  traps: { x: number; z: number; s: number; lateral: number }[];
  karts: KartState[];
  self: number;
  rand: () => number;
}

export function createBrain(skill: number, rand: () => number): BotBrain {
  return {
    lane: (rand() - 0.5) * 0.5,
    laneTimer: 2 + rand() * 4,
    itemTimer: 0,
    wobble: 0,
    wobbleTimer: 0,
    skill,
    driftHold: 0,
    stuckTime: 0,
    reverseTime: 0,
  };
}

export function botInput(k: KartState, b: BotBrain, ctx: BotContext, dt: number): KartInput {
  const { geom, rand } = ctx;
  const halfW = geom.def.width / 2;

  b.laneTimer -= dt;
  if (b.laneTimer <= 0) {
    b.laneTimer = 3 + rand() * 5;
    b.lane = (rand() - 0.5) * 0.6;
  }
  b.wobbleTimer -= dt;
  if (b.wobbleTimer <= 0) {
    b.wobbleTimer = 0.4 + rand() * 0.6;
    b.wobble = (rand() - 0.5) * (1 - b.skill) * 0.5;
  }

  // Stuck against a barrier? Back up briefly, then carry on.
  if (b.reverseTime > 0) {
    b.reverseTime -= dt;
    return { throttle: -1, steer: -Math.sign(k.lateral) * 0.6, drift: false };
  }
  if (k.speed < 3 && k.spinTime <= 0 && k.lap + k.next > 0) {
    b.stuckTime += dt;
    if (b.stuckTime > 1.4) {
      b.stuckTime = 0;
      b.reverseTime = 0.8;
    }
  } else {
    b.stuckTime = 0;
  }

  // Lane, nudged away from any trap in the road ahead.
  let lane = b.lane;
  for (const t of ctx.traps) {
    const ahead = deltaS(geom, k.prog, t.s);
    if (ahead > 0 && ahead < 16) {
      const tl = t.lateral / halfW;
      if (Math.abs(tl - lane) < 0.35) lane = tl > 0 ? tl - 0.5 : tl + 0.5;
    }
  }
  lane = clamp(lane, -0.62, 0.62);

  const look = 7 + Math.abs(k.speed) * 0.34;
  const target = pointAt(geom, k.prog + look, lane * halfW);
  const want = Math.atan2(target.x - k.x, target.z - k.z);
  const diff = angleDiff(want, k.heading);
  let steer = clamp(diff / 0.55, -1, 1) + b.wobble;

  // Bend coming up: drift into it when fast enough.
  const bend = sampleAt(geom, k.prog + look * 1.4).curvature;
  const sharp = Math.abs(bend) > 0.028;
  let drift = false;
  if (k.drift !== 0) {
    b.driftHold -= dt;
    const stillTurning = Math.sign(diff) === k.drift && Math.abs(diff) > 0.08;
    drift = b.driftHold > 0 || stillTurning;
    if (drift) steer = clamp(steer + k.drift * 0.35, -1, 1);
  } else if (sharp && k.speed > DRIFT_MIN_SPEED * 1.05 && Math.abs(steer) > 0.45 && Math.sign(steer) === Math.sign(bend)) {
    drift = rand() < 0.55 + b.skill * 0.45;
    b.driftHold = 0.5 + rand() * 0.5;
  }

  let throttle = 1;
  const verySharp = Math.abs(sampleAt(geom, k.prog + look * 0.8).curvature) > 0.05;
  if (verySharp && k.speed > BASE_MAX_SPEED * 0.72 && k.boostTime <= 0) throttle = 0.35;

  return { throttle, steer: clamp(steer, -1, 1), drift };
}

/** Decide whether a held item should be used this tick. */
export function botUseItem(k: KartState, b: BotBrain, item: ItemId, ctx: BotContext, dt: number): boolean {
  b.itemTimer -= dt;
  if (b.itemTimer > 0) return false;
  const straight = Math.abs(sampleAt(ctx.geom, k.prog + 10).curvature) < 0.012;
  const anyoneAhead = ctx.karts.some((o, i) => i !== ctx.self && o.place < k.place);
  switch (item) {
    case 'turbo':
      return straight && k.boostTime <= 0;
    case 'rocket':
      return anyoneAhead;
    case 'bubble':
      return true;
    case 'star':
      return true;
    case 'zap':
      return true;
  }
}

export function resetItemTimer(b: BotBrain, rand: () => number): void {
  b.itemTimer = 1.2 + rand() * 2.5;
}
