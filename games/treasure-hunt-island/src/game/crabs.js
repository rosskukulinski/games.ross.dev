import { TILE, CRAB_SPEED } from './constants.js';

const CRAB_PATROLS = [
  { waypoints: [[3, 10], [6, 10]], speed: 0.7 },
  { waypoints: [[12, 5], [14, 5]], speed: 0.9 },
  { waypoints: [[4, 13], [7, 13]], speed: 0.6 },
  { waypoints: [[10, 12], [14, 12]], speed: 0.8 },
  { waypoints: [[5, 7], [5, 9]], speed: 0.5 },
];

export function createCrabs() {
  return CRAB_PATROLS.map((patrol, i) => {
    const [sc, sr] = patrol.waypoints[0];
    return {
      id: i,
      x: sc * TILE + TILE / 2,
      y: sr * TILE + TILE / 2,
      waypointIdx: 0,
      waypoints: patrol.waypoints.map(([c, r]) => [c * TILE + TILE / 2, r * TILE + TILE / 2]),
      speed: patrol.speed,
      legFrame: Math.random() * Math.PI * 2,
    };
  });
}

export function updateCrabs(crabs, dt) {
  for (const crab of crabs) {
    const target = crab.waypoints[(crab.waypointIdx + 1) % crab.waypoints.length];
    const dx = target[0] - crab.x;
    const dy = target[1] - crab.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 2) {
      crab.waypointIdx = (crab.waypointIdx + 1) % crab.waypoints.length;
    } else {
      const spd = crab.speed * CRAB_SPEED * (dt / 16);
      crab.x += (dx / dist) * spd;
      crab.y += (dy / dist) * spd;
    }

    crab.legFrame += 0.12;
  }
}

export function drawCrabs(ctx, crabs, time) {
  for (const crab of crabs) {
    drawCrab(ctx, crab, time);
  }
}

function drawCrab(ctx, crab, time) {
  const { x, y, legFrame } = crab;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (3 per side, animated)
  ctx.strokeStyle = '#d35400';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const offset = Math.sin(legFrame + i * 1.2) * 3;
    // Left legs
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 2 + i * 4);
    ctx.lineTo(x - 14 - offset, y + 2 + i * 4);
    ctx.stroke();
    // Right legs
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 2 + i * 4);
    ctx.lineTo(x + 14 + offset, y + 2 + i * 4);
    ctx.stroke();
  }

  // Body (oval)
  ctx.fillStyle = '#e67e22';
  ctx.beginPath();
  ctx.ellipse(x, y, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shell pattern
  ctx.fillStyle = '#d35400';
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye stalks
  ctx.strokeStyle = '#d35400';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 6);
  ctx.lineTo(x - 6, y - 11);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 6);
  ctx.lineTo(x + 6, y - 11);
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - 6, y - 12, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 6, y - 12, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(x - 6, y - 12, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 6, y - 12, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Claws
  ctx.fillStyle = '#e67e22';
  ctx.beginPath();
  ctx.arc(x - 13, y - 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 13, y - 2, 5, 0, Math.PI * 2);
  ctx.fill();
  // Claw notch
  ctx.strokeStyle = '#d35400';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 16, y - 4);
  ctx.lineTo(x - 13, y - 2);
  ctx.lineTo(x - 16, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 16, y - 4);
  ctx.lineTo(x + 13, y - 2);
  ctx.lineTo(x + 16, y);
  ctx.stroke();
}
