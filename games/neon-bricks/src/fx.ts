/** Textures, particles and animated background — the juice factory. */

import { Container, Graphics, Renderer, Sprite, Texture, TilingSprite } from 'pixi.js';

export interface GameTextures {
  glow: Texture; // soft radial glow
  dot: Texture; // hard small circle
  shard: Texture; // brick fragment
  ring: Texture; // shockwave ring
  brick: Texture; // rounded brick (white, tintable)
  brickShine: Texture; // top highlight
  crack1: Texture;
  crack2: Texture;
  heart: Texture;
  grid: Texture; // tiling grid cell
  star4: Texture; // 4-point sparkle
}

function radialCanvas(size: number, stops: [number, string][]): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [p, col] of stops) g.addColorStop(p, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

export function makeTextures(renderer: Renderer): GameTextures {
  const glow = radialCanvas(128, [
    [0, 'rgba(255,255,255,1)'],
    [0.25, 'rgba(255,255,255,0.55)'],
    [0.6, 'rgba(255,255,255,0.14)'],
    [1, 'rgba(255,255,255,0)'],
  ]);

  const dotG = new Graphics().circle(12, 12, 10).fill(0xffffff);
  const dot = renderer.generateTexture(dotG);
  dotG.destroy();

  const shardG = new Graphics().poly([0, 0, 14, 3, 11, 12, 2, 10]).fill(0xffffff);
  const shard = renderer.generateTexture(shardG);
  shardG.destroy();

  const ringG = new Graphics().circle(64, 64, 56).stroke({ width: 10, color: 0xffffff });
  const ring = renderer.generateTexture(ringG);
  ringG.destroy();

  // Brick: bright border + translucent body, tint provides the color.
  const bw = 78;
  const bh = 34;
  const brickG = new Graphics()
    .roundRect(2, 2, bw - 4, bh - 4, 8)
    .fill({ color: 0xffffff, alpha: 0.17 })
    .roundRect(2, 2, bw - 4, bh - 4, 8)
    .stroke({ width: 3.5, color: 0xffffff, alpha: 1 });
  const brick = renderer.generateTexture(brickG);
  brickG.destroy();

  const shineG = new Graphics()
    .roundRect(7, 6, bw - 14, 8, 4)
    .fill({ color: 0xffffff, alpha: 0.28 });
  const brickShine = renderer.generateTexture(shineG);
  shineG.destroy();

  // Crack overlays — jagged dark lines
  const c1 = new Graphics()
    .moveTo(bw * 0.3, 3).lineTo(bw * 0.42, bh * 0.4).lineTo(bw * 0.3, bh * 0.62).lineTo(bw * 0.44, bh - 4)
    .stroke({ width: 2.5, color: 0x05050f, alpha: 0.85 });
  const crack1 = renderer.generateTexture(c1);
  c1.destroy();

  const c2 = new Graphics()
    .moveTo(bw * 0.3, 3).lineTo(bw * 0.42, bh * 0.4).lineTo(bw * 0.3, bh * 0.62).lineTo(bw * 0.44, bh - 4)
    .stroke({ width: 2.5, color: 0x05050f, alpha: 0.85 })
    .moveTo(bw * 0.68, 2).lineTo(bw * 0.6, bh * 0.35).lineTo(bw * 0.78, bh * 0.55).lineTo(bw * 0.66, bh - 3)
    .stroke({ width: 2.5, color: 0x05050f, alpha: 0.85 })
    .moveTo(bw * 0.42, bh * 0.4).lineTo(bw * 0.14, bh * 0.55)
    .stroke({ width: 2, color: 0x05050f, alpha: 0.7 })
    .moveTo(bw * 0.6, bh * 0.35).lineTo(bw * 0.9, bh * 0.3)
    .stroke({ width: 2, color: 0x05050f, alpha: 0.7 });
  const crack2 = renderer.generateTexture(c2);
  c2.destroy();

  // Heart
  const h = new Graphics();
  h.moveTo(16, 29);
  h.bezierCurveTo(-6, 14, 4, -4, 16, 8);
  h.bezierCurveTo(28, -4, 38, 14, 16, 29);
  h.fill(0xffffff);
  const heart = renderer.generateTexture(h);
  h.destroy();

  // Grid cell for tiling background
  const cell = 60;
  const gg = new Graphics()
    .moveTo(0, 0).lineTo(cell, 0)
    .moveTo(0, 0).lineTo(0, cell)
    .stroke({ width: 1.5, color: 0xffffff, alpha: 1 });
  const grid = renderer.generateTexture(gg);
  gg.destroy();

  // 4-point sparkle
  const sp = new Graphics()
    .poly([16, 0, 20, 12, 32, 16, 20, 20, 16, 32, 12, 20, 0, 16, 12, 12])
    .fill(0xffffff);
  const star4 = renderer.generateTexture(sp);
  sp.destroy();

  return { glow, dot, shard, ring, brick, brickShine, crack1, crack2, heart, grid, star4 };
}

// ---------------------------------------------------------------------------
// Particle system — pooled sprites in a single container.
// ---------------------------------------------------------------------------

interface Particle {
  sp: Sprite;
  vx: number;
  vy: number;
  vr: number;
  gravity: number;
  drag: number;
  life: number;
  maxLife: number;
  scaleFrom: number;
  scaleTo: number;
  alphaFrom: number;
  fadePow: number;
}

export class ParticleSystem {
  container = new Container();
  private pool: Sprite[] = [];
  private live: Particle[] = [];
  private max: number;

  constructor(max = 700) {
    this.max = max;
  }

  private obtain(tex: Texture): Sprite {
    let sp = this.pool.pop();
    if (!sp) {
      sp = new Sprite(tex);
      sp.anchor.set(0.5);
    } else {
      sp.texture = tex;
    }
    sp.visible = true;
    this.container.addChild(sp);
    return sp;
  }

  spawn(
    tex: Texture,
    x: number,
    y: number,
    opts: {
      vx?: number; vy?: number; vr?: number;
      gravity?: number; drag?: number;
      life?: number;
      tint?: number;
      scaleFrom?: number; scaleTo?: number;
      alpha?: number; fadePow?: number;
      additive?: boolean;
      rotation?: number;
    } = {},
  ): void {
    if (this.live.length >= this.max) return;
    const sp = this.obtain(tex);
    sp.position.set(x, y);
    sp.tint = opts.tint ?? 0xffffff;
    sp.alpha = opts.alpha ?? 1;
    sp.rotation = opts.rotation ?? Math.random() * Math.PI * 2;
    sp.blendMode = opts.additive === false ? 'normal' : 'add';
    const scaleFrom = opts.scaleFrom ?? 1;
    sp.scale.set(scaleFrom);
    this.live.push({
      sp,
      vx: opts.vx ?? 0,
      vy: opts.vy ?? 0,
      vr: opts.vr ?? 0,
      gravity: opts.gravity ?? 0,
      drag: opts.drag ?? 0,
      life: opts.life ?? 0.6,
      maxLife: opts.life ?? 0.6,
      scaleFrom,
      scaleTo: opts.scaleTo ?? scaleFrom,
      alphaFrom: opts.alpha ?? 1,
      fadePow: opts.fadePow ?? 1,
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
      p.sp.alpha = p.alphaFrom * Math.pow(1 - t, p.fadePow);
      const s = p.scaleFrom + (p.scaleTo - p.scaleFrom) * t;
      p.sp.scale.set(s);
    }
  }

  get count(): number {
    return this.live.length;
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
// Animated background — drifting grid + starfield + combo-reactive pulses.
// ---------------------------------------------------------------------------

export class NeonBackground {
  container = new Container();
  private gridSprite: TilingSprite;
  private stars: { sp: Sprite; speed: number; tw: number }[] = [];
  private pulses: Sprite[] = [];
  private horizon: Sprite;
  private t = 0;
  /** 0..1 combo energy */
  energy = 0;

  constructor(tex: GameTextures, w: number, h: number) {
    // deep gradient pulses (huge soft glows near bottom corners + top)
    const pulseDefs: [number, number, number, number][] = [
      [w * 0.15, h * 0.95, 0xff2d95, 8],
      [w * 0.85, h * 0.95, 0x00f5ff, 9],
      [w * 0.5, h * 0.1, 0xb537f2, 10],
    ];
    for (const [x, y, tint, scale] of pulseDefs) {
      const sp = new Sprite(tex.glow);
      sp.anchor.set(0.5);
      sp.position.set(x, y);
      sp.tint = tint;
      sp.scale.set(scale);
      sp.alpha = 0.10;
      sp.blendMode = 'add';
      this.container.addChild(sp);
      this.pulses.push(sp);
    }

    // perspective-ish horizon glow line at bottom
    this.horizon = new Sprite(tex.glow);
    this.horizon.anchor.set(0.5);
    this.horizon.position.set(w / 2, h + 40);
    this.horizon.scale.set(14, 3);
    this.horizon.tint = 0x4d6cff;
    this.horizon.alpha = 0.16;
    this.horizon.blendMode = 'add';
    this.container.addChild(this.horizon);

    // drifting nebula blobs
    this.nebulas = [];
    const nebDefs: [number, number][] = [
      [0xb537f2, 3.2],
      [0x00f5ff, 2.6],
      [0xff2d95, 2.9],
      [0x4d6cff, 3.6],
    ];
    nebDefs.forEach(([tint, scale], i) => {
      const sp = new Sprite(tex.glow);
      sp.anchor.set(0.5);
      sp.tint = tint;
      sp.scale.set(scale);
      sp.alpha = 0.08;
      sp.blendMode = 'add';
      sp.position.set(((i + 0.5) / nebDefs.length) * w, 250 + ((i * 331) % (h - 500)));
      this.container.addChild(sp);
      this.nebulas.push({ sp, phase: i * 1.7, baseX: sp.x, baseY: sp.y });
    });

    // drifting grid
    this.gridSprite = new TilingSprite({ texture: tex.grid, width: w, height: h });
    this.gridSprite.tint = 0x2a55cc;
    this.gridSprite.alpha = 0.32;
    this.container.addChild(this.gridSprite);

    // starfield
    for (let i = 0; i < 110; i++) {
      const sp = new Sprite(tex.dot);
      sp.anchor.set(0.5);
      sp.position.set(Math.random() * w, Math.random() * h);
      const s = 0.06 + Math.random() * 0.16;
      sp.scale.set(s);
      sp.tint = [0xffffff, 0x9fd8ff, 0xffc4e8][i % 3];
      sp.alpha = 0.25 + Math.random() * 0.5;
      sp.blendMode = 'add';
      this.container.addChild(sp);
      this.stars.push({ sp, speed: 6 + Math.random() * 26, tw: Math.random() * Math.PI * 2 });
    }
    this.w = w;
    this.h = h;
  }

  private w: number;
  private h: number;
  private nebulas: { sp: Sprite; phase: number; baseX: number; baseY: number }[] = [];

  update(dt: number): void {
    this.t += dt;
    const e = this.energy;
    this.gridSprite.tilePosition.y += dt * (14 + e * 60);
    this.gridSprite.tilePosition.x += dt * 4;
    this.gridSprite.alpha = 0.22 + e * 0.2 + Math.sin(this.t * 2) * 0.03;

    for (const s of this.stars) {
      s.sp.y += s.speed * (1 + e * 2.5) * dt;
      if (s.sp.y > this.h + 10) {
        s.sp.y = -10;
        s.sp.x = Math.random() * this.w;
      }
      s.sp.alpha = 0.3 + 0.3 * Math.sin(this.t * 3 + s.tw) + e * 0.25;
    }

    for (let i = 0; i < this.pulses.length; i++) {
      const p = this.pulses[i];
      const base = 0.09 + e * 0.16;
      p.alpha = base + Math.sin(this.t * (1.1 + i * 0.4) + i * 2.1) * (0.03 + e * 0.06);
    }
    this.horizon.alpha = 0.13 + e * 0.2 + Math.sin(this.t * 1.7) * 0.02;

    for (const n of this.nebulas) {
      n.sp.x = n.baseX + Math.sin(this.t * 0.16 + n.phase) * 90;
      n.sp.y = n.baseY + Math.cos(this.t * 0.11 + n.phase * 1.3) * 60;
      n.sp.alpha = 0.07 + e * 0.09 + Math.sin(this.t * 0.5 + n.phase) * 0.02;
    }
  }
}
