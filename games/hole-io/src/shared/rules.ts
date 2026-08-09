/**
 * Authoritative hole-eats-everything simulation.
 *
 * This module is imported by BOTH:
 *   - the game client (`games/hole-io`) for solo play (with bots) and for
 *     predicting the local hole during online play, and
 *   - the Cloudflare Durable Object (`multiplayer-server`) that hosts online
 *     arenas.
 *
 * It therefore has to stay dependency-free and side-effect-free. It lives
 * inside the game directory (rather than next to the worker) so that editing
 * the rules correctly invalidates the monorepo build cache, which only hashes
 * `games/<slug>/`.
 *
 * The arena is deterministic from a seed: the server sends the seed once and
 * both sides generate the identical prop layout. After that only prop ids
 * cross the wire (eat / regrow events), never prop positions.
 */

// --- Arena geometry (arbitrary units; the client scales to pixels) ---------

export const WORLD_W = 1600;
export const WORLD_H = 1600;

export const TICK_RATE = 30;
export const TICK_DT = 1 / TICK_RATE;

/** Humans allowed in one room. Bots top the arena up to TARGET_POPULATION. */
export const MAX_HUMANS = 8;
export const TARGET_POPULATION = 6;

export const HOLE_BASE_R = 11;
export const HOLE_MAX_R = 112;

export const ROUND_TIME = 120;

// --- Tuning ----------------------------------------------------------------

const MOVE_SPEED = 138; // units/s at base radius
const SPEED_FALLOFF = 0.32; // exponent — bigger holes move slower
const GROWTH_POINTS = 30; // points that meaningfully grow the hole
const GROWTH_EXP = 0.5;
const GROW_SMOOTH = 4; // 1/s — drawn radius eases toward the score's radius

const EAT_RATIO = 0.82; // a prop must be at most this fraction of the hole radius
const MOUTH_RATIO = 0.8; // ...with its centre this far inside the rim
const SWALLOW_RATIO = 1.22; // radius advantage needed to swallow another hole
const SWALLOW_REACH = 0.68; // victim centre must be this deep inside the eater

const COUNTDOWN_TIME = 3;
const OVER_TIME = 9;
const RESPAWN_TIME = 2.6;
const INVULN_TIME = 3; // spawn protection, so a respawn is never instantly re-eaten

const PROP_RESPAWN_BASE = 16; // seconds; + points, so towers stay gone a while

// Bots are tuned to lose gracefully — the youngest player here is five. They
// move slower than humans, react on a lazy clock, misjudge threats, and pick
// good-enough snacks rather than optimal ones.
const BOT_SPEED = 0.8; // fraction of human speed — a hungry kid can run one down
const BOT_THINK_TIME = 0.5; // seconds between bot decisions (plus jitter)
const BOT_FLEE_RADIUS = 190; // how close a bigger hole gets before they notice
const BOT_FLEE_MISS = 0.25; // chance a think tick fails to spot the danger
const BOT_DAWDLE = 0.15; // chance to just wander off mid-plan
const BOT_CHASE_CHANCE = 0.3;
const BOT_CHASE_RADIUS = 280;
const BOT_GRAZE_RADIUS = 340;

// --- Phases ----------------------------------------------------------------

export const PHASE_WAITING = 0;
export const PHASE_COUNTDOWN = 1;
export const PHASE_PLAY = 2;
export const PHASE_OVER = 3;

export type Phase =
  | typeof PHASE_WAITING
  | typeof PHASE_COUNTDOWN
  | typeof PHASE_PLAY
  | typeof PHASE_OVER;

// --- Props -----------------------------------------------------------------

export interface PropKind {
  name: string;
  r: number;
  points: number;
  /** How many the generator scatters around the arena. */
  count: number;
}

