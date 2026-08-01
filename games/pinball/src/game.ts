/** Cosmic Pinball — table hardware, rules and juice. */

import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyleOptions,
} from 'pixi.js';
import { AdvancedBloomFilter, RGBSplitFilter } from 'pixi-filters';
import { audio } from './audio';
import { Backdrop, GameTextures, makeTextures, ParticleSystem } from './fx';
import {
  BallBody,
  CircleCollider,
  clampSpeed,
  Collider,
  collideBalls,
  collideStatic,
  Contact,
  Flipper,
  SegCollider,
} from './physics';
import {
  APRON_Y,
  BALL_R,
  BUMPER_R,
  BUMPERS,
  buildPlayfield,
  buildWalls,
  C,
  DIV_X,
  DRAIN_Y,
  FLIP_LEN,
  FLIP_LX,
  FLIP_R_BASE,
  FLIP_R_TIP,
  FLIP_REST,
  FLIP_RX,
  FLIP_UP,
  FLIP_Y,
  KICKBACK_L,
  KICKBACK_LX,
  KICKBACK_R,
  KICKBACK_RX,
  KICKBACK_Y,
  H,
  LANE_FLOOR_Y,
  makeFeltTexture,
  makeSpaceTexture,
  PF_CX,
  PLUNGER_REST_Y,
  PLUNGER_X,
  POSTS,
  RIGHT_X,
  ROLLOVER_R,
  ROLLOVERS,
  SAUCER_R,
  SAUCER_X,
  SAUCER_Y,
  SLING_L,
  SLING_R,
  SlingDef,
  STANDUP_HALF,
  STANDUPS,
  SPINNER_ROT,
  SPINNER_X,
  SPINNER_Y,
  TARGET_HALF,
  TARGET_R,
  TARGETS_L,
  TARGETS_R,
  TargetDef,
  W,
} from './table';
import { Ease, killAllTweens, tween, updateTweens } from './tween';

const GRAVITY = 950;
const MAX_SPEED = 2400;
const DAMPING = 0.22;
const PHYS_STEP = 1 / 240;
const MAX_SUBSTEPS = 14;

const BALLS_PER_GAME = 3;
const SAVER_TIME = 12;
const KICKBACKS_PER_BALL = 2;
const EXTRA_BALL_AT = 250000;

const FONT = 'Arial Black, Arial Rounded MT Bold, Segoe UI, Helvetica, sans-serif';

type State = 'start' | 'launch' | 'play' | 'ballend' | 'gameover' | 'paused';

interface Ball extends BallBody {
  root: Container;
  body: Sprite;
  halo: Sprite;
  held: boolean;
  captured: number;
  trail: number;
  stillT: number;
  spin: number;
}

interface Bumper {
  x: number;
  y: number;
  col: CircleCollider;
  root: Container;
  ring: Graphics;
  cap: Graphics;
  glow: Sprite;
  lit: number;
}

interface DropTarget {
  def: TargetDef;
  col: SegCollider;
  root: Container;
  up: boolean;
}

interface Sling {
  def: SlingDef;
  kick: SegCollider;
  band: Graphics;
  glow: Sprite;
  flash: number;
}

interface Rollover {
  x: number;
  y: number;
  lit: boolean;
  ring: Graphics;
  glow: Sprite;
  star: Sprite;
}

function style(size: number, fill: number | string, strokeW = 0, extra: TextStyleOptions = {}): TextStyleOptions {
  return {
    fontFamily: FONT,
    fontWeight: '900',
    fontSize: size,
    fill,
    ...(strokeW > 0 ? { stroke: { color: 0x07051c, width: strokeW, join: 'round' } } : {}),
    ...extra,
  };
}

