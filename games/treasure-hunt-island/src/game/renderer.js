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

  // Layer 9: Where-to-go-next helper for players who haven't found anything lately
  if (gs.guide) {
    drawGuide(ctx, gs.player, gs.guide, time);
  }

  // Layer 10: Walk-to marker from a tap on the island
  if (gs.walkTarget) {
    drawWalkMarker(ctx, gs.walkTarget, time);
  }

  // Layer 11: Pickup celebration
  if (gs.pickupFx) {
    drawPickupFx(ctx, gs.pickupFx, time);
  }

  // Layer 12: Interaction hints
  drawInteractionHints(ctx, gs, time);
}

// A big pulsing arrow beside the player pointing at the next goal, plus a
// bouncing marker above the goal itself. Pictures only, so a pre-reader can
// follow it.
function drawGuide(ctx, player, target, time) {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  const pulse = (Math.sin(time / 180) + 1) / 2;

  if (dist > 48) {
    const angle = Math.atan2(dy, dx);
    const r = 34 + pulse * 6;
    ctx.save();
    ctx.translate(player.x + Math.cos(angle) * r, player.y + Math.sin(angle) * r);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.75 + pulse * 0.25;
    ctx.fillStyle = '#ffeb3b';
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-2, -12);
    ctx.lineTo(-2, -5);
    ctx.lineTo(-12, -5);
    ctx.lineTo(-12, 5);
    ctx.lineTo(-2, 5);
    ctx.lineTo(-2, 12);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  // Bouncing down-arrow over the goal
  const by = target.y - 34 - Math.abs(Math.sin(time / 220)) * 8;
  ctx.save();
  ctx.fillStyle = '#ffeb3b';
  ctx.strokeStyle = '#5d4037';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(target.x, by + 12);
  ctx.lineTo(target.x - 10, by);
  ctx.lineTo(target.x - 4, by);
  ctx.lineTo(target.x - 4, by - 10);
  ctx.lineTo(target.x + 4, by - 10);
  ctx.lineTo(target.x + 4, by);
  ctx.lineTo(target.x + 10, by);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

function drawWalkMarker(ctx, t, time) {
  const r = 8 + Math.sin(time / 150) * 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(t.x, t.y + 6, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPickupFx(ctx, fx, time) {
  const p = Math.min((performance.now() - fx.start) / 700, 1);
  if (p >= 1) return;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + p * 2;
    const d = 8 + p * 46;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = i % 2 ? '#fff59d' : '#f1c40f';
    ctx.beginPath();
    ctx.arc(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d, 3.5 * (1 - p * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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

function drawHintBubble(ctx, x, y, label, touch, time) {
  ctx.save();
  ctx.globalAlpha = 0.75 + Math.sin(time / 300) * 0.2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (touch) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(label.icon, x, y + 1);
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(label.text, x, y);
  }
  ctx.restore();
}

function drawInteractionHints(ctx, gs, time) {
  const { player, npcs } = gs;

  // Tools are picked up just by walking onto them, so only people need a hint.
  for (const npc of npcs) {
    if (distance(player.x, player.y, npc.x, npc.y) < INTERACT_RANGE) {
      drawHintBubble(ctx, npc.x, npc.y + 26, { icon: '\u{1F4AC}', text: '[E] Talk' }, gs.touch, time);
    }
  }
}