/** Ordered small → large. The index into this array is the prop's `kind`. */
export const PROP_KINDS: PropKind[] = [
  { name: 'flower', r: 4, points: 1, count: 170 },
  { name: 'mushroom', r: 4.6, points: 1, count: 80 },
  { name: 'cone', r: 5.6, points: 2, count: 64 },
  { name: 'hydrant', r: 6.4, points: 3, count: 48 },
  { name: 'bush', r: 8.4, points: 4, count: 64 },
  { name: 'bench', r: 10.5, points: 6, count: 40 },
  { name: 'car', r: 13.5, points: 10, count: 48 },
  { name: 'tree', r: 16, points: 12, count: 44 },
  { name: 'house', r: 24, points: 25, count: 18 },
  { name: 'tower', r: 32, points: 45, count: 9 },
  { name: 'grand', r: 44, points: 80, count: 5 },
  { name: 'colossus', r: 60, points: 150, count: 3 },
];

/** Small tiers spawn in clumps — flower fields and cone rows, not confetti. */
const CLUSTERED_KINDS = new Set([0, 1, 2, 3]);

export interface Prop {
  id: number;
  kind: number;
  x: number;
  y: number;
  alive: boolean;
  /** Seconds until it regrows; only meaningful while dead. */
  respawn: number;
}

/** Deterministic PRNG so both sides generate the same arena from one seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Scatter the props. Large kinds are placed first so they always find room;
 * everything keeps a little breathing space from its neighbours and the edge.
 */
export function generateProps(seed: number): Prop[] {
  const rng = mulberry32(seed);
  const props: Prop[] = [];

  const kindOrder = PROP_KINDS.map((_, i) => i).sort(
    (a, b) => PROP_KINDS[b].r - PROP_KINDS[a].r
  );

  const fits = (kind: number, x: number, y: number): boolean => {
    const def = PROP_KINDS[kind];
    for (const other of props) {
      const gap = def.r + PROP_KINDS[other.kind].r + (CLUSTERED_KINDS.has(kind) ? 4 : 10);
      const dx = x - other.x;
      const dy = y - other.y;
      if (dx * dx + dy * dy < gap * gap) return false;
    }
    return true;
  };

  for (const kind of kindOrder) {
    const def = PROP_KINDS[kind];
    const margin = def.r + 26;
    const span = (v: number): number => margin + v * (WORLD_W - margin * 2);

    if (CLUSTERED_KINDS.has(kind)) {
      // Clumps of 4–8 around shared centres.
      let placed = 0;
      let guard = 0;
      while (placed < def.count && guard++ < def.count * 4) {
        const cx = span(rng());
        const cy = span(rng());
        const n = Math.min(def.count - placed, 4 + Math.floor(rng() * 5));
        for (let i = 0; i < n; i++) {
          for (let attempt = 0; attempt < 10; attempt++) {
            const a = rng() * Math.PI * 2;
            const d = rng() * 52;
            const x = clamp(cx + Math.cos(a) * d, margin, WORLD_W - margin);
            const y = clamp(cy + Math.sin(a) * d, margin, WORLD_H - margin);
            if (fits(kind, x, y)) {
              props.push({ id: 0, kind, x, y, alive: true, respawn: 0 });
              placed++;
              break;
            }
          }
        }
      }
      continue;
    }

    for (let n = 0; n < def.count; n++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const x = span(rng());
        const y = span(rng());
        if (fits(kind, x, y)) {
          props.push({ id: 0, kind, x, y, alive: true, respawn: 0 });
          break;
        }
      }
      // A spot that never cleared 30 attempts is simply skipped; the arena is
      // roomy enough that this is rare and invisible.
    }
  }

  // Ids are positions in the final array — both sides derive the same list.
  for (let i = 0; i < props.length; i++) props[i].id = i;
  return props;
}

// --- Holes -----------------------------------------------------------------

export interface Hole {
  id: number;
  x: number;
  y: number;
  /** Input direction; magnitude 0..1. */
  ix: number;
  iy: number;
  score: number;
  /** Drawn radius — eases toward radiusForScore(score). */
  r: number;
  alive: boolean;
  /** Seconds until respawn; only meaningful while dead. */
  respawn: number;
  /** Seconds of spawn protection left. */
  invuln: number;
  bot: boolean;
  // Bot brain (only the simulation host reads these).
  botTimer: number;
  botTx: number;
  botTy: number;
}

export const BOT_NAMES = [
  'Munchy',
  'Gobbles',
  'Chompy',
  'Nibbles',
  'Snacko',
  'Gulp',
  'Vortexa',
  'Pittle',
];

