/**
 * All gameplay tuning + world geometry constants live here.
 * World units are roughly meters. The lane runs along +Z, the player
 * camera sits at -Z looking down the alley. +X is screen-right.
 */

export const BALLS_PER_GAME = 9;
export const HS_KEY = "sb-hs"; // shared with v1 so best scores carry over

// ---- lane geometry ----
export const BALL_R = 0.11;
export const LANE_HALF = 0.45; // half interior width of the lane
export const LANE_START_Z = -0.5;
export const BALL_START_Z = 1.6;
export const RAMP_START_Z = 5.0;
export const RAMP_END_Z = 6.3;
export const HUMP_H = 0.55; // height of the launch hump
export const PIT_FLOOR_Y = -0.42;
export const ROOM_FLOOR_Y = -0.45;

/** Height of the lane surface at z (0 on the flat, parabolic on the ramp). */
export function rampH(z: number): number {
  if (z <= RAMP_START_Z) return 0;
  const t = Math.min(1, (z - RAMP_START_Z) / (RAMP_END_Z - RAMP_START_Z));
  return HUMP_H * t * t;
}

/** dY/dZ of the lane surface at z. */
export function rampSlope(z: number): number {
  if (z <= RAMP_START_Z) return 0;
  const len = RAMP_END_Z - RAMP_START_Z;
  const t = Math.min(1, (z - RAMP_START_Z) / len);
  return (2 * HUMP_H * t) / len;
}

// ---- target board ----
export const BOARD_Y = 1.05; // world position of the ring bullseye center
export const BOARD_Z = 7.55;
export const BOARD_TILT = (30 * Math.PI) / 180; // leaned back from vertical
export const BOARD_HALF_W = 0.62;
export const BOARD_TOP_V = 0.70; // extent up the board from ring center
export const BOARD_BOT_V = -0.52; // extent down

// ring boundary radii, innermost first, and the points inside each boundary
export const RING_RADII = [0.075, 0.155, 0.245, 0.335, 0.44];
export const RING_POINTS = [50, 40, 30, 20, 10];
export const RING_COLORS = ["#FFD700", "#FF9900", "#CC33FF", "#3399FF", "#33CC66"];

export const POCKET_U = 0.38; // |x| of the two 100-point pockets
export const POCKET_V = 0.5; // up the board from ring center
export const POCKET_R = 0.078;
export const POCKET_COLOR = "#FF3366";

// ---- physics ----
export const GRAVITY = 9.8;
export const FLAT_FRICTION = 0.35; // rolling decel on the flat (m/s^2)
export const RAIL_RESTITUTION = 0.55;
export const RIM_BAND = 0.03; // rim-hit randomness band around ring edges
export const MAX_AIM = 0.12; // radians of lateral aim
export const MIN_POWER = 0.05;

/** Maps normalized power [0..1] to launch speed at the foul line. */
export function powerToSpeed(p: number): number {
  // The board is leaned back, so the landing height is a strongly non-linear
  // function of launch speed. This maps power -> a roughly *linear* landing
  // position on the board (v), which is what makes aiming feel fair:
  //   p ~ 0.43 -> bullseye, p ~ 0.79 -> the 100 pockets, p > 0.91 -> over the top.
  const v = -0.62 + 1.45 * Math.min(1, Math.max(0, p));
  return 4.87 + 1.62 * v + 1.55 * v * v + 1.45 * v * v * v;
}

// ---- ball return ----
export const RETURN_X = 0.78; // return trough x offset
export const RACK_Z0 = 1.7; // first parked ball z
export const RACK_SPACING = 0.235;

export function troughY(z: number): number {
  // gently sloped toward the player
  return -0.16 + (z / 7) * 0.1;
}

export const PALETTE = {
  bg: "#0a0614",
  woodLight: "#d9a45c",
  woodMid: "#b57f38",
  woodDark: "#7c5320",
  cabinet: "#241432",
  neonCyan: "#37f2ff",
  neonMagenta: "#ff3fd8",
  neonGold: "#ffd54a",
  felt: "#141830",
};

export function scoreColor(pts: number): string {
  if (pts >= 100) return POCKET_COLOR;
  const i = RING_POINTS.indexOf(pts);
  return i >= 0 ? RING_COLORS[i] : "#8f97b3";
}
