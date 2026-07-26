/**
 * 2D pinball physics: a ball is a circle, every obstacle reduces to
 * "closest point + effective radius", so one circle-vs-circle resolver
 * handles walls, arcs, bumpers, targets and flippers alike.
 */

export const TAU = Math.PI * 2;
export const D2R = Math.PI / 180;

export interface BallBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/** Straight capsule: segment a→b with a radius that may taper. */
export interface SegCollider {
  kind: 'seg';
  ax: number;
  ay: number;
  bx: number;
  by: number;
  r: number;
  /** radius at b — defaults to r */
  r2?: number;
  e: number;
  /** extra outward impulse applied on contact (px/s) */
  kick?: number;
  /** one-way gate: only collides when ball velocity points along this vector */
  owx?: number;
  owy?: number;
  active?: boolean;
  tag?: string;
}

/** Round obstacle: posts, bumper skirts. */
export interface CircleCollider {
  kind: 'circle';
  x: number;
  y: number;
  r: number;
  e: number;
  kick?: number;
  active?: boolean;
  tag?: string;
}

/** Curved capsule: centreline is an arc, so it works from inside or outside. */
export interface ArcCollider {
  kind: 'arc';
  cx: number;
  cy: number;
  /** centreline radius */
  R: number;
  /** a0 < a1, span <= TAU */
  a0: number;
  a1: number;
  r: number;
  e: number;
  kick?: number;
  active?: boolean;
  tag?: string;
}

export type Collider = SegCollider | CircleCollider | ArcCollider;

export interface Contact {
  nx: number;
  ny: number;
  /** closing speed along the normal, px/s — how hard the hit was */
  impact: number;
  /** contact point */
  px: number;
  py: number;
}

/** Closest point on a collider's centreline, plus the radius there. */
function closest(
  col: Collider,
  px: number,
  py: number,
  out: { x: number; y: number; r: number },
): void {
  if (col.kind === 'circle') {
    out.x = col.x;
    out.y = col.y;
    out.r = col.r;
    return;
  }
  if (col.kind === 'seg') {
    const dx = col.bx - col.ax;
    const dy = col.by - col.ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 1e-9 ? ((px - col.ax) * dx + (py - col.ay) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    out.x = col.ax + dx * t;
    out.y = col.ay + dy * t;
    out.r = col.r2 === undefined ? col.r : col.r + (col.r2 - col.r) * t;
    return;
  }
  // arc
  const dx = px - col.cx;
  const dy = py - col.cy;
  const a = Math.atan2(dy, dx);
  const span = col.a1 - col.a0;
  let rel = (((a - col.a0) % TAU) + TAU) % TAU;
  if (rel > span) {
    // outside the sweep — snap to whichever endpoint is nearer in angle
    rel = rel - span < TAU - rel ? span : 0;
  }
  const ca = col.a0 + rel;
  out.x = col.cx + Math.cos(ca) * col.R;
  out.y = col.cy + Math.sin(ca) * col.R;
  out.r = col.r;
}

const _cp = { x: 0, y: 0, r: 0 };

/**
 * Push the ball out of a static collider and reflect its velocity.
 * Returns the contact, or null when there was no overlap.
 */
export function collideStatic(
  b: BallBody,
  col: Collider,
  friction = 0.02,
): Contact | null {
  if (col.active === false) return null;
  closest(col, b.x, b.y, _cp);

  let dx = b.x - _cp.x;
  let dy = b.y - _cp.y;
  const minD = b.r + _cp.r;
  let d2 = dx * dx + dy * dy;
  if (d2 >= minD * minD) return null;

  let d = Math.sqrt(d2);
  if (d < 1e-6) {
    // Degenerate: shove straight up rather than dividing by zero.
    dx = 0;
    dy = -1;
    d = 1e-6;
  }
  const nx = dx / d;
  const ny = dy / d;

  if (col.kind === 'seg' && col.owx !== undefined && col.owy !== undefined) {
    // One-way gate: transparent unless the ball is heading the blocked way.
    if (b.vx * col.owx + b.vy * col.owy <= 0) return null;
  }

  b.x = _cp.x + nx * minD;
  b.y = _cp.y + ny * minD;

  const vn = b.vx * nx + b.vy * ny;
  const impact = -vn;
  if (vn < 0) {
    const j = -(1 + col.e) * vn;
    b.vx += nx * j;
    b.vy += ny * j;
    // tangential friction so grazing hits shed a little speed
    if (friction > 0) {
      const tx = -ny;
      const ty = nx;
      const vt = b.vx * tx + b.vy * ty;
      b.vx -= tx * vt * friction;
      b.vy -= ty * vt * friction;
    }
  }
  if (col.kick) {
    b.vx += nx * col.kick;
    b.vy += ny * col.kick;
  }
  return { nx, ny, impact: impact > 0 ? impact : 0, px: _cp.x, py: _cp.y };
}

/** Elastic-ish collision between two balls (multiball). */
export function collideBalls(a: BallBody, b: BallBody, e = 0.55): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minD = a.r + b.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minD * minD || d2 < 1e-9) return 0;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const overlap = minD - d;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;
  const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rvn >= 0) return 0;
  const j = (-(1 + e) * rvn) / 2;
  a.vx -= nx * j;
  a.vy -= ny * j;
  b.vx += nx * j;
  b.vy += ny * j;
  return -rvn;
}

