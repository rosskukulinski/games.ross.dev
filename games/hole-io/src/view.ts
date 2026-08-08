import { AdvancedBloomFilter } from 'pixi-filters';
import {
  type Application,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
} from 'pixi.js';
import { Fx } from './fx';
import {
  type Phase,
  type Prop,
  HOLE_BASE_R,
  PROP_KINDS,
  WORLD_H,
  WORLD_W,
  generateProps,
  mulberry32,
} from './shared/rules';

/** Rim colors, assigned per player in roster order. */
export const PLAYER_COLORS = [
  0x00e5ff, // you (index 0 in solo) — electric cyan
  0xff5d73, // coral
  0xffb703, // amber
  0x9ef01a, // lime
  0xb388ff, // violet
  0xff8fab, // pink
  0x2dd4bf, // mint
  0xff7b00, // orange
];

export interface RenderHole {
  id: number;
  x: number;
  y: number;
  r: number;
  score: number;
  alive: boolean;
  invuln: boolean;
  name: string;
  color: number;
  isMe: boolean;
  leader: boolean;
}

export interface RenderState {
  holes: RenderHole[];
  phase: Phase;
  timer: number;
}

interface HoleVis {
  root: Container;
  halo: Sprite;
  ring: Sprite;
  voidSprite: Sprite;
  swirl: Sprite;
  shield: Graphics;
  label: Text;
  /** Seconds left of the death animation; 0 when not dying. */
  deathT: number;
  deathR: number;
  eaterId: number;
  /** Seconds left of the spawn pop-in. */
  spawnT: number;
  lastAlive: boolean;
}

interface Sinking {
  sprite: Sprite;
  eaterId: number;
  t: number;
  maxT: number;
  startScale: number;
  fromX: number;
  fromY: number;
}

interface Firefly {
  sprite: Sprite;
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
}

const DEATH_TIME = 0.55;
const SPAWN_TIME = 0.45;
const SINK_TIME = 0.5;

export class View {
  readonly fx = new Fx();

  /** Everything in world coordinates lives under this container. */
  private world = new Container();
  private groundLayer = new Container();
  private propLayer = new Container();
  private holeLayer = new Container();
  private glowLayer = new Container();

  private vignette: Sprite;

  private propSprites = new Map<number, Sprite>();
  private props: Prop[] = [];
  private seed = 0;
  private sinking: Sinking[] = [];
  private holes = new Map<number, HoleVis>();
  private holePositions = new Map<number, { x: number; y: number }>();
  private fireflies: Firefly[] = [];

  private kindTextures = new Map<string, Texture>();
  private voidTexture: Texture;
  private ringTexture: Texture;
  private glowTexture: Texture;
  private swirlTexture: Texture;

  private camX = WORLD_W / 2;
  private camY = WORLD_H / 2;
  private zoom = 1;
  private zoomInit = false;

