import { Color3 } from "@babylonjs/core/Maths/math.color";

/* ==========================================================================
 * Palette — sunny island resort. Chosen up front; nothing uses a default color.
 * ========================================================================== */
export const PALETTE = {
  skyTop: "#3FB4E8",
  skyMid: "#7fd4f5",
  skyLow: "#cff0ff",

  grass: "#6fbf5f",
  grassDark: "#4f9a45",
  sand: "#f0dfb8",
  path: "#e8d3a4",
  pathEdge: "#cdb384",

  wall: "#fff3e0",
  wallShade: "#f2ddbf",
  roof: "#e8734a",
  roofDark: "#c4552f",
  door: "#5b8fa8",
  windowLit: "#ffd97a",
  windowDark: "#9fc9dd",

  water: "#2fc3e3",
  waterDeep: "#1287ab",
  foam: "#e8fbff",
  deck: "#c98a55",
  deckDark: "#a06c3f",

  slide: "#ff5fa2",
  slideAlt: "#ffe27a",

  coin: "#ffc94a",
  coinDark: "#e0a01e",
  star: "#ffd93b",

  skinA: "#f3c6a0",
  skinB: "#c98d63",
  skinC: "#8c5a3c",

  managerShirt: "#e8734a",
  managerTrim: "#ffd93b",

  leaf: "#5fae50",
  leafDark: "#3d7a36",
  trunk: "#8a6242",

  padGlow: "#7ef0ff",
  padReady: "#8bf07a",
  ink: "#17384a",
} as const;

/** Distinct guest outfit colors — one instanced prototype per entry. */
export const GUEST_COLORS: readonly string[] = [
  "#f26d8b", // rose
  "#6fa8ff", // cornflower
  "#9d78e8", // violet
  "#48c9a0", // mint
  "#ffb03b", // amber
  "#ff8b5e", // coral
  "#5fd0e8", // sky
  "#c86fd4", // orchid
];

export function hex(c: string): Color3 {
  return Color3.FromHexString(c);
}

/* ==========================================================================
 * World layout
 *
 *   X runs west(-) to east(+); the resort grows eastward as you buy land.
 *   Z runs south(-) to north(+). The promenade is the open corridor at z=0.
 *
 *          z = +9  ── north band: rooms, then the gym
 *          z =  0  ── promenade: entrance, desk, safe, decor, build pads
 *          z = -9  ── south band: rooms, bathrooms, pool, restaurant
 *
 *   Guests arrive along a road stretching far to the west, so the queue
 *   genuinely reads as a line running off down the street.
 * ========================================================================== */

export const BAND_N = 9;
export const BAND_S = -9;
export const PLOT_WEST = -13;
export const PLOT_Z_HALF = 14;

/** Eastern plot edge per expansion tier. Index = tier. */
export const PLOT_TIERS = [13, 26, 40, 50] as const;

/** The approach road guests walk in along. */
export const ROAD_WEST = -40;
export const ROAD_HALF_WIDTH = 3.2;

export const SPAWN = { x: -37, z: 0 };
export const DESK = { x: -8, z: 1.6 };
/** Where the manager (or receptionist) stands to serve — in front of the counter. */
export const DESK_STATION = { x: -8, z: -0.6 };

/** Head of the queue; subsequent guests stack westward. */
export const QUEUE_HEAD = { x: -8, z: -2.4 };
export const QUEUE_SPACING = 1.28;
export const QUEUE_MAX = 16;

/** Named build lots. Every buildable in content.ts points at one of these. */
export interface Lot {
  id: string;
  x: number;
  z: number;
  /** Which way the front door faces: +1 = toward +z, -1 = toward -z. */
  facing: 1 | -1;
}

/** Lot ids are purely spatial: n* = north band, s* = south band. */
export const LOTS: readonly Lot[] = [
  // The north band starts at x=2, not x=-2: the camera looks north-east from a
  // fixed angle, so a lot any further west sits directly behind the lobby and
  // the player's very first room is invisible.
  { id: "n1", x: 2, z: BAND_N, facing: -1 },
  { id: "n2", x: 9, z: BAND_N, facing: -1 },
  { id: "n3", x: 16, z: BAND_N, facing: -1 },
  { id: "n4", x: 23, z: BAND_N, facing: -1 },
  { id: "n5", x: 30, z: BAND_N, facing: -1 },
  { id: "n6", x: 37, z: BAND_N, facing: -1 },
  { id: "n7", x: 44, z: BAND_N, facing: -1 },
  { id: "s1", x: -2, z: BAND_S, facing: 1 },
  { id: "s2", x: 5, z: BAND_S, facing: 1 },
  { id: "s3", x: 12, z: BAND_S, facing: 1 },
  // Pulled south and trimmed so its coping lines up with the other
  // south-band buildings instead of eating the walkway apron.
  { id: "s4", x: 22.25, z: -10.8, facing: 1 },
  { id: "s5", x: 34, z: BAND_S, facing: 1 },
  { id: "s6", x: 44, z: BAND_S, facing: 1 },
];

