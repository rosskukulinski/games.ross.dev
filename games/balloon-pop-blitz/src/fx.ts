/**
 * Procedural textures, pooled particles and the painterly sunny-sky
 * background. Everything is generated at runtime — no asset files.
 */

import { Container, Graphics, Renderer, Sprite, Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  return Texture.from(c);
}

/** Soft radial glow (white, tintable). */
function glowTexture(size = 160): Texture {
  return canvasTexture(size, size, (ctx) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Vertical sky gradient strip, stretched to fill the screen. */
export function skyTexture(stops: [number, string][]): Texture {
  const h = 512;
  return canvasTexture(4, h, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [p, col] of stops) g.addColorStop(p, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, h);
  });
}

/**
 * Painterly cumulus cloud: many overlapping soft radial blobs with a
 * subtle cool shadow along the underside and a bright sunlit crown.
 */
function cloudTexture(seed: number): Texture {
  const w = 440;
  const h = 230;
  // deterministic-ish per-seed randomness
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 233280 + 9301) % 2147483647;
    return (s % 10000) / 10000;
  };
  return canvasTexture(w, h, (ctx) => {
    const cx = w / 2;
    const cy = h * 0.62;
    const blobs: { x: number; y: number; r: number }[] = [];
    const n = 9 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = cx + (t - 0.5) * w * (0.62 + rnd() * 0.18);
      const lift = Math.sin(t * Math.PI) * (0.55 + rnd() * 0.45);
      const y = cy - lift * h * 0.34 + (rnd() - 0.5) * h * 0.1;
      const r = h * (0.16 + rnd() * 0.14) * (0.7 + Math.sin(t * Math.PI) * 0.5);
      blobs.push({ x, y, r });
    }
    // shadow pass (soft blue-grey, offset down)
    for (const b of blobs) {
      const g = ctx.createRadialGradient(b.x, b.y + b.r * 0.35, b.r * 0.1, b.x, b.y + b.r * 0.35, b.r * 1.15);
      g.addColorStop(0, 'rgba(158,178,210,0.32)');
      g.addColorStop(1, 'rgba(158,178,210,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y + b.r * 0.35, b.r * 1.15, 0, Math.PI * 2);
      ctx.fill();
    }
    // body pass
    for (const b of blobs) {
      const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.1, b.x, b.y, b.r);
      g.addColorStop(0, 'rgba(255,255,255,0.98)');
      g.addColorStop(0.68, 'rgba(253,254,255,0.92)');
      g.addColorStop(0.88, 'rgba(250,252,255,0.42)');
      g.addColorStop(1, 'rgba(250,252,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // sunlit crown pass (small warm-white caps, offset up-left)
    for (const b of blobs) {
      const g = ctx.createRadialGradient(
        b.x - b.r * 0.2, b.y - b.r * 0.45, b.r * 0.05,
        b.x - b.r * 0.2, b.y - b.r * 0.45, b.r * 0.7,
      );
      g.addColorStop(0, 'rgba(255,253,246,0.9)');
      g.addColorStop(1, 'rgba(255,253,246,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.2, b.y - b.r * 0.45, b.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// ---------------------------------------------------------------------------
// Shared texture set
// ---------------------------------------------------------------------------

export interface GameTextures {
  glow: Texture;
  dot: Texture;
  ring: Texture;
  shred: Texture; // torn rubber scrap (tintable)
  shred2: Texture;
  confetti: Texture; // small rectangle
  heart: Texture;
  star4: Texture;
  clouds: Texture[];
}

export function makeTextures(renderer: Renderer): GameTextures {
  const glow = glowTexture(160);

  const dotG = new Graphics().circle(12, 12, 10).fill(0xffffff);
  const dot = renderer.generateTexture(dotG);
  dotG.destroy();

  const ringG = new Graphics().circle(72, 72, 62).stroke({ width: 9, color: 0xffffff });
  const ring = renderer.generateTexture(ringG);
  ringG.destroy();

  // rubber shreds — curvy torn scraps
  const s1 = new Graphics();
  s1.moveTo(0, 8);
  s1.bezierCurveTo(6, -4, 20, -2, 26, 6);
  s1.bezierCurveTo(18, 10, 16, 18, 6, 16);
  s1.closePath();
  s1.fill(0xffffff);
  const shred = renderer.generateTexture(s1);
  s1.destroy();

  const s2 = new Graphics();
  s2.moveTo(2, 2);
  s2.bezierCurveTo(14, -3, 22, 8, 30, 4);
  s2.bezierCurveTo(24, 14, 10, 16, 2, 10);
  s2.closePath();
  s2.fill(0xffffff);
  const shred2 = renderer.generateTexture(s2);
  s2.destroy();

  const confG = new Graphics().roundRect(0, 0, 14, 9, 2).fill(0xffffff);
  const confetti = renderer.generateTexture(confG);
  confG.destroy();

  const h = new Graphics();
  h.moveTo(16, 29);
  h.bezierCurveTo(-6, 14, 4, -4, 16, 8);
  h.bezierCurveTo(28, -4, 38, 14, 16, 29);
  h.fill(0xffffff);
  const heart = renderer.generateTexture(h);
  h.destroy();

  const sp = new Graphics()
    .poly([16, 0, 20, 12, 32, 16, 20, 20, 16, 32, 12, 20, 0, 16, 12, 12])
    .fill(0xffffff);
  const star4 = renderer.generateTexture(sp);
  sp.destroy();

  const clouds = [cloudTexture(3), cloudTexture(11), cloudTexture(27), cloudTexture(42)];

  return { glow, dot, ring, shred, shred2, confetti, heart, star4, clouds };
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
  flutter: number; // horizontal sinusoidal wiggle (confetti)
  flutterPhase: number;
  life: number;
  maxLife: number;
  scaleFrom: number;
  scaleTo: number;
  alphaFrom: number;
  fadePow: number;
  t: number;
}

export class ParticleSystem {
  container = new Container();
  private pool: Sprite[] = [];
  private live: Particle[] = [];
  private max: number;

  constructor(max = 800) {
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
      gravity?: number; drag?: number; flutter?: number;
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
    sp.blendMode = opts.additive ? 'add' : 'normal';
    const scaleFrom = opts.scaleFrom ?? 1;
    sp.scale.set(scaleFrom);
    this.live.push({
      sp,
      vx: opts.vx ?? 0,
      vy: opts.vy ?? 0,
      vr: opts.vr ?? 0,
      gravity: opts.gravity ?? 0,
      drag: opts.drag ?? 0,
      flutter: opts.flutter ?? 0,
      flutterPhase: Math.random() * Math.PI * 2,
      life: opts.life ?? 0.6,
      maxLife: opts.life ?? 0.6,
      scaleFrom,
      scaleTo: opts.scaleTo ?? scaleFrom,
      alphaFrom: opts.alpha ?? 1,
      fadePow: opts.fadePow ?? 1,
      t: 0,
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
      p.t += dt;
      p.vy += p.gravity * dt;
      if (p.drag > 0) {
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
      }
      p.sp.x += p.vx * dt + (p.flutter ? Math.sin(p.t * 9 + p.flutterPhase) * p.flutter * dt : 0);
      p.sp.y += p.vy * dt;
      p.sp.rotation += p.vr * dt;
      if (p.flutter) {
        // confetti tumble: fake 3D by squashing on a sine
        p.sp.scale.y = p.sp.scale.x * (0.25 + 0.75 * Math.abs(Math.sin(p.t * 7 + p.flutterPhase)));
      }
      const t = 1 - p.life / p.maxLife;
      p.sp.alpha = p.alphaFrom * Math.pow(1 - t, p.fadePow);
      const s = p.scaleFrom + (p.scaleTo - p.scaleFrom) * t;
      p.sp.scale.x = s;
      if (!p.flutter) p.sp.scale.y = s;
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
// Sunny background: gradient sky (morning → golden hour), sun with soft
// glow, three parallax cloud layers, occasional bird silhouettes.
// ---------------------------------------------------------------------------

interface CloudSprite {
  sp: Sprite;
  speed: number;
  bobPhase: number;
  baseY: number;
  depth: number;
  alpha: number;
}

interface Bird {
  root: Container;
  wingL: Graphics;
  wingR: Graphics;
  vx: number;
  t: number;
  baseY: number;
}

export class SunnyBackground {
  container = new Container();
  private skyMorning: Sprite;
  private skyGolden: Sprite;
  private sunGlowOuter: Sprite;
  private sunGlowInner: Sprite;
  private sunCore: Graphics;
  private haze: Sprite;
  private clouds: CloudSprite[] = [];
  private rays: Sprite[] = [];
  private motes: { sp: Sprite; vy: number; phase: number; amp: number; base: number }[] = [];
  private birds: Bird[] = [];
  private birdTimer = 6;
  private t = 0;
  private w: number;
  private h: number;
  /** 0 = morning, 1 = golden hour */
  progress = 0;

  constructor(tex: GameTextures, w: number, h: number) {
    this.w = w;
    this.h = h;

    this.skyMorning = new Sprite(
      skyTexture([
        [0, '#3f96e0'],
        [0.4, '#7cc4f2'],
        [0.78, '#c3e8fb'],
        [1, '#fdf3d9'],
      ]),
    );
    this.skyGolden = new Sprite(
      skyTexture([
        [0, '#7d74c9'],
        [0.42, '#e88f7f'],
        [0.75, '#ffbf80'],
        [1, '#ffe8b8'],
      ]),
    );
    this.skyGolden.alpha = 0;
    this.container.addChild(this.skyMorning, this.skyGolden);

    // sun in the top-right corner
    this.sunGlowOuter = new Sprite(tex.glow);
    this.sunGlowOuter.anchor.set(0.5);
    this.sunGlowOuter.tint = 0xfff2c0;
    this.sunGlowOuter.alpha = 0.55;
    this.sunGlowInner = new Sprite(tex.glow);
    this.sunGlowInner.anchor.set(0.5);
    this.sunGlowInner.tint = 0xfffbe8;
    this.sunGlowInner.alpha = 0.85;
    this.sunCore = new Graphics().circle(0, 0, 46).fill({ color: 0xfffef2 });
    this.container.addChild(this.sunGlowOuter, this.sunGlowInner, this.sunCore);

    // clouds: back / mid / front layers
    const defs: { texIdx: number; scale: number; alpha: number; speed: number; yFrac: number; depth: number }[] = [
      // depth 0 = far haze-blue and slow, 1 = near, bright and quick
      { texIdx: 0, scale: 0.42, alpha: 0.45, speed: 4, yFrac: 0.1, depth: 0 },
      { texIdx: 2, scale: 0.5, alpha: 0.42, speed: 5, yFrac: 0.3, depth: 0 },
      { texIdx: 1, scale: 0.62, alpha: 0.55, speed: 7, yFrac: 0.44, depth: 0.25 },
      { texIdx: 3, scale: 0.7, alpha: 0.6, speed: 8, yFrac: 0.18, depth: 0.25 },
      { texIdx: 2, scale: 0.85, alpha: 0.8, speed: 13, yFrac: 0.62, depth: 0.7 },
      { texIdx: 0, scale: 0.95, alpha: 0.78, speed: 15, yFrac: 0.36, depth: 0.7 },
      { texIdx: 3, scale: 1.1, alpha: 0.85, speed: 19, yFrac: 0.8, depth: 1 },
      { texIdx: 1, scale: 1.25, alpha: 0.88, speed: 23, yFrac: 0.95, depth: 1 },
    ];
    defs.forEach((d, i) => {
      const sp = new Sprite(tex.clouds[d.texIdx]);
      sp.anchor.set(0.5);
      sp.scale.set(d.scale);
      sp.alpha = d.alpha;
      const x = ((i * 0.37 + 0.15) % 1) * w;
      const y = d.yFrac * h * 0.92;
      sp.position.set(x, y);
      this.container.addChild(sp);
      this.clouds.push({ sp, speed: d.speed, bobPhase: i * 1.9, baseY: y, depth: d.depth, alpha: d.alpha });
    });

    // sun rays — long soft additive wedges that turn very slowly
    for (let i = 0; i < 7; i++) {
      const sp = new Sprite(tex.glow);
      sp.anchor.set(0.5, 0.06);
      sp.tint = 0xfff4cc;
      sp.alpha = 0.1;
      sp.blendMode = 'add';
      sp.rotation = (i / 7) * Math.PI * 2;
      this.container.addChild(sp);
      this.rays.push(sp);
    }

    // pollen / dust motes catching the light
    for (let i = 0; i < 46; i++) {
      const sp = new Sprite(tex.dot);
      sp.anchor.set(0.5);
      const sc = 0.05 + Math.random() * 0.12;
      sp.scale.set(sc);
      sp.tint = i % 3 === 0 ? 0xffffff : 0xfff0b8;
      sp.alpha = 0.25 + Math.random() * 0.4;
      sp.blendMode = 'add';
      sp.position.set(Math.random() * w, Math.random() * h);
      this.container.addChild(sp);
      this.motes.push({
        sp,
        vy: -(6 + Math.random() * 22),
        phase: Math.random() * Math.PI * 2,
        amp: 6 + Math.random() * 22,
        base: sp.x,
      });
    }

    // warm haze near the horizon for depth
    this.haze = new Sprite(tex.glow);
    this.haze.anchor.set(0.5);
    this.haze.tint = 0xfff0d0;
    this.haze.alpha = 0.3;
    this.haze.blendMode = 'add';
    this.container.addChild(this.haze);

    this.layout(w, h);
  }

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.skyMorning.width = w;
    this.skyMorning.height = h;
    this.skyGolden.width = w;
    this.skyGolden.height = h;
    const sx = w * 0.85;
    const sy = h * 0.14;
    this.sunGlowOuter.position.set(sx, sy);
    this.sunGlowOuter.scale.set(Math.max(w, h) / 155);
    this.sunGlowInner.position.set(sx, sy);
    this.sunGlowInner.scale.set(1.9);
    this.sunCore.position.set(sx, sy);
    this.haze.position.set(w / 2, h + 30);
    this.haze.scale.set(w / 70, h / 340);
    const rayLen = Math.max(w, h) / 40;
    for (const r of this.rays) {
      r.position.set(sx, sy);
      r.scale.set(0.55, rayLen);
    }
    for (const m of this.motes) {
      if (m.sp.x > w) m.sp.x = Math.random() * w;
      m.base = m.sp.x;
    }
  }

  private makeBird(): Bird {
    const root = new Container();
    const dir = Math.random() < 0.5 ? 1 : -1;
    const scale = 0.55 + Math.random() * 0.5;
    const col = 0x3d4b63;
    const wingL = new Graphics().moveTo(0, 0).quadraticCurveTo(-11, -9, -20, -3)
      .stroke({ width: 3, color: col, cap: 'round' });
    const wingR = new Graphics().moveTo(0, 0).quadraticCurveTo(11, -9, 20, -3)
      .stroke({ width: 3, color: col, cap: 'round' });
    root.addChild(wingL, wingR);
    root.scale.set(scale);
    root.alpha = 0.75;
    const y = this.h * (0.08 + Math.random() * 0.3);
    root.position.set(dir > 0 ? -30 : this.w + 30, y);
    this.container.addChild(root);
    return { root, wingL, wingR, vx: dir * (34 + Math.random() * 26) * scale, t: Math.random() * 5, baseY: y };
  }

  update(dt: number): void {
    this.t += dt;
    const p = this.progress;
    this.skyGolden.alpha = p;

    // sun warms and swells slightly toward golden hour
    const pulse = 1 + Math.sin(this.t * 0.8) * 0.02;
    this.sunGlowInner.scale.set((1.9 + p * 0.7) * pulse);
    this.sunGlowOuter.alpha = 0.5 + p * 0.3 + Math.sin(this.t * 0.6) * 0.04;
    this.sunGlowOuter.tint = p > 0.5 ? 0xffd9a0 : 0xfff2c0;
    this.sunCore.tint = 0xffffff;

    const nearTint = lerpColor(0xffffff, 0xffd9b8, p);
    const farTint = lerpColor(0xd6e8fa, 0xf3cfb4, p);
    for (const c of this.clouds) {
      c.sp.x += c.speed * dt;
      c.sp.y = c.baseY + Math.sin(this.t * 0.22 + c.bobPhase) * 7;
      c.sp.tint = lerpColor(farTint, nearTint, c.depth);
      c.sp.alpha = c.alpha * (0.85 + 0.15 * c.depth);
      const half = c.sp.width / 2;
      if (c.sp.x - half > this.w) c.sp.x = -half;
    }

    // slow crepuscular rays
    for (let i = 0; i < this.rays.length; i++) {
      const r = this.rays[i];
      r.rotation += dt * (0.012 + (i % 3) * 0.004);
      r.alpha = 0.07 + p * 0.06 + Math.sin(this.t * 0.5 + i * 1.3) * 0.035;
      r.tint = p > 0.5 ? 0xffdcae : 0xfff4cc;
    }

    // floating pollen
    for (const m of this.motes) {
      m.sp.y += m.vy * dt;
      m.sp.x = m.base + Math.sin(this.t * 0.5 + m.phase) * m.amp;
      if (m.sp.y < -8) {
        m.sp.y = this.h + 8;
        m.base = Math.random() * this.w;
      }
    }
    this.haze.alpha = 0.26 + p * 0.22;
    this.haze.tint = lerpColor(0xfff0d0, 0xffc98a, p);

    // birds
    this.birdTimer -= dt;
    if (this.birdTimer <= 0 && this.birds.length < 3) {
      this.birds.push(this.makeBird());
      this.birdTimer = 9 + Math.random() * 14;
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.t += dt;
      b.root.x += b.vx * dt;
      b.root.y = b.baseY + Math.sin(b.t * 0.9) * 12;
      const flap = Math.sin(b.t * 9);
      b.wingL.scale.y = 0.35 + Math.abs(flap) * 0.85;
      b.wingR.scale.y = b.wingL.scale.y;
      b.wingL.y = -flap * 2;
      b.wingR.y = -flap * 2;
      if ((b.vx > 0 && b.root.x > this.w + 40) || (b.vx < 0 && b.root.x < -40)) {
        this.container.removeChild(b.root);
        b.root.destroy({ children: true });
        this.birds.splice(i, 1);
      }
    }
  }
}

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
