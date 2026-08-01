/**
 * Authoritative air-hockey simulation.
 *
 * This module is imported by BOTH:
 *   - the game client (`games/air-hockey`) for solo-vs-bot play and for
 *     clamping the local paddle during online play, and
 *   - the Cloudflare Durable Object (`multiplayer-server`) that hosts online
 *     matches.
 *
 * It therefore has to stay dependency-free and side-effect-free. It lives
 * inside the game directory (rather than next to the worker) so that editing
 * the rules correctly invalidates the monorepo build cache, which only hashes
 * `games/<slug>/`.
 */

// --- Table geometry (arbitrary units; the client scales these to pixels) ---

export const TABLE_W = 100;
export const TABLE_H = 160;
export const GOAL_HALF_W = 19;
export const PUCK_R = 3.6;
export const PADDLE_R = 6.4;

export const TARGET_SCORE = 7;

export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;

// --- Tuning. Deliberately forgiving: the youngest player here is five. ---

const WALL_BOUNCE = 0.95;
const PADDLE_BOUNCE = 0.94;
const PUCK_DRAG = 0.22; // per second, applied exponentially
const PUCK_MAX_SPEED = 172;
const PUCK_MIN_BOUNCE_SPEED = 14; // stops the puck dying against a paddle
const SERVE_SPEED = 44;
const PADDLE_MAX_SPEED = 260;
const PADDLE_PUSH = 7; // so a gentle tap still sends the puck away

const COUNTDOWN_TIME = 2.2;
const GOAL_PAUSE = 1.7;

// A paddle held against a wall can pin the puck: the wall clamp and the
// paddle's outward push cancel each other out every tick and the puck stops
// dead. Kids do this constantly (usually in a corner, usually on purpose), so
// the simulation watches for a puck that has stopped going anywhere and
// squirts it back out.
const STUCK_TICKS = 90; // 1.5s at 60Hz
const STUCK_DISTANCE = 4; // table units of travel that counts as "moving"

// --- Phases ---

export const PHASE_WAITING = 0;
export const PHASE_COUNTDOWN = 1;
export const PHASE_PLAY = 2;
export const PHASE_GOAL = 3;
export const PHASE_OVER = 4;

export type Phase =
  | typeof PHASE_WAITING
  | typeof PHASE_COUNTDOWN
  | typeof PHASE_PLAY
  | typeof PHASE_GOAL
  | typeof PHASE_OVER;

/** 0 defends the bottom edge (y = TABLE_H); 1 defends the top edge (y = 0). */
export type Side = 0 | 1;

export interface Paddle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Where this player's pointer is asking the paddle to go. */
  tx: number;
  ty: number;
}

