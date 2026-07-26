import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { BOARD_TILT, BOARD_Y, BOARD_Z } from "./config";

/** Origin of the target board = center of the ring bullseye. */
export const BOARD_O = new Vector3(0, BOARD_Y, BOARD_Z);
/** "Up the board" axis (leans away from the player). */
export const BOARD_UP = new Vector3(0, Math.cos(BOARD_TILT), Math.sin(BOARD_TILT));
/** Board face normal — points back toward the player and slightly up. */
export const BOARD_N = new Vector3(0, Math.sin(BOARD_TILT), -Math.cos(BOARD_TILT));
/** Board right axis. */
export const BOARD_R = new Vector3(1, 0, 0);
/**
 * rotation.x that takes a Y-up mesh (torus, cylinder) to the board normal.
 * Babylon is left-handed: +rotation.x swings +Y toward +Z.
 */
export const BOARD_TILT_ROT = -(Math.PI / 2 - BOARD_TILT);

/** Board (u, v) + normal offset -> world position. */
export function boardPoint(u: number, v: number, n = 0, out?: Vector3): Vector3 {
  const p = out ?? new Vector3();
  p.set(
    BOARD_O.x + BOARD_R.x * u + BOARD_UP.x * v + BOARD_N.x * n,
    BOARD_O.y + BOARD_R.y * u + BOARD_UP.y * v + BOARD_N.y * n,
    BOARD_O.z + BOARD_R.z * u + BOARD_UP.z * v + BOARD_N.z * n
  );
  return p;
}

/** Signed distance of a world point from the board plane (+ = in front). */
export function boardDistance(p: Vector3): number {
  return (p.x - BOARD_O.x) * BOARD_N.x + (p.y - BOARD_O.y) * BOARD_N.y + (p.z - BOARD_O.z) * BOARD_N.z;
}

/** World point -> board (u, v). */
export function boardUV(p: Vector3): { u: number; v: number } {
  const dx = p.x - BOARD_O.x;
  const dy = p.y - BOARD_O.y;
  const dz = p.z - BOARD_O.z;
  return {
    u: dx * BOARD_R.x + dy * BOARD_R.y + dz * BOARD_R.z,
    v: dx * BOARD_UP.x + dy * BOARD_UP.y + dz * BOARD_UP.z,
  };
}
