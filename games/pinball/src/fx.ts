/** Procedural textures, pooled particles and the reactive backdrop. */

import { Container, Graphics, Renderer, Sprite, Texture } from 'pixi.js';
import { C, H, W } from './table';

export interface GameTextures {
  glow: Texture;
  dot: Texture;
  ball: Texture;
  ring: Texture;
  spark: Texture;
  star: Texture;
  shard: Texture;
  flare: Texture;
}

function radial(size: number, stops: [number, string][]): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [p, col] of stops) g.addColorStop(p, col);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return Texture.from(c);
}

/** Shaded chrome sphere — a flat circle reads as a disc, this reads as a ball. */
function makeBallTexture(size: number): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const r = size / 2;

  const body = x.createRadialGradient(r * 0.66, r * 0.6, r * 0.06, r, r, r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.24, '#eaf2ff');
  body.addColorStop(0.55, '#a9b8dd');
  body.addColorStop(0.82, '#5b688f');
  body.addColorStop(1, '#232a45');
  x.fillStyle = body;
  x.beginPath();
  x.arc(r, r, r - 1, 0, Math.PI * 2);
  x.fill();

  // rim light along the lower-right edge
  x.save();
  x.beginPath();
  x.arc(r, r, r - 1, 0, Math.PI * 2);
  x.clip();
  const rim = x.createLinearGradient(r * 0.4, r * 0.4, size, size);
  rim.addColorStop(0, 'rgba(255,255,255,0)');
  rim.addColorStop(0.78, 'rgba(120,190,255,0)');
  rim.addColorStop(1, 'rgba(160,215,255,0.75)');
  x.fillStyle = rim;
  x.fillRect(0, 0, size, size);
  x.restore();

  // specular highlight
  const hl = x.createRadialGradient(r * 0.62, r * 0.5, 0, r * 0.62, r * 0.5, r * 0.42);
  hl.addColorStop(0, 'rgba(255,255,255,0.95)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = hl;
  x.beginPath();
  x.arc(r * 0.62, r * 0.5, r * 0.42, 0, Math.PI * 2);
  x.fill();

  return Texture.from(c);
}

export function makeTextures(renderer: Renderer): GameTextures {
  const glow = radial(128, [
    [0, 'rgba(255,255,255,1)'],
    [0.22, 'rgba(255,255,255,0.5)'],
    [0.58, 'rgba(255,255,255,0.13)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  const flare = radial(160, [
    [0, 'rgba(255,255,255,1)'],
    [0.1, 'rgba(255,255,255,0.75)'],
    [0.3, 'rgba(255,255,255,0.2)'],
    [1, 'rgba(255,255,255,0)'],
  ]);

  const dg = new Graphics().circle(10, 10, 8).fill(0xffffff);
  const dot = renderer.generateTexture(dg);
  dg.destroy();

  const rg = new Graphics().circle(64, 64, 56).stroke({ width: 9, color: 0xffffff });
  const ring = renderer.generateTexture(rg);
  rg.destroy();

  const sg = new Graphics().roundRect(0, 6, 34, 5, 2.5).fill(0xffffff);
  const spark = renderer.generateTexture(sg);
  sg.destroy();

  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? 18 : 7.6;
    pts.push(18 + Math.cos(a) * rr, 18 + Math.sin(a) * rr);
  }
  const stg = new Graphics().poly(pts).fill(0xffffff);
  const star = renderer.generateTexture(stg);
  stg.destroy();

  const shg = new Graphics().poly([0, 0, 15, 4, 12, 13, 2, 11]).fill(0xffffff);
  const shard = renderer.generateTexture(shg);
  shg.destroy();

  return { glow, dot, ball: makeBallTexture(64), ring, spark, star, shard, flare };
}

// ---------------------------------------------------------------------------
// Pooled particles
// ---------------------------------------------------------------------------

interface P {
  sp: Sprite;
  vx: number; vy: number; vr: number;
  gravity: number; drag: number;
  life: number; maxLife: number;
  s0: number; s1: number;
  a0: number; fade: number;
}

export interface SpawnOpts {
  vx?: number; vy?: number; vr?: number;
  gravity?: number; drag?: number;
  life?: number;
  tint?: number;
  scaleFrom?: number; scaleTo?: number;
  alpha?: number; fadePow?: number;
  additive?: boolean;
  rotation?: number;
}

export class ParticleSystem {
  container = new Container();
  private pool: Sprite[] = [];
  private live: P[] = [];

  constructor(private max = 800) {}