export interface Puck {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Match {
  puck: Puck;
  paddles: [Paddle, Paddle];
  scores: [number, number];
  phase: Phase;
  /** Seconds left in the countdown / goal celebration. */
  timer: number;
  /** Which side the next serve drifts toward. */
  serveTo: Side;
  winner: Side | -1;
  tick: number;
  /** Consecutive ticks the puck has failed to travel STUCK_DISTANCE. */
  stuckTicks: number;
  stuckRefX: number;
  stuckRefY: number;
}

export type EventKind = 'wall' | 'paddle' | 'goal' | 'post' | 'win';

export interface StepEvent {
  kind: EventKind;
  x: number;
  y: number;
  /** 0..1 impact strength, for particles / sound / shake. */
  power: number;
  side: Side;
}

// --- Helpers ---

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** Vertical band a side's paddle is allowed to occupy (its own half only). */
export function paddleBounds(side: Side): { minY: number; maxY: number } {
  return side === 0
    ? { minY: TABLE_H / 2 + PADDLE_R, maxY: TABLE_H - PADDLE_R }
    : { minY: PADDLE_R, maxY: TABLE_H / 2 - PADDLE_R };
}

/** Clamp a requested paddle position into the legal area for that side. */
export function clampPaddleTarget(
  side: Side,
  x: number,
  y: number
): { x: number; y: number } {
  const { minY, maxY } = paddleBounds(side);
  return {
    x: clamp(x, PADDLE_R, TABLE_W - PADDLE_R),
    y: clamp(y, minY, maxY),
  };
}

/**
 * Move a paddle one step toward a requested position under the same speed
 * limit the server applies. The client uses this to draw the local paddle
 * immediately instead of waiting a round trip for it to come back.
 */
export function advancePaddle(
  side: Side,
  cur: { x: number; y: number },
  tx: number,
  ty: number,
  dt: number
): { x: number; y: number } {
  const t = clampPaddleTarget(side, tx, ty);
  let dx = t.x - cur.x;
  let dy = t.y - cur.y;
  const d = Math.hypot(dx, dy);
  const maxStep = PADDLE_MAX_SPEED * dt;
  if (d > maxStep && d > 0) {
    dx = (dx / d) * maxStep;
    dy = (dy / d) * maxStep;
  }
  return { x: cur.x + dx, y: cur.y + dy };
}

function homePosition(side: Side): { x: number; y: number } {
  return {
    x: TABLE_W / 2,
    y: side === 0 ? TABLE_H - PADDLE_R - 12 : PADDLE_R + 12,
  };
}

function makePaddle(side: Side): Paddle {
  const home = homePosition(side);
  return { x: home.x, y: home.y, vx: 0, vy: 0, tx: home.x, ty: home.y };
}

export function createMatch(): Match {
  const match: Match = {
    puck: { x: TABLE_W / 2, y: TABLE_H / 2, vx: 0, vy: 0 },
    paddles: [makePaddle(0), makePaddle(1)],
    scores: [0, 0],
    phase: PHASE_WAITING,
    timer: 0,
    serveTo: 0,
    winner: -1,
    tick: 0,
    stuckTicks: 0,
    stuckRefX: TABLE_W / 2,
    stuckRefY: TABLE_H / 2,
  };
  return match;
}

/** Park the puck at centre and begin the countdown before a serve. */
export function beginCountdown(match: Match): void {
  match.puck.x = TABLE_W / 2;
  match.puck.y = TABLE_H / 2;
  match.puck.vx = 0;
  match.puck.vy = 0;
  match.phase = PHASE_COUNTDOWN;
  match.timer = COUNTDOWN_TIME;
  match.stuckTicks = 0;
  match.stuckRefX = match.puck.x;
  match.stuckRefY = match.puck.y;
}

export function resetMatch(match: Match): void {
  match.scores[0] = 0;
  match.scores[1] = 0;
  match.winner = -1;
  match.serveTo = Math.random() < 0.5 ? 0 : 1;
  for (const side of [0, 1] as Side[]) {
    const home = homePosition(side);
    const p = match.paddles[side];
    p.x = p.tx = home.x;
    p.y = p.ty = home.y;
    p.vx = p.vy = 0;
  }
  beginCountdown(match);
}

/** Record a player's requested paddle position (already in table units). */
export function setInput(match: Match, side: Side, x: number, y: number): void {
  const t = clampPaddleTarget(side, x, y);
  match.paddles[side].tx = t.x;
  match.paddles[side].ty = t.y;
}

function serve(match: Match): void {
  const dir = match.serveTo === 0 ? 1 : -1; // +y is toward side 0
  const spread = (Math.random() * 2 - 1) * 0.45;
  match.puck.vx = SERVE_SPEED * spread;
  match.puck.vy = SERVE_SPEED * dir;
  match.phase = PHASE_PLAY;
}

function capSpeed(puck: Puck): void {
  const s = Math.hypot(puck.vx, puck.vy);
  if (s > PUCK_MAX_SPEED) {
    const k = PUCK_MAX_SPEED / s;
    puck.vx *= k;
    puck.vy *= k;
  }
}

function movePaddles(match: Match, dt: number): void {
  for (const side of [0, 1] as Side[]) {
    const p = match.paddles[side];
    const t = clampPaddleTarget(side, p.tx, p.ty);
    let dx = t.x - p.x;
    let dy = t.y - p.y;
    const d = Math.hypot(dx, dy);
    const maxStep = PADDLE_MAX_SPEED * dt;
    if (d > maxStep && d > 0) {
      dx = (dx / d) * maxStep;
      dy = (dy / d) * maxStep;
    }
    p.vx = dx / dt;
    p.vy = dy / dt;
    p.x += dx;
    p.y += dy;
  }
}

/** Resolve a puck/paddle overlap, pushing the puck out and away. */
function collidePaddle(
  puck: Puck,
  paddle: Paddle,
  side: Side,
  events: StepEvent[]
): void {
  let nx = puck.x - paddle.x;
  let ny = puck.y - paddle.y;
  let dist = Math.hypot(nx, ny);
  const minDist = PUCK_R + PADDLE_R;
  if (dist >= minDist) return;

  if (dist < 0.0001) {
    // Perfectly concentric: shove the puck toward the paddle owner's goal.
    nx = 0;
    ny = side === 0 ? -1 : 1;
    dist = 1;
  } else {
    nx /= dist;
    ny /= dist;
  }

  // Separate first so the next substep starts clean.
  puck.x = paddle.x + nx * (minDist + 0.01);
  puck.y = paddle.y + ny * (minDist + 0.01);

  const relVx = puck.vx - paddle.vx;
  const relVy = puck.vy - paddle.vy;
  const vn = relVx * nx + relVy * ny;
  if (vn < 0) {
    const j = -(1 + PADDLE_BOUNCE) * vn;
    puck.vx += nx * j;
    puck.vy += ny * j;
  }

  // A constant nudge means even a stationary paddle returns the puck, and a
  // slow, deliberate five-year-old push still does something satisfying.
  puck.vx += nx * PADDLE_PUSH;
  puck.vy += ny * PADDLE_PUSH;

  // Guarantee the puck actually leaves the paddle.
  const outward = puck.vx * nx + puck.vy * ny;
  if (outward < PUCK_MIN_BOUNCE_SPEED) {
    const add = PUCK_MIN_BOUNCE_SPEED - outward;
    puck.vx += nx * add;
    puck.vy += ny * add;
  }

  capSpeed(puck);
  events.push({
    kind: 'paddle',
    x: puck.x,
    y: puck.y,
    power: clamp(Math.hypot(puck.vx, puck.vy) / PUCK_MAX_SPEED, 0.15, 1),
    side,
  });
}

/**
 * Advance the simulation by `dt` seconds and return everything worth showing
 * or hearing. Safe to call with a fixed TICK_DT from either host.
 */
export function step(match: Match, dt: number): StepEvent[] {
  const events: StepEvent[] = [];
  match.tick++;

  movePaddles(match, dt);

  if (match.phase === PHASE_COUNTDOWN) {
    match.timer -= dt;
    if (match.timer <= 0) {
      match.timer = 0;
      serve(match);
    }
    return events;
  }

  if (match.phase === PHASE_GOAL) {
    match.timer -= dt;
    if (match.timer <= 0) beginCountdown(match);
    return events;
  }

  if (match.phase !== PHASE_PLAY) return events;

  const puck = match.puck;

  // Drag.
  const drag = Math.exp(-PUCK_DRAG * dt);
  puck.vx *= drag;
  puck.vy *= drag;
  capSpeed(puck);

  // Substep so a fast puck can never tunnel through a wall or paddle.
  const speed = Math.hypot(puck.vx, puck.vy);
  const steps = clamp(Math.ceil((speed * dt) / (PUCK_R * 0.5)), 1, 10);
  const sdt = dt / steps;

  for (let i = 0; i < steps; i++) {
    puck.x += puck.vx * sdt;
    puck.y += puck.vy * sdt;

    // Side walls.
    if (puck.x < PUCK_R) {
      puck.x = PUCK_R;
      puck.vx = Math.abs(puck.vx) * WALL_BOUNCE;
      events.push({
        kind: 'wall',
        x: puck.x,
        y: puck.y,
        power: clamp(Math.abs(puck.vx) / PUCK_MAX_SPEED, 0.1, 1),
        side: 0,
      });
    } else if (puck.x > TABLE_W - PUCK_R) {
      puck.x = TABLE_W - PUCK_R;
      puck.vx = -Math.abs(puck.vx) * WALL_BOUNCE;
      events.push({
        kind: 'wall',
        x: puck.x,
        y: puck.y,
        power: clamp(Math.abs(puck.vx) / PUCK_MAX_SPEED, 0.1, 1),
        side: 0,
      });
    }

    // End walls / goal mouths.
    const inMouth = Math.abs(puck.x - TABLE_W / 2) < GOAL_HALF_W - PUCK_R * 0.35;
    if (puck.y < PUCK_R) {
      if (inMouth) {
        scoreGoal(match, 0, events);
        return events;
      }
      puck.y = PUCK_R;
      puck.vy = Math.abs(puck.vy) * WALL_BOUNCE;
      events.push({
        kind: Math.abs(puck.x - TABLE_W / 2) < GOAL_HALF_W + PUCK_R ? 'post' : 'wall',
        x: puck.x,
        y: puck.y,
        power: clamp(Math.abs(puck.vy) / PUCK_MAX_SPEED, 0.1, 1),
        side: 1,
      });
    } else if (puck.y > TABLE_H - PUCK_R) {
      if (inMouth) {
        scoreGoal(match, 1, events);
        return events;
      }
      puck.y = TABLE_H - PUCK_R;
      puck.vy = -Math.abs(puck.vy) * WALL_BOUNCE;
      events.push({
        kind: Math.abs(puck.x - TABLE_W / 2) < GOAL_HALF_W + PUCK_R ? 'post' : 'wall',
        x: puck.x,
        y: puck.y,
        power: clamp(Math.abs(puck.vy) / PUCK_MAX_SPEED, 0.1, 1),
        side: 0,
      });
    }

    collidePaddle(puck, match.paddles[0], 0, events);
    collidePaddle(puck, match.paddles[1], 1, events);

    // Paddles can pin the puck against a wall; keep it inside regardless.
    puck.x = clamp(puck.x, PUCK_R, TABLE_W - PUCK_R);
    puck.y = clamp(puck.y, PUCK_R, TABLE_H - PUCK_R);
  }

  // Deadlock watchdog — see STUCK_TICKS.
  if (Math.hypot(puck.x - match.stuckRefX, puck.y - match.stuckRefY) > STUCK_DISTANCE) {
    match.stuckRefX = puck.x;
    match.stuckRefY = puck.y;
    match.stuckTicks = 0;
  } else if (++match.stuckTicks >= STUCK_TICKS) {
    unstick(match, events);
  }

  return events;
}

/**
 * Free a puck that has stopped moving. If a paddle is pinning it, slide it
 * *around* the paddle — the way out of a corner is along the wall, not
 * through the thing holding it there.
 */
function unstick(match: Match, events: StepEvent[]): void {
  const puck = match.puck;
  match.stuckTicks = 0;

  let nearest: Paddle | null = null;
  let nearestDist = Infinity;
  for (const side of [0, 1] as Side[]) {
    const p = match.paddles[side];
    const d = Math.hypot(puck.x - p.x, puck.y - p.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = p;
    }
  }

  const toCentreX = TABLE_W / 2 - puck.x;
  const toCentreY = TABLE_H / 2 - puck.y;
  let ex: number;
  let ey: number;

  if (nearest && nearestDist > 0.001 && nearestDist < (PUCK_R + PADDLE_R) * 1.5) {
    // Escape along the tangent, choosing whichever way around the paddle
    // heads for open table.
    const nx = (puck.x - nearest.x) / nearestDist;
    const ny = (puck.y - nearest.y) / nearestDist;
    const dir = -ny * toCentreX + nx * toCentreY >= 0 ? 1 : -1;
    ex = -ny * dir;
    ey = nx * dir;
  } else {
    const d = Math.hypot(toCentreX, toCentreY) || 1;
    ex = toCentreX / d;
    ey = toCentreY / d;
  }

  const clearance = (PUCK_R + PADDLE_R) * 1.5;
  puck.x = clamp(puck.x + ex * clearance, PUCK_R, TABLE_W - PUCK_R);
  puck.y = clamp(puck.y + ey * clearance, PUCK_R, TABLE_H - PUCK_R);
  puck.vx = ex * SERVE_SPEED * 1.4;
  puck.vy = ey * SERVE_SPEED * 1.4;
  match.stuckRefX = puck.x;
  match.stuckRefY = puck.y;

  events.push({ kind: 'wall', x: puck.x, y: puck.y, power: 0.45, side: 0 });
}

function scoreGoal(match: Match, scorer: Side, events: StepEvent[]): void {
  match.scores[scorer]++;
  events.push({
    kind: 'goal',
    x: match.puck.x,
    y: scorer === 0 ? 0 : TABLE_H,
    power: 1,
    side: scorer,
  });

  match.puck.x = TABLE_W / 2;
  match.puck.y = TABLE_H / 2;
  match.puck.vx = 0;
  match.puck.vy = 0;
  // The player who conceded gets the next serve coming toward them.
  match.serveTo = (scorer === 0 ? 1 : 0) as Side;

  if (match.scores[scorer] >= TARGET_SCORE) {
    match.phase = PHASE_OVER;
    match.winner = scorer;
    match.timer = 0;
    events.push({ kind: 'win', x: TABLE_W / 2, y: TABLE_H / 2, power: 1, side: scorer });
  } else {
    match.phase = PHASE_GOAL;
    match.timer = GOAL_PAUSE;
  }
}

// --- Wire format -----------------------------------------------------------
// Snapshots go out 30x a second, so they are packed into a flat number array
// rather than an object with keys.

export type Snapshot = number[];

const r2 = (n: number): number => Math.round(n * 100) / 100;

export function encodeSnapshot(match: Match): Snapshot {
  return [
    match.tick,
    r2(match.puck.x),
    r2(match.puck.y),
    r2(match.puck.vx),
    r2(match.puck.vy),
    r2(match.paddles[0].x),
    r2(match.paddles[0].y),
    r2(match.paddles[1].x),
    r2(match.paddles[1].y),
    match.scores[0],
    match.scores[1],
    match.phase,
    r2(match.timer),
    match.winner,
  ];
}

export function decodeSnapshot(s: Snapshot): Match {
  return {
    tick: s[0],
    puck: { x: s[1], y: s[2], vx: s[3], vy: s[4] },
    paddles: [
      { x: s[5], y: s[6], vx: 0, vy: 0, tx: s[5], ty: s[6] },
      { x: s[7], y: s[8], vx: 0, vy: 0, tx: s[7], ty: s[8] },
    ],
    scores: [s[9], s[10]],
    phase: s[11] as Phase,
    timer: s[12],
    winner: s[13] as Side | -1,
    // These only matter to whoever is running the simulation, so they stay
    // off the wire; clients never read them.
    serveTo: 0,
    stuckTicks: 0,
    stuckRefX: s[1],
    stuckRefY: s[2],
  };
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
