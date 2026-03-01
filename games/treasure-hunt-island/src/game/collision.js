import { TILE, WALKABLE } from './constants.js';
import { getTile } from './island.js';

// Check if a rectangular hitbox can be at (px, py) — center position
export function canMove(px, py, halfW, halfH) {
  // Check all 4 corners of the hitbox
  const corners = [
    [px - halfW, py - halfH], // top-left
    [px + halfW, py - halfH], // top-right
    [px - halfW, py + halfH], // bottom-left
    [px + halfW, py + halfH], // bottom-right
  ];
  for (const [x, y] of corners) {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (!WALKABLE.has(getTile(col, row))) return false;
  }
  return true;
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}
