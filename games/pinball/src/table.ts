/**
 * Playfield layout: every dimension of the table lives here, plus the
 * static art (felt, painted decals, chrome rails, apron).
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { ArcCollider, Collider, D2R, SegCollider } from './physics';

export const W = 900;
export const H = 1560;

export const BALL_R = 14;
export const WALL_R = 9;

/** Horizontal centre of the playable area (excludes the shooter lane). */
export const PF_CX = 402;

// --- the great arch over the top of the table ------------------------------
export const ARCH_CX = 450;
export const ARCH_CY = 560;
export const ARCH_R = 410;
/** inner wall of the orbit lane */
export const ORBIT_R = 330;
export const ORBIT_A0 = -162 * D2R;
export const ORBIT_A1 = -18 * D2R;

export const LEFT_X = 40;
export const RIGHT_X = 860;
/** shooter-lane divider, lines up with the inner orbit wall */
export const DIV_X = ARCH_CX + ORBIT_R * Math.cos(ORBIT_A1);
export const DIV_TOP_Y = ARCH_CY + ORBIT_R * Math.sin(ORBIT_A1);
export const LANE_FLOOR_Y = 1424;
export const DRAIN_Y = 1500;
export const APRON_Y = 1348;

export const PLUNGER_X = (DIV_X + RIGHT_X) / 2;
export const PLUNGER_REST_Y = 1382;

// --- orbit mouth (upper left) ----------------------------------------------
export const MOUTH_OUT_X = ARCH_CX + ARCH_R * Math.cos(ORBIT_A0);
export const MOUTH_OUT_Y = ARCH_CY + ARCH_R * Math.sin(ORBIT_A0);
export const MOUTH_IN_X = ARCH_CX + ORBIT_R * Math.cos(ORBIT_A0);
export const MOUTH_IN_Y = ARCH_CY + ORBIT_R * Math.sin(ORBIT_A0);
export const SPINNER_X = (MOUTH_OUT_X + MOUTH_IN_X) / 2;
export const SPINNER_Y = (MOUTH_OUT_Y + MOUTH_IN_Y) / 2;
export const SPINNER_ROT = ORBIT_A0;
/** direction that points *into* the orbit lane at the mouth */
export const MOUTH_IN_NX = -Math.sin(ORBIT_A0);
export const MOUTH_IN_NY = Math.cos(ORBIT_A0);

// --- flippers ---------------------------------------------------------------
export const FLIP_LEN = 130;
export const FLIP_R_BASE = 15;
export const FLIP_R_TIP = 9;
export const FLIP_Y = 1255;
// Pivot spacing is set from the *surface* gap between the resting tips, not
// the centre gap: tips are 9px capsules, so 54px between centres leaves a
// 36px mouth for a 28px ball. Any tighter and the ball is cradled by the two
// tips and the centre drain never opens.
export const FLIP_LX = 260;
export const FLIP_RX = 544;
export const FLIP_REST = 28 * D2R;
export const FLIP_UP = -30 * D2R;

// --- bumpers ----------------------------------------------------------------
export const BUMPERS: { x: number; y: number }[] = [
  { x: 318, y: 606 },
  { x: 486, y: 590 },
  { x: 402, y: 712 },
];
export const BUMPER_R = 40;

// --- slingshots (kick face is p1 -> p3) -------------------------------------
export interface SlingDef {
  x1: number; y1: number;
  x2: number; y2: number;
  x3: number; y3: number;
}
export const SLING_L: SlingDef = { x1: 278, y1: 1072, x2: 274, y2: 1176, x3: 374, y3: 1144 };
export const SLING_R: SlingDef = { x1: 526, y1: 1072, x2: 530, y2: 1176, x3: 430, y3: 1144 };

// --- drop targets -----------------------------------------------------------
export interface TargetDef { x: number; y: number; angle: number }
export const TARGET_HALF = 32;
export const TARGET_R = 9;
export const TARGETS_L: TargetDef[] = [
  { x: 150, y: 646, angle: 97 * D2R },
  { x: 144, y: 728, angle: 90 * D2R },
  { x: 150, y: 810, angle: 83 * D2R },
];
export const TARGETS_R: TargetDef[] = TARGETS_L.map((t) => ({
  x: 2 * PF_CX - t.x,
  y: t.y,
  angle: Math.PI - t.angle,
}));