  constructor(private readonly app: Application) {
    this.world.addChild(this.groundLayer, this.propLayer, this.holeLayer, this.glowLayer);
    this.glowLayer.addChild(this.fx.particleLayer, this.fx.popupLayer);
    app.stage.addChild(this.world);

    this.fx.init(app.renderer);

    this.voidTexture = makeRadialTexture(256, [
      [0, 'rgba(1,2,7,1)'],
      [0.76, 'rgba(1,2,7,1)'],
      [0.88, 'rgba(2,4,12,0.96)'],
      [1, 'rgba(2,4,12,0)'],
    ]);
    this.ringTexture = makeRadialTexture(256, [
      [0, 'rgba(255,255,255,0)'],
      [0.7, 'rgba(255,255,255,0)'],
      [0.8, 'rgba(255,255,255,1)'],
      [0.9, 'rgba(255,255,255,0.85)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    this.glowTexture = makeRadialTexture(128, [
      [0, 'rgba(255,255,255,0.9)'],
      [0.4, 'rgba(255,255,255,0.28)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    this.swirlTexture = this.makeSwirlTexture();

    this.vignette = new Sprite(
      makeRadialTexture(512, [
        [0, 'rgba(0,0,0,0)'],
        [0.62, 'rgba(0,0,0,0)'],
        [1, 'rgba(2,4,10,0.55)'],
      ])
    );
    this.vignette.anchor.set(0.5);
    app.stage.addChild(this.vignette);

    this.world.filters = [
      new AdvancedBloomFilter({
        // High enough that prop bodies keep their detail — only rims, windows,
        // popups, particles and the boundary wall actually bloom.
        threshold: 0.52,
        bloomScale: 0.7,
        brightness: 1,
        blur: 6,
        quality: 6,
      }),
    ];

    this.resize();
  }

  resize(): void {
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    this.vignette.position.set(w / 2, h / 2);
    // Oversize so the corners are fully covered.
    const d = Math.hypot(w, h) * 1.05;
    this.vignette.width = d;
    this.vignette.height = d;
  }

  // --- Arena construction --------------------------------------------------

  /** Build the arena for a seed. Call on every join (replaces the old one). */
  setWorld(seed: number, gone: number[]): void {
    this.groundLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.propLayer.removeChildren().forEach((c) => c.destroy());
    for (const vis of this.holes.values()) vis.root.destroy({ children: true });
    this.holes.clear();
    this.holePositions.clear();
    this.propSprites.clear();
    this.sinking = [];
    this.fireflies = [];
    this.zoomInit = false;

    this.seed = seed;
    this.buildGround(seed);
    this.props = generateProps(seed);
    const goneSet = new Set(gone);
    for (const prop of this.props) {
      const sprite = new Sprite(this.textureForProp(prop));
      sprite.anchor.set(0.5);
      sprite.position.set(prop.x, prop.y);
      sprite.scale.set(1 / TEX_SCALE);
      sprite.rotation = (mulberry32(seed + prop.id)() - 0.5) * 0.9;
      sprite.visible = !goneSet.has(prop.id);
      this.propLayer.addChild(sprite);
      this.propSprites.set(prop.id, sprite);
    }
  }

  /** New round: every prop regrows at once (the server reset them silently). */
  resetProps(): void {
    this.sinking = [];
    for (const [id, sprite] of this.propSprites) {
      const prop = this.props[id];
      sprite.visible = true;
      sprite.alpha = 1;
      sprite.scale.set(1 / TEX_SCALE);
      sprite.position.set(prop.x, prop.y);
      sprite.rotation = (mulberry32(this.seed + id)() - 0.5) * 0.9;
    }
  }

  private buildGround(seed: number): void {
    const rng = mulberry32(seed ^ 0x9e3779b9);
    const g = new Graphics();

    // Base lawn — bright enough that the near-black holes punch through it.
    g.rect(-200, -200, WORLD_W + 400, WORLD_H + 400).fill(0x0a1420);
    g.rect(0, 0, WORLD_W, WORLD_H).fill(0x1d3d57);

    // Small soft patches to break up the flatness — kept subtle so they read
    // as mottled grass, not giant discs.
    for (let i = 0; i < 56; i++) {
      const x = rng() * WORLD_W;
      const y = rng() * WORLD_H;
      const r = 34 + rng() * 80;
      g.circle(x, y, r).fill({ color: i % 2 ? 0x224461 : 0x19364f, alpha: 0.4 });
    }
    // A few mown stripes for texture.
    for (let i = 0; i < 9; i++) {
      const y = rng() * WORLD_H;
      g.rect(0, y, WORLD_W, 34 + rng() * 40).fill({ color: 0x224460, alpha: 0.35 });
    }

    // Subtle grid, like park paths seen from far above.
    for (let x = 100; x < WORLD_W; x += 100) {
      g.rect(x - 1.2, 0, 2.4, WORLD_H).fill({ color: 0x35608a, alpha: 0.3 });
    }
    for (let y = 100; y < WORLD_H; y += 100) {
      g.rect(0, y - 1.2, WORLD_W, 2.4).fill({ color: 0x35608a, alpha: 0.3 });
    }

    // Glowing boundary wall — bright enough to bloom.
    g.roundRect(-10, -10, WORLD_W + 20, WORLD_H + 20, 26).stroke({ width: 7, color: 0x2dd4bf });
    g.roundRect(-22, -22, WORLD_W + 44, WORLD_H + 44, 34).stroke({
      width: 4,
      color: 0x1a7f74,
      alpha: 0.7,
    });
    this.groundLayer.addChild(g);

    // Fireflies drifting over the lawn.
    for (let i = 0; i < 26; i++) {
      const sprite = new Sprite(this.glowTexture);
      sprite.anchor.set(0.5);
      sprite.tint = i % 3 === 0 ? 0x9ef0d0 : 0xffd166;
      sprite.blendMode = 'add';
      const f: Firefly = {
        sprite,
        baseX: rng() * WORLD_W,
        baseY: rng() * WORLD_H,
        phase: rng() * Math.PI * 2,
        speed: 0.3 + rng() * 0.5,
      };
      sprite.width = sprite.height = 10 + rng() * 8;
      this.groundLayer.addChild(sprite);
      this.fireflies.push(f);
    }
  }

  private textureForProp(prop: Prop): Texture {
    const variants = KIND_VARIANTS[PROP_KINDS[prop.kind].name] ?? 1;
    const variant = prop.id % variants;
    const key = `${prop.kind}:${variant}`;
    let texture = this.kindTextures.get(key);
    if (!texture) {
      const g = new Graphics();
      drawPropArt(g, PROP_KINDS[prop.kind].name, variant);
      texture = this.app.renderer.generateTexture(g);
      g.destroy();
      this.kindTextures.set(key, texture);
    }
    return texture;
  }

  // --- Arena events --------------------------------------------------------

  /** A prop fell in: animate it spiralling into the eater. */
  propEaten(propId: number, eaterId: number): void {
    const sprite = this.propSprites.get(propId);
    if (!sprite || !sprite.visible) return;
    this.sinking.push({
      sprite,
      eaterId,
      t: SINK_TIME,
      maxT: SINK_TIME,
      startScale: sprite.scale.x,
      fromX: sprite.x,
      fromY: sprite.y,
    });
  }

  propRespawned(propId: number): void {
    const sprite = this.propSprites.get(propId);
    if (!sprite) return;
    const prop = this.props[propId];
    sprite.visible = true;
    sprite.alpha = 0;
    sprite.position.set(prop.x, prop.y);
    // The render loop eases alpha/scale back in via the sinking list trick:
    this.sinking.push({
      sprite,
      eaterId: -1, // -1 marks "growing back", not sinking
      t: 0.4,
      maxT: 0.4,
      startScale: 1 / TEX_SCALE,
      fromX: prop.x,
      fromY: prop.y,
    });
  }

  holeSwallowed(victimId: number, eaterId: number): void {
    const vis = this.holes.get(victimId);
    if (vis) {
      vis.deathT = DEATH_TIME;
      vis.deathR = Math.max(vis.voidSprite.width / 2, HOLE_BASE_R);
      vis.eaterId = eaterId;
    }
    const pos = this.holePositions.get(victimId);
    const eaterVis = this.holes.get(eaterId);
    if (pos) {
      const color = eaterVis ? eaterVis.ring.tint : 0xffffff;
      this.fx.implode(pos.x, pos.y, color as number, 46, vis ? vis.deathR * 1.4 : 40);
      this.fx.burst(pos.x, pos.y, 0xffffff, 18, 190, 9, 0.5);
    }
  }

  holeSpawned(id: number): void {
    const vis = this.holes.get(id);
    if (vis) vis.spawnT = SPAWN_TIME;
  }

  eatFx(propId: number, color: number, pts: number, mine: boolean): void {
    const prop = this.props[propId];
    if (!prop) return;
    const size = PROP_KINDS[prop.kind].r;
    this.fx.burst(prop.x, prop.y, color, Math.min(26, 6 + pts * 2), 120 + size * 6, 4 + size * 0.4);
    if (mine || pts >= 6) {
      this.fx.popup(prop.x, prop.y - size, `+${pts}`, mine ? 0xffe066 : 0xdfe8ff, mine ? 1 : 0.75);
    }
  }

  /** Screen shake, exposed for main.ts (swallows, deaths). */
  shake(power: number): void {
    this.fx.shake(power);
  }

  // --- Per-frame rendering -------------------------------------------------

  screenToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.world.position.x) / this.zoom,
      y: (y - this.world.position.y) / this.zoom,
    };
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: x * this.zoom + this.world.position.x,
      y: y * this.zoom + this.world.position.y,
    };
  }

