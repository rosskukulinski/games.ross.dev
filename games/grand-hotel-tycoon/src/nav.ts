/**
 * Navigation.
 *
 * The resort is deliberately laid out as one open promenade at z≈0 with every
 * building hanging off it to the north or south, and every entrance facing the
 * promenade. That means any two points connect with a simple L-shaped route —
 * leave your building onto the promenade, walk along it, turn in at the target.
 * No grid, no A*, and nothing to get stuck on.
 *
 * Each agent gets a personal lane offset so the promenade looks like a busy
 * street rather than a conga line down the centre stripe.
 */

import { SEPARATION_R, ARRIVE_R } from "./config";

export interface Pt {
  x: number;
  z: number;
}

export type Route = Pt[];

/** Half-width of the walkable promenade corridor. */
export const PROM_HALF = 2.3;

/**
 * Deterministic walking lane for an agent.
 *
 * Biased to the south half of the promenade: the reception counter sits on the
 * north half, and agents have no collision, so an unbiased lane sent guests
 * strolling straight through the desk.
 */
export function laneFor(seed: number): number {
  const t = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
  return -0.3 - t * (PROM_HALF - 0.4);
}

/**
 * Build an L-shaped route from `from` to `to`.
 * Waypoints are pruned when a leg would be shorter than a step, so agents
 * already on the promenade just walk straight along it.
 */
export function routeTo(from: Pt, to: Pt, lane: number): Route {
  const pts: Route = [];
  const onProm = Math.abs(from.z - lane) < 1.4 && Math.abs(from.z) <= PROM_HALF + 1.4;

  // 1. step out to the promenade lane, keeping the current x
  if (!onProm) pts.push({ x: from.x, z: lane });

  // 2. travel along the promenade to the target's x
  if (Math.abs(to.x - from.x) > 0.6) pts.push({ x: to.x, z: lane });

  // 3. turn in to the target
  pts.push({ x: to.x, z: to.z });

  return pts;
}

/** Squared planar distance — avoids a sqrt in the hot loops. */
export function dist2(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function dist(a: Pt, b: Pt): number {
  return Math.sqrt(dist2(a, b));
}

export function arrived(a: Pt, b: Pt, r = ARRIVE_R): boolean {
  return dist2(a, b) <= r * r;
}

/* ------------------------------------------------------------------------- */

export interface Steerable extends Pt {
  /** Facing angle in radians, smoothed toward the direction of travel. */
  heading: number;
  /** Accumulated separation push, applied and cleared each frame. */
  pushX: number;
  pushZ: number;
}

/**
 * Uniform spatial hash used only for agent-vs-agent separation. Rebuilt every
 * frame — with a couple of dozen agents that is far cheaper than maintaining
 * incremental buckets.
 */
export class SpatialHash {
  private cell: number;
  private buckets = new Map<number, Steerable[]>();

  constructor(cell = 1.6) {
    this.cell = cell;
  }

  private key(x: number, z: number): number {
    const cx = Math.floor(x / this.cell);
    const cz = Math.floor(z / this.cell);
    // pack two smallish signed ints into one number
    return (cx + 4096) * 8192 + (cz + 4096);
  }

  rebuild(agents: Steerable[]): void {
    this.buckets.clear();
    for (const a of agents) {
      const k = this.key(a.x, a.z);
      const b = this.buckets.get(k);
      if (b) b.push(a);
      else this.buckets.set(k, [a]);
    }
  }

  /** Accumulate a gentle shove apart for every overlapping pair. */
  separate(agents: Steerable[]): void {
    const r2 = SEPARATION_R * SEPARATION_R * 4;
    for (const a of agents) {
      const cx = Math.floor(a.x / this.cell);
      const cz = Math.floor(a.z / this.cell);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const b = this.buckets.get((cx + ox + 4096) * 8192 + (cz + oz + 4096));
          if (!b) continue;
          for (const other of b) {
            if (other === a) continue;
            const dx = a.x - other.x;
            const dz = a.z - other.z;
            const d2 = dx * dx + dz * dz;
            if (d2 >= r2 || d2 < 1e-6) continue;
            const d = Math.sqrt(d2);
            const push = (SEPARATION_R * 2 - d) / (SEPARATION_R * 2);
            a.pushX += (dx / d) * push;
            a.pushZ += (dz / d) * push;
          }
        }
      }
    }
  }
}

/**
 * Apply separation to an agent that has no route.
 *
 * `followRoute` is what normally consumes and clears the accumulated push, so
 * a standing agent would otherwise never budge *and* would pile up an
 * ever-growing push vector that yanks them sideways the moment they next got
 * a route. Queueing guests stand still for a long time, so this matters.
 */
export function settle(agent: Steerable, dt: number): void {
  const m = Math.hypot(agent.pushX, agent.pushZ);
  if (m > 0.001) {
    const step = Math.min(m, 1) * 1.5 * dt;
    agent.x += (agent.pushX / m) * step;
    agent.z += (agent.pushZ / m) * step;
  }
  agent.pushX = 0;
  agent.pushZ = 0;
}

/**
 * Move an agent one step along its route. Returns true once the final
 * waypoint has been reached.
 */
export function followRoute(
  agent: Steerable,
  route: Route,
  speed: number,
  dt: number,
): boolean {
  if (route.length === 0) return true;

  const target = route[0];
  let dx = target.x - agent.x;
  let dz = target.z - agent.z;
  const d = Math.hypot(dx, dz);

  // consume waypoints; the last one uses a tighter radius so agents land
  // properly on their station instead of hovering a metre short
  const reachR = route.length > 1 ? 0.55 : ARRIVE_R;
  if (d <= reachR) {
    route.shift();
    if (route.length === 0) {
      agent.pushX = 0;
      agent.pushZ = 0;
      return true;
    }
    return false;
  }

  dx /= d;
  dz /= d;

  // blend in the separation shove, then renormalise so speed stays constant
  let mx = dx + agent.pushX * 0.85;
  let mz = dz + agent.pushZ * 0.85;
  const ml = Math.hypot(mx, mz) || 1;
  mx /= ml;
  mz /= ml;

  const step = Math.min(speed * dt, d);
  agent.x += mx * step;
  agent.z += mz * step;

  // smooth the facing toward travel direction, shortest way round
  const want = Math.atan2(mx, mz);
  let diff = want - agent.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  agent.heading += diff * Math.min(1, dt * 12);

  agent.pushX = 0;
  agent.pushZ = 0;
  return false;
}
