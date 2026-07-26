import { Color3 } from "@babylonjs/core/Maths/math.color";

/** Lane center x positions (3 lanes). */
export const LANE_X = [-3, 0, 3];

export const SHIP_BASE_Y = 0.95; // hover height of the ship
export const SHIP_Z = 0; // ship stays fixed in z; the world scrolls past

export const SPEED_START = 19;
export const SPEED_MAX = 58;
export const SPEED_RAMP = 0.55; // units/sec gained per second

export const JUMP_VELOCITY = 13.5;
export const GRAVITY = -34;

export const SPAWN_Z = 205; // where obstacles appear
export const KILL_Z = -22; // where world objects are recycled
export const FOG_START = 70;
export const FOG_END = 195;

export const SEGMENT_LENGTH = 30;
export const SEGMENT_COUNT = 9;
export const TRACK_WIDTH = 11;

export const PICKUP_SCORE = 50;

export const PALETTE = {
  bgClear: "#050110",
  hull: "#20336f",
  hullDark: "#0e1330",
  cyan: "#37f2ff",
  magenta: "#ff3fd8",
  orange: "#ff8f3c",
  violet: "#8a6bff",
  gold: "#ffd54a",
  trackBase: "#0d1030",
  fog: "#0a0524",
};

export function hex(c: string): Color3 {
  return Color3.FromHexString(c);
}