export function radiusForScore(score: number): number {
  const r = HOLE_BASE_R * Math.pow(1 + score / GROWTH_POINTS, GROWTH_EXP);
  return r < HOLE_MAX_R ? r : HOLE_MAX_R;
}

export function moveSpeed(r: number): number {
  return MOVE_SPEED * Math.pow(HOLE_BASE_R / r, SPEED_FALLOFF);
}

/** Can a hole of radius `holeR` eat a prop of this kind at all? */
export function canEatKind(holeR: number, kind: number): boolean {
  return PROP_KINDS[kind].r <= holeR * EAT_RATIO;
}

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

function clampToWorld(hole: { x: number; y: number; r: number }): void {
  hole.x = clamp(hole.x, hole.r, WORLD_W - hole.r);
  hole.y = clamp(hole.y, hole.r, WORLD_H - hole.r);
}

/**
 * Advance a hole one step under the same speed rule the server applies. The
 * client uses this to draw its own hole immediately instead of waiting a
 * round trip.
 */
export function advanceHole(
  cur: { x: number; y: number },
  r: number,
  ix: number,
  iy: number,
  dt: number
): { x: number; y: number } {
  const mag = Math.hypot(ix, iy);
  const k = mag > 1 ? 1 / mag : 1;
  const speed = moveSpeed(r);
  const next = { x: cur.x + ix * k * speed * dt, y: cur.y + iy * k * speed * dt, r };
  clampToWorld(next);
  return { x: next.x, y: next.y };
}

// --- World -----------------------------------------------------------------

export interface World {
  seed: number;
  props: Prop[];
  holes: Hole[];
  phase: Phase;
  /** Seconds left in the current phase. */
  timer: number;
  tick: number;
  /** Highest score reached at the last round end (for the client's records). */
  round: number;
}

export type StepEvent =
  | { kind: 'eat'; p: number; h: number; pts: number }
  | { kind: 'swallow'; a: number; b: number; pts: number }
  | { kind: 'spawn'; h: number }
  | { kind: 'prop'; p: number }
  | { kind: 'over'; winner: number }
  | { kind: 'round' };

export function createWorld(seed: number): World {
  return {
    seed,
    props: generateProps(seed),
    holes: [],
    phase: PHASE_WAITING,
    timer: 0,
    tick: 0,
    round: 0,
  };
}

/** Pick a spawn spot far from every living hole (especially the big ones). */
function spawnPosition(world: World, rand: () => number): { x: number; y: number } {
  const margin = 90;
  let best = { x: WORLD_W / 2, y: WORLD_H / 2 };
  let bestScore = -Infinity;
  for (let i = 0; i < 14; i++) {
    const x = margin + rand() * (WORLD_W - margin * 2);
    const y = margin + rand() * (WORLD_H - margin * 2);
    let nearest = Infinity;
    for (const h of world.holes) {
      if (!h.alive) continue;
      const d = Math.hypot(x - h.x, y - h.y) - h.r;
      if (d < nearest) nearest = d;
    }
    if (nearest > bestScore) {
      bestScore = nearest;
      best = { x, y };
    }
  }
  return best;
}

export function addHole(world: World, id: number, bot: boolean): Hole {
  const pos = spawnPosition(world, Math.random);
  const hole: Hole = {
    id,
    x: pos.x,
    y: pos.y,
    ix: 0,
    iy: 0,
    score: 0,
    r: HOLE_BASE_R,
    alive: true,
    respawn: 0,
    invuln: INVULN_TIME,
    bot,
    botTimer: 0,
    botTx: pos.x,
    botTy: pos.y,
  };
  world.holes.push(hole);
  return hole;
}

export function removeHole(world: World, id: number): void {
  const idx = world.holes.findIndex((h) => h.id === id);
  if (idx !== -1) world.holes.splice(idx, 1);
}

export function getHole(world: World, id: number): Hole | undefined {
  return world.holes.find((h) => h.id === id);
}

