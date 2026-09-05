/**
 * Track geometry.
 *
 * A track is a closed Catmull-Rom loop of control points on the ground plane
 * (x, z). It is sampled once into evenly spaced samples with tangents and
 * right-hand normals, which is all the simulation, the bots and the renderer
 * ever look at.
 *
 * Coordinates follow Babylon's left-handed convention: heading 0 faces +z and
 * a positive heading turns toward +x (a right turn). "Lateral" offsets are
 * positive to the RIGHT of the direction of travel.
 */

export type ThemeId = 'meadow' | 'beach' | 'neon';

export interface TrackDef {
  id: string;
  name: string;
  theme: ThemeId;
  /** Closed loop of control points (x, z). The first segment holds the start line. */
  points: [number, number][];
  /** Road width in world units. */
  width: number;
  /** Grass/sand beyond the road edge before the barrier. */
  shoulder: number;
  laps: number;
  /** Item box rows, as fractions of a lap. */
  itemRows: number[];
  /** Boost pads, as fractions of a lap. */
  boostPads: number[];
}

export interface TrackSample {
  x: number;
  z: number;
  /** Unit tangent (direction of travel). */
  tx: number;
  tz: number;
  /** Unit normal pointing to the right of travel. */
  nx: number;
  nz: number;
  /** Distance along the lap. */
  s: number;
  /** Signed curvature, radians per unit; positive bends right. */
  curvature: number;
}

export interface ItemBox {
  x: number;
  z: number;
  s: number;
}

export interface BoostPad {
  x: number;
  z: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  s: number;
  halfWidth: number;
}

export interface TrackGeom {
  def: TrackDef;
  samples: TrackSample[];
  /** Arc length of one lap. */
  length: number;
  /** Distance between consecutive samples. */
  step: number;
  /** Checkpoint positions along the lap; the first is the start line. */
  checkpoints: number[];
  boxes: ItemBox[];
  pads: BoostPad[];
}

export interface Locate {
  index: number;
  s: number;
  lateral: number;
}

export const CHECKPOINT_COUNT = 8;
export const SAMPLE_STEP = 2;
export const BOX_LATERALS = [-0.28, 0, 0.28];
export const BOX_RADIUS = 1.6;
export const PAD_LENGTH = 3.2;

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export function buildTrack(def: TrackDef): TrackGeom {
  const pts = def.points;
  const n = pts.length;

  // Dense pass along the spline, then resample at a fixed arc-length step so
  // that indices map linearly to distance.
  const dense: { x: number; z: number }[] = [];
  const PER_SEGMENT = 40;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let j = 0; j < PER_SEGMENT; j++) {
      const t = j / PER_SEGMENT;
      dense.push({
        x: catmull(p0[0], p1[0], p2[0], p3[0], t),
        z: catmull(p0[1], p1[1], p2[1], p3[1], t),
      });
    }
  }

  const cum: number[] = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const total = cum[dense.length];
  const count = Math.max(8, Math.round(total / SAMPLE_STEP));
  const step = total / count;

  const samples: TrackSample[] = [];
  let k = 0;
  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (k < dense.length - 1 && cum[k + 1] < target) k++;
    const a = dense[k];
    const b = dense[(k + 1) % dense.length];
    const span = Math.max(1e-6, cum[k + 1] - cum[k]);
    const t = Math.min(1, Math.max(0, (target - cum[k]) / span));
    samples.push({
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      tx: 0,
      tz: 0,
      nx: 0,
      nz: 0,
      s: target,
      curvature: 0,
    });
  }

  for (let i = 0; i < count; i++) {
    const prev = samples[(i - 1 + count) % count];
    const next = samples[(i + 1) % count];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    const s = samples[i];
    s.tx = tx;
    s.tz = tz;
    s.nx = tz;
    s.nz = -tx;
  }
  for (let i = 0; i < count; i++) {
    const prev = samples[(i - 1 + count) % count];
    const next = samples[(i + 1) % count];
    const a0 = Math.atan2(prev.tx, prev.tz);
    const a1 = Math.atan2(next.tx, next.tz);
    samples[i].curvature = angleDiff(a1, a0) / (2 * step);
  }

  const checkpoints: number[] = [];
  for (let i = 0; i < CHECKPOINT_COUNT; i++) checkpoints.push((total * i) / CHECKPOINT_COUNT);

  const geom: TrackGeom = {
    def,
    samples,
    length: total,
    step,
    checkpoints,
    boxes: [],
    pads: [],
  };

  for (const frac of def.itemRows) {
    const s = frac * total;
    for (const lat of BOX_LATERALS) {
      const p = pointAt(geom, s, lat * def.width);
      geom.boxes.push({ x: p.x, z: p.z, s });
    }
  }
  for (const frac of def.boostPads) {
    const s = frac * total;
    const smp = sampleAt(geom, s);
    geom.pads.push({
      x: smp.x,
      z: smp.z,
      tx: smp.tx,
      tz: smp.tz,
      nx: smp.nx,
      nz: smp.nz,
      s,
      halfWidth: def.width * 0.5 - 0.6,
    });
  }
  return geom;
}

