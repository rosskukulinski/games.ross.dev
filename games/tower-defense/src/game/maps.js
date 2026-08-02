import { CELL, COLS, ROWS } from './constants.js';

// Waypoints define the center of path cells the enemies follow.
// S-curve path: enters left side, zigzags 3 times, exits right side.
// Coordinates are in pixel space (center of cells).
const wp = (col, row) => ({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });

export const WAYPOINTS = [
  wp(0, 2),
  wp(16, 2),
  wp(16, 5),
  wp(3, 5),
  wp(3, 8),
  wp(16, 8),
  wp(16, 11),
  wp(3, 11),
  wp(3, 13),
  wp(19, 13),
];

// Build set of path cells for placement validation.
// We trace between consecutive waypoints and mark every cell along the way.
function buildPathCells() {
  const cells = new Set();
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const a = WAYPOINTS[i];
    const b = WAYPOINTS[i + 1];
    const colA = Math.floor(a.x / CELL);
    const rowA = Math.floor(a.y / CELL);
    const colB = Math.floor(b.x / CELL);
    const rowB = Math.floor(b.y / CELL);

    if (rowA === rowB) {
      // horizontal segment
      const minC = Math.min(colA, colB);
      const maxC = Math.max(colA, colB);
      for (let c = minC; c <= maxC; c++) cells.add(`${c},${rowA}`);
    } else {
      // vertical segment
      const minR = Math.min(rowA, rowB);
      const maxR = Math.max(rowA, rowB);
      for (let r = minR; r <= maxR; r++) cells.add(`${colA},${r}`);
    }
  }
  return cells;
}

export const PATH_CELLS = buildPathCells();

// Path segments for rendering (pairs of waypoints)
export const PATH_SEGMENTS = [];
for (let i = 0; i < WAYPOINTS.length - 1; i++) {
  PATH_SEGMENTS.push([WAYPOINTS[i], WAYPOINTS[i + 1]]);
}

export function isPathCell(col, row) {
  return PATH_CELLS.has(`${col},${row}`);
}

export function isValidPlacement(col, row) {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS && !isPathCell(col, row);
}

// Total path length in pixels (for progress tracking)
export function totalPathLength() {
  let len = 0;
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const dx = WAYPOINTS[i + 1].x - WAYPOINTS[i].x;
    const dy = WAYPOINTS[i + 1].y - WAYPOINTS[i].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}
