import { Container, Graphics, type Renderer, Sprite, Text } from 'pixi.js';

/**
 * Pooled additive particles, floating score popups, and screen shake.
 * Everything is allocated once and recycled — nothing is constructed during
 * play.
 */

const MAX_PARTICLES = 700;
const MAX_POPUPS = 24;

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  drag: number;
}

interface Popup {
  text: Text;
  vy: number;
  life: number;
  maxLife: number;
}

export class Fx {
  /** Additive sprites live here — add it to the world, above props/holes. */
  readonly particleLayer = new Container();
  readonly popupLayer = new Container();

  private pool: Particle[] = [];
  private active: Particle[] = [];
  private popupPool: Popup[] = [];
  private popupActive: Popup[] = [];

  private shakeTime = 0;
  private shakePower = 0;
  shakeX = 0;
  shakeY = 0;

  init(renderer: Renderer): void {
    const g = new Graphics().circle(0, 0, 24).fill(0xffffff);
    const texture = renderer.generateTexture(g);
    g.destroy();
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'add';
      sprite.visible = false;
      this.particleLayer.addChild(sprite);
      this.pool.push({ sprite, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, drag: 1 });
    }
    for (let i = 0; i < MAX_POPUPS; i++) {
      const text = new Text({
        text: '',
        style: {
          fontFamily: 'system-ui, sans-serif',
          fontSize: 26,
          fontWeight: '800',
          fill: 0xffffff,
          stroke: { color: 0x081020, width: 5 },
        },
      });
      text.anchor.set(0.5);
      text.visible = false;
      this.popupLayer.addChild(text);
      this.popupPool.push({ text, vy: 0, life: 0, maxLife: 1 });
    }
  }

  burst(
    x: number,
    y: number,
    color: number,
    count: number,
    speed: number,
    size: number,
    life = 0.6
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool.pop();
      if (!p) return;
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = p.life = life * (0.6 + Math.random() * 0.4);
      p.size = size * (0.5 + Math.random() * 0.5);
      p.drag = 2.6;
      p.sprite.tint = color;
      p.sprite.position.set(x, y);
      p.sprite.visible = true;
      this.active.push(p);
    }
  }

  /** Particles pulled inward — the "falling into the void" look. */
  implode(x: number, y: number, color: number, count: number, radius: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool.pop();
      if (!p) return;
      const angle = Math.random() * Math.PI * 2;
      const d = radius * (0.8 + Math.random() * 0.6);
      p.sprite.position.set(x + Math.cos(angle) * d, y + Math.sin(angle) * d);
      p.vx = -Math.cos(angle) * d * 2.6;
      p.vy = -Math.sin(angle) * d * 2.6;
      p.maxLife = p.life = 0.42 * (0.7 + Math.random() * 0.5);
      p.size = radius * 0.05 * (0.5 + Math.random());
      p.drag = 0.2;
      p.sprite.tint = color;
      p.sprite.visible = true;
      this.active.push(p);
    }
  }

  popup(x: number, y: number, message: string, color: number, scale = 1): void {
    const p = this.popupPool.pop();
    if (!p) return;
    p.text.text = message;
    p.text.style.fill = color;
    p.text.position.set(x, y);
    p.text.scale.set(scale * 0.2); // pops outward in update()
    p.text.alpha = 1;
    p.text.visible = true;
    p.vy = -46;
    p.maxLife = p.life = 0.9;
    this.popupActive.push(p);
    // Remember the intended scale on the object itself.
    (p as unknown as { target: number }).target = scale;
  }

  shake(power: number): void {
    this.shakePower = Math.max(this.shakePower, power);
    this.shakeTime = Math.max(this.shakeTime, 0.18 + power * 0.12);
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
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      const t = p.life / p.maxLife;
      p.sprite.alpha = t;
      p.sprite.scale.set((p.size / 24) * (0.4 + t * 0.6));
    }

    for (let i = this.popupActive.length - 1; i >= 0; i--) {
      const p = this.popupActive[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.text.visible = false;
        this.popupActive.splice(i, 1);
        this.popupPool.push(p);
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      const target = (p as unknown as { target: number }).target || 1;
      // outBack-ish entrance, then drift and fade.
      const k = t < 0.3 ? easeOutBack(t / 0.3) : 1;
      p.text.scale.set(target * k);
      p.text.y += p.vy * dt;
      p.text.alpha = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
    }

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const a = Math.max(0, this.shakeTime) * this.shakePower * 46;
      this.shakeX = (Math.random() * 2 - 1) * a;
      this.shakeY = (Math.random() * 2 - 1) * a;
      if (this.shakeTime <= 0) {
        this.shakePower = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      }
    }
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