/** Record a player's requested movement direction (magnitude clamped to 1). */
export function setHoleInput(world: World, id: number, ix: number, iy: number): void {
  const hole = getHole(world, id);
  if (!hole) return;
  if (!Number.isFinite(ix) || !Number.isFinite(iy)) return;
  const mag = Math.hypot(ix, iy);
  const k = mag > 1 ? 1 / mag : 1;
  hole.ix = ix * k;
  hole.iy = iy * k;
}

export function beginCountdown(world: World): void {
  world.phase = PHASE_COUNTDOWN;
  world.timer = COUNTDOWN_TIME;
}

/** Fresh round: everything regrows, every hole shrinks back and respawns. */
export function resetRound(world: World): void {
  for (const prop of world.props) {
    prop.alive = true;
    prop.respawn = 0;
  }
  for (const hole of world.holes) {
    hole.score = 0;
    hole.r = HOLE_BASE_R;
    hole.alive = true;
    hole.respawn = 0;
    hole.invuln = INVULN_TIME;
    hole.ix = 0;
    hole.iy = 0;
    const pos = spawnPosition(world, Math.random);
    hole.x = pos.x;
    hole.y = pos.y;
    hole.botTimer = 0;
  }
  world.round++;
  beginCountdown(world);
}

// --- Bots ------------------------------------------------------------------

/**
 * One brain, three instincts, in priority order: run from anything that can
 * swallow you, chase anything you can swallow, otherwise graze good-enough
 * nearby food. Deliberately fallible — see the BOT_* tuning above.
 */
function thinkBot(world: World, bot: Hole): void {
  bot.botTimer = BOT_THINK_TIME + Math.random() * 0.4;

  // Flee: sum of directions away from every nearby bigger hole. Sometimes
  // they simply fail to look over their shoulder.
  let fleeX = 0;
  let fleeY = 0;
  let threatened = false;
  if (Math.random() >= BOT_FLEE_MISS) {
    for (const other of world.holes) {
      if (other === bot || !other.alive) continue;
      if (other.r < bot.r * SWALLOW_RATIO) continue;
      const dx = bot.x - other.x;
      const dy = bot.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d > other.r + BOT_FLEE_RADIUS || d < 0.001) continue;
      threatened = true;
      const w = 1 / Math.max(30, d);
      fleeX += (dx / d) * w;
      fleeY += (dy / d) * w;
    }
  }
  if (threatened) {
    const d = Math.hypot(fleeX, fleeY) || 1;
    // Aim well past the escape direction, nudged toward the arena centre so a
    // cornered bot slides out along the wall instead of pinning itself.
    const cx = (WORLD_W / 2 - bot.x) * 0.0012;
    const cy = (WORLD_H / 2 - bot.y) * 0.0012;
    bot.botTx = bot.x + (fleeX / d + cx) * 340;
    bot.botTy = bot.y + (fleeY / d + cy) * 340;
    return;
  }

  // Sometimes a bot just... wanders off. Openings like this are how a kid
  // lines up their first swallow.
  if (Math.random() < BOT_DAWDLE) {
    bot.botTx = 100 + Math.random() * (WORLD_W - 200);
    bot.botTy = 100 + Math.random() * (WORLD_H - 200);
    return;
  }

  // Chase: nearest clearly-smaller hole. Kept half-hearted on purpose — bots
  // that hunt relentlessly snowball into unbeatable monsters within a round.
  let prey: Hole | null = null;
  let preyDist = BOT_CHASE_RADIUS;
  for (const other of world.holes) {
    if (other === bot || !other.alive || other.invuln > 0) continue;
    if (bot.r < other.r * SWALLOW_RATIO * 1.15) continue;
    const d = Math.hypot(bot.x - other.x, bot.y - other.y);
    if (d < preyDist) {
      preyDist = d;
      prey = other;
    }
  }
  if (prey && Math.random() < BOT_CHASE_CHANCE) {
    bot.botTx = prey.x;
    bot.botTy = prey.y;
    return;
  }

  // Graze: a good-enough nearby prop — the value estimate is noisy, so bots
  // routinely trundle past the optimal snack.
  let best: Prop | null = null;
  let bestValue = 0;
  for (const prop of world.props) {
    if (!prop.alive) continue;
    if (!canEatKind(bot.r * 0.97, prop.kind)) continue;
    const d = Math.hypot(bot.x - prop.x, bot.y - prop.y);
    if (d > BOT_GRAZE_RADIUS) continue;
    const value = (PROP_KINDS[prop.kind].points / (d + 30)) * (0.6 + Math.random() * 0.8);
    if (value > bestValue) {
      bestValue = value;
      best = prop;
    }
  }
  if (best) {
    bot.botTx = best.x;
    bot.botTy = best.y;
    return;
  }

  // Wander.
  bot.botTx = 100 + Math.random() * (WORLD_W - 200);
  bot.botTy = 100 + Math.random() * (WORLD_H - 200);
}

