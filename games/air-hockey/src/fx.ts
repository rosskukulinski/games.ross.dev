import { Container, Graphics, Sprite, Texture, type Renderer } from 'pixi.js';

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  spin: number;
  drag: number;
  startScale: number;
}

const POOL_SIZE = 700;

export interface BurstOptions {
  color?: number;
  /** Peak outward speed, px/s. */
  speed?: number;
  life?: number;
  size?: number;
  /** Restrict the spray to a cone around this angle (radians). */
  direction?: number;
  spread?: number;
  gravity?: number;
}

/** Pooled additive particles plus a shared screen-shake accumulator. */
export class Fx {
  private readonly layer = new Container();
  private readonly pool: Particle[] = [];
  private readonly active: Particle[] = [];
  private trauma = 0;
  shakeX = 0;
  shakeY = 0;

  constructor(renderer: Renderer, parent: Container) {
    this.layer.blendMode = 'add';
    parent.addChild(this.layer);

    const dot = new Graphics().circle(0, 0, 16).fill({ color: 0xffffff });
    const texture: Texture = renderer.generateTexture({
      target: dot,
      resolution: 2,
      antialias: true,
    });
    dot.destroy();

    for (let i = 0; i < POOL_SIZE; i++) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.layer.addChild(sprite);
      this.pool.push({
        sprite,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        spin: 0,
        drag: 1,
        startScale: 1,
      });
    }
  }

  burst(x: number, y: number, count: number, opts: BurstOptions = {}): void {
    const color = opts.color ?? 0xffffff;
    const speed = opts.speed ?? 260;
    const life = opts.life ?? 0.5;
    const size = opts.size ?? 5;
    const spread = opts.spread ?? Math.PI * 2;
    const dir = opts.direction ?? 0;

    for (let i = 0; i < count; i++) {
      const p = this.pool.pop();
      if (!p) return; // Pool exhausted — dropping particles beats stuttering.
      const angle = dir + (Math.random() - 0.5) * spread;
      const mag = speed * (0.35 + Math.random() * 0.65);
      p.vx = Math.cos(angle) * mag;
      p.vy = Math.sin(angle) * mag;
      p.maxLife = life * (0.6 + Math.random() * 0.7);
      p.life = p.maxLife;
      p.drag = opts.gravity !== undefined ? 1.6 : 2.6;
      p.spin = opts.gravity ?? 0;
      p.startScale = (size * (0.5 + Math.random() * 0.8)) / 16;

      p.sprite.visible = true;
      p.sprite.position.set(x, y);
      p.sprite.tint = color;
      p.sprite.alpha = 1;
      p.sprite.scale.set(p.startScale);
      this.active.push(p);
    }
  }

  /** Adds screen shake. `amount` is roughly 0..1. */
  addShake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        this.active.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      const decay = Math.exp(-p.drag * dt);
      p.vx *= decay;
      p.vy = p.vy * decay + p.spin * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      const t = p.life / p.maxLife;
      p.sprite.alpha = t;
      p.sprite.scale.set(p.startScale * (0.35 + t * 0.75));
    }

    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const mag = this.trauma * this.trauma * 16;
    this.shakeX = (Math.random() * 2 - 1) * mag;
    this.shakeY = (Math.random() * 2 - 1) * mag;
  }

  clear(): void {
    for (const p of this.active) {
      p.sprite.visible = false;
      this.pool.push(p);
    }
    this.active.length = 0;
    this.trauma = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }
}