  spawn(tex: Texture, x: number, y: number, o: SpawnOpts = {}): void {
    if (this.live.length >= this.max) return;
    let sp = this.pool.pop();
    if (!sp) {
      sp = new Sprite(tex);
      sp.anchor.set(0.5);
    } else {
      sp.texture = tex;
    }
    sp.visible = true;
    this.container.addChild(sp);
    sp.position.set(x, y);
    sp.tint = o.tint ?? 0xffffff;
    sp.alpha = o.alpha ?? 1;
    sp.rotation = o.rotation ?? Math.random() * Math.PI * 2;
    sp.blendMode = o.additive === false ? 'normal' : 'add';
    const s0 = o.scaleFrom ?? 1;
    sp.scale.set(s0);
    const life = o.life ?? 0.6;
    this.live.push({
      sp,
      vx: o.vx ?? 0, vy: o.vy ?? 0, vr: o.vr ?? 0,
      gravity: o.gravity ?? 0, drag: o.drag ?? 0,
      life, maxLife: life,
      s0, s1: o.scaleTo ?? s0,
      a0: o.alpha ?? 1, fade: o.fadePow ?? 1,
    });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sp.visible = false;
        this.container.removeChild(p.sp);
        this.pool.push(p.sp);
        this.live.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      if (p.drag > 0) {
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
      }
      p.sp.x += p.vx * dt;
      p.sp.y += p.vy * dt;
      p.sp.rotation += p.vr * dt;
      const t = 1 - p.life / p.maxLife;
      p.sp.alpha = p.a0 * Math.pow(1 - t, p.fade);
      p.sp.scale.set(p.s0 + (p.s1 - p.s0) * t);
    }
  }

  clear(): void {
    for (const p of this.live) {
      p.sp.visible = false;
      this.container.removeChild(p.sp);
      this.pool.push(p.sp);
    }
    this.live.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Backdrop behind the cabinet — drifts, and swells with table excitement.
// ---------------------------------------------------------------------------

export class Backdrop {
  container = new Container();
  /** 0..1 how hot the table is right now */
  energy = 0;
  private t = 0;
  private blobs: { sp: Sprite; bx: number; by: number; ph: number }[] = [];
  private stars: { sp: Sprite; ph: number; sp0: number }[] = [];

  constructor(tex: GameTextures, space: Texture) {
    const bg = new Sprite(space);
    this.container.addChild(bg);

    const defs: [number, number, number, number][] = [
      [70, 300, C.violet, 4.2],
      [830, 700, C.cyan, 3.6],
      [120, 1240, C.magenta, 4.0],
      [820, 1380, C.gold, 3.2],
      [450, 90, C.cyan, 3.4],
    ];
    for (const [x, y, tint, s] of defs) {
      const sp = new Sprite(tex.glow);
      sp.anchor.set(0.5);
      sp.position.set(x, y);
      sp.tint = tint;
      sp.scale.set(s);
      sp.alpha = 0.1;
      sp.blendMode = 'add';
      this.container.addChild(sp);
      this.blobs.push({ sp, bx: x, by: y, ph: this.blobs.length * 1.9 });
    }

    for (let i = 0; i < 70; i++) {
      const sp = new Sprite(tex.dot);
      sp.anchor.set(0.5);
      // keep them in the dead space either side of the cabinet
      const left = i % 2 === 0;
      sp.position.set(left ? Math.random() * 130 : W - Math.random() * 130, Math.random() * H);
      const s = 0.05 + Math.random() * 0.14;
      sp.scale.set(s);
      sp.tint = [0xffffff, 0xa8d8ff, 0xffd9a8][i % 3];
      sp.alpha = 0.3 + Math.random() * 0.4;
      sp.blendMode = 'add';
      this.container.addChild(sp);
      this.stars.push({ sp, ph: Math.random() * Math.PI * 2, sp0: sp.alpha });
    }
  }

  update(dt: number): void {
    this.t += dt;
    const e = this.energy;
    for (const b of this.blobs) {
      b.sp.x = b.bx + Math.sin(this.t * 0.17 + b.ph) * 70;
      b.sp.y = b.by + Math.cos(this.t * 0.13 + b.ph * 1.3) * 52;
      b.sp.alpha = 0.08 + e * 0.14 + Math.sin(this.t * 0.6 + b.ph) * 0.025;
      b.sp.scale.set(3.4 + Math.sin(this.t * 0.4 + b.ph) * 0.4 + e * 0.8);
    }
    for (const s of this.stars) {
      s.sp.alpha = s.sp0 * (0.55 + 0.45 * Math.sin(this.t * 2.4 + s.ph)) + e * 0.25;
    }
  }
}