function driveBots(world: World, dt: number): void {
  for (const bot of world.holes) {
    if (!bot.bot || !bot.alive) continue;
    bot.botTimer -= dt;
    const dx = bot.botTx - bot.x;
    const dy = bot.botTy - bot.y;
    const d = Math.hypot(dx, dy);
    if (bot.botTimer <= 0 || d < 24) thinkBot(world, bot);
    if (d > 0.001) {
      // Bots never move at full human speed — see BOT_SPEED.
      bot.ix = (dx / d) * BOT_SPEED;
      bot.iy = (dy / d) * BOT_SPEED;
    } else {
      bot.ix = 0;
      bot.iy = 0;
    }
  }
}

// --- Simulation step -------------------------------------------------------

/**
 * Advance the world by `dt` seconds and return everything worth showing or
 * hearing. Safe to call with a fixed TICK_DT from either host.
 */
export function step(world: World, dt: number): StepEvent[] {
  const events: StepEvent[] = [];
  world.tick++;

  if (world.phase === PHASE_WAITING) return events;

  if (world.phase === PHASE_COUNTDOWN) {
    world.timer -= dt;
    if (world.timer <= 0) {
      world.phase = PHASE_PLAY;
      world.timer = ROUND_TIME;
    }
  } else if (world.phase === PHASE_PLAY) {
    world.timer -= dt;
    if (world.timer <= 0) {
      world.phase = PHASE_OVER;
      world.timer = OVER_TIME;
      let winner = -1;
      let bestScore = -1;
      for (const hole of world.holes) {
        if (hole.score > bestScore) {
          bestScore = hole.score;
          winner = hole.id;
        }
      }
      events.push({ kind: 'over', winner });
      return events;
    }
  } else if (world.phase === PHASE_OVER) {
    world.timer -= dt;
    if (world.timer <= 0) {
      resetRound(world);
      events.push({ kind: 'round' });
    }
    return events; // The arena is frozen while the standings are up.
  }

  driveBots(world, dt);

  // Movement + growth easing + timers.
  for (const hole of world.holes) {
    if (hole.invuln > 0) hole.invuln = Math.max(0, hole.invuln - dt);

    if (!hole.alive) {
      hole.respawn -= dt;
      if (hole.respawn <= 0) {
        const pos = spawnPosition(world, Math.random);
        hole.x = pos.x;
        hole.y = pos.y;
        hole.score = 0;
        hole.r = HOLE_BASE_R;
        hole.alive = true;
        hole.invuln = INVULN_TIME;
        hole.ix = 0;
        hole.iy = 0;
        hole.botTimer = 0;
        events.push({ kind: 'spawn', h: hole.id });
      }
      continue;
    }

    const speed = moveSpeed(hole.r);
    hole.x += hole.ix * speed * dt;
    hole.y += hole.iy * speed * dt;
    clampToWorld(hole);

    const target = radiusForScore(hole.score);
    hole.r += (target - hole.r) * Math.min(1, GROW_SMOOTH * dt);
  }

  if (world.phase !== PHASE_PLAY) return events;

  // Props regrow.
  for (const prop of world.props) {
    if (prop.alive) continue;
    prop.respawn -= dt;
    if (prop.respawn <= 0) {
      // Never regrow underneath a hole big enough to instantly re-eat it —
      // that would just be a point fountain.
      let blocked = false;
      for (const hole of world.holes) {
        if (!hole.alive) continue;
        if (Math.hypot(prop.x - hole.x, prop.y - hole.y) < hole.r + PROP_KINDS[prop.kind].r + 24) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        prop.respawn = 2;
      } else {
        prop.alive = true;
        events.push({ kind: 'prop', p: prop.id });
      }
    }
  }

  // Eating props.
  for (const hole of world.holes) {
    if (!hole.alive) continue;
    const mouth = hole.r * MOUTH_RATIO;
    const mouth2 = mouth * mouth;
    for (const prop of world.props) {
      if (!prop.alive) continue;
      if (!canEatKind(hole.r, prop.kind)) continue;
      const dx = prop.x - hole.x;
      const dy = prop.y - hole.y;
      if (dx * dx + dy * dy > mouth2) continue;
      const def = PROP_KINDS[prop.kind];
      prop.alive = false;
      prop.respawn = PROP_RESPAWN_BASE + def.points;
      hole.score += def.points;
      events.push({ kind: 'eat', p: prop.id, h: hole.id, pts: def.points });
    }
  }

  // Holes swallowing holes. Sorted biggest-first so an A>B>C pile-up resolves
  // top-down in one tick.
  const bySize = [...world.holes].sort((a, b) => b.r - a.r);
  for (const eater of bySize) {
    if (!eater.alive || eater.invuln > 0) continue;
    for (const victim of bySize) {
      if (victim === eater || !victim.alive || victim.invuln > 0) continue;
      if (eater.r < victim.r * SWALLOW_RATIO) continue;
      const d = Math.hypot(victim.x - eater.x, victim.y - eater.y);
      if (d > eater.r * SWALLOW_REACH) continue;
      const pts = victim.score;
      eater.score += pts;
      victim.alive = false;
      victim.respawn = RESPAWN_TIME;
      victim.score = 0;
      victim.ix = 0;
      victim.iy = 0;
      events.push({ kind: 'swallow', a: eater.id, b: victim.id, pts });
    }
  }

  return events;
}