  render(
    state: RenderState | null,
    focus: { x: number; y: number; r: number },
    dt: number
  ): void {
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;

    // Camera: zoom out as the hole grows.
    const targetZoom = h / Math.min(1500, 320 + focus.r * 8.5);
    if (!this.zoomInit) {
      this.zoom = targetZoom;
      this.camX = focus.x;
      this.camY = focus.y;
      this.zoomInit = true;
    }
    this.zoom += (targetZoom - this.zoom) * Math.min(1, dt * 2.5);
    this.camX += (focus.x - this.camX) * Math.min(1, dt * 5);
    this.camY += (focus.y - this.camY) * Math.min(1, dt * 5);

    // Keep the view inside the arena (with a little border showing).
    const halfW = w / 2 / this.zoom;
    const halfH = h / 2 / this.zoom;
    const pad = 60;
    const cx = clampCam(this.camX, halfW, WORLD_W, pad);
    const cy = clampCam(this.camY, halfH, WORLD_H, pad);

    this.world.scale.set(this.zoom);
    this.world.position.set(
      w / 2 - cx * this.zoom + this.fx.shakeX,
      h / 2 - cy * this.zoom + this.fx.shakeY
    );

    // Fireflies drift and pulse.
    const now = performance.now() / 1000;
    for (const f of this.fireflies) {
      f.sprite.x = f.baseX + Math.sin(now * f.speed + f.phase) * 26;
      f.sprite.y = f.baseY + Math.cos(now * f.speed * 0.8 + f.phase * 2) * 20;
      f.sprite.alpha = 0.35 + 0.3 * Math.sin(now * 1.7 + f.phase * 3);
    }

    if (state) this.renderHoles(state, dt);
    this.updateSinking(dt);
    this.fx.update(dt);
  }

