import { CANVAS_W, CANVAS_H, CELL, COLS, ROWS, TOWERS, ENEMIES } from './constants.js';
import { PATH_SEGMENTS, WAYPOINTS } from './maps.js';
import {
  PAL, PIECE, FONT, SHAPES, drawCrown, cast, plastic, mix, rgba, roundRect, mulberry32,
} from './theme.js';

const PATH_W = CELL - 2;

/**
 * The board never changes, so it's painted once into an offscreen canvas and
 * blitted each frame. That buys the felt nap and wood grain — thousands of
 * strokes — for the cost of a single drawImage.
 */
let boardCache = null;

function getBoard() {
  if (boardCache) return boardCache;
  const c = document.createElement('canvas');
  c.width = CANVAS_W;
  c.height = CANVAS_H;
  const ctx = c.getContext('2d');
  paintFelt(ctx);
  paintPath(ctx);
  paintFrame(ctx);
  boardCache = c;
  return c;
}

function paintFelt(ctx) {
  ctx.fillStyle = PAL.feltA;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Woven nap: short strokes in two directions, seeded so it never shimmers.
  const rand = mulberry32(0x7a11);
  ctx.lineWidth = 1;
  for (let i = 0; i < 9000; i++) {
    const x = rand() * CANVAS_W;
    const y = rand() * CANVAS_H;
    const len = 2 + rand() * 4;
    const horiz = rand() > 0.5;
    ctx.strokeStyle = rgba(rand() > 0.5 ? PAL.feltB : PAL.feltEdge, 0.16 + rand() * 0.2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(horiz ? x + len : x, horiz ? y : y + len);
    ctx.stroke();
  }

  // Faint grid, so placement squares are legible without drawing hard lines.
  ctx.strokeStyle = rgba('#ffffff', 0.035);
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL + 0.5, 0);
    ctx.lineTo(c * CELL + 0.5, CANVAS_H);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL + 0.5);
    ctx.lineTo(CANVAS_W, r * CELL + 0.5);
    ctx.stroke();
  }

  // Vignette — the board dips slightly toward its edges.
  const vg = ctx.createRadialGradient(
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.25,
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.85,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function tracePath(ctx) {
  ctx.beginPath();
  for (const [a, b] of PATH_SEGMENTS) {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
}

/** Clip region matching the inlay, used to keep grain and chevrons in the wood. */
function pathRegion() {
  const p = new Path2D();
  for (const [a, b] of PATH_SEGMENTS) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (PATH_W / 2);
    const ny = (dx / len) * (PATH_W / 2);
    p.moveTo(a.x + nx, a.y + ny);
    p.lineTo(b.x + nx, b.y + ny);
    p.lineTo(b.x - nx, b.y - ny);
    p.lineTo(a.x - nx, a.y - ny);
    p.closePath();
  }
  return p;
}

const PATH_REGION = pathRegion();

function paintPath(ctx) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Groove: the channel routed out of the felt, darkest at its wall.
  ctx.strokeStyle = PAL.feltEdge;
  ctx.lineWidth = PATH_W + 9;
  tracePath(ctx);
  ctx.stroke();

  // Maple inlay dropped into the groove.
  ctx.strokeStyle = PAL.maple;
  ctx.lineWidth = PATH_W;
  tracePath(ctx);
  ctx.stroke();

  // Grain: pale streaks confined to the inlay.
  ctx.save();
  ctx.clip(PATH_REGION);
  const rand = mulberry32(0x3c0de);
  for (let i = 0; i < 600; i++) {
    const x = rand() * CANVAS_W;
    const y = rand() * CANVAS_H;
    const len = 8 + rand() * 26;
    ctx.strokeStyle = rgba(rand() > 0.45 ? PAL.mapleDark : '#ffffff', 0.12 + rand() * 0.16);
    ctx.lineWidth = 0.6 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rand() - 0.5) * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Bevelled lip: light catches the upper edge, shadow pools at the lower.
  ctx.save();
  ctx.clip(PATH_REGION);
  ctx.strokeStyle = rgba('#ffffff', 0.3);
  ctx.lineWidth = 3;
  ctx.save();
  ctx.translate(0, -(PATH_W / 2 - 1));
  tracePath(ctx);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = rgba(PAL.mapleEdge, 0.6);
  ctx.lineWidth = 4;
  ctx.save();
  ctx.translate(0, PATH_W / 2 - 1);
  tracePath(ctx);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function paintFrame(ctx) {
  const t = 10;
  ctx.strokeStyle = PAL.frame;
  ctx.lineWidth = t * 2;
  ctx.strokeRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.strokeStyle = PAL.frameLip;
  ctx.lineWidth = 2;
  ctx.strokeRect(t - 1, t - 1, CANVAS_W - t * 2 + 2, CANVAS_H - t * 2 + 2);
  ctx.strokeStyle = rgba('#000000', 0.5);
  ctx.lineWidth = 3;
  ctx.strokeRect(t + 2, t + 2, CANVAS_W - t * 2 - 4, CANVAS_H - t * 2 - 4);
}

// ---------------------------------------------------------------- frame

export function renderGame(ctx, gs, ui) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.drawImage(getBoard(), 0, 0);
  if (!gs) return;

  const t = performance.now() / 1000;
  drawFlow(ctx, t);
  drawEntry(ctx, t);
  drawRange(ctx, ui);
  drawGhost(ctx, ui);
  drawEffectsUnder(ctx, gs.effects);
  drawTowers(ctx, gs.towers, ui, t);
  drawEnemies(ctx, gs.enemies, t);
  drawProjectiles(ctx, gs.projectiles);
  drawEffectsOver(ctx, gs.effects);
}

