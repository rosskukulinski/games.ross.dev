import { TILE } from './constants.js';

// Predefined spawn pools — setup.js picks one from each pool per game
export const ITEM_POOLS = {
  shovel: [
    { col: 3, row: 5 },
    { col: 13, row: 9 },
    { col: 5, row: 12 },
    { col: 14, row: 4 },
  ],
  map: [
    { col: 4, row: 4 },
    { col: 12, row: 8 },
    { col: 7, row: 11 },
    { col: 3, row: 9 },
  ],
  compass: [
    { col: 14, row: 11 },
    { col: 6, row: 8 },
    { col: 11, row: 5 },
    { col: 8, row: 12 },
  ],
};

export function createItems(shovelPos, mapPos, compassPos) {
  return [
    {
      id: 'shovel',
      name: 'Shovel',
      x: shovelPos.col * TILE + TILE / 2,
      y: shovelPos.row * TILE + TILE / 2,
      collected: false,
    },
    {
      id: 'map',
      name: 'Treasure Map',
      x: mapPos.col * TILE + TILE / 2,
      y: mapPos.row * TILE + TILE / 2,
      collected: false,
    },
    {
      id: 'compass',
      name: 'Compass',
      x: compassPos.col * TILE + TILE / 2,
      y: compassPos.row * TILE + TILE / 2,
      collected: false,
    },
  ];
}

export function drawItems(ctx, items, time) {
  for (const item of items) {
    if (item.collected) continue;
    drawItem(ctx, item, time);
  }
}

function drawItem(ctx, item, time) {
  const { x, y, id } = item;
  const bob = Math.sin(time / 300 + x) * 2;

  // Glow ring
  ctx.save();
  ctx.globalAlpha = 0.3 + Math.sin(time / 400) * 0.15;
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(x, y + bob, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (id === 'shovel') {
    // Handle
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 2, y - 10 + bob, 4, 16);
    // Blade
    ctx.fillStyle = '#bdc3c7';
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 6 + bob);
    ctx.lineTo(x + 6, y + 6 + bob);
    ctx.lineTo(x + 4, y + 12 + bob);
    ctx.lineTo(x - 4, y + 12 + bob);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'map') {
    // Scroll
    ctx.fillStyle = '#f5deb3';
    ctx.fillRect(x - 8, y - 6 + bob, 16, 12);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 9, y - 7 + bob, 18, 3);
    ctx.fillRect(x - 9, y + 4 + bob, 18, 3);
    // Map lines
    ctx.strokeStyle = '#a0522d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 2 + bob);
    ctx.lineTo(x + 5, y - 2 + bob);
    ctx.moveTo(x - 5, y + 1 + bob);
    ctx.lineTo(x + 3, y + 1 + bob);
    ctx.stroke();
    // X mark
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 4 + bob);
    ctx.lineTo(x + 6, y + bob);
    ctx.moveTo(x + 6, y - 4 + bob);
    ctx.lineTo(x + 2, y + bob);
    ctx.stroke();
  } else if (id === 'compass') {
    // Compass body
    ctx.fillStyle = '#d4a76a';
    ctx.beginPath();
    ctx.arc(x, y + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y + bob, 7, 0, Math.PI * 2);
    ctx.fill();
    // Needle
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(x, y - 5 + bob);
    ctx.lineTo(x - 2, y + bob);
    ctx.lineTo(x + 2, y + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#bdc3c7';
    ctx.beginPath();
    ctx.moveTo(x, y + 5 + bob);
    ctx.lineTo(x - 2, y + bob);
    ctx.lineTo(x + 2, y + bob);
    ctx.closePath();
    ctx.fill();
  }
}
