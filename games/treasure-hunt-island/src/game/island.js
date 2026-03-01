import { TILE, COLS, ROWS, T, TILE_COLORS, WATER_COLORS } from './constants.js';

// 20x18 tile map — hand-crafted island
// W=Water, S=Sand, G=Grass, T=Trees, R=Rock, B=Bridge, P=Path
const { W, S, G, R, B, P } = T;
const Tr = T.T; // Tree (avoid conflict with T object)

// prettier-ignore
export const MAP = [
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  [W,W,W,W,W,S,S,S,S,S,S,S,S,S,S,W,W,W,W,W],
  [W,W,W,S,S,S,G,G,G,G,G,G,G,S,S,S,W,W,W,W],
  [W,W,S,S,Tr,G,G,P,P,G,G,P,G,G,R,S,S,W,W,W],
  [W,S,S,Tr,Tr,G,G,P,G,G,G,P,G,R,R,R,S,S,W,W],
  [W,S,Tr,Tr,G,G,G,P,G,G,G,P,G,G,R,S,S,S,W,W],
  [W,S,S,G,G,G,P,P,P,P,P,P,G,G,G,S,S,W,W,W],
  [W,S,G,G,G,Tr,P,G,G,G,G,P,G,G,S,S,W,W,W,W],
  [W,S,G,G,Tr,Tr,P,G,G,G,G,P,P,S,S,W,W,W,W,W],
  [W,S,G,G,G,Tr,P,G,G,G,G,G,P,S,S,S,W,W,W,W],
  [W,S,S,G,G,G,P,P,P,B,P,P,P,G,G,S,S,W,W,W],
  [W,W,S,S,G,G,G,G,G,W,G,G,G,G,G,G,S,S,W,W],
  [W,W,S,G,G,G,G,G,G,W,W,G,G,G,G,G,G,S,W,W],
  [W,W,S,S,G,G,S,S,S,W,W,S,G,G,G,G,S,S,W,W],
  [W,W,W,S,S,S,S,S,S,W,W,S,S,G,G,S,S,W,W,W],
  [W,W,W,W,S,S,S,S,W,W,W,W,S,S,S,S,W,W,W,W],
  [W,W,W,W,W,W,S,S,W,W,W,W,W,S,S,W,W,W,W,W],
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
];

export function getTile(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return T.W;
  return MAP[row][col];
}

export function drawMap(ctx, time) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = MAP[r][c];
      const x = c * TILE;
      const y = r * TILE;

      if (tile === T.W) {
        // Animated water
        const idx = Math.floor((time / 800 + c * 0.3 + r * 0.2) % 3);
        ctx.fillStyle = WATER_COLORS[idx];
        ctx.fillRect(x, y, TILE, TILE);
        // Wave highlight
        const waveOffset = Math.sin(time / 400 + c + r * 0.5) * 0.15;
        ctx.fillStyle = `rgba(255,255,255,${0.08 + waveOffset})`;
        ctx.fillRect(x, y, TILE, TILE / 2);
      } else {
        ctx.fillStyle = TILE_COLORS[tile];
        ctx.fillRect(x, y, TILE, TILE);

        // Tree decoration
        if (tile === T.T) {
          ctx.fillStyle = '#1a5c1a';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2 - 4, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#8B4513';
          ctx.fillRect(x + 14, y + 20, 4, 10);
        }

        // Rock decoration
        if (tile === T.R) {
          ctx.fillStyle = '#777';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#999';
          ctx.beginPath();
          ctx.arc(x + TILE / 2 - 3, y + TILE / 2 - 3, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bridge planks
        if (tile === T.B) {
          ctx.fillStyle = '#a07850';
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(x + 2, y + 4 + i * 10, TILE - 4, 6);
          }
          ctx.strokeStyle = '#7a5a3a';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
        }

        // Path texture
        if (tile === T.P) {
          ctx.fillStyle = '#c99a5a';
          ctx.fillRect(x + 4, y + 4, 3, 3);
          ctx.fillRect(x + 18, y + 14, 3, 3);
          ctx.fillRect(x + 10, y + 24, 3, 3);
        }

        // Sand dots
        if (tile === T.S) {
          ctx.fillStyle = '#e8c45a';
          ctx.fillRect(x + 6, y + 8, 2, 2);
          ctx.fillRect(x + 20, y + 18, 2, 2);
          ctx.fillRect(x + 12, y + 26, 2, 2);
        }
      }
    }
  }
}
