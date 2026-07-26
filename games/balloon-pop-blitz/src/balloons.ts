/**
 * Balloon kinds, painterly balloon textures (canvas radial gradients with
 * rim shading + gloss), and the Balloon entity with its wobbling string.
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';

export type PowerUpId = 'slow' | 'multi';

export interface BalloonKind {
  id: string;
  /** css color of the body */
  color: string;
  /** css highlight color */
  hi: string;
  /** numeric tint for pop particles */
  tint: number;
  pts: number;
  weight: number;
  /** base radius in v1's 400-unit space */
  r: number;
  speedMul: number;
  pu?: PowerUpId;
  special?: 'striped' | 'gold' | 'rainbow' | 'bomb';
  minLevel: number;
}

/**
 * v1 roster preserved: red 1 / blue 2 / green 2 / orange 3 / purple 4,
 * cyan = slow-motion power-up, gold = multi-pop power-up.
 * v2 additions: striped speedster, rainbow combo balloon, bomb to avoid.
 */
export const KINDS: BalloonKind[] = [
  { id: 'red',     color: '#FF5C5C', hi: '#FFC1C1', tint: 0xff5c5c, pts: 1,  weight: 35, r: 28, speedMul: 1,    minLevel: 1 },
  { id: 'blue',    color: '#3D9BFF', hi: '#AFD9FF', tint: 0x3d9bff, pts: 2,  weight: 24, r: 28, speedMul: 1,    minLevel: 1 },
  { id: 'green',   color: '#3FC24E', hi: '#ADEFAD', tint: 0x3fc24e, pts: 2,  weight: 15, r: 28, speedMul: 1,    minLevel: 1 },
  { id: 'orange',  color: '#FF9E2E', hi: '#FFD99C', tint: 0xff9e2e, pts: 3,  weight: 10, r: 26, speedMul: 1,    minLevel: 1 },
  { id: 'purple',  color: '#AE58FF', hi: '#E0BDFF', tint: 0xae58ff, pts: 4,  weight: 7,  r: 26, speedMul: 1,    minLevel: 1 },
  { id: 'striped', color: '#FF66AE', hi: '#FFC4E0', tint: 0xff66ae, pts: 6,  weight: 6,  r: 24, speedMul: 1.6,  minLevel: 2, special: 'striped' },
  { id: 'cyan',    color: '#25CFF2', hi: '#B2F2FF', tint: 0x25cff2, pts: 5,  weight: 4,  r: 32, speedMul: 1,    minLevel: 1, pu: 'slow' },
  { id: 'gold',    color: '#FFC322', hi: '#FFF3B8', tint: 0xffc322, pts: 10, weight: 3,  r: 32, speedMul: 1,    minLevel: 1, pu: 'multi', special: 'gold' },
  { id: 'rainbow', color: '#FF5C5C', hi: '#FFFFFF', tint: 0xffffff, pts: 8,  weight: 3,  r: 30, speedMul: 1,    minLevel: 2, special: 'rainbow' },
];

export const BOMB_KIND: BalloonKind = {
  id: 'bomb', color: '#4E5261', hi: '#9BA1B5', tint: 0x565b6c,
  pts: 0, weight: 0, r: 30, speedMul: 0.85, minLevel: 3, special: 'bomb',
};

export function pickKind(level: number): BalloonKind {
  const pool = KINDS.filter((k) => level >= k.minLevel);
  const total = pool.reduce((s, k) => s + k.weight, 0);
  let r = Math.random() * total;
  for (const k of pool) {
    r -= k.weight;
    if (r <= 0) return k;
  }
  return pool[0];
}

// ---------------------------------------------------------------------------
// Texture baking
// ---------------------------------------------------------------------------

const TEX_W = 176;
const TEX_H = 216;
const CX = 88;
const CY = 92;
const RX = 70;
const RY = 79;

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((n & 0xff) * f));
  return `rgb(${r},${g},${b})`;
}

function bodyPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2);
}