// --- Wire format -----------------------------------------------------------
// Snapshots go out 30x a second, so they are packed into a flat number array
// rather than an object with keys. Props never appear here — the arena is
// derived from the seed and kept in sync by eat/regrow events.

export type Snapshot = number[];

export interface SnapHole {
  id: number;
  x: number;
  y: number;
  r: number;
  score: number;
  alive: boolean;
  invuln: boolean;
  respawn: number;
}

export interface Snap {
  tick: number;
  phase: Phase;
  timer: number;
  holes: SnapHole[];
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

export function encodeSnapshot(world: World): Snapshot {
  const out: Snapshot = [world.tick, world.phase, r2(world.timer), world.holes.length];
  for (const h of world.holes) {
    out.push(
      h.id,
      r2(h.x),
      r2(h.y),
      r2(h.r),
      h.score,
      (h.alive ? 1 : 0) | (h.invuln > 0 ? 2 : 0),
      r2(h.respawn)
    );
  }
  return out;
}

export function decodeSnapshot(s: Snapshot): Snap {
  const holes: SnapHole[] = [];
  const count = s[3];
  for (let i = 0; i < count; i++) {
    const o = 4 + i * 7;
    holes.push({
      id: s[o],
      x: s[o + 1],
      y: s[o + 2],
      r: s[o + 3],
      score: s[o + 4],
      alive: (s[o + 5] & 1) !== 0,
      invuln: (s[o + 5] & 2) !== 0,
      respawn: s[o + 6],
    });
  }
  return { tick: s[0], phase: s[1] as Phase, timer: s[2], holes };
}

// --- Map themes ------------------------------------------------------------
// Purely cosmetic, but derived from the arena seed so every client in a room
// renders the same world. The simulation is identical across themes.

export const THEMES = ['city', 'moon', 'pirate'] as const;
export type ThemeName = (typeof THEMES)[number];

export function themeForSeed(seed: number): ThemeName {
  return THEMES[Math.abs(seed) % THEMES.length];
}

// --- Room codes ------------------------------------------------------------
// No I/O/0/1 — an eight-year-old has to read these out loud to a five-year-old.

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export function isValidCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return false;
  return true;
}

export function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}