function fmt(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

export class Game {
  private app: Application;
  private tex: GameTextures;

  // scene graph
  private shakeRoot = new Container();
  private backdrop: Backdrop;
  private table = new Container();
  private lampLayer = new Container();
  private hwLayer = new Container();
  private fxUnder: ParticleSystem;
  private ballLayer = new Container();
  private fxOver: ParticleSystem;
  private hud = new Container();
  private overlay = new Container();
  private flashRect: Graphics;

  private bloom: AdvancedBloomFilter;
  private rgb: RGBSplitFilter;
  private rgbAmt = 0;

  // hardware
  private walls: Collider[] = [];
  private bumpers: Bumper[] = [];
  private targetsL: DropTarget[] = [];
  private targetsR: DropTarget[] = [];
  private standups: DropTarget[] = [];
  private slings: Sling[] = [];
  private posts: CircleCollider[] = [];
  private rollovers: Rollover[] = [];
  private flipL!: Flipper;
  private flipR!: Flipper;
  private flipGL!: Container;
  private flipGR!: Container;
  private saucerRing!: Graphics;
  private saucerGlow!: Sprite;
  private spinnerBlade!: Graphics;
  private spinnerGlow!: Sprite;
  private spinAngle = 0;
  private spinSpeed = 0;
  private plungerG!: Graphics;
  private plungerMeter!: Graphics;
  private saverBeam!: Graphics;

  // state
  state: State = 'start';
  private prevState: State = 'start';
  private balls: Ball[] = [];
  private score = 0;
  private shownScore = 0;
  private best = 0;
  private ballNum = 1;
  private ballsLeft = BALLS_PER_GAME;
  private multiplier = 1;
  private bumperChain = 0;
  private chainT = 0;
  private saverT = 0;
  /** the ball saver arms once per ball, not once per launch */
  private saverPending = false;
  /** kickback charges for the current ball — unlimited made the ball unloseable */
  private kickCharges = 0;
  private kickCool: [number, number] = [0, 0];
  private kickFlash: [number, number] = [0, 0];
  private kickG: Graphics[] = [];
  private kickLamp: Sprite[] = [];
  private bankResetL = 0;
  private bankResetR = 0;
  private plungerPull = 0;
  private plungerHeld = false;
  private launchWait = 0;
  private multiball = false;
  private rolloverSets = 0;
  private extraAwarded = false;
  private spinCount = 0;
  private freeze = 0;
  private shakeMag = 0;
  private time = 0;
  private energy = 0;
  private ballEndT = 0;
  private stats = { saucer: 0, banks: 0, multiballs: 0, rollSets: 0, bumps: 0, targets: 0, kicks: 0, flipHits: 0, serves: 0, drainX: [] as number[] };

  // hud
  private scoreText!: Text;
  private bestText!: Text;
  private multText!: Text;
  private ballText!: Text;
  private ballPips!: Container;
  private muteBtn!: Container;
  private muteIcon!: Graphics;
  private banner!: Text;
  private saverText!: Text;

  constructor(app: Application) {
    this.app = app;
    this.tex = makeTextures(app.renderer);
    this.best = Number(localStorage.getItem('pinball-best') ?? 0) || 0;

    this.backdrop = new Backdrop(this.tex, makeSpaceTexture());
    this.fxUnder = new ParticleSystem(420);
    this.fxOver = new ParticleSystem(900);

    this.shakeRoot.addChild(this.backdrop.container);
    this.table.addChild(buildPlayfield(makeFeltTexture(), this.tex.glow));
    this.shakeRoot.addChild(this.table);
    this.shakeRoot.addChild(this.lampLayer);
    this.shakeRoot.addChild(this.fxUnder.container);
    this.shakeRoot.addChild(this.hwLayer);
    this.shakeRoot.addChild(this.ballLayer);
    this.shakeRoot.addChild(this.fxOver.container);
    app.stage.addChild(this.shakeRoot);
    app.stage.addChild(this.hud);
    app.stage.addChild(this.overlay);

    this.flashRect = new Graphics().rect(0, 0, W, H).fill(0xffffff);
    this.flashRect.alpha = 0;
    this.flashRect.blendMode = 'add';
    app.stage.addChild(this.flashRect);

    this.bloom = new AdvancedBloomFilter({
      threshold: 0.52,
      bloomScale: 0.7,
      brightness: 1.0,
      blur: 7,
      quality: 4,
    });
    this.rgb = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
    app.stage.filters = [this.bloom];
    app.stage.filterArea = app.renderer.screen;

    this.walls = buildWalls();
    this.buildHardware();
    this.buildHud();
    this.showStartScreen();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play') this.pause();
    });
  }

  // ---------------------------------------------------------------- hardware

  private buildHardware(): void {
    // --- pop bumpers
    for (const b of BUMPERS) {
      const root = new Container();
      root.position.set(b.x, b.y);

      const glow = new Sprite(this.tex.glow);
      glow.anchor.set(0.5);
      glow.scale.set(2.1);
      glow.tint = C.magenta;
      glow.alpha = 0.3;
      glow.blendMode = 'add';
      this.lampLayer.addChild(glow);
      glow.position.set(b.x, b.y);

      const ring = new Graphics();
      ring.circle(0, 0, BUMPER_R + 6).fill({ color: 0x0b0724, alpha: 0.9 });
      ring.circle(0, 0, BUMPER_R + 2).stroke({ width: 5, color: C.violet, alpha: 0.9 });
      ring.circle(0, 0, BUMPER_R - 4).fill({ color: 0x3a1f7a, alpha: 0.95 });
      ring.circle(0, 0, BUMPER_R - 4).stroke({ width: 3, color: C.magenta, alpha: 0.85 });
      root.addChild(ring);

      const cap = new Graphics();
      cap.circle(0, 0, 25).fill({ color: 0xffd9f0, alpha: 1 });
      cap.circle(0, 0, 25).stroke({ width: 3.5, color: 0x2a0a3c, alpha: 0.9 });
      cap.circle(-7, -8, 9).fill({ color: 0xffffff, alpha: 0.95 });
      cap.star(0, 0, 5, 16, 7).fill({ color: 0x8c1655, alpha: 0.95 });
      cap.star(0, 0, 5, 16, 7).stroke({ width: 1.5, color: 0x2a0a3c, alpha: 0.8 });
      root.addChild(cap);

      this.hwLayer.addChild(root);
      this.bumpers.push({
        x: b.x, y: b.y,
        col: { kind: 'circle', x: b.x, y: b.y, r: BUMPER_R - 2, e: 0.5, kick: 560, tag: 'bumper' },
        root, ring, cap, glow, lit: 0,
      });
    }

    // --- drop targets
    const mkBank = (defs: TargetDef[], tint: number): DropTarget[] =>
      defs.map((def, idx) => {
        const root = new Container();
        root.position.set(def.x, def.y);
        root.rotation = def.angle - Math.PI / 2;

        // glow behind the translucent face
        const lamp = new Sprite(this.tex.glow);
        lamp.anchor.set(0.5);
        lamp.scale.set(1.15, 0.65);
        lamp.tint = tint;
        lamp.alpha = 0.4;
        lamp.blendMode = 'add';
        root.addChild(lamp);

        const g = new Graphics();
        // socket the target sits in
        g.roundRect(-15, -TARGET_HALF - 3, 30, TARGET_HALF * 2 + 6, 9)
          .fill({ color: 0x08051e, alpha: 0.95 });
        // the target face, bevelled
        g.roundRect(-12, -TARGET_HALF, 24, TARGET_HALF * 2, 7)
          .fill({ color: tint, alpha: 1 });
        g.roundRect(-12, -TARGET_HALF, 24, TARGET_HALF * 2, 7)
          .stroke({ width: 3, color: 0x0a0626, alpha: 0.9 });
        // top-lit bevel + shaded lower edge give it thickness
        g.roundRect(-9, -TARGET_HALF + 4, 7, TARGET_HALF * 2 - 8, 3.5)
          .fill({ color: 0xffffff, alpha: 0.55 });
        g.roundRect(3, -TARGET_HALF + 4, 7, TARGET_HALF * 2 - 8, 3.5)
          .fill({ color: 0x000000, alpha: 0.3 });
        root.addChild(g);

        const st = new Sprite(this.tex.star);
        st.anchor.set(0.5);
        st.scale.set(0.62);
        st.tint = 0x0d0730;
        st.alpha = 0.75;
        st.y = (idx - 1) * 0;
        root.addChild(st);
        this.hwLayer.addChild(root);

        const dx = Math.cos(def.angle) * TARGET_HALF;
        const dy = Math.sin(def.angle) * TARGET_HALF;
        return {
          def,
          col: {
            kind: 'seg',
            ax: def.x - dx, ay: def.y - dy,
            bx: def.x + dx, by: def.y + dy,
            r: TARGET_R, e: 0.35, tag: 'target',
          } as SegCollider,
          root,
          up: true,
        };
      });
    this.targetsL = mkBank(TARGETS_L, C.lime);
    this.targetsR = mkBank(TARGETS_R, C.cyan);

    // --- standing targets flanking the star gate (they pop straight back up)
    for (const def of STANDUPS) {
      const root = new Container();
      root.position.set(def.x, def.y);
      root.rotation = def.angle - Math.PI / 2;

      const lamp = new Sprite(this.tex.glow);
      lamp.anchor.set(0.5);
      lamp.scale.set(1.1, 0.7);
      lamp.tint = C.orange;
      lamp.alpha = 0.4;
      lamp.blendMode = 'add';
      root.addChild(lamp);

      const g = new Graphics();
      g.roundRect(-13, -STANDUP_HALF - 3, 26, STANDUP_HALF * 2 + 6, 8)
        .fill({ color: 0x08051e, alpha: 0.95 });
      g.roundRect(-10, -STANDUP_HALF, 20, STANDUP_HALF * 2, 6)
        .fill({ color: C.orange, alpha: 1 });
      g.roundRect(-10, -STANDUP_HALF, 20, STANDUP_HALF * 2, 6)
        .stroke({ width: 3, color: 0x0a0626, alpha: 0.9 });
      g.roundRect(-7, -STANDUP_HALF + 4, 6, STANDUP_HALF * 2 - 8, 3)
        .fill({ color: 0xffffff, alpha: 0.55 });
      root.addChild(g);
      this.hwLayer.addChild(root);

      const dx = Math.cos(def.angle) * STANDUP_HALF;
      const dy = Math.sin(def.angle) * STANDUP_HALF;
      this.standups.push({
        def,
        col: {
          kind: 'seg',
          ax: def.x - dx, ay: def.y - dy,
          bx: def.x + dx, by: def.y + dy,
          r: TARGET_R, e: 0.55, tag: 'standup',
        },
        root,
        up: true,
      });
    }

    // --- slingshots
    for (const def of [SLING_L, SLING_R]) {
      const tri = [def.x1, def.y1, def.x2, def.y2, def.x3, def.y3];
      const cx = (def.x1 + def.x2 + def.x3) / 3;
      const cy = (def.y1 + def.y2 + def.y3) / 3;
      const shrink = (f: number) =>
        tri.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * f : cy + (v - cy) * f));

      const g = new Graphics();
      g.poly(tri).fill({ color: 0x090522, alpha: 0.95 });
      // moulded plastic body with a lit inner panel
      g.poly(shrink(0.92)).fill({ color: 0x35248f, alpha: 1 });
      g.poly(shrink(0.7)).fill({ color: 0x4c34c4, alpha: 1 });
      g.poly(shrink(0.7)).stroke({ width: 2, color: C.violet, alpha: 0.9 });
      g.poly(shrink(0.34)).fill({ color: C.violet, alpha: 0.55 });
      g.poly(shrink(0.92)).stroke({ width: 3, color: C.cyan, alpha: 0.55 });
      // rubber posts at the two ends of the kicking face
      for (const [px, py] of [[def.x1, def.y1], [def.x3, def.y3]]) {
        g.circle(px, py, 11).fill({ color: 0x0a0626, alpha: 1 });
        g.circle(px, py, 8.5).fill({ color: C.magenta, alpha: 1 });
        g.circle(px, py, 4).fill({ color: 0xffd6e8, alpha: 0.9 });
      }
      this.hwLayer.addChild(g);

      const glow = new Sprite(this.tex.glow);
      glow.anchor.set(0.5);
      glow.position.set((def.x1 + def.x3) / 2, (def.y1 + def.y3) / 2);
      glow.scale.set(1.5);
      glow.tint = C.gold;
      glow.alpha = 0;
      glow.blendMode = 'add';
      this.lampLayer.addChild(glow);

      const band = new Graphics();
      this.hwLayer.addChild(band);

      this.slings.push({
        def,
        kick: {
          kind: 'seg',
          ax: def.x1, ay: def.y1, bx: def.x3, by: def.y3,
          r: 8, e: 0.42, tag: 'sling',
        },
        band, glow, flash: 0,
      });
      // the two non-kicking faces are plain walls
      this.walls.push(
        { kind: 'seg', ax: def.x1, ay: def.y1, bx: def.x2, by: def.y2, r: 7, e: 0.4, tag: 'wall' },
        { kind: 'seg', ax: def.x2, ay: def.y2, bx: def.x3, by: def.y3, r: 7, e: 0.4, tag: 'wall' },
      );
      this.drawSlingBand(this.slings[this.slings.length - 1], 0);
    }

    // --- posts
    for (const p of POSTS) {
      const g = new Graphics();
      g.circle(p.x, p.y, p.r + 4).fill({ color: 0x0b0726, alpha: 0.95 });
      g.circle(p.x, p.y, p.r + 1).fill({ color: C.gold, alpha: 0.9 });
      g.circle(p.x, p.y, p.r - 4).fill({ color: 0xfff2c8, alpha: 0.95 });
      this.hwLayer.addChild(g);
      const glow = new Sprite(this.tex.glow);
      glow.anchor.set(0.5);
      glow.position.set(p.x, p.y);
      glow.scale.set(0.7);
      glow.tint = C.gold;
      glow.alpha = 0.35;
      glow.blendMode = 'add';
      this.lampLayer.addChild(glow);
      this.posts.push({ kind: 'circle', x: p.x, y: p.y, r: p.r, e: 0.62, tag: 'post' });
    }

    // --- rollover stars
    for (const r of ROLLOVERS) {
      const glow = new Sprite(this.tex.glow);
      glow.anchor.set(0.5);
      glow.position.set(r.x, r.y);
      glow.scale.set(1.2);
      glow.tint = C.gold;
      glow.alpha = 0.12;
      glow.blendMode = 'add';
      this.lampLayer.addChild(glow);

      // a translucent playfield insert with a wire rollover hoop over it
      const ring = new Graphics();
      ring.circle(r.x, r.y, ROLLOVER_R + 3).fill({ color: 0x0c0730, alpha: 0.9 });
      ring.circle(r.x, r.y, ROLLOVER_R).fill({ color: 0x4a3aa8, alpha: 0.85 });
      ring.circle(r.x, r.y, ROLLOVER_R).stroke({ width: 2.5, color: C.gold, alpha: 0.75 });
      ring.circle(r.x - 6, r.y - 8, ROLLOVER_R * 0.5).fill({ color: 0xffffff, alpha: 0.12 });
      // the wire the ball rolls over
      ring.moveTo(r.x - ROLLOVER_R - 6, r.y + 4)
        .quadraticCurveTo(r.x, r.y - ROLLOVER_R - 4, r.x + ROLLOVER_R + 6, r.y + 4)
        .stroke({ width: 3, color: C.steel, alpha: 0.85 });
      this.hwLayer.addChild(ring);

      const star = new Sprite(this.tex.star);
      star.anchor.set(0.5);
      star.position.set(r.x, r.y);
      star.scale.set(0.72);
      star.tint = C.gold;
      star.alpha = 0.4;
      this.hwLayer.addChild(star);

      this.rollovers.push({ x: r.x, y: r.y, lit: false, ring, glow, star });
    }

    // --- saucer
    this.saucerGlow = new Sprite(this.tex.flare);
    this.saucerGlow.anchor.set(0.5);
    this.saucerGlow.position.set(SAUCER_X, SAUCER_Y);
    this.saucerGlow.scale.set(1.6);
    this.saucerGlow.tint = C.cyan;
    this.saucerGlow.alpha = 0.35;
    this.saucerGlow.blendMode = 'add';
    this.lampLayer.addChild(this.saucerGlow);

    // A machined housing around the scoop, with bulbs — this is the table's
    // centrepiece shot, so it gets real hardware rather than a painted circle.
    const hole = new Graphics();
    hole.circle(SAUCER_X, SAUCER_Y, SAUCER_R + 30).fill({ color: 0x140d3e, alpha: 0.9 });
    hole.circle(SAUCER_X, SAUCER_Y, SAUCER_R + 30).stroke({ width: 3, color: C.violet, alpha: 0.7 });
    hole.circle(SAUCER_X, SAUCER_Y, SAUCER_R + 20).stroke({ width: 2, color: C.cyan, alpha: 0.45 });
    hole.circle(SAUCER_X, SAUCER_Y, SAUCER_R + 12).fill({ color: 0x0a0724, alpha: 0.98 });
    hole.circle(SAUCER_X, SAUCER_Y, SAUCER_R + 4).stroke({ width: 5, color: C.steel, alpha: 0.85 });
    hole.circle(SAUCER_X, SAUCER_Y, SAUCER_R - 2).fill({ color: 0x02010a, alpha: 1 });
    // ring of bulbs around the housing
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      hole.circle(SAUCER_X + Math.cos(a) * (SAUCER_R + 25), SAUCER_Y + Math.sin(a) * (SAUCER_R + 25), 4.5)
        .fill({ color: C.goldPale, alpha: 0.9 });
    }
    // support struts out to the standing targets
    for (const s of [-1, 1]) {
      hole.moveTo(SAUCER_X + s * (SAUCER_R + 30), SAUCER_Y - 6)
        .lineTo(SAUCER_X + s * 150, SAUCER_Y - 46)
        .stroke({ width: 7, color: 0x0a0626, alpha: 0.9, cap: 'round' });
      hole.moveTo(SAUCER_X + s * (SAUCER_R + 30), SAUCER_Y - 6)
        .lineTo(SAUCER_X + s * 150, SAUCER_Y - 46)
        .stroke({ width: 3, color: C.steel, alpha: 0.8, cap: 'round' });
    }
    this.hwLayer.addChild(hole);

    this.saucerRing = new Graphics();
    this.saucerRing.circle(SAUCER_X, SAUCER_Y, SAUCER_R + 8).stroke({ width: 3, color: C.cyan, alpha: 0.9 });
    this.hwLayer.addChild(this.saucerRing);

    const label = new Text({ text: 'STAR GATE', style: style(17, C.cyan, 4, { letterSpacing: 2 }) });
    label.anchor.set(0.5);
    label.position.set(SAUCER_X, SAUCER_Y + SAUCER_R + 26);
    this.hwLayer.addChild(label);

    // --- spinner at the orbit mouth
    this.spinnerGlow = new Sprite(this.tex.glow);
    this.spinnerGlow.anchor.set(0.5);
    this.spinnerGlow.position.set(SPINNER_X, SPINNER_Y);
    this.spinnerGlow.scale.set(1.1);
    this.spinnerGlow.tint = C.lime;
    this.spinnerGlow.alpha = 0.2;
    this.spinnerGlow.blendMode = 'add';
    this.lampLayer.addChild(this.spinnerGlow);

    // bracket the spinner hangs in, so it reads as part of the lane
    const bracket = new Graphics();
    bracket.position.set(SPINNER_X, SPINNER_Y);
    bracket.rotation = SPINNER_ROT + Math.PI / 2;
    bracket.moveTo(-40, -34).lineTo(40, -34)
      .stroke({ width: 6, color: 0x0b0628, cap: 'round' });
    bracket.moveTo(-40, -34).lineTo(40, -34)
      .stroke({ width: 3, color: C.steel, alpha: 0.9, cap: 'round' });
    bracket.circle(-34, -34, 5).fill({ color: C.steel, alpha: 0.9 });
    bracket.circle(34, -34, 5).fill({ color: C.steel, alpha: 0.9 });
    this.hwLayer.addChild(bracket);

    this.spinnerBlade = new Graphics();
    this.spinnerBlade.position.set(SPINNER_X, SPINNER_Y);
    this.spinnerBlade.rotation = SPINNER_ROT + Math.PI / 2;
    this.hwLayer.addChild(this.spinnerBlade);
    this.drawSpinner();

    const spinLabel = new Text({ text: 'SPINNER', style: style(14, C.lime, 4, { letterSpacing: 2 }) });
    spinLabel.anchor.set(0.5);
    spinLabel.position.set(SPINNER_X + 6, SPINNER_Y + 52);
    this.hwLayer.addChild(spinLabel);

    // --- flippers
    this.flipL = new Flipper(FLIP_LX, FLIP_Y, FLIP_LEN, FLIP_R_BASE, FLIP_R_TIP, FLIP_REST, FLIP_UP, 21);
    this.flipR = new Flipper(
      FLIP_RX, FLIP_Y, FLIP_LEN, FLIP_R_BASE, FLIP_R_TIP,
      Math.PI - FLIP_REST, Math.PI - FLIP_UP, 21,
    );
    this.flipGL = this.makeFlipperGraphic(C.gold);
    this.flipGL.position.set(FLIP_LX, FLIP_Y);
    this.flipGR = this.makeFlipperGraphic(C.gold);
    this.flipGR.position.set(FLIP_RX, FLIP_Y);
    this.flipGR.scale.x = -1;
    this.hwLayer.addChild(this.flipGL, this.flipGR);

    // --- ball saver: an energy gate strung across the drain mouth
    this.saverBeam = new Graphics();
    this.saverBeam.alpha = 0;
    this.saverBeam
      .roundRect(292, APRON_Y - 26, 220, 13, 6.5)
      .fill({ color: C.cyan, alpha: 0.8 });
    this.saverBeam
      .roundRect(292, APRON_Y - 23, 220, 5, 2.5)
      .fill({ color: 0xffffff, alpha: 0.95 });
    this.saverBeam.circle(292, APRON_Y - 20, 9).fill({ color: C.cyan, alpha: 0.9 });
    this.saverBeam.circle(512, APRON_Y - 20, 9).fill({ color: C.cyan, alpha: 0.9 });
    this.saverBeam.blendMode = 'add';
    this.hwLayer.addChild(this.saverBeam);

    // apron legends, like the printed cards on a real table
    const nameCard = new Text({
      text: 'COSMIC PINBALL',
      style: style(19, C.violet, 4, { letterSpacing: 3 }),
    });
    nameCard.anchor.set(0.5);
    nameCard.position.set(186, APRON_Y + 46);
    nameCard.rotation = -0.04;
    this.hwLayer.addChild(nameCard);

    // --- outlane kickbacks
    for (const [i, k] of [KICKBACK_L, KICKBACK_R].entries()) {
      const dir = i === 0 ? 1 : -1;
      const glow = new Sprite(this.tex.glow);
      glow.anchor.set(0.5);
      glow.position.set(k.x, k.y);
      glow.scale.set(1.3, 1.6);
      glow.tint = C.orange;
      glow.alpha = 0.3;
      glow.blendMode = 'add';
      this.lampLayer.addChild(glow);
      this.kickLamp.push(glow);

      const g = new Graphics();
      g.position.set(k.x, k.y);
      g.rotation = dir * 0.14;
      // coil housing
      g.roundRect(-19, -6, 38, 34, 9).fill({ color: 0x0b0728, alpha: 0.95 });
      g.roundRect(-15, -2, 30, 26, 7).fill({ color: 0x4a3a9e, alpha: 1 });
      for (let c = 0; c < 4; c++) {
        g.moveTo(-15, 2 + c * 6).lineTo(15, 4 + c * 6)
          .stroke({ width: 2.5, color: C.steel, alpha: 0.55 });
      }
      // upward arrow insert
      g.poly([0, -40, 15, -18, 6, -18, 6, -6, -6, -6, -6, -18, -15, -18])
        .fill({ color: C.orange, alpha: 0.95 })
        .stroke({ width: 2, color: 0x2a1206, alpha: 0.8 });
      this.hwLayer.addChild(g);
      this.kickG.push(g);
    }

    // --- plunger
    this.plungerG = new Graphics();
    this.hwLayer.addChild(this.plungerG);
    this.plungerMeter = new Graphics();
    this.hwLayer.addChild(this.plungerMeter);
    this.drawPlunger();
  }

  private makeFlipperGraphic(tint: number): Container {
    const c = new Container();
    const g = new Graphics();
    const L = FLIP_LEN;
    const rb = FLIP_R_BASE;
    const rt = FLIP_R_TIP;
    // Local -y is the face the ball rides on, so the rubber goes there.
    const capsule = (br: number, tr: number) => {
      g.moveTo(0, -br).lineTo(L, -tr).arc(L, 0, tr, -Math.PI / 2, Math.PI / 2)
        .lineTo(0, br).arc(0, 0, br, Math.PI / 2, -Math.PI / 2);
    };
    // dark socket outline
    capsule(rb + 4, rt + 4);
    g.fill({ color: 0x07041a, alpha: 0.95 });
    // rubber sleeve
    capsule(rb + 1.5, rt + 1.5);
    g.fill({ color: 0xd42f77, alpha: 1 });
    // metal bat
    capsule(rb - 2, rt - 1.5);
    g.fill({ color: tint, alpha: 1 });
    // lit bevel along the striking face
    g.moveTo(2, -rb + 3).lineTo(L - 2, -rt + 2.5).lineTo(L - 2, -rt + 7).lineTo(2, -rb + 9)
      .fill({ color: 0xfff6dd, alpha: 0.95 });
    // shaded trailing edge gives the bat thickness
    g.moveTo(3, rb - 4).lineTo(L - 2, rt - 3).lineTo(L - 2, rt - 0.5).lineTo(3, rb - 1)
      .fill({ color: 0x8a5510, alpha: 0.75 });
    // bright rubber highlight on the leading edge
    g.moveTo(1, -rb - 0.5).lineTo(L, -rt - 0.5)
      .stroke({ width: 2.5, color: 0xffb3d4, alpha: 0.9, cap: 'round' });
    // pivot hardware
    g.circle(0, 0, rb - 3).fill({ color: 0x241a58, alpha: 1 });
    g.circle(0, 0, rb - 6).fill({ color: C.steel, alpha: 0.95 });
    g.circle(-2, -2, rb - 10).fill({ color: 0xffffff, alpha: 0.9 });
    c.addChild(g);

    const glow = new Sprite(this.tex.glow);
    glow.anchor.set(0.5);
    glow.position.set(L * 0.55, 0);
    glow.scale.set(1.1, 0.45);
    glow.tint = tint;
    glow.alpha = 0.25;
    glow.blendMode = 'add';
    c.addChildAt(glow, 0);
    return c;
  }

  private drawSlingBand(s: Sling, flash: number): void {
    const { def } = s;
    const dx = def.x3 - def.x1;
    const dy = def.y3 - def.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dy / len;
    const ny = -dx / len;
    const push = flash * 12;
    s.band.clear();
    s.band
      .moveTo(def.x1 + nx * push, def.y1 + ny * push)
      .lineTo(def.x3 + nx * push, def.y3 + ny * push)
      .stroke({ width: 12, color: 0x0a0622, alpha: 0.95, cap: 'round' });
    s.band
      .moveTo(def.x1 + nx * push, def.y1 + ny * push)
      .lineTo(def.x3 + nx * push, def.y3 + ny * push)
      .stroke({ width: 8, color: flash > 0.15 ? 0xffffff : C.magenta, alpha: 1, cap: 'round' });
    s.band
      .moveTo(def.x1 + nx * push, def.y1 + ny * push)
      .lineTo(def.x3 + nx * push, def.y3 + ny * push)
      .stroke({ width: 2.5, color: 0xffd6e8, alpha: 0.75, cap: 'round' });
  }

  private drawSpinner(): void {
    const g = this.spinnerBlade;
    g.clear();
    // scale.x fakes the blade rotating about its own long axis
    const w = 44;
    const facing = Math.cos(this.spinAngle) >= 0;
    g.roundRect(-w / 2, -30, w, 60, 5).fill({ color: facing ? 0x241a70 : 0x120c44, alpha: 1 });
    g.roundRect(-w / 2, -30, w, 60, 5).stroke({ width: 2.5, color: C.lime, alpha: 0.95 });
    g.star(0, 0, 4, 13, 5).fill({ color: facing ? C.lime : 0x2e7f5c, alpha: 0.95 });
    g.roundRect(-w / 2 + 4, -26, 5, 52, 2.5).fill({ color: 0xffffff, alpha: facing ? 0.35 : 0.12 });
    g.scale.x = Math.max(0.06, Math.abs(Math.cos(this.spinAngle)));
  }

  private drawPlunger(): void {
    const g = this.plungerG;
    g.clear();
    const y = PLUNGER_REST_Y + 26 + this.plungerPull * 46;
    const cx = PLUNGER_X;
    // shaft
    g.roundRect(cx - 7, y, 14, LANE_FLOOR_Y - y, 6).fill({ color: 0x3a4a80, alpha: 1 });
    g.roundRect(cx - 3, y + 4, 5, LANE_FLOOR_Y - y - 8, 2.5).fill({ color: 0xbfd0ff, alpha: 0.75 });
    // spring coils
    for (let i = 0; i < 6; i++) {
      const yy = y + 16 + i * ((LANE_FLOOR_Y - y - 20) / 6);
      g.moveTo(cx - 20, yy).lineTo(cx + 20, yy + 6)
        .stroke({ width: 4, color: 0x8fa4dd, alpha: 0.65 });
    }
    // knob
    g.roundRect(cx - 26, y - 20, 52, 26, 12).fill({ color: 0x0d0930, alpha: 1 });
    g.roundRect(cx - 23, y - 17, 46, 20, 10)
      .fill({ color: C.magenta, alpha: 1 })
      .stroke({ width: 2, color: 0xffd0e8, alpha: 0.9 });
    g.roundRect(cx - 17, y - 13, 34, 6, 3).fill({ color: 0xffffff, alpha: 0.5 });
  }

  private drawPlungerMeter(): void {
    const g = this.plungerMeter;
    g.clear();
    if (this.state !== 'launch') return;
    const x = RIGHT_X - 26;
    const y0 = 1080;
    const y1 = 1340;
    g.roundRect(x - 7, y0, 14, y1 - y0, 7).fill({ color: 0x07041c, alpha: 0.8 });
    g.roundRect(x - 7, y0, 14, y1 - y0, 7).stroke({ width: 2, color: C.violet, alpha: 0.7 });
    const h = (y1 - y0 - 6) * this.plungerPull;
    if (h > 2) {
      const col = this.plungerPull > 0.85 ? C.magenta : this.plungerPull > 0.5 ? C.gold : C.lime;
      g.roundRect(x - 4, y1 - 3 - h, 8, h, 4).fill({ color: col, alpha: 1 });
    }
  }

  // -------------------------------------------------------------------- hud

  private buildHud(): void {
    const bar = new Graphics();
    bar.rect(0, 0, W, 118).fill({ color: 0x07051c, alpha: 0.82 });
    bar.moveTo(0, 118).lineTo(W, 118).stroke({ width: 3, color: C.violet, alpha: 0.8 });
    bar.moveTo(0, 121).lineTo(W, 121).stroke({ width: 1.5, color: C.cyan, alpha: 0.4 });
    this.hud.addChild(bar);

    const lbl = new Text({ text: 'SCORE', style: style(16, 0x8f9bd8, 0, { letterSpacing: 3 }) });
    lbl.position.set(26, 16);
    this.hud.addChild(lbl);

    this.scoreText = new Text({ text: '0', style: style(46, C.gold, 5) });
    this.scoreText.position.set(24, 38);
    this.hud.addChild(this.scoreText);

    this.multText = new Text({ text: '1x', style: style(30, C.lime, 4) });
    this.multText.anchor.set(0.5, 0);
    this.multText.position.set(W / 2, 62);
    this.hud.addChild(this.multText);

    const mlbl = new Text({ text: 'MULTIPLIER', style: style(14, 0x8f9bd8, 0, { letterSpacing: 3 }) });
    mlbl.anchor.set(0.5, 0);
    mlbl.position.set(W / 2, 20);
    this.hud.addChild(mlbl);

    this.ballText = new Text({ text: 'BALL 1', style: style(20, C.cyan, 3) });
    this.ballText.anchor.set(1, 0);
    this.ballText.position.set(W - 26, 62);
    this.hud.addChild(this.ballText);

    this.bestText = new Text({ text: `BEST ${fmt(this.best)}`, style: style(15, 0x8f9bd8, 0, { letterSpacing: 1 }) });
    this.bestText.anchor.set(1, 0);
    this.bestText.position.set(W - 26, 18);
    this.hud.addChild(this.bestText);

    this.ballPips = new Container();
    this.ballPips.position.set(W - 30, 96);
    this.hud.addChild(this.ballPips);
    this.refreshPips();

    // mute button, bottom-left of the cabinet
    this.muteBtn = new Container();
    this.muteBtn.position.set(52, H - 46);
    const bg = new Graphics();
    bg.circle(0, 0, 26).fill({ color: 0x0d0930, alpha: 0.9 });
    bg.circle(0, 0, 26).stroke({ width: 2.5, color: C.violet, alpha: 0.8 });
    this.muteIcon = new Graphics();
    this.muteBtn.addChild(bg, this.muteIcon);
    this.muteBtn.eventMode = 'static';
    this.muteBtn.cursor = 'pointer';
    this.muteBtn.on('pointertap', (e) => {
      e.stopPropagation();
      audio.unlock();
      audio.toggleMuted();
      this.drawMuteIcon();
    });
    this.hud.addChild(this.muteBtn);
    this.drawMuteIcon();

    this.banner = new Text({ text: '', style: style(56, 0xffffff, 8, { letterSpacing: 2 }) });
    this.banner.anchor.set(0.5);
    this.banner.position.set(PF_CX, 900);
    this.banner.alpha = 0;
    this.hud.addChild(this.banner);

    this.saverText = new Text({ text: '', style: style(21, C.cyan, 5, { letterSpacing: 2 }) });
    this.saverText.anchor.set(0.5);
    this.saverText.position.set(2 * PF_CX - 186, APRON_Y + 46);
    this.saverText.rotation = 0.04;
    this.saverText.alpha = 0;
    this.hud.addChild(this.saverText);
  }

  private drawMuteIcon(): void {
    const g = this.muteIcon;
    g.clear();
    const col = audio.muted ? 0x6b6f93 : C.cyan;
    g.poly([-11, -5, -4, -5, 3, -12, 3, 12, -4, 5, -11, 5]).fill({ color: col });
    if (audio.muted) {
      g.moveTo(7, -8).lineTo(17, 8).moveTo(17, -8).lineTo(7, 8)
        .stroke({ width: 3, color: 0xff6b8a, cap: 'round' });
    } else {
      g.arc(4, 0, 9, -0.9, 0.9).stroke({ width: 2.6, color: col });
      g.arc(4, 0, 15, -0.8, 0.8).stroke({ width: 2.2, color: col, alpha: 0.7 });
    }
  }

  private refreshPips(): void {
    this.ballPips.removeChildren();
    for (let i = 0; i < BALLS_PER_GAME; i++) {
      const g = new Graphics();
      const on = i < this.ballsLeft;
      g.circle(-i * 26, 0, 9).fill({ color: on ? C.steel : 0x2b2a4d, alpha: on ? 1 : 0.8 });
      if (on) g.circle(-i * 26 - 3, -3, 3.4).fill({ color: 0xffffff, alpha: 0.9 });
      this.ballPips.addChild(g);
    }
  }

  // ----------------------------------------------------------------- screens

  private clearOverlay(): void {
    this.overlay.removeChildren();
  }

  private bigTitle(text: string, color: number, y: number, size = 78): Text {
    const t = new Text({ text, style: style(size, color, 9, { letterSpacing: 3 }) });
    t.anchor.set(0.5);
    t.position.set(PF_CX, y);
    this.overlay.addChild(t);
    return t;
  }

  private showStartScreen(): void {
    this.clearOverlay();
    const scrim = new Graphics().rect(0, 0, W, H).fill({ color: 0x05031a, alpha: 0.84 });
    this.overlay.addChild(scrim);

    const halo = new Sprite(this.tex.flare);
    halo.anchor.set(0.5);
    halo.position.set(PF_CX, 460);
    halo.scale.set(6);
    halo.tint = C.violet;
    halo.alpha = 0.35;
    halo.blendMode = 'add';
    this.overlay.addChild(halo);

    const t1 = this.bigTitle('COSMIC', C.gold, 400, 96);
    const t2 = this.bigTitle('PINBALL', C.cyan, 500, 96);

    const ball = new Sprite(this.tex.ball);
    ball.anchor.set(0.5);
    ball.position.set(PF_CX, 645);
    ball.scale.set(0.95);
    this.overlay.addChild(ball);
    tween(2.2, (t) => {
      ball.y = 640 + Math.sin(t * Math.PI * 4) * 14;
      ball.rotation = t * 3;
    }, { ease: Ease.linear });

    const rows: [string, string][] = [
      ['FLIP', '← →  or tap left / right side'],
      ['LAUNCH', 'hold SPACE, let go to fire'],
      ['GOAL', 'bumpers, targets & the Star Gate'],
    ];
    rows.forEach(([k, v], i) => {
      const y = 800 + i * 62;
      const a = new Text({ text: k, style: style(24, C.magenta, 4, { letterSpacing: 2 }) });
      a.anchor.set(1, 0.5);
      a.position.set(PF_CX - 20, y);
      const b = new Text({ text: v, style: style(22, 0xd7dcff, 4) });
      b.anchor.set(0, 0.5);
      b.position.set(PF_CX + 20, y);
      this.overlay.addChild(a, b);
      a.alpha = 0;
      b.alpha = 0;
      tween(0.4, (t) => { a.alpha = t; b.alpha = t; }, { delay: 0.25 + i * 0.12 });
    });

    const hint = new Text({ text: 'TAP  or  PRESS SPACE  TO PLAY', style: style(30, C.lime, 6, { letterSpacing: 2 }) });
    hint.anchor.set(0.5);
    hint.position.set(PF_CX, 1060);
    this.overlay.addChild(hint);
    this.blink(hint);

    if (this.best > 0) {
      const b = new Text({ text: `BEST  ${fmt(this.best)}`, style: style(26, C.gold, 5) });
      b.anchor.set(0.5);
      b.position.set(PF_CX, 1150);
      this.overlay.addChild(b);
    }

    this.titlePulse(t1, t2);
    for (const t of [t1, t2]) {
      t.scale.set(0.6);
      tween(0.55, (p) => t.scale.set(0.6 + 0.4 * p), { ease: Ease.outBack });
    }
  }

  private titlePulse(...texts: Text[]): void {
    let k = 0;
    const step = () => {
      k++;
      for (const t of texts) {
        tween(1.4, (p) => {
          const s = 1 + Math.sin(p * Math.PI) * 0.035;
          t.scale.set(s);
        }, { ease: Ease.linear, onComplete: k < 400 ? step : undefined });
      }
    };
    step();
  }

  private blink(t: Text): void {
    const loop = () => {
      tween(1.1, (p) => { t.alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(p * Math.PI * 2)); },
        { ease: Ease.linear, onComplete: loop });
    };
    loop();
  }

  private showGameOver(): void {
    this.clearOverlay();
    const scrim = new Graphics().rect(0, 0, W, H).fill({ color: 0x05031a, alpha: 0.78 });
    this.overlay.addChild(scrim);

    const isBest = this.score >= this.best && this.score > 0;
    const t = this.bigTitle('GAME OVER', C.magenta, 560, 74);
    t.scale.set(0.5);
    tween(0.5, (p) => t.scale.set(0.5 + 0.5 * p), { ease: Ease.outBack });

    const sc = new Text({ text: fmt(this.score), style: style(84, C.gold, 9) });
    sc.anchor.set(0.5);
    sc.position.set(PF_CX, 700);
    this.overlay.addChild(sc);
    sc.alpha = 0;
    tween(0.5, (p) => { sc.alpha = p; sc.scale.set(0.7 + 0.3 * p); }, { delay: 0.25, ease: Ease.outBack });

    if (isBest) {
      const nb = new Text({ text: 'NEW BEST!', style: style(40, C.lime, 7, { letterSpacing: 3 }) });
      nb.anchor.set(0.5);
      nb.position.set(PF_CX, 790);
      this.overlay.addChild(nb);
      this.blink(nb);
      this.confetti();
    } else {
      const b = new Text({ text: `BEST  ${fmt(this.best)}`, style: style(28, 0xb9c2ef, 5) });
      b.anchor.set(0.5);
      b.position.set(PF_CX, 790);
      this.overlay.addChild(b);
    }

    const again = new Text({ text: 'TAP  or  SPACE  TO PLAY AGAIN', style: style(30, C.cyan, 6, { letterSpacing: 2 }) });
    again.anchor.set(0.5);
    again.position.set(PF_CX, 920);
    this.overlay.addChild(again);
    this.blink(again);
  }

  private showPause(): void {
    this.clearOverlay();
    const scrim = new Graphics().rect(0, 0, W, H).fill({ color: 0x05031a, alpha: 0.7 });
    this.overlay.addChild(scrim);
    this.bigTitle('PAUSED', C.cyan, 700, 72);
    const sub = new Text({ text: 'TAP  or  SPACE  TO RESUME', style: style(28, C.gold, 6) });
    sub.anchor.set(0.5);
    sub.position.set(PF_CX, 800);
    this.overlay.addChild(sub);
    this.blink(sub);
  }

  private confetti(): void {
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 240 + Math.random() * 520;
      this.fxOver.spawn(this.tex.shard, PF_CX, 700, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 200,
        vr: (Math.random() - 0.5) * 12,
        gravity: 620,
        life: 1.4 + Math.random(),
        tint: [C.gold, C.cyan, C.magenta, C.lime][i % 4],
        scaleFrom: 0.7 + Math.random() * 0.7,
        additive: false,
        fadePow: 1.6,
      });
    }
  }

  // ------------------------------------------------------------------- input

  onFlip(side: -1 | 1, down: boolean): void {
    const f = side === -1 ? this.flipL : this.flipR;
    // Releases are always honoured, even mid state change: dropping one used
    // to leave a flipper stuck up and the next ball parked on it forever.
    if (!down) {
      f.pressed = false;
      return;
    }
    if (this.state !== 'play' && this.state !== 'launch') return;
    if (!f.pressed) {
      audio.flipper();
      const tip = side === -1 ? this.flipL : this.flipR;
      for (let i = 0; i < 5; i++) {
        this.fxUnder.spawn(this.tex.dot, tip.tipX, tip.tipY, {
          vx: (Math.random() - 0.5) * 160,
          vy: -Math.random() * 200,
          life: 0.24,
          tint: C.gold,
          scaleFrom: 0.5,
          scaleTo: 0,
        });
      }
    }
    f.pressed = true;
  }

  onPlunger(down: boolean): void {
    this.plungerHeld = down;
    if (!down && this.state === 'launch' && this.plungerPull > 0.02) this.launchBall();
  }

  /** Space / tap: advances menus, otherwise acts as the plunger. */
  onPrimary(down: boolean): void {
    if (down) audio.unlock();
    if (this.state === 'start') {
      if (down) this.startGame();
      return;
    }
    if (this.state === 'gameover') {
      if (down) this.startGame();
      return;
    }
    if (this.state === 'paused') {
      if (down) this.resume();
      return;
    }
    this.onPlunger(down);
  }

  pause(): void {
    if (this.state !== 'play' && this.state !== 'launch') return;
    this.prevState = this.state;
    this.state = 'paused';
    this.flipL.pressed = false;
    this.flipR.pressed = false;
    audio.playing = false;
    this.showPause();
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = this.prevState;
    audio.playing = true;
    this.clearOverlay();
  }

  togglePause(): void {
    if (this.state === 'paused') this.resume();
    else this.pause();
  }

  // -------------------------------------------------------------- game flow

  private startGame(): void {
    killAllTweens();
    this.clearOverlay();
    this.flipL.pressed = false;
    this.flipR.pressed = false;
    this.score = 0;
    this.shownScore = 0;
    this.ballNum = 1;
    this.ballsLeft = BALLS_PER_GAME;
    this.multiplier = 1;
    this.rolloverSets = 0;
    this.extraAwarded = false;
    this.multiball = false;
    this.spinCount = 0;
    this.bumperChain = 0;
    this.stats = { saucer: 0, banks: 0, multiballs: 0, rollSets: 0, bumps: 0, targets: 0, kicks: 0, flipHits: 0, serves: 0, drainX: [] };
    for (const r of this.rollovers) r.lit = false;
    this.resetBank(this.targetsL, true);
    this.resetBank(this.targetsR, true);
    this.bankResetL = 0;
    this.bankResetR = 0;
    for (const b of this.balls) b.root.destroy({ children: true });
    this.balls.length = 0;
    this.fxOver.clear();
    this.fxUnder.clear();
    this.refreshPips();
    this.updateHudText();
    audio.playing = true;
    this.serveBall();
  }

  private makeBall(x: number, y: number): Ball {
    const root = new Container();
    const halo = new Sprite(this.tex.glow);
    halo.anchor.set(0.5);
    halo.scale.set(0.85);
    halo.tint = 0x7ec0ff;
    halo.alpha = 0.3;
    halo.blendMode = 'add';
    const body = new Sprite(this.tex.ball);
    body.anchor.set(0.5);
    body.width = BALL_R * 2.15;
    body.height = BALL_R * 2.15;
    root.addChild(halo, body);
    root.position.set(x, y);
    this.ballLayer.addChild(root);
    return {
      x, y, vx: 0, vy: 0, r: BALL_R,
      root, body, halo,
      held: false, captured: 0, trail: 0, stillT: 0, spin: 0,
    };
  }

  private serveBall(): void {
    const b = this.makeBall(PLUNGER_X, PLUNGER_REST_Y);
    b.held = true;
    this.balls.push(b);
    this.state = 'launch';
    this.saverPending = true;
    this.kickCharges = KICKBACKS_PER_BALL;
    this.stats.serves++;
    this.plungerPull = 0;
    this.launchWait = 0;
    this.ballText.text = `BALL ${this.ballNum}`;
    this.bumperChain = 0;
    this.drawPlunger();
  }

  private launchBall(): void {
    const b = this.balls.find((x) => x.held);
    if (!b) return;
    const p = this.plungerPull;
    b.held = false;
    b.vy = -(1680 + p * 720);
    b.vx = (Math.random() - 0.5) * 24;
    audio.launch(p);
    this.state = 'play';
    // Only a fresh ball arms the saver — re-arming on every save made the
    // game literally unloseable.
    if (this.saverPending) {
      this.saverT = SAVER_TIME;
      this.saverPending = false;
    }
    this.plungerPull = 0;
    this.drawPlunger();
    for (let i = 0; i < 18; i++) {
      this.fxOver.spawn(this.tex.spark, PLUNGER_X, PLUNGER_REST_Y + 30, {
        vx: (Math.random() - 0.5) * 220,
        vy: 120 + Math.random() * 260,
        life: 0.4,
        tint: C.magenta,
        scaleFrom: 0.6,
        scaleTo: 0.1,
        rotation: Math.random() * Math.PI,
      });
    }
  }

  private addScore(n: number, x?: number, y?: number, color = C.gold): void {
    const total = Math.round(n * this.multiplier * (this.multiball ? 2 : 1));
    this.score += total;
    if (!this.extraAwarded && this.score >= EXTRA_BALL_AT) {
      this.extraAwarded = true;
      this.ballsLeft++;
      this.refreshPips();
      this.showBanner('EXTRA BALL!', C.lime);
      audio.ballSaved();
    }
    if (x !== undefined && y !== undefined && total >= 400) this.popup(total, x, y, color);
  }

  private popup(n: number, x: number, y: number, color: number): void {
    const t = new Text({ text: `+${fmt(n)}`, style: style(n >= 5000 ? 34 : 25, color, 5) });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.shakeRoot.addChild(t);
    const y0 = y;
    tween(0.85, (p) => {
      t.y = y0 - 62 * p;
      t.alpha = 1 - p * p;
      t.scale.set(0.6 + 0.5 * Math.min(1, p * 4));
    }, { ease: Ease.outCubic, onComplete: () => t.destroy() });
  }

  private showBanner(text: string, color: number): void {
    this.banner.text = text;
    this.banner.style.fill = color;
    this.banner.alpha = 1;
    this.banner.scale.set(0.4);
    tween(0.45, (p) => this.banner.scale.set(0.4 + 0.6 * p), { ease: Ease.outBack });
    tween(0.5, (p) => { this.banner.alpha = 1 - p; }, { delay: 1.25, ease: Ease.inQuad });
  }

  private shake(mag: number): void {
    this.shakeMag = Math.min(24, Math.max(this.shakeMag, mag));
  }

  private flash(alpha: number): void {
    this.flashRect.alpha = Math.max(this.flashRect.alpha, alpha);
  }

  private burst(x: number, y: number, tint: number, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.9);
      this.fxOver.spawn(Math.random() < 0.6 ? this.tex.dot : this.tex.spark, x, y, {
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.3 + Math.random() * 0.35,
        tint,
        scaleFrom: 0.4 + Math.random() * 0.5,
        scaleTo: 0,
        drag: 2.4,
        rotation: a,
      });
    }
    this.fxOver.spawn(this.tex.ring, x, y, {
      life: 0.34, tint, scaleFrom: 0.12, scaleTo: 1.0, alpha: 0.85, fadePow: 1.5,
    });
  }

  // ------------------------------------------------------------------ update

  update(rawDt: number): void {
    this.time += rawDt;
    updateTweens(rawDt);

    if (this.flashRect.alpha > 0) {
      this.flashRect.alpha = Math.max(0, this.flashRect.alpha - rawDt * 3.4);
    }
    if (this.shakeMag > 0) {
      this.shakeMag = Math.max(0, this.shakeMag - rawDt * 62);
      const m = this.shakeMag;
      this.shakeRoot.position.set((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    } else {
      this.shakeRoot.position.set(0, 0);
    }

    if (this.rgbAmt > 0.01) {
      this.rgbAmt = Math.max(0, this.rgbAmt - rawDt * 3.2);
      const a = this.rgbAmt;
      this.rgb.red = { x: -6 * a, y: 0 };
      this.rgb.blue = { x: 6 * a, y: 0 };
      this.rgb.green = { x: 0, y: 2 * a };
      if (this.app.stage.filters !== undefined && (this.app.stage.filters as unknown[]).length === 1) {
        this.app.stage.filters = [this.bloom, this.rgb];
      }
    } else if (Array.isArray(this.app.stage.filters) && this.app.stage.filters.length > 1) {
      this.app.stage.filters = [this.bloom];
    }

    // hitstop: the world freezes, presentation keeps running
    if (this.freeze > 0) {
      this.freeze -= rawDt;
      this.backdrop.update(rawDt);
      this.fxOver.update(rawDt);
      this.fxUnder.update(rawDt);
      this.updatePresentation(rawDt);
      return;
    }

    const dt = Math.min(rawDt, 1 / 30);

    const targetEnergy = this.state === 'play' ? Math.min(1, this.bumperChain / 10 + (this.multiball ? 0.5 : 0)) : 0;
    this.energy += (targetEnergy - this.energy) * Math.min(1, dt * 2.4);
    this.backdrop.energy = this.energy;
    this.backdrop.update(dt);
    audio.intensity = this.energy;
    this.bloom.brightness = 1 + this.energy * 0.18;
    this.bloom.bloomScale = 0.7 + this.energy * 0.28;

    this.fxUnder.update(dt);
    this.fxOver.update(dt);
    this.updatePresentation(dt);

    if (this.state === 'paused' || this.state === 'start' || this.state === 'gameover') return;

    if (this.bankResetL > 0 && (this.bankResetL -= dt) <= 0) this.resetBank(this.targetsL, false);
    if (this.bankResetR > 0 && (this.bankResetR -= dt) <= 0) this.resetBank(this.targetsR, false);

    if (this.chainT > 0) {
      this.chainT -= dt;
      if (this.chainT <= 0) this.bumperChain = 0;
    }

    if (this.state === 'launch') {
      this.launchWait += dt;
      if (this.plungerHeld) {
        this.plungerPull = Math.min(1, this.plungerPull + dt * 0.95);
        if (Math.random() < dt * 22) audio.plungerCharge(this.plungerPull);
        this.drawPlunger();
      }
      // nobody's pulling — send it anyway so play never stalls
      if (this.launchWait > 9) {
        this.plungerPull = 0.8;
        this.launchBall();
      }
    }

    if (this.state === 'ballend') {
      this.ballEndT -= dt;
      if (this.ballEndT <= 0) this.afterBallEnd();
      return;
    }

    this.flipL.update(dt);
    this.flipR.update(dt);

    if (this.saverT > 0 && this.state === 'play') this.saverT = Math.max(0, this.saverT - dt);

    this.stepPhysics(dt);
    this.updateHudText();
  }

  private stepPhysics(dt: number): void {
    let remaining = dt;
    let guard = 0;
    while (remaining > 1e-6 && guard < MAX_SUBSTEPS) {
      const h = Math.min(PHYS_STEP, remaining);
      remaining -= h;
      guard++;
      this.substep(h);
    }
  }

  private substep(h: number): void {
    for (const b of this.balls) {
      if (b.held) {
        b.x = PLUNGER_X;
        b.y = PLUNGER_REST_Y + this.plungerPull * 46;
        b.vx = 0;
        b.vy = 0;
        continue;
      }
      if (b.captured > 0) {
        b.captured -= h;
        b.x = SAUCER_X;
        b.y = SAUCER_Y;
        b.vx = 0;
        b.vy = 0;
        if (b.captured <= 0) this.ejectSaucer(b);
        continue;
      }

      b.vy += GRAVITY * h;
      const d = Math.max(0, 1 - DAMPING * h);
      b.vx *= d;
      b.vy *= d;
      b.x += b.vx * h;
      b.y += b.vy * h;

      this.collideBall(b, h);
      clampSpeed(b, MAX_SPEED);
    }

    // ball-vs-ball
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        const a = this.balls[i];
        const c = this.balls[j];
        if (a.held || c.held || a.captured > 0 || c.captured > 0) continue;
        const imp = collideBalls(a, c);
        if (imp > 260) audio.wall(imp);
      }
    }

    // drains
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.held || b.captured > 0) continue;
      if (b.y > DRAIN_Y - 30 && b.x < DIV_X) this.drainBall(i);
    }

    // Outlane kickbacks: fire the ball back into play instead of losing it
    // somewhere the flippers can never reach.
    for (const b of this.balls) {
      if (b.held || b.captured > 0) continue;
      if (b.y < KICKBACK_Y || b.y > DRAIN_Y) continue;
      if (b.x > DIV_X) continue; // shooter lane, not an outlane
      const side: 0 | 1 | null = b.x < KICKBACK_LX ? 0 : b.x > KICKBACK_RX ? 1 : null;
      if (side === null || this.kickCool[side] > 0 || this.kickCharges <= 0) continue;
      this.fireKickback(b, side);
    }

    // A ball that rolls back down the shooter lane gets handed to the plunger
    // again — otherwise a soft plunge would strand it there for good.
    if (this.state === 'play' && this.balls.length === 1) {
      const b = this.balls[0];
      if (!b.held && b.captured <= 0 && b.x > DIV_X && b.y > 1300
          && Math.hypot(b.vx, b.vy) < 150) {
        b.held = true;
        b.vx = 0;
        b.vy = 0;
        this.state = 'launch';
        this.plungerPull = 0;
        this.launchWait = 0;
        this.drawPlunger();
      }
    }
  }

  private collideBall(b: Ball, h: number): void {
    let hardest: Contact | null = null;

    for (const w of this.walls) {
      const c = collideStatic(b, w);
      if (c) {
        if (c.impact > 150) audio.wall(c.impact);
        if (w.tag === 'gate' && c.impact > 100) this.burst(c.px, c.py, C.cyan, 4, 180);
        if (!hardest || c.impact > hardest.impact) hardest = c;
      }
    }

    for (const p of this.posts) {
      const c = collideStatic(b, p);
      if (c) {
        if (c.impact > 180) {
          audio.wall(c.impact * 1.3);
          this.burst(c.px, c.py, C.gold, 5, 200);
          this.addScore(30);
        }
      }
    }

    for (const bm of this.bumpers) {
      const c = collideStatic(b, bm.col);
      if (c) this.hitBumper(bm, c);
    }

    for (const s of this.slings) {
      const c = collideStatic(b, s.kick);
      if (c) this.hitSling(s, c, b);
    }

    for (const bank of [this.targetsL, this.targetsR]) {
      for (const t of bank) {
        if (!t.up) continue;
        const c = collideStatic(b, t.col);
        if (c) this.hitTarget(bank, t, c);
      }
    }

    for (const t of this.standups) {
      const c = collideStatic(b, t.col);
      if (c && t.up) this.hitStandup(t, c);
    }

    const cl = this.flipL.collide(b);
    if (cl) {
      this.stats.flipHits++;
      if (cl.impact > 220) this.flipperFx(cl);
    }
    const cr = this.flipR.collide(b);
    if (cr) {
      this.stats.flipHits++;
      if (cr.impact > 220) this.flipperFx(cr);
    }

    // rollovers
    for (const r of this.rollovers) {
      if (r.lit) continue;
      const dx = b.x - r.x;
      const dy = b.y - r.y;
      if (dx * dx + dy * dy < (ROLLOVER_R + 4) * (ROLLOVER_R + 4)) this.hitRollover(r);
    }

    // spinner — spins while the ball crosses the orbit mouth
    const sdx = b.x - SPINNER_X;
    const sdy = b.y - SPINNER_Y;
    if (sdx * sdx + sdy * sdy < 46 * 46) {
      const sp = Math.hypot(b.vx, b.vy);
      // capped, or a single orbit rip out-scores every other shot on the table
      this.spinSpeed = Math.min(12, Math.max(this.spinSpeed, sp * 0.010));
    }

    // saucer capture
    const qx = b.x - SAUCER_X;
    const qy = b.y - SAUCER_Y;
    if (qx * qx + qy * qy < (SAUCER_R - 3) * (SAUCER_R - 3)) this.captureSaucer(b);

    // stuck-ball rescue: a table that traps the ball is worse than a nudge
    const speed = Math.hypot(b.vx, b.vy);
    if (speed < 45) {
      b.stillT += h;
      if (b.stillT > 3.5) {
        b.stillT = 0;
        b.vx += (Math.random() - 0.5) * 340;
        b.vy -= 260;
        this.shake(5);
      }
    } else {
      b.stillT = 0;
    }

    if (hardest && hardest.impact > 900) this.shake(hardest.impact * 0.004);
  }

  // ----------------------------------------------------------------- effects

  private flipperFx(c: Contact): void {
    audio.wall(c.impact * 0.7);
    for (let i = 0; i < 5; i++) {
      this.fxOver.spawn(this.tex.dot, c.px, c.py, {
        vx: c.nx * 220 * Math.random() + (Math.random() - 0.5) * 130,
        vy: c.ny * 220 * Math.random() + (Math.random() - 0.5) * 130,
        life: 0.22,
        tint: C.goldPale,
        scaleFrom: 0.45,
        scaleTo: 0,
      });
    }
  }

  private hitBumper(bm: Bumper, c: Contact): void {
    this.bumperChain++;
    this.stats.bumps++;
    this.chainT = 2.4;
    bm.lit = 1;
    audio.bumper(this.bumperChain);
    this.addScore(500 + Math.min(this.bumperChain, 12) * 50, bm.x, bm.y - 30, C.magenta);
    this.shake(4 + Math.min(6, this.bumperChain * 0.4));
    this.burst(c.px, c.py, C.magenta, 12, 380);
    this.fxOver.spawn(this.tex.ring, bm.x, bm.y, {
      life: 0.3, tint: 0xffffff, scaleFrom: 0.5, scaleTo: 1.5, alpha: 0.7, fadePow: 1.6,
    });
    bm.cap.scale.set(1.32);
    tween(0.26, (p) => bm.cap.scale.set(1.32 - 0.32 * p), { ease: Ease.outBack });
  }

  private hitSling(s: Sling, c: Contact, b: Ball) {
    s.flash = 1;
    audio.sling();
    // kick along the face normal, away from the sling
    b.vx += c.nx * 620;
    b.vy += c.ny * 620;
    this.addScore(250, c.px, c.py - 20, C.gold);
    this.shake(3.5);
    this.burst(c.px, c.py, C.gold, 9, 320);
  }

  private hitTarget(bank: DropTarget[], t: DropTarget, c: Contact): void {
    t.up = false;
    t.col.active = false;
    this.stats.targets++;
    const down = bank.filter((x) => !x.up).length;
    audio.target(down);
    this.addScore(1000, t.def.x, t.def.y - 34, C.lime);
    this.shake(3);
    this.burst(c.px, c.py, bank === this.targetsL ? C.lime : C.cyan, 12, 340);
    const root = t.root;
    tween(0.22, (p) => {
      root.scale.set(1 - p, 1 - p * 0.9);
      root.alpha = 1 - p;
    }, { ease: Ease.inQuad, onComplete: () => { root.visible = false; } });

    if (down === bank.length) this.bankCleared(bank);
  }

  /** Standing target: scores and flashes, but stays in play. */
  private hitStandup(t: DropTarget, c: Contact): void {
    t.up = false;
    audio.target(2);
    this.addScore(1500, t.def.x, t.def.y - 36, C.orange);
    this.shake(3.5);
    this.burst(c.px, c.py, C.orange, 11, 340);
    const root = t.root;
    tween(0.16, (p) => root.scale.set(1 - p * 0.32, 1 + p * 0.12), { ease: Ease.outQuad });
    tween(0.3, (p) => root.scale.set(0.68 + 0.32 * p, 1.12 - 0.12 * p), {
      delay: 0.16,
      ease: Ease.outBack,
      onComplete: () => { t.up = true; },
    });
  }

  private bankCleared(bank: DropTarget[]): void {
    const left = bank === this.targetsL;
    this.stats.banks++;
    if (left) this.bankResetL = 12;
    else this.bankResetR = 12;
    audio.bankClear();
    this.addScore(6000, left ? 150 : 2 * PF_CX - 150, 740, C.lime);
    this.flash(0.2);
    this.shake(9);
    if (!this.multiball) this.startMultiball();
    else {
      this.showBanner('JACKPOT LIT!', C.gold);
      this.addScore(12000, PF_CX, 860, C.gold);
    }
  }

  private resetBank(bank: DropTarget[], instant: boolean): void {
    for (const t of bank) {
      t.up = true;
      t.col.active = true;
      t.root.visible = true;
      t.root.alpha = 1;
      if (instant) t.root.scale.set(1);
      else {
        t.root.scale.set(0.2);
        tween(0.4, (p) => t.root.scale.set(0.2 + 0.8 * p), { ease: Ease.outBack });
      }
    }
  }

  private hitRollover(r: Rollover): void {
    r.lit = true;
    audio.rollover();
    this.addScore(750, r.x, r.y - 26, C.gold);
    this.burst(r.x, r.y, C.gold, 8, 220);
    tween(0.35, (p) => {
      r.star.scale.set(0.62 + 0.5 * Math.sin(p * Math.PI));
      r.star.alpha = 0.35 + 0.65 * p;
      r.glow.alpha = 0.12 + 0.5 * p;
    });
    if (this.rollovers.every((x) => x.lit)) this.rolloversComplete();
  }

  private rolloversComplete(): void {
    this.rolloverSets++;
    this.stats.rollSets++;
    this.multiplier = Math.min(6, this.multiplier + 1);
    this.addScore(10000, PF_CX, 1000, C.lime);
    audio.bankClear();
    this.showBanner(`${this.multiplier}x MULTIPLIER!`, C.lime);
    this.flash(0.24);
    this.shake(10);
    this.freeze = 0.03;
    for (const r of this.rollovers) {
      this.burst(r.x, r.y, C.lime, 14, 320);
      r.lit = false;
      tween(0.45, (p) => {
        r.star.alpha = 1 - 0.65 * p;
        r.glow.alpha = 0.62 - 0.5 * p;
        r.star.scale.set(1.12 - 0.5 * p);
      });
    }
    this.multText.scale.set(1.7);
    tween(0.5, (p) => this.multText.scale.set(1.7 - 0.7 * p), { ease: Ease.outBack });
  }

  private captureSaucer(b: Ball): void {
    if (b.captured > 0) return;
    b.captured = 1.1;
    this.stats.saucer++;
    b.vx = 0;
    b.vy = 0;
    audio.saucer();
    this.shake(8);
    this.flash(0.3);
    this.rgbAmt = 1;
    this.freeze = 0.035;
    const jack = this.multiball;
    this.addScore(jack ? 50000 : 15000, SAUCER_X, SAUCER_Y - 44, C.cyan);
    this.showBanner(jack ? 'JACKPOT!' : 'STAR GATE!', jack ? C.magenta : C.cyan);
    if (jack) audio.jackpot();
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 200 + Math.random() * 620;
      this.fxOver.spawn(i % 3 === 0 ? this.tex.star : this.tex.dot, SAUCER_X, SAUCER_Y, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.5,
        tint: [C.cyan, C.violet, 0xffffff][i % 3],
        scaleFrom: 0.2 + Math.random() * 0.55,
        scaleTo: 0,
        drag: 2,
        vr: (Math.random() - 0.5) * 10,
      });
    }
    tween(0.7, (p) => {
      this.saucerRing.scale.set(1 + Math.sin(p * Math.PI * 3) * 0.16);
      this.saucerGlow.alpha = 0.35 + 0.6 * (1 - p);
    });
  }

  private ejectSaucer(b: Ball): void {
    const a = Math.PI / 2 + (Math.random() - 0.5) * 1.1;
    const s = 620 + Math.random() * 160;
    b.vx = Math.cos(a) * s;
    b.vy = Math.sin(a) * s;
    b.y = SAUCER_Y + SAUCER_R + 4;
    audio.sling();
    this.burst(SAUCER_X, SAUCER_Y + 20, C.cyan, 12, 300);
  }

  private startMultiball(): void {
    this.multiball = true;
    this.stats.multiballs++;
    audio.multiball();
    this.showBanner('MULTIBALL!', C.magenta);
    this.flash(0.42);
    this.shake(18);
    this.freeze = 0.05;
    this.rgbAmt = 1.3;
    this.saverT = Math.max(this.saverT, SAVER_TIME);
    for (let i = 0; i < 2; i++) {
      const nb = this.makeBall(SAUCER_X + (i === 0 ? -40 : 40), SAUCER_Y + 70);
      nb.vx = (i === 0 ? -1 : 1) * 260;
      nb.vy = 420;
      this.balls.push(nb);
    }
    this.confetti();
  }

  private fireKickback(b: Ball, side: 0 | 1): void {
    const k = side === 0 ? KICKBACK_L : KICKBACK_R;
    this.kickCool[side] = 0.6;
    this.kickCharges--;
    this.stats.kicks++;
    this.kickFlash[side] = 1;
    // Fire the ball from where it stands — never reposition it onto the
    // kicker's own coordinates, which can sit inside the outer wall.
    b.vx = (side === 0 ? -1 : 1) * 90;
    b.vy = -1580;
    audio.kickback();
    this.addScore(1500, k.x, k.y - 70, C.orange);
    this.shake(7);
    this.flash(0.1);
    if (this.kickCharges === 0) this.showBanner('LAST KICKBACK!', C.orange);
    for (let n = 0; n < 22; n++) {
      this.fxOver.spawn(n % 2 ? this.tex.spark : this.tex.dot, k.x, k.y, {
        vx: (Math.random() - 0.5) * 320,
        vy: -180 - Math.random() * 520,
        life: 0.4 + Math.random() * 0.3,
        tint: n % 3 === 0 ? C.goldPale : C.orange,
        scaleFrom: 0.35 + Math.random() * 0.5,
        scaleTo: 0,
        drag: 1.6,
        gravity: 400,
      });
    }
    const g = this.kickG[side];
    if (g) {
      g.scale.set(1.3, 0.7);
      tween(0.3, (p) => g.scale.set(1.3 - 0.3 * p, 0.7 + 0.3 * p), { ease: Ease.outBack });
    }
  }

  private drainBall(i: number): void {
    const b = this.balls[i];
    if (this.stats.drainX.length < 200) this.stats.drainX.push(Math.round(b.x));
    const saved = this.saverT > 0;
    this.burst(b.x, Math.min(b.y, DRAIN_Y - 20), saved ? C.cyan : C.magenta, 16, 300);
    b.root.destroy({ children: true });
    this.balls.splice(i, 1);

    if (saved && !this.multiball) {
      audio.ballSaved();
      this.showBanner('BALL SAVED', C.cyan);
      const nb = this.makeBall(PLUNGER_X, PLUNGER_REST_Y);
      nb.held = true;
      this.balls.push(nb);
      this.plungerPull = 0.82;
      this.drawPlunger();
      tween(0.55, () => {}, { onComplete: () => { if (this.balls.some((x) => x.held)) this.launchBall(); } });
      this.state = 'launch';
      this.launchWait = 0;
      return;
    }

    if (this.balls.length > 0) {
      // multiball winding down
      if (this.multiball && this.balls.length === 1) {
        this.multiball = false;
        this.resetBank(this.targetsL, false);
        this.resetBank(this.targetsR, false);
        this.showBanner('MULTIBALL OVER', C.violet);
      }
      audio.wall(600);
      return;
    }

    this.multiball = false;
    audio.drain();
    this.shake(12);
    this.state = 'ballend';
    this.flipL.pressed = false;
    this.flipR.pressed = false;
    this.ballEndT = 1.1;
    this.ballsLeft--;
    this.refreshPips();
  }

  private afterBallEnd(): void {
    if (this.ballsLeft <= 0) {
      this.state = 'gameover';
      this.flipL.pressed = false;
      this.flipR.pressed = false;
      audio.playing = false;
      if (this.score > this.best) {
        this.best = this.score;
        localStorage.setItem('pinball-best', String(this.best));
        this.bestText.text = `BEST ${fmt(this.best)}`;
        audio.highScore();
      } else {
        audio.gameOver();
      }
      // Global from /arcade/arcade.js — absent when this game runs standalone.
      (window as any).Arcade?.submit({ game: 'pinball', value: this.score });
      this.showGameOver();
      return;
    }
    this.ballNum++;
    for (const r of this.rollovers) {
      r.lit = false;
      r.star.alpha = 0.35;
      r.star.scale.set(0.62);
      r.glow.alpha = 0.12;
    }
    this.resetBank(this.targetsL, false);
    this.resetBank(this.targetsR, false);
    this.serveBall();
  }

  // ---------------------------------------------------------- presentation

  private updatePresentation(dt: number): void {
    for (let i = 0; i < 2; i++) {
      if (this.kickCool[i] > 0) this.kickCool[i] = Math.max(0, this.kickCool[i] - dt);
      if (this.kickFlash[i] > 0) this.kickFlash[i] = Math.max(0, this.kickFlash[i] - dt * 2.2);
      const g = this.kickG[i];
      if (g) {
        g.alpha = this.kickCharges > 0
          ? 0.8 + 0.2 * Math.sin(this.time * 3 + i) + this.kickFlash[i] * 0.6
          : 0.3;
      }
      const lamp = this.kickLamp[i];
      if (lamp) lamp.alpha = this.kickCharges > 0 ? 0.3 + this.kickFlash[i] * 0.7 : 0.06;
    }

    // bumpers breathe, and flare when struck
    for (const bm of this.bumpers) {
      bm.lit = Math.max(0, bm.lit - dt * 3.4);
      const idle = 0.24 + Math.sin(this.time * 2.4 + bm.x * 0.01) * 0.06;
      bm.glow.alpha = idle + bm.lit * 0.9;
      bm.glow.scale.set(2.1 + bm.lit * 0.9);
      bm.ring.alpha = 1;
      bm.cap.rotation += dt * (0.4 + bm.lit * 8);
    }

    for (const s of this.slings) {
      if (s.flash > 0) {
        s.flash = Math.max(0, s.flash - dt * 5);
        this.drawSlingBand(s, s.flash);
      }
      s.glow.alpha = s.flash * 0.85;
      s.glow.scale.set(1.5 + s.flash * 0.8);
    }

    // spinner free-wheels down
    if (this.spinSpeed > 0.01) {
      const before = this.spinAngle;
      this.spinAngle += this.spinSpeed * dt * 26;
      this.spinSpeed *= Math.max(0, 1 - dt * 3.2);
      const halfTurns = Math.floor(this.spinAngle / Math.PI) - Math.floor(before / Math.PI);
      if (halfTurns > 0 && this.state === 'play') {
        this.spinCount += halfTurns;
        audio.spinner(this.spinCount);
        this.addScore(120 * halfTurns);
        this.fxOver.spawn(this.tex.dot, SPINNER_X, SPINNER_Y, {
          vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160,
          life: 0.28, tint: C.lime, scaleFrom: 0.5, scaleTo: 0,
        });
      }
      this.drawSpinner();
      this.spinnerGlow.alpha = 0.2 + Math.min(0.7, this.spinSpeed * 0.5);
    } else if (this.spinnerGlow.alpha > 0.2) {
      this.spinnerGlow.alpha = Math.max(0.2, this.spinnerGlow.alpha - dt);
    }

    // saucer idles with a slow pulse; lit hard during multiball
    const sp = 0.5 + 0.5 * Math.sin(this.time * 2.2);
    this.saucerGlow.alpha = (this.multiball ? 0.6 : 0.3) + sp * (this.multiball ? 0.4 : 0.14);
    this.saucerRing.alpha = 0.6 + sp * 0.4;

    // rollover lamps
    for (const r of this.rollovers) {
      if (r.lit) r.glow.alpha = 0.45 + 0.2 * Math.sin(this.time * 6 + r.x * 0.02);
    }

    // flippers
    this.flipGL.rotation = this.flipL.angle + this.flipL.recoil;
    this.flipGR.rotation = this.flipR.angle - this.flipR.recoil + Math.PI;

    // ball saver beam
    const on = this.saverT > 0 && (this.state === 'play' || this.state === 'launch');
    const targetA = on ? (this.saverT < 3 ? (Math.sin(this.time * 14) > 0 ? 0.9 : 0.25) : 0.75) : 0;
    this.saverBeam.alpha += (targetA - this.saverBeam.alpha) * Math.min(1, dt * 12);
    this.saverText.text = on ? `BALL SAVE  ${Math.ceil(this.saverT)}` : '';
    this.saverText.alpha = on ? 0.9 : 0;

    this.drawPlungerMeter();

    // balls: trail, halo and spin
    for (const b of this.balls) {
      b.root.position.set(b.x, b.y);
      const speed = Math.hypot(b.vx, b.vy);
      b.spin += (b.vx / BALL_R) * dt;
      b.body.rotation = b.spin;
      b.halo.alpha = 0.26 + Math.min(0.3, speed / 6000);
      b.halo.scale.set(0.82 + Math.min(0.4, speed / 5200));
      if (this.state === 'play' && speed > 260) {
        b.trail -= dt;
        if (b.trail <= 0) {
          b.trail = 0.014;
          this.fxUnder.spawn(this.tex.glow, b.x, b.y, {
            life: 0.28,
            tint: 0x9fd4ff,
            scaleFrom: 0.34 + Math.min(0.16, speed / 14000),
            scaleTo: 0.05,
            alpha: 0.5,
            fadePow: 1.5,
          });
        }
      }
    }
  }

  private updateHudText(): void {
    if (this.shownScore !== this.score) {
      const diff = this.score - this.shownScore;
      this.shownScore += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.18));
      if (Math.abs(this.score - this.shownScore) < 2) this.shownScore = this.score;
      this.scoreText.text = fmt(this.shownScore);
    }
    const m = `${this.multiplier}x${this.multiball ? ' ×2' : ''}`;
    if (this.multText.text !== m) this.multText.text = m;
  }

  /** Test/debug surface. */
  debugState() {
    return {
      state: this.state,
      score: this.score,
      ballNum: this.ballNum,
      ballsLeft: this.ballsLeft,
      ballsInPlay: this.balls.length,
      multiplier: this.multiplier,
      multiball: this.multiball,
      saver: this.saverT,
      stats: { ...this.stats },
      flipL: this.flipL.angle,
      flipR: this.flipR.angle,
      flipLp: this.flipL.pressed,
      flipRp: this.flipR.pressed,
      ball: this.balls[0] ? { x: this.balls[0].x, y: this.balls[0].y, vx: this.balls[0].vx, vy: this.balls[0].vy } : null,
    };
  }

  /**
   * Test hook: advance the simulation without waiting on the renderer.
   * Headless WebGL runs at a few fps, so pacing has to be measured in game
   * time, not wall time.
   */
  debugSim(seconds: number, onStep?: (t: number) => void): void {
    const step = 1 / 120;
    const n = Math.min(60000, Math.floor(seconds / step));
    for (let i = 0; i < n; i++) {
      this.update(step);
      onStep?.(i * step);
    }
  }

  /** Test hook: drop a ball straight into the playfield. */
  debugPlaceBall(x: number, y: number, vx = 0, vy = 0): void {
    for (const b of this.balls) b.root.destroy({ children: true });
    this.balls.length = 0;
    const b = this.makeBall(x, y);
    b.vx = vx;
    b.vy = vy;
    this.balls.push(b);
    this.state = 'play';
  }

  debugStart(): void {
    if (this.state === 'start' || this.state === 'gameover') this.startGame();
  }

  debugLaunch(power = 1): void {
    if (this.state !== 'launch') return;
    this.plungerPull = power;
    this.launchBall();
  }
}