/** Chevrons drifting along the inlay — shows which way the enemies run. */
function drawFlow(ctx, t) {
  const phase = (t * 26) % 46;
  ctx.save();
  ctx.clip(PATH_REGION);
  ctx.strokeStyle = rgba(PAL.mapleEdge, 0.4);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const [a, b] of PATH_SEGMENTS) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const ang = Math.atan2(dy, dx);
    for (let d = phase; d < len; d += 46) {
      ctx.save();
      ctx.translate(a.x + ux * d, a.y + uy * d);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-5, -6);
      ctx.lineTo(4, 0);
      ctx.lineTo(-5, 6);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Where enemies come in and where they get out — labelled on the board. */
function drawEntry(ctx, t) {
  const inp = WAYPOINTS[0];
  const out = WAYPOINTS[WAYPOINTS.length - 1];
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);

  ctx.save();
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = rgba(PAL.danger, 0.5 + pulse * 0.4);
  ctx.beginPath();
  ctx.arc(inp.x + 8, inp.y, 6 + pulse * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rgba(PAL.chalk, 0.75);
  ctx.fillText('IN', inp.x + 34, inp.y - 22);
  ctx.fillText('OUT', out.x - 26, out.y - 22);

  ctx.strokeStyle = rgba(PAL.chalk, 0.45);
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(out.x + 4, out.y - 14);
  ctx.lineTo(out.x + 4, out.y + 14);
  ctx.stroke();
  ctx.restore();
}

function drawRange(ctx, ui) {
  const t = ui.selectedTower;
  if (!t) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
  ctx.fillStyle = rgba('#ffffff', 0.07);
  ctx.fill();
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = rgba(PAL.gold, 0.75);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/**
 * The piece you're about to place, held above the board: a wider, softer
 * shadow sells the height, and the ring says whether it can be set down.
 */
function drawGhost(ctx, ui) {
  if (!ui.placingType || ui.hoverCol < 0) return;
  const spec = TOWERS[ui.placingType];
  const x = ui.hoverCol * CELL + CELL / 2;
  const y = ui.hoverRow * CELL + CELL / 2;
  const ok = ui.canPlace;
  const good = '#7bffb0';

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, spec.range, 0, Math.PI * 2);
  ctx.fillStyle = ok ? rgba(good, 0.09) : rgba(PAL.danger, 0.09);
  ctx.fill();
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = ok ? rgba(good, 0.6) : rgba(PAL.danger, 0.6);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Footprint on the square under the hovering piece.
  ctx.save();
  ctx.globalAlpha = 0.55;
  roundRect(ctx, x - CELL / 2 + 3, y - CELL / 2 + 3, CELL - 6, CELL - 6, 7);
  ctx.strokeStyle = ok ? good : PAL.danger;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Held above the board: offset up-left with a longer, softer shadow.
  ctx.save();
  ctx.globalAlpha = 0.82;
  drawTowerPiece(
    ctx,
    { x: x - 3, y: y - 5, type: ui.placingType, angle: -Math.PI / 2, upgradeLevels: {} },
    ok ? spec.color : PAL.danger,
    12,
    0.3,
  );
  ctx.restore();
}

// ---------------------------------------------------------------- towers

