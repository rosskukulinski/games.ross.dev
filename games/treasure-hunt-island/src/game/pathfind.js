import { TILE, COLS, ROWS, WALKABLE, PLAYER_SIZE } from './constants.js';
import { getTile } from './island.js';
import { canMove } from './collision.js';

const walkable = (c, r) => WALKABLE.has(getTile(c, r));

/**
 * Tile path for tap-to-walk. Breadth-first search from the player's tile to
 * the reachable walkable tile closest to (tx, ty) — so tapping a tree, rock or
 * the sea walks you to the nearest spot beside it. Returns waypoints in
 * canvas pixels (tile centres), ending at the exact tap point when that point
 * is itself walkable.
 */
export function findPath(fromX, fromY, tx, ty) {
  const sc = Math.floor(fromX / TILE), sr = Math.floor(fromY / TILE);
  const idx = (c, r) => r * COLS + c;
  const prev = new Int16Array(COLS * ROWS).fill(-2);
  prev[idx(sc, sr)] = -1;
  const queue = [idx(sc, sr)];
  let best = idx(sc, sr);
  const dTo = (i) => Math.hypot((i % COLS) * TILE + TILE / 2 - tx, Math.floor(i / COLS) * TILE + TILE / 2 - ty);
  let bestD = dTo(best);
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q];
    const c = cur % COLS, r = Math.floor(cur / COLS);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const ni = idx(nc, nr);
      if (prev[ni] !== -2 || !walkable(nc, nr)) continue;
      prev[ni] = cur;
      queue.push(ni);
      const d = dTo(ni);
      if (d < bestD) { bestD = d; best = ni; }
    }
  }
  const tiles = [];
  for (let i = best; i !== -1; i = prev[i]) tiles.push(i);
  tiles.reverse();
  tiles.shift(); // already standing in the first tile
  // Off-centre in the start tile? Step to its centre first so the first
  // straight leg can't clip a tree corner.
  const startC = { x: sc * TILE + TILE / 2, y: sr * TILE + TILE / 2 };
  const pts = tiles.map(i => ({ x: (i % COLS) * TILE + TILE / 2, y: Math.floor(i / COLS) * TILE + TILE / 2 }));
  if (tiles.length && Math.hypot(fromX - startC.x, fromY - startC.y) > 6) pts.unshift(startC);
  const tc = Math.floor(tx / TILE), tr = Math.floor(ty / TILE);
  if (best === idx(tc, tr) && canMove(tx, ty, PLAYER_SIZE, PLAYER_SIZE)) {
    if (tiles.length) pts[pts.length - 1] = { x: tx, y: ty };
    else pts.push({ x: tx, y: ty });
  } else if (best === idx(tc, tr) && !tiles.length) {
    pts.push(startC);
  } else if (!pts.length) {
    pts.push({ x: (best % COLS) * TILE + TILE / 2, y: Math.floor(best / COLS) * TILE + TILE / 2 });
  }
  return pts;
}