// --- posts, rollovers, saucer ----------------------------------------------
export const POSTS: { x: number; y: number; r: number }[] = [
  { x: 402, y: 1086, r: 14 },
  { x: 226, y: 924, r: 13 },
  { x: 578, y: 924, r: 13 },
  // rubber at the mouth of each outlane, so cheap side drains are rarer
  { x: 196, y: 1032, r: 13 },
  { x: 608, y: 1032, r: 13 },
];

/** Big painted planet that anchors the middle of the table. */
export const PLANET_X = 402;
export const PLANET_Y = 916;
export const PLANET_R = 122;

export const ROLLOVERS: { x: number; y: number }[] = [
  { x: 232, y: 988 },
  { x: 322, y: 1030 },
  { x: 482, y: 1030 },
  { x: 572, y: 988 },
];
export const ROLLOVER_R = 30;

/** Standing targets flanking the star gate — they pop straight back up. */
export const STANDUPS: TargetDef[] = [
  { x: 236, y: 392, angle: 58 * D2R },
  { x: 568, y: 392, angle: 122 * D2R },
];
export const STANDUP_HALF = 30;

/**
 * Outlane kickbacks. Playtesting a passive player found 17 of 19 balls dying
 * in the left outlane with only 3 flipper chances in the whole run — the table
 * was killing the ball somewhere the player could never reach. Both outlanes
 * now fire the ball back into play, so the centre drain is the real one.
 */
export const KICKBACK_L = { x: 200, y: 1268 };
export const KICKBACK_R = { x: 2 * PF_CX - 200, y: 1268 };
/**
 * A ball past this depth and outside the flipper span is committed to an
 * outlane. Fire it where it stands — an earlier version teleported it onto the
 * kicker's own coordinates, which sat inside the outer wall, so the ball was
 * shoved back out and drained anyway.
 */
export const KICKBACK_Y = 1250;
// Reaches right up to the flipper's pivot. A narrower trigger left a ~20px
// band between it and the bat where the ball slipped past unreachably —
// which was most of the deaths in a passive-player run.
export const KICKBACK_LX = 254;
export const KICKBACK_RX = 2 * PF_CX - 254;

export const SAUCER_X = 402;
export const SAUCER_Y = 462;
export const SAUCER_R = 32;

// --- wall polylines ---------------------------------------------------------
type Poly = [number, number][];

export const WALL_LEFT: Poly = [
  [LEFT_X, ARCH_CY],
  [LEFT_X, 894],
  [126, 1044],
  [150, 1160],
  [174, 1292],
  [192, APRON_Y + 20],
];
export const WALL_RIGHT: Poly = [
  [DIV_X, 894],
  [2 * PF_CX - 126, 1044],
  [2 * PF_CX - 150, 1160],
  [2 * PF_CX - 174, 1292],
  [2 * PF_CX - 192, APRON_Y + 20],
];
export const WALL_DIVIDER: Poly = [
  [DIV_X, DIV_TOP_Y],
  [DIV_X, LANE_FLOOR_Y],
];
export const WALL_LANE_OUTER: Poly = [
  [RIGHT_X, ARCH_CY],
  [RIGHT_X, LANE_FLOOR_Y],
];
export const WALL_LANE_FLOOR: Poly = [
  [DIV_X, LANE_FLOOR_Y],
  [RIGHT_X, LANE_FLOOR_Y],
];
/**
 * Outlane / inlane divider. The lower run is deliberately near-horizontal and
 * clears the flipper bat: it catches the ball out of the inlane and rolls it
 * onto the middle of the bat. Earlier revisions funnelled the inlane shut and
 * the ball wedged permanently beside the flipper's pivot.
 */
export const GUIDE_LEFT: Poly = [
  [196, 1046],
  [206, 1152],
  [234, 1216],
  [282, 1240],
];
export const GUIDE_RIGHT: Poly = GUIDE_LEFT.map(
  ([x, y]) => [2 * PF_CX - x, y] as [number, number],
);

/**
 * Ball guide under the orbit exit. Without it the plunger shot fell straight
 * down the left channel into the outlane every single time; this sweeps the
 * ball right, into the drop targets and the bumper pocket.
 */