  private renderHoles(state: RenderState, dt: number): void {
    const seen = new Set<number>();
    for (const hole of state.holes) {
      seen.add(hole.id);
      let vis = this.holes.get(hole.id);
      if (!vis) {
        vis = this.makeHoleVis();
        this.holes.set(hole.id, vis);
      }
      this.holePositions.set(hole.id, { x: hole.x, y: hole.y });

      const label = hole.leader ? `👑 ${hole.name}` : hole.name;
      if (vis.label.text !== label) vis.label.text = label;
      vis.ring.tint = hole.color;
      vis.halo.tint = hole.color;
      vis.swirl.tint = hole.color;
      vis.label.style.fill = hole.isMe ? 0xffffff : 0xcfe0f5;

      vis.root.position.set(hole.x, hole.y);

      if (!hole.alive) {
        if (vis.deathT > 0) {
          // Death animation: shrink and spin into the eater.
          vis.deathT -= dt;
          const t = Math.max(0, vis.deathT / DEATH_TIME);
          const eater = this.holePositions.get(vis.eaterId);
          if (eater) {
            vis.root.position.set(
              hole.x + (eater.x - hole.x) * (1 - t),
              hole.y + (eater.y - hole.y) * (1 - t)
            );
          }
          this.sizeHole(vis, vis.deathR * t);
          vis.swirl.rotation += dt * 14;
          vis.root.alpha = t;
          vis.root.visible = true;
        } else {
          vis.root.visible = false;
        }
        vis.lastAlive = false;
        continue;
      }

      if (!vis.lastAlive) {
        // Came (back) to life this frame.
        vis.spawnT = SPAWN_TIME;
        vis.lastAlive = true;
      }
      vis.root.visible = true;
      vis.root.alpha = 1;

      let r = hole.r;
      if (vis.spawnT > 0) {
        vis.spawnT -= dt;
        const t = 1 - Math.max(0, vis.spawnT) / SPAWN_TIME;
        r *= easeOutBack(t);
      }
      this.sizeHole(vis, r);

      vis.swirl.rotation += dt * (1.6 + 14 / hole.r);
      vis.shield.visible = hole.invuln;
      if (hole.invuln) {
        vis.shield.alpha = 0.5 + 0.4 * Math.sin(performance.now() / 90);
      }
      // Labels stay a constant size on screen.
      const labelScale = Math.min(1.6, 1 / this.zoom);
      vis.label.scale.set(labelScale);
      vis.label.position.set(0, -hole.r - 16 * labelScale);
    }

    // Remove visuals for holes no longer in the snapshot (players who left).
    for (const [id, vis] of this.holes) {
      if (!seen.has(id)) {
        vis.root.destroy({ children: true });
        this.holes.delete(id);
        this.holePositions.delete(id);
      }
    }
  }

