import { W, H, TILE, INTERACT_RANGE } from './constants.js';
import { drawMap } from './island.js';
import { drawPlayer } from './player.js';
import { drawNPCs } from './npcs.js';
import { drawCrabs } from './crabs.js';
import { drawItems } from './items.js';
import { distance } from './collision.js';

export function render(ctx, gs, time) {
  ctx.clearRect(0, 0, W, H);

  // Layer 1: Map
  drawMap(ctx, time);

  // Layer 2: Treasure sparkles (when player has map)
  if (gs.inventory.map && !gs.treasure.found) {
    drawSparkles(ctx, gs, time);
  }

  // Layer 3: Items
  drawItems(ctx, gs.items, time);

  // Layer 4: NPCs
  drawNPCs(ctx, gs.npcs, time);

  // Layer 5: Crabs
  drawCrabs(ctx, gs.crabs, time);

  // Layer 6: Player
  drawPlayer(ctx, gs.player);

  // Layer 7: Dig animation
  if (gs.digAnim) {
    drawDigAnim(ctx, gs.digAnim, time);
  }

  // Layer 8: Compass HUD needle (in world, pointing at treasure)
  if (gs.inventory.compass && !gs.treasure.found) {
    drawCompassArrow(ctx, gs.player, gs.treasure);
  }

  // Layer 9: Interaction hints
  drawInteractionHints(ctx, gs, time);
}

function drawSparkles(ctx, gs, time) {
  const { treasure } = gs;
  const cx = treasure.x;
  const cy = treasure.y;

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + time / 1000;
    const dist = 12 + Math.sin(time / 300 + i) * 6;
    const sx = cx + Math.cos(angle) * dist;
    const sy = cy + Math.sin(angle) * dist;
    const size = 2 + Math.sin(time / 200 + i * 0.7) * 1.5;

    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(time / 250 + i) * 0.3;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    // Star shape
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2 + time / 500;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a) * size, sy + Math.sin(a) * size);
    }
    ctx.arc(sx, sy, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCompassArrow(ctx, player, treasure) {
  const angle = Math.atan2(treasure.y - player.y, treasure.x - player.x);
  const arrowDist = 28;
  const ax = player.x + Math.cos(angle) * arrowDist;
  const ay = player.y + Math.sin(angle) * arrowDist;

  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);

  // Arrow
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawDigAnim(ctx, digAnim, time) {
  const elapsed = time - digAnim.startTime;
  const progress = Math.min(elapsed / 600, 1);

  if (digAnim.success) {
    // Treasure chest appearing
    const scale = Math.min(progress * 1.5, 1);
    ctx.save();
    ctx.translate(digAnim.x, digAnim.y);
    ctx.scale(scale, scale);

    // Chest body
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-12, -4, 24, 16);
    // Chest lid
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(-14, -10, 28, 8);
    // Gold clasp
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-3, -6, 6, 10);
    // Gold coins inside
    if (progress > 0.5) {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(-4, -2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -6, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Victory sparkles
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + progress * 3;
      const d = progress * 40;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = i % 2 === 0 ? '#f1c40f' : '#f39c12';
      ctx.beginPath();
      ctx.arc(digAnim.x + Math.cos(a) * d, digAnim.y + Math.sin(a) * d, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    // Failed dig — dirt particles flying up
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const d = progress * 20;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = '#8B6914';
      ctx.beginPath();
      ctx.arc(
        digAnim.x + Math.cos(a + i) * d,
        digAnim.y + Math.sin(a + i) * d - progress * 15,
        2, 0, Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawInteractionHints(ctx, gs, time) {
  const { player, npcs, items } = gs;

  // Check nearby NPCs
  for (const npc of npcs) {
    if (distance(player.x, player.y, npc.x, npc.y) < INTERACT_RANGE) {
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(time / 300) * 0.2;
      ctx.fillStyle = '#fff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('[E] Talk', npc.x, npc.y + 22);
      ctx.restore();
    }
  }

  // Check nearby uncollected items
  for (const item of items) {
    if (item.collected) continue;
    if (distance(player.x, player.y, item.x, item.y) < INTERACT_RANGE) {
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(time / 300) * 0.2;
      ctx.fillStyle = '#fff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('[E] Pick up', item.x, item.y + 20);
      ctx.restore();
    }
  }
}