export const GUIDE_UPPER_LEFT: Poly = [
  [46, 458],
  [64, 528],
  [104, 578],
  [166, 602],
];
export const GUIDE_UPPER_RIGHT: Poly = GUIDE_UPPER_LEFT.map(
  ([x, y]) => [2 * PF_CX - x, y] as [number, number],
);

function polyToSegs(p: Poly, r: number, e: number, tag?: string): SegCollider[] {
  const out: SegCollider[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    out.push({
      kind: 'seg',
      ax: p[i][0], ay: p[i][1],
      bx: p[i + 1][0], by: p[i + 1][1],
      r, e, tag,
    });
  }
  return out;
}

/** Static walls — everything the ball just bounces off. */
export function buildWalls(): Collider[] {
  const arch: ArcCollider = {
    kind: 'arc',
    cx: ARCH_CX, cy: ARCH_CY, R: ARCH_R,
    a0: -Math.PI, a1: 0,
    r: WALL_R, e: 0.4, tag: 'wall',
  };
  const orbit: ArcCollider = {
    kind: 'arc',
    cx: ARCH_CX, cy: ARCH_CY, R: ORBIT_R,
    a0: ORBIT_A0, a1: ORBIT_A1,
    r: WALL_R, e: 0.4, tag: 'wall',
  };
  const gate: SegCollider = {
    kind: 'seg',
    ax: MOUTH_OUT_X, ay: MOUTH_OUT_Y,
    bx: MOUTH_IN_X, by: MOUTH_IN_Y,
    r: 5, e: 0.3,
    owx: MOUTH_IN_NX, owy: MOUTH_IN_NY,
    tag: 'gate',
  };
  return [
    arch,
    orbit,
    gate,
    ...polyToSegs(WALL_LEFT, WALL_R, 0.4, 'wall'),
    ...polyToSegs(WALL_RIGHT, WALL_R, 0.4, 'wall'),
    ...polyToSegs(WALL_DIVIDER, WALL_R, 0.4, 'wall'),
    ...polyToSegs(WALL_LANE_OUTER, WALL_R, 0.4, 'wall'),
    ...polyToSegs(WALL_LANE_FLOOR, WALL_R, 0.25, 'wall'),
    ...polyToSegs(GUIDE_LEFT, 7, 0.4, 'guide'),
    ...polyToSegs(GUIDE_RIGHT, 7, 0.4, 'guide'),
    ...polyToSegs(GUIDE_UPPER_LEFT, 7, 0.45, 'guide'),
    ...polyToSegs(GUIDE_UPPER_RIGHT, 7, 0.45, 'guide'),
  ];
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

export const C = {
  space: 0x05041a,
  felt: 0x2a2080,
  rail: 0x4a5590,
  railLit: 0xc9d6ff,
  gold: 0xffc247,
  goldPale: 0xffeaa8,
  cyan: 0x3fe8ff,
  magenta: 0xff4f9d,
  lime: 0x5fffa8,
  violet: 0xa678ff,
  orange: 0xff8a3d,
  steel: 0xdfe6ff,
};

// ---------------------------------------------------------------------------
// Static art
// ---------------------------------------------------------------------------

/** Traces the outline of the whole table (playfield + shooter lane). */
export function tablePath(g: Graphics): Graphics {
  g.moveTo(LEFT_X, DRAIN_Y);
  g.lineTo(LEFT_X, ARCH_CY);
  g.arc(ARCH_CX, ARCH_CY, ARCH_R, Math.PI, 0, false);
  g.lineTo(RIGHT_X, DRAIN_Y);
  g.closePath();
  return g;
}

/** Deep-space canvas behind the cabinet. */
export function makeSpaceTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b0830');
  bg.addColorStop(0.5, '#05041a');
  bg.addColorStop(1, '#02020c');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  for (const [cx, cy, r, col] of [
    [140, 260, 420, 'rgba(120,70,220,0.24)'],
    [790, 900, 480, 'rgba(30,110,220,0.18)'],
    [430, 1500, 520, 'rgba(200,50,140,0.15)'],
  ] as [number, number, number, string][]) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 340; i++) {
    const sx = rnd() * W;
    const sy = rnd() * H;
    x.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.6})`;
    x.beginPath();
    x.arc(sx, sy, rnd() * 1.5 + 0.4, 0, Math.PI * 2);
    x.fill();
  }
  return Texture.from(c);
}

/** The painted playfield surface — this is what sells "real table". */
export function makeFeltTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;

  const base = x.createLinearGradient(0, 100, 0, H);
  base.addColorStop(0, '#463099');
  base.addColorStop(0.28, '#33227f');
  base.addColorStop(0.58, '#281a68');
  base.addColorStop(0.85, '#1d1250');
  base.addColorStop(1, '#150d3c');
  x.fillStyle = base;
  x.fillRect(0, 0, W, H);

  // sun flare behind the star gate
  const sg = x.createRadialGradient(SAUCER_X, 330, 20, SAUCER_X, 330, 330);
  sg.addColorStop(0, 'rgba(120,220,255,0.34)');
  sg.addColorStop(0.4, 'rgba(90,120,255,0.18)');
  sg.addColorStop(1, 'rgba(40,30,120,0)');
  x.fillStyle = sg;
  x.fillRect(SAUCER_X - 340, 0, 680, 680);

  // radiating shot lines from the top of the table
  x.save();
  x.translate(SAUCER_X, 300);
  for (let i = 0; i < 22; i++) {
    x.rotate((Math.PI * 2) / 22);
    x.fillStyle = i % 2 ? 'rgba(150,190,255,0.05)' : 'rgba(190,150,255,0.035)';
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(520, -60);
    x.lineTo(520, 60);
    x.closePath();
    x.fill();
  }
  x.restore();

  // --- the centrepiece: a big ringed planet filling the mid-playfield
  x.save();
  x.translate(PLANET_X, PLANET_Y);

  // back half of the rings
  x.save();
  x.rotate(-0.3);
  x.scale(1, 0.26);
  for (const [r, w, col] of [
    [PLANET_R * 1.75, 20, 'rgba(255,194,71,0.42)'],
    [PLANET_R * 2.06, 11, 'rgba(63,232,255,0.34)'],
    [PLANET_R * 2.3, 6, 'rgba(255,79,157,0.28)'],
  ] as [number, number, string][]) {
    x.strokeStyle = col;
    x.lineWidth = w;
    x.beginPath();
    x.arc(0, 0, r, Math.PI, Math.PI * 2);
    x.stroke();
  }
  x.restore();

  // planet body
  const pb = x.createRadialGradient(-PLANET_R * 0.35, -PLANET_R * 0.4, PLANET_R * 0.1, 0, 0, PLANET_R);
  pb.addColorStop(0, '#8f6bff');
  pb.addColorStop(0.42, '#5b39c8');
  pb.addColorStop(0.78, '#331d84');
  pb.addColorStop(1, '#1a0f4e');
  x.fillStyle = pb;
  x.beginPath();
  x.arc(0, 0, PLANET_R, 0, Math.PI * 2);
  x.fill();

  // banding
  x.save();
  x.beginPath();
  x.arc(0, 0, PLANET_R, 0, Math.PI * 2);
  x.clip();
  for (const [oy, h, col] of [
    [-58, 16, 'rgba(190,160,255,0.26)'],
    [-14, 26, 'rgba(120,220,255,0.18)'],
    [40, 18, 'rgba(255,150,210,0.16)'],
    [82, 12, 'rgba(255,194,71,0.14)'],
  ] as [number, number, string][]) {
    x.fillStyle = col;
    x.beginPath();
    x.ellipse(0, oy, PLANET_R * 1.1, h, 0, 0, Math.PI * 2);
    x.fill();
  }
  // terminator shadow
  const term = x.createLinearGradient(-PLANET_R, 0, PLANET_R, PLANET_R);
  term.addColorStop(0, 'rgba(0,0,0,0)');
  term.addColorStop(0.62, 'rgba(5,2,25,0.28)');
  term.addColorStop(1, 'rgba(3,1,18,0.72)');
  x.fillStyle = term;
  x.fillRect(-PLANET_R, -PLANET_R, PLANET_R * 2, PLANET_R * 2);
  x.restore();

  // front half of the rings, drawn over the planet
  x.save();
  x.rotate(-0.3);
  x.scale(1, 0.26);
  for (const [r, w, col] of [
    [PLANET_R * 1.75, 20, 'rgba(255,205,110,0.72)'],
    [PLANET_R * 2.06, 11, 'rgba(63,232,255,0.6)'],
    [PLANET_R * 2.3, 6, 'rgba(255,79,157,0.5)'],
  ] as [number, number, string][]) {
    x.strokeStyle = col;
    x.lineWidth = w;
    x.beginPath();
    x.arc(0, 0, r, 0, Math.PI);
    x.stroke();
  }
  x.restore();
  x.restore();

  // starfield dusted over the felt
  let seed = 90210;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 300; i++) {
    const sx = rnd() * W;
    const sy = 120 + rnd() * (H - 120);
    x.fillStyle = `rgba(255,255,255,${0.12 + rnd() * 0.5})`;
    x.beginPath();
    x.arc(sx, sy, rnd() * 1.5 + 0.3, 0, Math.PI * 2);
    x.fill();
  }

  // vignette so the edges read as a recessed cabinet
  const vg = x.createRadialGradient(450, 760, 340, 450, 760, 940);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.66)');
  x.fillStyle = vg;
  x.fillRect(0, 0, W, H);

  return Texture.from(c);
}

/** A lane arrow insert, pointing along `rot`. */
function laneArrow(g: Graphics, x: number, y: number, rot: number, color: number, alpha: number): void {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const pt = (lx: number, ly: number): [number, number] => [x + lx * c - ly * s, y + lx * s + ly * c];
  const p = [...pt(16, 0), ...pt(-10, -14), ...pt(-4, 0), ...pt(-10, 14)];
  g.poly(p).fill({ color, alpha });
  g.poly(p).stroke({ width: 1.5, color, alpha: alpha * 1.6 });
}

/** Painted lane guides, shot arrows and inserts — drawn under the hardware. */
function drawDecals(g: Graphics): void {
  // orbit lane floor
  g.arc(ARCH_CX, ARCH_CY, (ARCH_R + ORBIT_R) / 2, ORBIT_A0, ORBIT_A1)
    .stroke({ width: ARCH_R - ORBIT_R - 20, color: 0x4c3ac0, alpha: 0.6 });
  g.arc(ARCH_CX, ARCH_CY, (ARCH_R + ORBIT_R) / 2, ORBIT_A0, ORBIT_A1)
    .stroke({ width: 3, color: C.cyan, alpha: 0.35 });
  // chevrons running around the orbit
  for (let k = 0; k <= 9; k++) {
    const a = ORBIT_A0 + ((ORBIT_A1 - ORBIT_A0) * k) / 9;
    const rr = (ARCH_R + ORBIT_R) / 2;
    laneArrow(g, ARCH_CX + Math.cos(a) * rr, ARCH_CY + Math.sin(a) * rr, a + Math.PI / 2, C.cyan, 0.2);
  }

  // shooter lane floor
  g.roundRect(DIV_X + 6, DIV_TOP_Y, RIGHT_X - DIV_X - 12, LANE_FLOOR_Y - DIV_TOP_Y, 18)
    .fill({ color: 0x3b2c9c, alpha: 0.55 });
  for (let y = DIV_TOP_Y + 70; y < LANE_FLOOR_Y - 90; y += 92) {
    laneArrow(g, (DIV_X + RIGHT_X) / 2, y, -Math.PI / 2, C.magenta, 0.24);
  }

  // bumper pocket ring
  g.circle(402, 655, 186).stroke({ width: 4, color: C.violet, alpha: 0.35 });
  g.circle(402, 655, 200).stroke({ width: 1.5, color: C.cyan, alpha: 0.2 });

  // shot arrows pointing at the star gate
  for (const dx of [-64, 64]) {
    for (let i = 0; i < 3; i++) {
      laneArrow(g, SAUCER_X + dx, 570 - i * 30, -Math.PI / 2, C.gold, 0.22 - i * 0.05);
    }
  }

  // feed lanes sweeping in from each orbit exit, tracing the ball guides
  for (const s of [1, -1] as const) {
    const mx = (x: number) => (s === 1 ? x : 2 * PF_CX - x);
    g.moveTo(mx(62), 462).lineTo(mx(84), 534).lineTo(mx(126), 582).lineTo(mx(196), 606)
      .stroke({ width: 46, color: 0x3b2c9c, alpha: 0.5, cap: 'round', join: 'round' });
    laneArrow(g, mx(88), 520, s * 1.1, C.lime, 0.3);
    laneArrow(g, mx(166), 600, s * 0.3, C.lime, 0.28);
  }

  // inlane / outlane paint
  for (const s of [1, -1] as const) {
    const mx = (x: number) => (s === 1 ? x : 2 * PF_CX - x);
    // outlane (drains) and inlane (feeds the flipper), traced between the rails
    g.moveTo(mx(162), 1046).lineTo(mx(180), 1160).lineTo(mx(200), 1272).lineTo(mx(196), 1330)
      .stroke({ width: 42, color: 0x412c96, alpha: 0.5, cap: 'round', join: 'round' });
    g.moveTo(mx(238), 1066).lineTo(mx(242), 1152).lineTo(mx(258), 1214).lineTo(mx(292), 1248)
      .stroke({ width: 44, color: 0x3b2c9c, alpha: 0.6, cap: 'round', join: 'round' });
    laneArrow(g, mx(240), 1120, Math.PI / 2 + s * 0.06, C.gold, 0.32);
    laneArrow(g, mx(174), 1130, Math.PI / 2 + s * 0.12, C.magenta, 0.3);
  }

  // target bank backing plates
  for (const s of [1, -1] as const) {
    const cx = s === 1 ? 148 : 2 * PF_CX - 148;
    g.roundRect(cx - 36, 600, 72, 256, 22)
      .fill({ color: 0x1a1052, alpha: 0.7 })
      .stroke({ width: 2.5, color: s === 1 ? C.lime : C.cyan, alpha: 0.4 });
  }
}

/** Chrome rails drawn over the felt for every wall polyline. */
function drawRail(g: Graphics, pts: [number, number][], width: number, lit: number): void {
  const trace = () => {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  };
  trace();
  g.stroke({ width: width + 9, color: 0x0a0626, alpha: 0.9, cap: 'round', join: 'round' });
  trace();
  g.stroke({ width: width + 2, color: C.rail, cap: 'round', join: 'round' });
  trace();
  g.stroke({ width: Math.max(2, width * 0.4), color: lit, alpha: 0.95, cap: 'round', join: 'round' });
  trace();
  g.stroke({ width: Math.max(1, width * 0.14), color: 0xffffff, alpha: 0.55, cap: 'round', join: 'round' });
}

function drawArcRail(
  g: Graphics, cx: number, cy: number, R: number,
  a0: number, a1: number, width: number, lit: number,
): void {
  g.arc(cx, cy, R, a0, a1).stroke({ width: width + 9, color: 0x0a0626, alpha: 0.9, cap: 'round' });
  g.arc(cx, cy, R, a0, a1).stroke({ width: width + 2, color: C.rail, cap: 'round' });
  g.arc(cx, cy, R, a0, a1).stroke({ width: Math.max(2, width * 0.4), color: lit, alpha: 0.95, cap: 'round' });
  g.arc(cx, cy, R, a0, a1).stroke({ width: Math.max(1, width * 0.14), color: 0xffffff, alpha: 0.5, cap: 'round' });
}

/** Bulb positions strung along the arch — returned so they can twinkle. */
export function archBulbs(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI + (Math.PI * i) / n;
    out.push({
      x: ARCH_CX + Math.cos(a) * (ARCH_R - 26),
      y: ARCH_CY + Math.sin(a) * (ARCH_R - 26),
    });
  }
  return out;
}

/** The apron: the metal plate the ball drains behind. */
function drawApron(g: Graphics): void {
  const yTop = APRON_Y;
  const gapL = 322;
  const gapR = 2 * PF_CX - 322;
  for (const side of [0, 1]) {
    const pts = side === 0
      ? [LEFT_X - 6, yTop, gapL, yTop, gapL - 26, DRAIN_Y + 8, LEFT_X - 6, DRAIN_Y + 8]
      : [DIV_X + 6, yTop, gapR, yTop, gapR + 26, DRAIN_Y + 8, DIV_X + 6, DRAIN_Y + 8];
    g.poly(pts).fill({ color: 0x191140, alpha: 1 });
    g.poly(pts).stroke({ width: 3, color: C.violet, alpha: 0.85 });
  }
  // brushed-metal streaks
  for (let i = 0; i < 7; i++) {
    const y = yTop + 10 + i * 18;
    g.moveTo(LEFT_X, y).lineTo(gapL - 14, y)
      .stroke({ width: 1.5, color: 0xffffff, alpha: 0.06 });
    g.moveTo(gapR + 14, y).lineTo(DIV_X, y)
      .stroke({ width: 1.5, color: 0xffffff, alpha: 0.06 });
  }
  // highlight along the leading edge
  g.moveTo(LEFT_X - 6, yTop + 2).lineTo(gapL, yTop + 2)
    .stroke({ width: 3, color: C.cyan, alpha: 0.5 });
  g.moveTo(gapR, yTop + 2).lineTo(DIV_X + 6, yTop + 2)
    .stroke({ width: 3, color: C.cyan, alpha: 0.5 });
  // the drain mouth itself, with a lit grille so it reads as a hole
  g.poly([gapL, yTop, gapR, yTop, gapR + 26, DRAIN_Y + 8, gapL - 26, DRAIN_Y + 8])
    .fill({ color: 0x03020c, alpha: 0.96 });
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const y = yTop + (DRAIN_Y + 8 - yTop) * t;
    g.moveTo(gapL - 26 * t, y).lineTo(gapR + 26 * t, y)
      .stroke({ width: 2, color: C.magenta, alpha: 0.3 - t * 0.22 });
  }
  g.moveTo(gapL, yTop).lineTo(gapR, yTop)
    .stroke({ width: 3, color: C.magenta, alpha: 0.65 });
  g.moveTo(gapL, yTop).lineTo(gapL - 26, DRAIN_Y + 8)
    .stroke({ width: 2.5, color: C.magenta, alpha: 0.35 });
  g.moveTo(gapR, yTop).lineTo(gapR + 26, DRAIN_Y + 8)
    .stroke({ width: 2.5, color: C.magenta, alpha: 0.35 });
}

/**
 * Builds the static table: felt surface (masked to the cabinet outline),
 * painted decals, chrome rails and the apron.
 */
export function buildPlayfield(feltTex: Texture, bulbTex: Texture): Container {
  const root = new Container();

  const mask = tablePath(new Graphics()).fill(0xffffff);
  const felt = new Sprite(feltTex);
  felt.mask = mask;
  root.addChild(felt, mask);

  const decals = new Graphics();
  drawDecals(decals);
  const decalMask = tablePath(new Graphics()).fill(0xffffff);
  decals.mask = decalMask;
  root.addChild(decals, decalMask);

  const rails = new Graphics();
  drawArcRail(rails, ARCH_CX, ARCH_CY, ARCH_R, Math.PI, Math.PI * 2, WALL_R * 2, C.railLit);
  drawArcRail(rails, ARCH_CX, ARCH_CY, ORBIT_R, ORBIT_A0, ORBIT_A1, WALL_R * 2, C.cyan);
  drawRail(rails, WALL_LEFT, WALL_R * 2, C.railLit);
  drawRail(rails, WALL_RIGHT, WALL_R * 2, C.railLit);
  drawRail(rails, WALL_DIVIDER, WALL_R * 2, C.railLit);
  drawRail(rails, WALL_LANE_OUTER, WALL_R * 2, C.railLit);
  drawRail(rails, WALL_LANE_FLOOR, WALL_R * 2, C.railLit);
  drawRail(rails, GUIDE_LEFT, 12, C.gold);
  drawRail(rails, GUIDE_RIGHT, 12, C.gold);
  drawRail(rails, GUIDE_UPPER_LEFT, 12, C.lime);
  drawRail(rails, GUIDE_UPPER_RIGHT, 12, C.cyan);
  root.addChild(rails);

  // bulbs strung along the arch
  const bulbs = new Container();
  for (const b of archBulbs()) {
    const s = new Sprite(bulbTex);
    s.anchor.set(0.5);
    s.position.set(b.x, b.y);
    s.scale.set(0.44);
    s.tint = C.goldPale;
    s.alpha = 0.75;
    s.blendMode = 'add';
    bulbs.addChild(s);
  }
  root.addChild(bulbs);

  const apron = new Graphics();
  drawApron(apron);
  root.addChild(apron);

  // cabinet edge — a chunky bezel around the whole table
  const bezel = tablePath(new Graphics()).stroke({ width: 22, color: 0x0a0626, alpha: 1 });
  tablePath(bezel).stroke({ width: 8, color: C.rail, alpha: 1 });
  tablePath(bezel).stroke({ width: 3, color: C.violet, alpha: 0.95 });
  root.addChild(bezel);

  return root;
}