export function wrapS(geom: TrackGeom, s: number): number {
  const L = geom.length;
  s %= L;
  return s < 0 ? s + L : s;
}

/** Shortest signed distance from a to b along the loop. */
export function deltaS(geom: TrackGeom, from: number, to: number): number {
  const L = geom.length;
  let d = (to - from) % L;
  if (d > L / 2) d -= L;
  if (d < -L / 2) d += L;
  return d;
}

export function sampleAt(geom: TrackGeom, s: number): TrackSample {
  const i = Math.round(wrapS(geom, s) / geom.step) % geom.samples.length;
  return geom.samples[i];
}

/** Interpolated centreline point offset laterally (positive = right). */
export function pointAt(geom: TrackGeom, s: number, lateral = 0): { x: number; z: number; tx: number; tz: number } {
  const n = geom.samples.length;
  const f = wrapS(geom, s) / geom.step;
  const i0 = Math.floor(f) % n;
  const i1 = (i0 + 1) % n;
  const t = f - Math.floor(f);
  const a = geom.samples[i0];
  const b = geom.samples[i1];
  const x = a.x + (b.x - a.x) * t;
  const z = a.z + (b.z - a.z) * t;
  let tx = a.tx + (b.tx - a.tx) * t;
  let tz = a.tz + (b.tz - a.tz) * t;
  const len = Math.hypot(tx, tz) || 1;
  tx /= len;
  tz /= len;
  return { x: x + tz * lateral, z: z - tx * lateral, tx, tz };
}

/**
 * Find the closest sample to a point. `hint` is the last known index, which
 * makes this a short local search every tick instead of a scan of the whole
 * lap. Pass -1 when nothing is known.
 */
export function locate(geom: TrackGeom, x: number, z: number, hint: number): Locate {
  const samples = geom.samples;
  const n = samples.length;
  let best = -1;
  let bestD = Infinity;

  const consider = (i: number): void => {
    const s = samples[i];
    const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  };

  if (hint >= 0) {
    const WINDOW = 24;
    for (let k = -WINDOW; k <= WINDOW; k++) consider((hint + k + n) % n);
    // Way off the hinted stretch: the kart was teleported or the hint is
    // stale. Fall back to the full scan.
    if (bestD > 40 * 40) {
      best = -1;
      bestD = Infinity;
      for (let i = 0; i < n; i++) consider(i);
    }
  } else {
    for (let i = 0; i < n; i++) consider(i);
  }

  const smp = samples[best];
  const dx = x - smp.x;
  const dz = z - smp.z;
  const along = Math.max(-geom.step, Math.min(geom.step, dx * smp.tx + dz * smp.tz));
  return {
    index: best,
    s: wrapS(geom, smp.s + along),
    lateral: dx * smp.nx + dz * smp.nz,
  };
}

export function headingOf(tx: number, tz: number): number {
  return Math.atan2(tx, tz);
}

/** Signed difference a - b wrapped to [-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + angleDiff(b, a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
