import { TILE } from './constants.js';

export const NPC_DEFS = [
  {
    id: 'sailor',
    name: 'Old Sailor',
    col: 8, row: 3,
    color: '#2c3e50',
    hatColor: '#f39c12',
    defaultText: 'Ahoy! Come back when ye need a hint.',
  },
  {
    id: 'kid',
    name: 'Island Kid',
    col: 11, row: 7,
    color: '#27ae60',
    hatColor: null,
    defaultText: 'I love exploring this island!',
  },
  {
    id: 'parrot',
    name: 'Parrot Pete',
    col: 6, row: 6,
    color: '#8e44ad',
    hatColor: '#e74c3c',
    defaultText: 'Squawk! Pete knows all the secrets!',
  },
];

export function createNPCs() {
  return NPC_DEFS.map(def => ({
    ...def,
    x: def.col * TILE + TILE / 2,
    y: def.row * TILE + TILE / 2,
    dialogueQueue: [],
    talked: false,
  }));
}

export function drawNPC(ctx, npc, time) {
  const { x, y, color, hatColor, dialogueQueue } = npc;
  const bob = Math.sin(time / 500 + x) * 1.5;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = color;
  ctx.fillRect(x - 7, y - 4 + bob, 14, 14);

  // Head
  ctx.fillStyle = '#fcd5b0';
  ctx.beginPath();
  ctx.arc(x, y - 8 + bob, 8, 0, Math.PI * 2);
  ctx.fill();

  // Hat (if any)
  if (hatColor) {
    ctx.fillStyle = hatColor;
    ctx.fillRect(x - 9, y - 16 + bob, 18, 5);
    ctx.fillRect(x - 6, y - 21 + bob, 12, 6);
  }

  // Eyes
  ctx.fillStyle = '#333';
  ctx.fillRect(x - 3, y - 9 + bob, 2, 2);
  ctx.fillRect(x + 1, y - 9 + bob, 2, 2);

  // Exclamation mark when has unseen dialogue
  if (dialogueQueue.length > 0 && !npc.talked) {
    const bounceY = Math.sin(time / 200) * 3;
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('!', x, y - 24 + bob + bounceY);
  }
}

export function drawNPCs(ctx, npcs, time) {
  for (const npc of npcs) {
    drawNPC(ctx, npc, time);
  }
}