// ---------------------------------------------------------------------------
// Flipper — a tapered capsule that rotates about a pivot. The ball picks up
// the surface velocity at the contact point, which is what makes a flip kick.
// ---------------------------------------------------------------------------

export class Flipper {
  angle: number;
  omega = 0;
  pressed = false;
  /** visual recoil, radians */
  recoil = 0;

  constructor(
    readonly px: number,
    readonly py: number,
    readonly len: number,
    readonly rBase: number,
    readonly rTip: number,
    readonly restAngle: number,
    readonly upAngle: number,
    /** rad/s */
    readonly speed = 24,
  ) {
    this.angle = restAngle;
  }

  get tipX(): number {
    return this.px + Math.cos(this.angle) * this.len;
  }

  get tipY(): number {
    return this.py + Math.sin(this.angle) * this.len;
  }

  update(dt: number): void {
    const target = this.pressed ? this.upAngle : this.restAngle;
    const diff = target - this.angle;
    // Returning is a little slower than flipping, like a real coil + spring.
    const maxStep = this.speed * (this.pressed ? 1 : 0.62) * dt;
    const step = diff > maxStep ? maxStep : diff < -maxStep ? -maxStep : diff;
    this.angle += step;
    this.omega = dt > 0 ? step / dt : 0;
    if (this.recoil !== 0) this.recoil *= Math.max(0, 1 - dt * 12);
  }

  collide(b: BallBody): Contact | null {
    const seg: SegCollider = {
      kind: 'seg',
      ax: this.px,
      ay: this.py,
      bx: this.tipX,
      by: this.tipY,
      r: this.rBase,
      r2: this.rTip,
      e: 0.22,
    };
    closest(seg, b.x, b.y, _cp);
    let dx = b.x - _cp.x;
    let dy = b.y - _cp.y;
    const minD = b.r + _cp.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minD * minD) return null;
    let d = Math.sqrt(d2);
    if (d < 1e-6) {
      dx = 0;
      dy = -1;
      d = 1e-6;
    }
    const nx = dx / d;
    const ny = dy / d;
    b.x = _cp.x + nx * minD;
    b.y = _cp.y + ny * minD;

    // Surface velocity at the contact point: omega x r. Contacts right at the
    // pivot have almost no lever arm, so a ball resting in the crook would be
    // unflippable; borrow a minimum arm along the bat so it still gets punted.
    let rx = _cp.x - this.px;
    let ry = _cp.y - this.py;
    const arm = Math.hypot(rx, ry);
    const MIN_ARM = 42;
    if (arm < MIN_ARM) {
      rx = Math.cos(this.angle) * MIN_ARM;
      ry = Math.sin(this.angle) * MIN_ARM;
    }
    const svx = -this.omega * ry;
    const svy = this.omega * rx;

    const rvx = b.vx - svx;
    const rvy = b.vy - svy;
    const vn = rvx * nx + rvy * ny;
    const impact = -vn;
    if (vn < 0) {
      const j = -(1 + seg.e) * vn;
      b.vx = rvx + nx * j + svx;
      b.vy = rvy + ny * j + svy;
      if (this.pressed) this.recoil = 0.06;
    }
    return { nx, ny, impact: impact > 0 ? impact : 0, px: _cp.x, py: _cp.y };
  }
}

export function clampSpeed(b: BallBody, max: number): void {
  const s2 = b.vx * b.vx + b.vy * b.vy;
  if (s2 > max * max) {
    const s = Math.sqrt(s2);
    b.vx = (b.vx / s) * max;
    b.vy = (b.vy / s) * max;
  }
}