  private sizeHole(vis: HoleVis, r: number): void {
    const d = Math.max(1, r * 2);
    vis.voidSprite.width = vis.voidSprite.height = d * 1.06;
    vis.ring.width = vis.ring.height = d * 1.24;
    vis.halo.width = vis.halo.height = d * 2.5;
    vis.swirl.width = vis.swirl.height = d * 0.92;
    vis.shield.scale.set(r / 64);
  }

  private makeHoleVis(): HoleVis {
    const root = new Container();

    // Soft colored halo underneath everything, so a hole pops off the lawn.
    const halo = new Sprite(this.glowTexture);
    halo.anchor.set(0.5);
    halo.blendMode = 'add';
    halo.alpha = 0.34;

    const ring = new Sprite(this.ringTexture);
    ring.anchor.set(0.5);
    ring.blendMode = 'add';

    const voidSprite = new Sprite(this.voidTexture);
    voidSprite.anchor.set(0.5);

    const swirl = new Sprite(this.swirlTexture);
    swirl.anchor.set(0.5);
    swirl.blendMode = 'add';
    swirl.alpha = 0.8;

    const shield = new Graphics();
    // Drawn at radius 64; sizeHole scales it to match.
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2;
      const a1 = a0 + Math.PI / 14;
      shield.arc(0, 0, 78, a0, a1).stroke({ width: 7, color: 0xffffff, alpha: 0.9 });
      shield.closePath();
    }
    shield.visible = false;

    const label = new Text({
      text: '',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 17,
        fontWeight: '700',
        fill: 0xffffff,
        stroke: { color: 0x081020, width: 4 },
      },
    });
    label.anchor.set(0.5, 1);

    root.addChild(halo, ring, voidSprite, swirl, shield, label);
    this.holeLayer.addChild(root);
    return {
      root,
      halo,
      ring,
      voidSprite,
      swirl,
      shield,
      label,
      deathT: 0,
      deathR: HOLE_BASE_R,
      eaterId: -1,
      spawnT: SPAWN_TIME,
      lastAlive: true,
    };
  }

  private updateSinking(dt: number): void {
    for (let i = this.sinking.length - 1; i >= 0; i--) {
      const s = this.sinking[i];
      s.t -= dt;
      const done = s.t <= 0;
      const t = Math.max(0, s.t / s.maxT);

      if (s.eaterId === -1) {
        // Growing back in.
        const k = easeOutBack(1 - t);
        s.sprite.scale.set(s.startScale * k);
        s.sprite.alpha = 1 - t;
        if (done) {
          s.sprite.scale.set(s.startScale);
          s.sprite.alpha = 1;
          this.sinking.splice(i, 1);
        }
        continue;
      }

      // Spiralling down the hole.
      const eater = this.holePositions.get(s.eaterId);
      const k = 1 - t;
      if (eater) {
        s.sprite.x = s.fromX + (eater.x - s.fromX) * k * k;
        s.sprite.y = s.fromY + (eater.y - s.fromY) * k * k;
      }
      s.sprite.rotation += dt * 9;
      s.sprite.scale.set(s.startScale * t);
      if (done) {
        s.sprite.visible = false;
        s.sprite.scale.set(s.startScale);
        s.sprite.rotation = 0;
        this.sinking.splice(i, 1);
      }
    }
  }

  private makeSwirlTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineCap = 'round';
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const angle = arm * ((Math.PI * 2) / 3) + t * 2.4;
        const radius = 14 + t * 96;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    return Texture.from(canvas);
  }
}

// --- Helpers ---------------------------------------------------------------