/** Shared finishing pass: rim shade, gloss highlights, knot. */
function finish(ctx: CanvasRenderingContext2D, color: string): void {
  // rim shading — darker toward the silhouette edge, strongest lower-right
  ctx.save();
  bodyPath(ctx);
  ctx.clip();
  const rim = ctx.createRadialGradient(CX - 18, CY - 22, RX * 0.35, CX, CY, RX * 1.18);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(0.72, 'rgba(30,20,60,0.05)');
  rim.addColorStop(1, 'rgba(30,20,60,0.30)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  // soft reflected sky-light along the bottom edge
  const refl = ctx.createRadialGradient(CX, CY + RY * 0.95, 4, CX, CY + RY * 0.7, RX * 0.9);
  refl.addColorStop(0, 'rgba(210,240,255,0.28)');
  refl.addColorStop(1, 'rgba(210,240,255,0)');
  ctx.fillStyle = refl;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.restore();

  // gloss: one big soft sheen + one crisp hot spot
  ctx.save();
  ctx.translate(CX - RX * 0.34, CY - RY * 0.38);
  ctx.rotate(-0.55);
  const sheen = ctx.createRadialGradient(0, 0, 2, 0, 0, RX * 0.52);
  sheen.addColorStop(0, 'rgba(255,255,255,0.55)');
  sheen.addColorStop(0.6, 'rgba(255,255,255,0.16)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.ellipse(0, 0, RX * 0.5, RY * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.ellipse(-4, -6, RX * 0.16, RY * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // knot
  ctx.fillStyle = shade(color, 0.82);
  ctx.beginPath();
  ctx.moveTo(CX, CY + RY - 3);
  ctx.lineTo(CX - 8, CY + RY + 10);
  ctx.quadraticCurveTo(CX, CY + RY + 15, CX + 8, CY + RY + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(color, 0.95);
  ctx.beginPath();
  ctx.ellipse(CX, CY + RY + 1, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function baseGradient(ctx: CanvasRenderingContext2D, color: string, hi: string): void {
  bodyPath(ctx);
  const g = ctx.createRadialGradient(CX - RX * 0.32, CY - RY * 0.36, RX * 0.06, CX, CY, RX * 1.25);
  g.addColorStop(0, hi);
  g.addColorStop(0.42, color);
  g.addColorStop(0.85, shade(color, 0.8));
  g.addColorStop(1, shade(color, 0.66));
  ctx.fillStyle = g;
  ctx.fill();
}

function drawClockIcon(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(CX, CY + 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -14);
  ctx.moveTo(0, 0);
  ctx.lineTo(10, 5);
  ctx.stroke();
  ctx.restore();
}

function drawStarIcon(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(CX, CY + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? 26 : 11;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBombEmblem(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(CX, CY + 8);
  // bomb ball
  const g = ctx.createRadialGradient(-7, -8, 2, 0, 0, 24);
  g.addColorStop(0, '#5b5f6e');
  g.addColorStop(0.4, '#23252e');
  g.addColorStop(1, '#101117');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 2, 21, 0, Math.PI * 2);
  ctx.fill();
  // cap + fuse
  ctx.fillStyle = '#2c2f3a';
  ctx.fillRect(-6, -25, 12, 8);
  ctx.strokeStyle = '#c9a15a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -25);
  ctx.quadraticCurveTo(8, -34, 16, -30);
  ctx.stroke();
  // spark
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rad = i % 2 === 0 ? 9 : 3.5;
    const x = 16 + Math.cos(a) * rad;
    const y = -30 + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // shine on ball
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-8, -6, 6, 4, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function bakeKind(kind: BalloonKind): Texture {
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  const ctx = c.getContext('2d')!;

  if (kind.special === 'rainbow') {
    // vertical rainbow bands clipped to the body, then volume overlay
    ctx.save();
    bodyPath(ctx);
    ctx.clip();
    const bands = ['#FF5C5C', '#FF9E2E', '#FFD23A', '#3FC24E', '#3D9BFF', '#AE58FF'];
    const bandH = (RY * 2 + 20) / bands.length;
    bands.forEach((col, i) => {
      const grad = ctx.createLinearGradient(0, CY - RY + i * bandH - 8, 0, CY - RY + (i + 1) * bandH + 8);
      grad.addColorStop(0, col);
      grad.addColorStop(1, bands[Math.min(i + 1, bands.length - 1)]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, CY - RY + i * bandH - (i === 0 ? 20 : 0), TEX_W, bandH + 22);
    });
    // volume: light top-left, dark edge
    const vol = ctx.createRadialGradient(CX - RX * 0.32, CY - RY * 0.36, RX * 0.05, CX, CY, RX * 1.25);
    vol.addColorStop(0, 'rgba(255,255,255,0.55)');
    vol.addColorStop(0.45, 'rgba(255,255,255,0)');
    vol.addColorStop(1, 'rgba(40,20,70,0.28)');
    ctx.fillStyle = vol;
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    ctx.restore();
    finish(ctx, '#FF5C5C');
    return Texture.from(c);
  }

  baseGradient(ctx, kind.color, kind.hi);

  if (kind.special === 'striped') {
    ctx.save();
    bodyPath(ctx);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = -3; i < 8; i++) {
      ctx.save();
      ctx.translate(0, i * 34 - 40);
      ctx.rotate(-0.32);
      ctx.fillRect(-40, 0, TEX_W + 90, 13);
      ctx.restore();
    }
    // re-add a hint of volume over the stripes
    const vol = ctx.createRadialGradient(CX - RX * 0.32, CY - RY * 0.36, RX * 0.06, CX, CY, RX * 1.25);
    vol.addColorStop(0, 'rgba(255,255,255,0.28)');
    vol.addColorStop(0.5, 'rgba(255,255,255,0)');
    vol.addColorStop(1, 'rgba(120,20,80,0.22)');
    ctx.fillStyle = vol;
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    ctx.restore();
  }

  if (kind.pu === 'slow') drawClockIcon(ctx);
  if (kind.special === 'gold') drawStarIcon(ctx);
  if (kind.special === 'bomb') drawBombEmblem(ctx);

  finish(ctx, kind.color);
  return Texture.from(c);
}

export function bakeBalloonTextures(): Map<string, Texture> {
  const map = new Map<string, Texture>();
  for (const k of KINDS) map.set(k.id, bakeKind(k));
  map.set(BOMB_KIND.id, bakeKind(BOMB_KIND));
  return map;
}

// ---------------------------------------------------------------------------
// Balloon entity
// ---------------------------------------------------------------------------

let goldGlow: GlowFilter | null = null;
let rainbowGlow: GlowFilter | null = null;
let bombGlow: GlowFilter | null = null;

/** Shared filters (created lazily, reused across balloons). */
function glowFor(kind: BalloonKind): GlowFilter | null {
  if (kind.special === 'gold') {
    if (!goldGlow) goldGlow = new GlowFilter({ distance: 16, outerStrength: 1.7, color: 0xffe27a, quality: 0.2 });
    return goldGlow;
  }
  if (kind.special === 'rainbow') {
    if (!rainbowGlow) rainbowGlow = new GlowFilter({ distance: 14, outerStrength: 1.4, color: 0xffffff, quality: 0.2 });
    return rainbowGlow;
  }
  if (kind.special === 'bomb') {
    if (!bombGlow) bombGlow = new GlowFilter({ distance: 13, outerStrength: 1.3, color: 0xff5544, quality: 0.2 });
    return bombGlow;
  }
  return null;
}

let uid = 0;

export class Balloon {
  id = uid++;
  root = new Container();
  body: Sprite;
  private stringG = new Graphics();
  kind: BalloonKind;
  /** world radius in px */
  r: number;
  baseX: number;
  /** rise speed px/s */
  speed: number;
  private wob: number;
  private wobF: number;
  private wobA: number;
  private strLen: number;
  private t = Math.random() * 10;
  popped = false;
  /** tween cancels to run when this balloon is destroyed (Pixi v8 nulls
   *  transform objects on destroy, so stray tweens would throw) */
  cancels: (() => void)[] = [];
  constructor(kind: BalloonKind, tex: Texture, x: number, y: number, r: number, speed: number) {
    this.kind = kind;
    this.r = r;
    this.baseX = x;
    this.speed = speed;
    this.wob = Math.random() * Math.PI * 2;
    this.wobF = 0.9 + Math.random() * 1.3;
    this.wobA = (0.4 + Math.random() * 0.6) * (r / 28);
    this.strLen = r * (1.5 + Math.random() * 0.5);

    this.body = new Sprite(tex);
    this.body.anchor.set(CX / TEX_W, CY / TEX_H);
    const scale = (r * 2) / (RX * 2);
    this.body.scale.set(scale);
    const glow = glowFor(kind);
    if (glow) this.body.filters = [glow];

    this.root.addChild(this.stringG);
    this.root.addChild(this.body);
    this.root.position.set(x, y);
  }

  get x(): number { return this.root.x; }
  get y(): number { return this.root.y; }

  /** returns true when fully above the top edge (escaped) */
  update(dt: number, speedScale: number): boolean {
    this.t += dt;
    this.wob += this.wobF * dt;
    this.root.y -= this.speed * speedScale * dt;
    this.root.x = this.baseX + Math.sin(this.wob) * this.wobA * 14;
    // gentle pendulum tilt with the bob
    this.body.rotation = Math.sin(this.wob) * 0.07;

    // wobbling string — few-segment rope swaying against the motion
    const g = this.stringG;
    const L = this.strLen;
    const sway = Math.sin(this.t * 2.4) * L * 0.14 - Math.cos(this.wob) * this.wobA * 6;
    const sway2 = Math.sin(this.t * 2.4 + 1.2) * L * 0.2 - Math.cos(this.wob) * this.wobA * 9;
    const y0 = this.r * 1.12 + 6;
    g.clear();
    g.moveTo(0, y0);
    g.bezierCurveTo(sway * 0.4, y0 + L * 0.4, sway, y0 + L * 0.7, sway2, y0 + L);
    g.stroke({ width: Math.max(1.5, this.r * 0.055), color: 0x8a7a66, alpha: 0.75, cap: 'round' });

    return this.root.y < -(this.r + L + 24);
  }

  hitTest(px: number, py: number): boolean {
    const dx = px - this.root.x;
    const dy = py - this.root.y;
    return Math.hypot(dx, dy) <= this.r * 1.2;
  }
}
