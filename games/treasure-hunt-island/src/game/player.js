import { PLAYER_SIZE, PLAYER_SPEED, TILE } from './constants.js';
import { canMove } from './collision.js';

export function createPlayer() {
  return {
    x: 7 * TILE + TILE / 2,  // Start on southern beach path
    y: 14 * TILE + TILE / 2,
    dir: 0, // 0=down, 1=left, 2=up, 3=right
    walkFrame: 0,
    stunUntil: 0,
  };
}

export function updatePlayer(player, input, dt) {
  if (performance.now() < player.stunUntil) return;

  let dx = 0, dy = 0;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;

  if (dx === 0 && dy === 0) return;

  // Normalize diagonal
  if (dx !== 0 && dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
  }

  // Set facing direction
  if (Math.abs(dx) > Math.abs(dy)) {
    player.dir = dx < 0 ? 1 : 3;
  } else {
    player.dir = dy < 0 ? 2 : 0;
  }

  const spd = PLAYER_SPEED * (dt / 16);
  const nx = player.x + dx * spd;
  const ny = player.y + dy * spd;
  const hw = PLAYER_SIZE;
  const hh = PLAYER_SIZE;

  // Try full movement, then axis-separated
  if (canMove(nx, ny, hw, hh)) {
    player.x = nx;
    player.y = ny;
  } else if (canMove(nx, player.y, hw, hh)) {
    player.x = nx;
  } else if (canMove(player.x, ny, hw, hh)) {
    player.y = ny;
  }

  player.walkFrame += 0.15;
}

export function drawPlayer(ctx, player) {
  const { x, y, dir, walkFrame, stunUntil } = player;
  const stunned = performance.now() < stunUntil;

  ctx.save();
  if (stunned && Math.floor(performance.now() / 80) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }

  // Body bob
  const bob = Math.sin(walkFrame) * 1.5;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body (shirt)
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(x - 7, y - 4 + bob, 14, 14);

  // Head
  ctx.fillStyle = '#fcd5b0';
  ctx.beginPath();
  ctx.arc(x, y - 8 + bob, 8, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = '#6b3a1f';
  ctx.beginPath();
  ctx.arc(x, y - 11 + bob, 7, Math.PI, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#333';
  const eyeOffX = dir === 1 ? -3 : dir === 3 ? 3 : 0;
  const eyeOffY = dir === 2 ? -2 : dir === 0 ? 1 : 0;
  ctx.fillRect(x - 3 + eyeOffX, y - 9 + eyeOffY + bob, 2, 2);
  ctx.fillRect(x + 1 + eyeOffX, y - 9 + eyeOffY + bob, 2, 2);

  // Legs (simple walk animation)
  ctx.fillStyle = '#2c3e50';
  const legOffset = Math.sin(walkFrame * 2) * 3;
  ctx.fillRect(x - 5, y + 10 + bob, 4, 6 + legOffset);
  ctx.fillRect(x + 1, y + 10 + bob, 4, 6 - legOffset);

  ctx.restore();
}