function drawTowers(ctx, towers, ui, time) {
  for (const t of towers) {
    const spec = TOWERS[t.type];
    const selected = ui.selectedTower && ui.selectedTower.id === t.id;
    if (selected) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.save();
      ctx.beginPath();
      ctx.arc(t.x, t.y, 21 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(PAL.gold, 0.5 + pulse * 0.4);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
    drawTowerPiece(ctx, t, spec.color, 4, 0.45);
  }
}

/**
 * A tower piece: moulded base, coloured dome, barrel that tracks its target,
 * and a gold stud for each upgrade bought.
 */
function drawTowerPiece(ctx, t, color, shadowDist, shadowAlpha) {
  const R = 15;
  const recoil = t.recoil || 0;

  cast(ctx, shadowDist * 0.6, shadowDist, shadowDist * 1.6, (c) => {
    c.beginPath();
    c.arc(t.x, t.y, R, 0, Math.PI * 2);
    c.fillStyle = '#000';
    c.fill();
  }, shadowAlpha);

  // Base disc
  ctx.beginPath();
  ctx.arc(t.x, t.y, R, 0, Math.PI * 2);
  ctx.fillStyle = plastic(ctx, t.x, t.y, R, mix(color, '#241a3d', 0.55));
  ctx.fill();
  ctx.strokeStyle = rgba('#000000', 0.35);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Barrel, drawn under the dome so it reads as mounted through it
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.angle || 0);
  const push = 2 - recoil * 5;
  roundRect(ctx, push, -4, 19, 8, 4);
  ctx.fillStyle = mix(color, '#0e0a1c', 0.35);
  ctx.fill();
  roundRect(ctx, push, -4, 19, 3, 1.5);
  ctx.fillStyle = rgba('#ffffff', 0.28);
  ctx.fill();
  if (recoil > 0) {
    // Muzzle flash
    ctx.beginPath();
    ctx.arc(push + 21, 0, 3 + recoil * 9, 0, Math.PI * 2);
    ctx.fillStyle = rgba('#fff3c4', recoil);
    ctx.fill();
  }
  ctx.restore();

  // Dome
  ctx.beginPath();
  ctx.arc(t.x, t.y, R * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = plastic(ctx, t.x, t.y, R * 0.62, color);
  ctx.fill();

  // Specular highlight — the giveaway that it's glossy plastic
  ctx.beginPath();
  ctx.ellipse(t.x - 3.2, t.y - 3.8, 3.4, 2.2, -0.7, 0, Math.PI * 2);
  ctx.fillStyle = rgba('#ffffff', 0.6);
  ctx.fill();

  const levels = Object.values(t.upgradeLevels || {}).reduce((a, b) => a + b, 0);
  for (let i = 0; i < levels; i++) {
    const a = -Math.PI / 2 + (i - (levels - 1) / 2) * 0.42;
    ctx.beginPath();
    ctx.arc(t.x + Math.cos(a) * (R - 3), t.y + Math.sin(a) * (R - 3), 2.2, 0, Math.PI * 2);
    ctx.fillStyle = PAL.gold;
    ctx.fill();
    ctx.strokeStyle = PAL.goldDark;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- enemies

function drawEnemies(ctx, enemies, time) {
  for (const e of enemies) {
    if (!e.alive) continue;
    const spec = ENEMIES[e.type];
    const shape = SHAPES[spec.shape] || SHAPES.pawn;
    const color = PIECE[e.type] || spec.color;
    const r = e.radius;
    const frozen = e.slowTimer > 0;
    const heading = e.heading || 0;

    // Healer aura, drawn under the pieces it's mending
    if (e.healRadius > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3);
      ctx.save();
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.healRadius, 0, Math.PI * 2);
      ctx.fillStyle = rgba('#4ade80', 0.06 + pulse * 0.05);
      ctx.fill();
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = rgba('#4ade80', 0.35);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    cast(ctx, 3, 4, 6, (c) => {
      c.save();
      c.translate(e.x, e.y);
      c.rotate(heading);
      shape(c, r);
      c.fillStyle = '#000';
      c.fill();
      c.restore();
    }, 0.5);

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(heading);
    shape(ctx, r);
    ctx.fillStyle = plastic(ctx, 0, 0, r, frozen ? mix(color, '#8fd8ff', 0.6) : color);
    ctx.fill();
    ctx.strokeStyle = rgba('#150d24', 0.55);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Top-left sheen
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.34, r * 0.22, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = rgba('#ffffff', 0.4);
    ctx.fill();

    if (e.type === 'boss') drawCrown(ctx, r);
    ctx.restore();

    if (frozen) {
      ctx.save();
      ctx.strokeStyle = rgba('#bfeaff', 0.85);
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        const a = time * 1.5 + (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * (r + 2), e.y + Math.sin(a) * (r + 2));
        ctx.lineTo(e.x + Math.cos(a) * (r + 6), e.y + Math.sin(a) * (r + 6));
        ctx.stroke();
      }
      ctx.restore();
    }

    drawHealth(ctx, e, r);
  }
}

function drawHealth(ctx, e, r) {
  const pct = Math.max(0, e.hp / e.maxHp);
  if (pct >= 0.999) return; // an untouched piece needs no bar
  const w = Math.max(22, r * 2.6);
  const x = e.x - w / 2;
  const y = e.y - r - 11;
  roundRect(ctx, x, y, w, 5, 2.5);
  ctx.fillStyle = rgba('#0b0716', 0.8);
  ctx.fill();
  roundRect(ctx, x + 1, y + 1, (w - 2) * pct, 3, 1.5);
  ctx.fillStyle = pct > 0.5 ? '#7bffb0' : pct > 0.25 ? PAL.gold : PAL.danger;
  ctx.fill();
}

// ---------------------------------------------------------------- shots & fx

function drawProjectiles(ctx, projectiles) {
  for (const p of projectiles) {
    if (!p.alive) continue;
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }
}

/** Effects that belong on the board surface, beneath the pieces. */
function drawEffectsUnder(ctx, effects) {
  for (const e of effects) {
    const k = e.life / e.maxLife;
    if (e.type === 'explosion') {
      const rr = e.radius * (1.05 - k * 0.5);
      ctx.save();
      ctx.beginPath();
      ctx.arc(e.x, e.y, rr, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(e.x, e.y, rr * 0.2, e.x, e.y, rr);
      g.addColorStop(0, `rgba(255,214,140,${k * 0.75})`);
      g.addColorStop(0.6, `rgba(255,120,70,${k * 0.4})`);
      g.addColorStop(1, 'rgba(255,90,60,0)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,220,160,${k * 0.7})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    } else if (e.type === 'topple') {
      // A knocked-over piece: it falls flat, spins a little, and fades.
      const fall = 1 - k;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.translate(e.x, e.y);
      ctx.rotate((e.heading || 0) + fall * 1.5);
      ctx.scale(1 + fall * 0.35, 1 - fall * 0.72);
      const spec = ENEMIES[e.enemyType] || {};
      (SHAPES[spec.shape] || SHAPES.pawn)(ctx, e.radius);
      ctx.fillStyle = mix(PIECE[e.enemyType] || spec.color || '#888', '#1b1230', 0.35);
      ctx.fill();
      ctx.strokeStyle = rgba('#150d24', 0.5);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    } else if (e.type === 'leak') {
      // A piece that got through — a red bloom at the exit.
      ctx.save();
      ctx.globalAlpha = k;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 16 + (1 - k) * 26, 0, Math.PI * 2);
      ctx.strokeStyle = PAL.danger;
      ctx.lineWidth = 4 * k;
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Effects that read as light, drawn over everything. */
function drawEffectsOver(ctx, effects) {
  for (const e of effects) {
    const k = e.life / e.maxLife;
    if (e.type === 'hit') {
      ctx.save();
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4 + (1 - k) * 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (e.type === 'chain') {
      // Jagged bolt rather than a straight line — reads as electricity.
      ctx.save();
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#fff6b0';
      ctx.shadowColor = '#ffd23f';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1);
      const segs = 4;
      const nx = -(e.y2 - e.y1);
      const ny = e.x2 - e.x1;
      const nl = Math.hypot(nx, ny) || 1;
      for (let i = 1; i < segs; i++) {
        const f = i / segs;
        const off = (i % 2 === 0 ? 1 : -1) * 7 * (1 - Math.abs(f - 0.5) * 2);
        ctx.lineTo(
          e.x1 + (e.x2 - e.x1) * f + (nx / nl) * off,
          e.y1 + (e.y2 - e.y1) * f + (ny / nl) * off,
        );
      }
      ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
      ctx.restore();
    } else if (e.type === 'coin') {
      // Reward floating up off the piece that dropped it.
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = `700 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10,6,20,0.85)';
      const ty = e.y - 14 - (1 - k) * 26;
      ctx.strokeText(`+${e.amount}`, e.x, ty);
      ctx.fillStyle = PAL.gold;
      ctx.fillText(`+${e.amount}`, e.x, ty);
      ctx.restore();
    }
  }
}

/** Drops the cached board — call if the canvas size or map ever changes. */
export function invalidateBoard() {
  boardCache = null;
}
