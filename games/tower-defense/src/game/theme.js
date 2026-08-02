/**
 * Toy Kingdom art direction.
 *
 * The battlefield is a physical board game viewed from directly above: an
 * aubergine felt board with a maple path routed into it, played with glossy
 * moulded-plastic towers and wooden enemy pieces. Everything sits *on* the
 * board and casts a shadow — that's the whole trick, and it's why pieces read
 * as objects you could pick up rather than sprites painted on a background.
 */

export const PAL = {
  table: '#141021',       // surface the board rests on
  feltA: '#2b2145',       // board felt
  feltB: '#332853',       // nap variation
  feltEdge: '#1d1633',    // inner shadow where felt meets the frame
  frame: '#4a3a2a',       // wooden board edge
  frameLip: '#6d5540',    // lit top edge of the frame
  maple: '#f0cf9a',       // routed path inlay
  mapleDark: '#d3ac74',   // grain
  mapleEdge: '#a9814f',   // routed groove wall
  gold: '#ffc94a',
  goldDark: '#c9932a',
  danger: '#ff5d73',
  chalk: '#f6f1ff',       // labels drawn on the board
};

/** Enemy piece colours — wooden game pieces, kept clear of the tower palette. */
export const PIECE = {
  grunt: '#e05263',
  runner: '#f79d5c',
  tank: '#7b6cf6',
  healer: '#4ade80',
  boss: '#d1329b',
};

export const FONT = "'Fredoka', 'Trebuchet MS', sans-serif";

/** Deterministic value noise — a seeded PRNG so the felt looks identical each load. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Run `draw` with a soft drop shadow, then again with none. Canvas shadows
 * apply to every fill inside the callback, so a piece drawn in several passes
 * would stack shadow on shadow — this paints the silhouette once for the
 * shadow and lets the caller redraw detail cleanly on top.
 */
export function cast(ctx, dx, dy, blur, draw, alpha = 0.45) {
  ctx.save();
  ctx.shadowColor = `rgba(8, 5, 18, ${alpha})`;
  ctx.shadowOffsetX = dx;
  ctx.shadowOffsetY = dy;
  ctx.shadowBlur = blur;
  draw(ctx);
  ctx.restore();
}

/** Vertical light→dark ramp that reads as moulded plastic under a top-left key light. */
export function plastic(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.15);
  g.addColorStop(0, mix(color, '#ffffff', 0.55));
  g.addColorStop(0.45, color);
  g.addColorStop(1, mix(color, '#120c22', 0.45));
  return g;
}

export function mix(a, b, t) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function hexToRgb(hex) {
  if (hex.startsWith('rgb')) {
    const m = hex.match(/\d+/g);
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  }
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Enemy silhouettes, drawn centred on the origin facing +x. Shape carries the
 * enemy's role so the five types stay distinguishable for players who can't
 * rely on colour alone.
 */
export const SHAPES = {
  // Round pawn — the rank-and-file piece.
  pawn(ctx, r) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.closePath();
  },
  // Arrow — reads as fast, and points where it's heading.
  arrow(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(r * 1.3, 0);
    ctx.lineTo(-r * 0.7, -r);
    ctx.lineTo(-r * 0.3, 0);
    ctx.lineTo(-r * 0.7, r);
    ctx.closePath();
  },
  // Hexagon — heavy, flat-sided, armoured.
  hex(ctx, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * r * 1.1;
      const py = Math.sin(a) * r * 1.1;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  },
  // Cross — the medic.
  cross(ctx, r) {
    const t = r * 0.42;
    ctx.beginPath();
    ctx.moveTo(-t, -r); ctx.lineTo(t, -r); ctx.lineTo(t, -t);
    ctx.lineTo(r, -t); ctx.lineTo(r, t); ctx.lineTo(t, t);
    ctx.lineTo(t, r); ctx.lineTo(-t, r); ctx.lineTo(-t, t);
    ctx.lineTo(-r, t); ctx.lineTo(-r, -t); ctx.lineTo(-t, -t);
    ctx.closePath();
  },
  // Crowned disc — the boss reads as the king piece.
  crown(ctx, r) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.closePath();
  },
};

/** The gold crown sitting on top of a boss piece. */
export function drawCrown(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, -r * 0.15);
  ctx.lineTo(-r * 0.7, -r * 0.75);
  ctx.lineTo(-r * 0.35, -r * 0.4);
  ctx.lineTo(0, -r * 0.9);
  ctx.lineTo(r * 0.35, -r * 0.4);
  ctx.lineTo(r * 0.7, -r * 0.75);
  ctx.lineTo(r * 0.7, -r * 0.15);
  ctx.closePath();
  ctx.fillStyle = PAL.gold;
  ctx.fill();
  ctx.strokeStyle = PAL.goldDark;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
