// The living night sky behind the UI: twinkling stars, nebula glow, shooting
// stars, and a pooled additive particle system for every reward.
// `energy` (0..1) follows the perfect-word streak and warms everything up.

export const COLORS = {
  gold: '#ffd166',
  pink: '#ff6fae',
  teal: '#4cc9f0',
  mint: '#7ae582',
  lilac: '#b79cff',
  white: '#ffffff',
  coral: '#ff8a5c',
};
const PALETTE = Object.values(COLORS);

interface Star {
  x: number;
  y: number;
  r: number;
  tw: number;
  sp: number;
  depth: number;
}

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  sprite: HTMLCanvasElement;
  grav: number;
  drag: number;
  spin: number;
  shape: 'dot' | 'star';
  rot: number;
}

interface Flyer {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  done: () => void;
  trail: number;
}

interface Shooter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

const POOL = 700;

function glowSprite(color: string, size = 64): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.18, color);
  grd.addColorStop(0.45, color + '55');
  grd.addColorStop(1, color + '00');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

function starPath(g: CanvasRenderingContext2D, r: number): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
}

export class Sky {
  private g: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private stars: Star[] = [];
  private nebula: HTMLCanvasElement = document.createElement('canvas');
  private sprites = new Map<string, HTMLCanvasElement>();
  private pool: Particle[] = [];
  private flyers: Flyer[] = [];
  private shooters: Shooter[] = [];
  private time = 0;
  private last = 0;
  private running = true;
  private shake = 0;
  energy = 0;
  private energyShown = 0;
  /** Optional listener for the screen shake offset, applied to the DOM UI. */
  onShake: ((x: number, y: number) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.g = canvas.getContext('2d')!;
    for (const c of PALETTE) this.sprites.set(c, glowSprite(c));
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1,
        sprite: this.sprites.get(COLORS.gold)!, grav: 0, drag: 1, spin: 0, shape: 'dot', rot: 0,
      });
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  get activeParticles(): number {
    return this.pool.filter((p) => p.alive).length;
  }

  setRunning(r: boolean): void {
    this.running = r;
    this.last = performance.now();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    const count = Math.round((this.w * this.h) / 4200);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      const depth = Math.random();
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: 0.4 + depth * depth * 1.9,
        tw: Math.random() * Math.PI * 2,
        sp: 0.6 + Math.random() * 2.2,
        depth,
      });
    }
    this.paintNebula();
  }

  private paintNebula(): void {
    const n = this.nebula;
    n.width = Math.max(1, Math.round(this.w / 2));
    n.height = Math.max(1, Math.round(this.h / 2));
    const g = n.getContext('2d')!;
    const blobs: [number, number, number, string][] = [
      [0.15, 0.25, 0.55, 'rgba(183,156,255,0.22)'],
      [0.85, 0.2, 0.45, 'rgba(76,201,240,0.16)'],
      [0.75, 0.85, 0.6, 'rgba(255,111,174,0.18)'],
      [0.2, 0.9, 0.4, 'rgba(76,201,240,0.12)'],
      [0.5, 0.5, 0.35, 'rgba(255,209,102,0.06)'],
    ];
    const s = Math.max(n.width, n.height);
    for (const [x, y, r, c] of blobs) {
      const grd = g.createRadialGradient(x * n.width, y * n.height, 0, x * n.width, y * n.height, r * s);
      grd.addColorStop(0, c);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, n.width, n.height);
    }
  }

  private spawn(): Particle | null {
    for (const p of this.pool) if (!p.alive) return p;
    return null;
  }

  /** A radial burst of glowing sparks (plus a few little star shapes). */
  burst(x: number, y: number, count: number, colors: string[] = PALETTE, speed = 260, size = 1): void {
    for (let i = 0; i < count; i++) {
      const p = this.spawn();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.25 + Math.random() * 0.85);
      const c = colors[(Math.random() * colors.length) | 0];
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v - speed * 0.25;
      p.max = p.life = 0.6 + Math.random() * 0.8;
      p.size = (8 + Math.random() * 18) * size;
      p.sprite = this.sprites.get(c) || this.sprites.get(COLORS.gold)!;
      p.grav = 380;
      p.drag = 0.985;
      p.shape = Math.random() < 0.22 ? 'star' : 'dot';
      p.rot = Math.random() * 6;
      p.spin = (Math.random() - 0.5) * 10;
    }
  }

  /** Gentle upward fizz, used for small per-letter rewards. */
  fizz(x: number, y: number, color: string, count = 10): void {
    for (let i = 0; i < count; i++) {
      const p = this.spawn();
      if (!p) return;
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * 30;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = (Math.random() - 0.5) * 120;
      p.vy = -60 - Math.random() * 160;
      p.max = p.life = 0.45 + Math.random() * 0.4;
      p.size = 6 + Math.random() * 12;
      p.sprite = this.sprites.get(color) || this.sprites.get(COLORS.gold)!;
      p.grav = 120;
      p.drag = 0.97;
      p.shape = 'dot';
      p.rot = 0;
      p.spin = 0;
    }
  }

  /** A star that arcs from (x0,y0) to (x1,y1) trailing sparkles. */
  fly(x0: number, y0: number, x1: number, y1: number, done: () => void, dur = 0.85): void {
    const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 200;
    const my = Math.min(y0, y1) - 120;
    this.flyers.push({ x0, y0, cx: mx, cy: my, x1, y1, t: 0, dur, done, trail: 0 });
  }

  /** Drop in-flight stars (their callbacks never fire). */
  clearFlyers(): void {
    this.flyers.length = 0;
  }

  kick(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.time += dt;
    this.update(dt);
    this.draw();
  }

  private update(dt: number): void {
    this.energyShown += (this.energy - this.energyShown) * Math.min(1, dt * 2);

    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy += p.grav * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }

    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt / f.dur;
      const t = Math.min(f.t, 1);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = (1 - e) * (1 - e) * f.x0 + 2 * (1 - e) * e * f.cx + e * e * f.x1;
      const y = (1 - e) * (1 - e) * f.y0 + 2 * (1 - e) * e * f.cy + e * e * f.y1;
      f.trail += dt;
      while (f.trail > 0.012) {
        f.trail -= 0.012;
        this.fizz(x, y, Math.random() < 0.5 ? COLORS.gold : COLORS.white, 1);
      }
      (f as Flyer & { px?: number; py?: number }).px = x;
      (f as Flyer & { px?: number; py?: number }).py = y;
      if (f.t >= 1) {
        this.flyers.splice(i, 1);
        this.burst(f.x1, f.y1, 26, [COLORS.gold, COLORS.white, COLORS.coral], 170, 0.8);
        f.done();
      }
    }

    // Shooting stars — more of them as the streak heats up.
    if (Math.random() < dt * (0.12 + this.energyShown * 0.9)) {
      const fromLeft = Math.random() < 0.5;
      this.shooters.push({
        x: fromLeft ? Math.random() * this.w * 0.5 : this.w * (0.5 + Math.random() * 0.5),
        y: Math.random() * this.h * 0.4,
        vx: (fromLeft ? 1 : -1) * (500 + Math.random() * 300),
        vy: 180 + Math.random() * 120,
        life: 0.9,
      });
    }
    for (let i = this.shooters.length - 1; i >= 0; i--) {
      const s = this.shooters[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) this.shooters.splice(i, 1);
    }

    this.shake *= Math.pow(0.0015, dt);
    if (this.shake < 0.3) this.shake = 0;
    const sx = this.shake ? (Math.random() - 0.5) * this.shake * 2 : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake * 2 : 0;
    this.onShake?.(sx, sy);
  }

  private draw(): void {
    const g = this.g;
    const { w, h } = this;
    const e = this.energyShown;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Deep indigo sky that warms toward magenta with the streak.
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, `hsl(${252 - e * 22}, 62%, ${9 + e * 4}%)`);
    grd.addColorStop(0.55, `hsl(${262 - e * 30}, 55%, ${17 + e * 5}%)`);
    grd.addColorStop(1, `hsl(${285 - e * 40}, 50%, ${24 + e * 6}%)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);

    g.globalAlpha = 0.85 + e * 0.5;
    g.drawImage(this.nebula, 0, 0, w, h);
    g.globalAlpha = 1;

    g.globalCompositeOperation = 'lighter';
    const drift = this.time * 6;
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(this.time * s.sp + s.tw);
      const x = (s.x + drift * s.depth) % w;
      const a = tw * (0.35 + s.depth * 0.65);
      g.globalAlpha = a;
      if (s.r > 1.6) {
        const sz = s.r * 7 * (1 + e * 0.4);
        g.drawImage(this.sprites.get(s.depth > 0.93 ? COLORS.gold : COLORS.white)!, x - sz / 2, s.y - sz / 2, sz, sz);
      } else {
        g.fillStyle = '#fff';
        g.fillRect(x, s.y, s.r, s.r);
      }
    }
    g.globalAlpha = 1;

    for (const s of this.shooters) {
      const a = Math.min(1, s.life * 2);
      const tail = g.createLinearGradient(s.x, s.y, s.x - s.vx * 0.15, s.y - s.vy * 0.15);
      tail.addColorStop(0, `rgba(255,255,255,${a})`);
      tail.addColorStop(1, 'rgba(183,156,255,0)');
      g.strokeStyle = tail;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x - s.vx * 0.15, s.y - s.vy * 0.15);
      g.stroke();
      g.drawImage(this.sprites.get(COLORS.white)!, s.x - 8, s.y - 8, 16, 16);
    }

    for (const p of this.pool) {
      if (!p.alive) continue;
      const k = p.life / p.max;
      g.globalAlpha = Math.min(1, k * 1.6);
      const sz = p.size * (0.4 + k * 0.6);
      if (p.shape === 'star') {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.drawImage(p.sprite, -sz, -sz, sz * 2, sz * 2);
        g.fillStyle = '#fff6d6';
        starPath(g, sz * 0.32);
        g.fill();
        g.restore();
      } else {
        g.drawImage(p.sprite, p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
    }
    g.globalAlpha = 1;

    for (const f of this.flyers) {
      const ff = f as Flyer & { px?: number; py?: number };
      if (ff.px === undefined || ff.py === undefined) continue;
      g.drawImage(this.sprites.get(COLORS.gold)!, ff.px - 40, ff.py - 40, 80, 80);
      g.save();
      g.translate(ff.px, ff.py);
      g.rotate(this.time * 6);
      g.fillStyle = '#fff3c4';
      starPath(g, 13);
      g.fill();
      g.restore();
    }
    g.globalCompositeOperation = 'source-over';
  }
}