export function lotById(id: string): Lot {
  const l = LOTS.find((v) => v.id === id);
  if (!l) throw new Error(`unknown lot ${id}`);
  return l;
}

/** Standing spot in front of a lot, on the promenade side. */
export function lotDoor(lot: Lot): { x: number; z: number } {
  return { x: lot.x, z: lot.z + lot.facing * 3.4 };
}

/* ==========================================================================
 * Movement
 * ========================================================================== */
export const PLAYER_SPEED = 9.2;
export const PLAYER_ACCEL = 62;
export const GUEST_SPEED = 3.1;
export const STAFF_SPEED = 4.4;
/** Agents nudge apart when closer than this. */
export const SEPARATION_R = 0.62;
export const ARRIVE_R = 0.42;

/** Guest-room footprint. Cleaning works anywhere inside this. */
export const ROOM_W = 5.6;
export const ROOM_D = 4.5;

export const GUEST_H = 1.51;
export const GUEST_R = 0.32;
export const PLAYER_H = 1.78;

/* ==========================================================================
 * Core loop timings — deliberately generous. This is tuned for a 5-year-old:
 * an impatient guest costs you a fare, never a life, and the hotel can always
 * climb back out of a bad streak.
 * ========================================================================== */
export const PATIENCE_BASE = 52;
/** How long a guest stays in their room before checking out. */
export const ROOM_STAY = 18;
/** Seconds between tip drops while a room is occupied. */
export const TIP_PERIOD = 7;
/** How long the check-in / clean / scoop progress rings take to fill. */
export const ACT_CHECKIN = 0.75;
export const ACT_CLEAN = 1.5;
export const ACT_SCOOP = 1.1;
export const ACT_SERVE = 1.2;
/** How long a departing guest lingers at the ice cream cart. */
export const CART_STOP = 2.4;
/** Radius within which standing still auto-starts a job. */
export const INTERACT_R = 2.5;
/**
 * How close the front guest must be to the head of the queue before they can
 * be checked in. Guests join the queue the instant they spawn, far down the
 * road, so without this you can serve someone who hasn't arrived yet.
 */
export const CHECKIN_REACH = 1.7;
/** Cash flies to you inside this radius so precision is never required. */
export const MAGNET_R = 3.4;
/** The Lucky Magnet perk multiplies it. */
export const MAGNET_PERK_MUL = 2.2;

export const BASE_ROOM_RATE = 14;
export const TIP_VALUE = 5;
/** Arrivals get faster as the resort becomes more of a draw. */
export const ARRIVE_BASE = 5.6;
export const ARRIVE_MIN = 1.25;
/** The line stops growing past this, so a tiny hotel never gets swamped. */
export function queueCap(rooms: number): number {
  return Math.min(QUEUE_MAX, rooms * 3 + 4);
}

export const STARS_START = 3.0;
export const STAR_GAIN = 0.035;
export const STAR_LOSS = 0.16;

/** Cap on how much of an away-stretch pays out, and at what discount. */
export const OFFLINE_CAP_S = 4 * 3600;
export const OFFLINE_RATE = 0.55;

/* ==========================================================================
 * Camera
 * ========================================================================== */
/** How far the camera leans toward the player vs. the middle of the plot. */
export const FOCUS_W = 0.58;
/** Lower beta = more overhead. Tuned so both room bands stay in frame. */
export const CAM_BETA = 0.88;
export const CAM_ALPHA = -Math.PI / 2 - 0.62;
export const CAM_LAG = 3.4;
/** Multiplier from plot width to camera distance. */
export const CAM_FIT = 0.82;

export const SAVE_KEY = "grandHotel.save";
export const MUTE_KEY = "grandHotel.muted";
export const SAVE_VERSION = 1;
export const AUTOSAVE_EVERY = 3;