function clampCam(v: number, half: number, size: number, pad: number): number {
  const lo = half - pad;
  const hi = size - half + pad;
  if (lo > hi) return size / 2;
  return v < lo ? lo : v > hi ? hi : v;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function makeRadialTexture(size: number, stops: [number, string][]): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

// --- Prop art --------------------------------------------------------------
// Everything is drawn procedurally at TEX_SCALE× so the textures stay crisp
// when the camera is zoomed in, then sprites scale back down.

const TEX_SCALE = 3;

const KIND_VARIANTS: Record<string, number> = {
  flower: 3,
  car: 3,
  tree: 2,
  house: 2,
};

/** Top-down doodads with a soft drop shadow baked into the texture. */
function drawPropArt(g: Graphics, name: string, variant: number): void {
  const s = TEX_SCALE;
  const shadow = (r: number): void => {
    g.ellipse(2.4 * s, 3 * s, r * s, r * 0.82 * s).fill({ color: 0x000000, alpha: 0.34 });
  };

  switch (name) {
    case 'flower': {
      const petals = [0xff8fab, 0xfff1f0, 0xc8b6ff][variant];
      shadow(3.6);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.circle(Math.cos(a) * 2.3 * s, Math.sin(a) * 2.3 * s, 2 * s).fill(petals);
      }
      g.circle(0, 0, 1.7 * s).fill(0xffd166);
      break;
    }
    case 'mushroom': {
      shadow(4.2);
      g.circle(0, 0, 4.2 * s).fill(0xff5d5d);
      g.circle(0, 0, 4.2 * s).stroke({ width: 0.8 * s, color: 0xd6336c });
      g.circle(-1.5 * s, -1.2 * s, 1 * s).fill(0xfff5f5);
      g.circle(1.7 * s, 0.6 * s, 0.8 * s).fill(0xfff5f5);
      g.circle(-0.2 * s, 2 * s, 0.7 * s).fill(0xfff5f5);
      break;
    }
    case 'cone': {
      shadow(5);
      g.circle(0, 0, 5 * s).fill(0xff7b00);
      g.circle(0, 0, 3.4 * s).fill(0xfff4e6);
      g.circle(0, 0, 1.9 * s).fill(0xff9500);
      break;
    }
    case 'hydrant': {
      shadow(5.6);
      g.circle(0, 0, 5.2 * s).fill(0xff4d6d);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        g.circle(Math.cos(a) * 4.4 * s, Math.sin(a) * 4.4 * s, 1.5 * s).fill(0xc9184a);
      }
      g.circle(0, 0, 2.6 * s).fill(0xffccd5);
      g.circle(0, 0, 1.1 * s).fill(0xff758f);
      break;
    }
    case 'bush': {
      shadow(7.4);
      g.circle(-3 * s, 1 * s, 4.6 * s).fill(0x2b8a3e);
      g.circle(3.2 * s, 0.4 * s, 4.2 * s).fill(0x2f9e44);
      g.circle(0, -2.6 * s, 4.4 * s).fill(0x37b24d);
      g.circle(-2 * s, -1.5 * s, 1 * s).fill(0xff6b6b);
      g.circle(2.6 * s, -2.6 * s, 0.9 * s).fill(0xff6b6b);
      g.circle(1 * s, 2 * s, 0.9 * s).fill(0xff8787);
      break;
    }
    case 'bench': {
      shadow(9);
      g.roundRect(-8.5 * s, -3.6 * s, 17 * s, 7.2 * s, 2 * s).fill(0x9c6644);
      g.roundRect(-8.5 * s, -3.6 * s, 17 * s, 7.2 * s, 2 * s).stroke({ width: 0.7 * s, color: 0x6f4a2f });
      for (let i = -1; i <= 1; i++) {
        g.rect(-7.6 * s, i * 2.1 * s - 0.5 * s, 15.2 * s, 1 * s).fill(0xb08968);
      }
      break;
    }
    case 'car': {
      const body = [0x1c7ed6, 0xf59f00, 0xe03131][variant];
      const roof = [0x4dabf7, 0xffd43b, 0xff8787][variant];
      shadow(11);
      // Wheels poke out from under the body.
      for (const [wx, wy] of [
        [-5.6, -6.5],
        [5.6, -6.5],
        [-5.6, 6.5],
        [5.6, 6.5],
      ]) {
        g.roundRect((wx - 1.4) * s, (wy - 2.4) * s, 2.8 * s, 4.8 * s, 1 * s).fill(0x11151f);
      }
      g.roundRect(-6 * s, -10.5 * s, 12 * s, 21 * s, 3.6 * s).fill(body);
      g.roundRect(-6 * s, -10.5 * s, 12 * s, 21 * s, 3.6 * s).stroke({
        width: 0.9 * s,
        color: 0x0b1626,
        alpha: 0.55,
      });
      // Cabin roof with dark glass front and back.
      g.roundRect(-4.6 * s, -5.6 * s, 9.2 * s, 11 * s, 2.4 * s).fill(roof);
      g.roundRect(-4.2 * s, -6.6 * s, 8.4 * s, 3 * s, 1.4 * s).fill(0x14263c);
      g.roundRect(-4.2 * s, 3.8 * s, 8.4 * s, 2.7 * s, 1.2 * s).fill(0x14263c);
      // Headlights.
      g.circle(-3.4 * s, -9.6 * s, 1 * s).fill(0xfff3bf);
      g.circle(3.4 * s, -9.6 * s, 1 * s).fill(0xfff3bf);
      break;
    }
    case 'tree': {
      const crown = variant === 0 ? 0x2b8a3e : 0x2d9660;
      const light = variant === 0 ? 0x51cf66 : 0x63e6be;
      shadow(13);
      g.circle(0, 0, 13 * s).fill(crown);
      g.circle(0, 0, 13 * s).stroke({ width: 1 * s, color: 0x14532d, alpha: 0.7 });
      g.circle(-4 * s, -4 * s, 6.4 * s).fill({ color: light, alpha: 0.5 });
      g.circle(5 * s, 3 * s, 4.4 * s).fill({ color: 0x1f6e33, alpha: 0.55 });
      g.circle(0, 0, 3.2 * s).fill(0x6f4a2f);
      g.circle(-0.6 * s, -0.6 * s, 1.6 * s).fill({ color: 0xa07850, alpha: 0.9 });
      break;
    }
    case 'house': {
      const roofLight = variant === 0 ? 0xf76707 : 0x748ffc;
      const roofDark = variant === 0 ? 0xd9480f : 0x4c6ef5;
      shadow(19);
      // Gabled roof seen from above: two shaded slopes meeting at a ridge.
      g.roundRect(-17 * s, -17 * s, 34 * s, 34 * s, 2.5 * s).fill(roofDark);
      g.poly([
        { x: -17 * s, y: -17 * s },
        { x: 17 * s, y: -17 * s },
        { x: 17 * s, y: -1 * s },
        { x: -17 * s, y: -1 * s },
      ]).fill(roofLight);
      g.rect(-17 * s, -1.6 * s, 34 * s, 1.6 * s).fill({ color: 0xffffff, alpha: 0.45 });
      // Roof planks.
      for (let i = 1; i < 4; i++) {
        g.rect(-17 * s + i * 8.5 * s - 0.5 * s, -17 * s, 1 * s, 34 * s).fill({
          color: 0x000000,
          alpha: 0.12,
        });
      }
      g.roundRect(6 * s, -13 * s, 6.5 * s, 6.5 * s, 1 * s).fill(0x862e2e);
      g.roundRect(6 * s, -13 * s, 6.5 * s, 6.5 * s, 1 * s).stroke({ width: 0.8 * s, color: 0x5c1f1f });
      // A warm lit window — bright enough for the bloom to catch.
      g.circle(-8 * s, 8 * s, 2.6 * s).fill(0xffe066);
      break;
    }
    case 'tower': {
      shadow(26);
      g.roundRect(-23 * s, -23 * s, 46 * s, 46 * s, 4 * s).fill(0x3b4d81);
      g.roundRect(-23 * s, -23 * s, 46 * s, 46 * s, 4 * s).stroke({ width: 1.6 * s, color: 0x91a7ff });
      g.roundRect(-16 * s, -16 * s, 32 * s, 32 * s, 3 * s).fill(0x475d99);
      g.roundRect(-13 * s, -13 * s, 11 * s, 11 * s, 2 * s).fill(0x2e3d66);
      g.roundRect(3 * s, 2 * s, 9 * s, 9 * s, 2 * s).fill(0x2e3d66);
      g.roundRect(2 * s, -13 * s, 10 * s, 7 * s, 2 * s).fill(0x54689f);
      // Rooftop beacon.
      g.circle(0, 0, 3 * s).fill(0xff8787);
      g.circle(0, 0, 1.4 * s).fill(0xffe3e3);
      break;
    }
  }
}
