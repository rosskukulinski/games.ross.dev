/** Neon Bricks — core game: states, entities, physics, juice. */

import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyleOptions,
} from 'pixi.js';
import { AdvancedBloomFilter, GlowFilter, RGBSplitFilter, ShockwaveFilter } from 'pixi-filters';
import { audio } from './audio';
import { GameTextures, makeTextures, NeonBackground, ParticleSystem } from './fx';
import { BrickSpec, getLevels, LEVEL_COUNT, LevelDef, NEON } from './levels';
import { Ease, killAllTweens, tween, tweenProps, updateTweens } from './tween';

export const W = 900;
export const H = 1200;

const FIELD_L = 18;
const FIELD_R = W - 18;
const FIELD_T = 96;
const PADDLE_Y = 1104;
const BRICK_H = 30;
const BRICK_GAP = 6;
const BRICK_TOP = 168;
const BALL_R = 11;
// hidden test/demo hook: ?juice cranks the power-up drop rate for screenshots
const POWERUP_CHANCE = typeof location !== 'undefined' && location.search.includes('juice') ? 0.85 : 0.24;
const MAX_BALLS = 6;

type GameState = 'start' | 'transition' | 'playing' | 'paused' | 'gameover' | 'win';
type PowerType = 'wide' | 'multi' | 'laser';

interface Brick {
  c: Container;
  body: Sprite;
  shine: Sprite;
  crack: Sprite;
  spec: BrickSpec;
  hp: number;
  x: number; // center
  y: number;
  w: number;
  h: number;
  alive: boolean;
}

interface Ball {
  c: Container;
  core: Sprite;
  halo: Sprite;
  vx: number;
  vy: number;
  speed: number;
  stuck: boolean;
  stuckOffset: number;
}

interface PowerUp {
  c: Container;
  type: PowerType;
  vy: number;
  spin: number;
}

interface Laser {
  sp: Sprite;
  x: number;
  y: number;
}

const POWER_INFO: Record<PowerType, { color: number; label: string }> = {
  wide: { color: 0x39ff14, label: 'W' },
  multi: { color: 0xff2d95, label: 'M' },
  laser: { color: 0xff5533, label: 'L' },
};

function darken(color: number, f: number): number {
  const r = Math.round(((color >> 16) & 0xff) * f);
  const g = Math.round(((color >> 8) & 0xff) * f);
  const b = Math.round((color & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

function chunkyStyle(size: number, fill: number | string, strokeW = 0): TextStyleOptions {
  return {
    fontFamily: 'Arial Black, Arial, Helvetica, sans-serif',
    fontWeight: '900',
    fontSize: size,
    fill,
    ...(strokeW > 0 ? { stroke: { color: 0x050510, width: strokeW } } : {}),
  };
}

export class Game {
  private app: Application;
  private tex: GameTextures;

  // scene graph
  private shakeRoot = new Container();
  private bg: NeonBackground;
  private world = new Container();
  private brickLayer = new Container();
  private ballLayer = new Container();
  private fxUnder: ParticleSystem; // trails, behind entities
  private fxOver: ParticleSystem; // shards, sparks, rings
  private hud = new Container();
  private overlay = new Container();
  private flashRect: Graphics;

  // filters
  private bloom: AdvancedBloomFilter;
  private rgb: RGBSplitFilter;
  private shock: ShockwaveFilter;
  private rgbAmt = 0;
  private shockActive = false;

  // entities
  private paddle = new Container();
  private paddleBody!: Graphics;
  private paddleGlow!: Sprite;
  private cannonL!: Graphics;
  private cannonR!: Graphics;
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private powerups: PowerUp[] = [];
  private lasers: Laser[] = [];

  // game state
  private state: GameState = 'start';
  private pausedFrom: GameState = 'playing';
  private levels: LevelDef[] = getLevels();
  private levelIndex = 0;
  /** Highest level index the player has ever reached — the continue point. */
  private unlocked = 0;
  private lives = 3;
  private score = 0;
  private displayScore = 0;
  private best = 0;
  private combo = 0;
  private maxCombo = 0;

  // paddle / input
  private paddleX = W / 2;
  private paddleTargetX = W / 2;
  private paddleW = 150;
  private paddleWTarget = 150;

  // powerup timers
  private wideT = 0;
  private laserT = 0;
  private laserCooldown = 0;

  // input buffering
  private pendingLaunch = false;
  private buttons: { x: number; y: number; w: number; h: number; action: () => void }[] = [];

  // juice
  private shakeMag = 0;
  private freeze = 0;
  private time = 0;
  private ballSpeedBase = 620;

  // HUD refs
  private scoreText!: Text;
  private bestText!: Text;
  private comboText!: Text;
  private comboBar!: Graphics;
  private levelText!: Text;
  private hearts: Container[] = [];
  private muteIcon!: Graphics;

  constructor(app: Application) {
    this.app = app;
    this.tex = makeTextures(app.renderer);
    this.best = Number(localStorage.getItem('neon-bricks-best') ?? 0) || 0;
    const saved = Number(localStorage.getItem('neon-bricks-progress') ?? 0) || 0;
    this.unlocked = Math.max(0, Math.min(this.levels.length - 1, Math.floor(saved)));

    this.bg = new NeonBackground(this.tex, W, H);
    this.fxUnder = new ParticleSystem(500);
    this.fxOver = new ParticleSystem(800);

    this.shakeRoot.addChild(this.bg.container);
    this.shakeRoot.addChild(this.fxUnder.container);
    this.shakeRoot.addChild(this.world);
    this.world.addChild(this.brickLayer);
    this.world.addChild(this.ballLayer);
    this.shakeRoot.addChild(this.fxOver.container);
    app.stage.addChild(this.shakeRoot);
    app.stage.addChild(this.hud);
    app.stage.addChild(this.overlay);

    this.flashRect = new Graphics().rect(0, 0, W, H).fill(0xffffff);
    this.flashRect.alpha = 0;
    this.flashRect.blendMode = 'add';
    app.stage.addChild(this.flashRect);

    // filters
    this.bloom = new AdvancedBloomFilter({
      threshold: 0.38,
      bloomScale: 0.9,
      brightness: 1.0,
      blur: 7,
      quality: 4,
    });
    this.rgb = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
    this.shock = new ShockwaveFilter({
      center: { x: W / 2, y: H / 2 },
      amplitude: 30,
      wavelength: 190,
      brightness: 1.12,
      radius: 1400,
      speed: 1600,
    });
    app.stage.filters = [this.bloom];
    app.stage.filterArea = app.renderer.screen;

    this.buildWalls();
    this.buildPaddle();
    this.buildHud();
    this.showStartScreen();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
  }

  // ------------------------------------------------------------ setup

  private buildWalls(): void {
    const walls = new Graphics();
    // outer soft frame
    walls
      .roundRect(FIELD_L - 8, FIELD_T - 8, FIELD_R - FIELD_L + 16, H, 14)
      .stroke({ width: 10, color: 0x141433, alpha: 1 });
    walls
      .roundRect(FIELD_L - 5, FIELD_T - 5, FIELD_R - FIELD_L + 10, H, 12)
      .stroke({ width: 4, color: 0x4d6cff, alpha: 0.9 });
    walls
      .roundRect(FIELD_L - 2, FIELD_T - 2, FIELD_R - FIELD_L + 4, H, 10)
      .stroke({ width: 1.5, color: 0xbfe6ff, alpha: 0.9 });
    this.world.addChild(walls);
  }

  private buildPaddle(): void {
    this.paddleGlow = new Sprite(this.tex.glow);
    this.paddleGlow.anchor.set(0.5);
    this.paddleGlow.tint = 0x00f5ff;
    this.paddleGlow.alpha = 0.55;
    this.paddleGlow.blendMode = 'add';
    this.paddle.addChild(this.paddleGlow);

    this.paddleBody = new Graphics();
    this.paddle.addChild(this.paddleBody);
    this.cannonL = new Graphics();
    this.cannonR = new Graphics();
    this.paddle.addChild(this.cannonL, this.cannonR);
    this.redrawPaddle();

    this.paddle.position.set(this.paddleX, PADDLE_Y);
    this.paddle.filters = [
      new GlowFilter({ distance: 14, outerStrength: 1.6, color: 0x00f5ff, quality: 0.2 }),
    ];
    this.world.addChild(this.paddle);
  }

  private redrawPaddle(): void {
    const w = this.paddleW;
    const g = this.paddleBody;
    g.clear();
    g.roundRect(-w / 2, -13, w, 26, 13).fill({ color: 0x0a2a3a, alpha: 0.95 });
    g.roundRect(-w / 2, -13, w, 26, 13).stroke({ width: 3.5, color: 0x00f5ff });
    g.roundRect(-w / 2 + 8, -8, w - 16, 7, 4).fill({ color: 0xbffcff, alpha: 0.8 });
    // energy nubs at the tips
    g.circle(-w / 2 + 7, 0, 4.5).fill(0xffffff);
    g.circle(w / 2 - 7, 0, 4.5).fill(0xffffff);
    this.paddleGlow.scale.set((w + 90) / 128, 0.7);

    const laserOn = this.laserT > 0;
    for (const [cg, sx] of [
      [this.cannonL, -1],
      [this.cannonR, 1],
    ] as [Graphics, number][]) {
      cg.clear();
      if (laserOn) {
        cg.roundRect(sx * (w / 2 - 16) - 6, -26, 12, 18, 4).fill(0x2a0a0a);
        cg.roundRect(sx * (w / 2 - 16) - 6, -26, 12, 18, 4).stroke({ width: 2.5, color: 0xff5533 });
        cg.circle(sx * (w / 2 - 16), -26, 3.5).fill(0xffcc99);
      }
    }
  }

  private buildHud(): void {
    // score
    const scoreLabel = new Text({ text: 'SCORE', style: chunkyStyle(17, 0x8899dd) });
    scoreLabel.position.set(34, 14);
    this.scoreText = new Text({ text: '0', style: chunkyStyle(34, 0xffee32) });
    this.scoreText.position.set(34, 34);
    this.hud.addChild(scoreLabel, this.scoreText);

    // best
    this.bestText = new Text({ text: `BEST ${this.best}`, style: chunkyStyle(17, 0x8899dd) });
    this.bestText.position.set(34, 74);
    this.hud.addChild(this.bestText);

    // combo (center-left)
    this.comboText = new Text({ text: '', style: chunkyStyle(30, 0x00f5ff) });
    this.comboText.anchor.set(0.5);
    this.comboText.position.set(W / 2, 40);
    this.hud.addChild(this.comboText);
    this.comboBar = new Graphics();
    this.hud.addChild(this.comboBar);

    // level
    this.levelText = new Text({ text: `LV 1/${LEVEL_COUNT}`, style: chunkyStyle(22, 0xb537f2) });
    this.levelText.anchor.set(0.5, 0);
    this.levelText.position.set(W / 2, 62);
    this.hud.addChild(this.levelText);

    // hearts
    for (let i = 0; i < 3; i++) {
      const hc = new Container();
      const glow = new Sprite(this.tex.glow);
      glow.anchor.set(0.5);
      glow.scale.set(0.55);
      glow.tint = 0xff2d95;
      glow.alpha = 0.7;
      glow.blendMode = 'add';
      const h = new Sprite(this.tex.heart);
      h.anchor.set(0.5);
      h.tint = 0xff2d95;
      h.scale.set(1.15);
      hc.addChild(glow, h);
      hc.position.set(W - 160 + i * 46, 46);
      this.hud.addChild(hc);
      this.hearts.push(hc);
    }

    // mute button
    const mute = new Container();
    const mbg = new Graphics().circle(0, 0, 22).fill({ color: 0x101030, alpha: 0.9 });
    mbg.circle(0, 0, 22).stroke({ width: 2.5, color: 0x4d6cff });
    this.muteIcon = new Graphics();
    mute.addChild(mbg, this.muteIcon);
    mute.position.set(W - 46, 46);
    mute.eventMode = 'static';
    mute.cursor = 'pointer';
    mute.on('pointertap', (e) => {
      e.stopPropagation();
      audio.unlock();
      audio.toggleMuted();
      this.drawMuteIcon();
    });
    this.hud.addChild(mute);
    this.drawMuteIcon();
  }

  private drawMuteIcon(): void {
    const g = this.muteIcon;
    g.clear();
    g.poly([-9, -4, -3, -4, 4, -10, 4, 10, -3, 4, -9, 4]).fill(0xbfe6ff);
    if (audio.muted) {
      g.moveTo(7, -8).lineTo(14, 8).stroke({ width: 3, color: 0xff2d95 });
    } else {
      g.moveTo(8, -5).quadraticCurveTo(12, 0, 8, 5).stroke({ width: 2.5, color: 0xbfe6ff });
      g.moveTo(10, -9).quadraticCurveTo(16, 0, 10, 9).stroke({ width: 2.5, color: 0x4d6cff });
    }
  }

  private updateHearts(): void {
    this.hearts.forEach((h, i) => {
      h.visible = i < this.lives;
    });
  }

  // ------------------------------------------------------------ screens

  private clearOverlay(): void {
    this.overlay.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.buttons = [];
  }

  /**
   * Overlay button. Presses are hit-tested against these before the screen's
   * default tap action, so "tap anywhere to play" still works around them.
   */
  private menuButton(label: string, y: number, color: number, size: number, action: () => void): void {
    const t = new Text({
      text: label,
      style: { ...chunkyStyle(size, color, size >= 30 ? 5 : 4), letterSpacing: 2 },
    });
    t.anchor.set(0.5);
    t.position.set(W / 2, y);

    const padX = 34;
    const padY = 14;
    const w = t.width + padX * 2;
    const h = t.height + padY * 2;
    const frame = new Graphics()
      .roundRect(W / 2 - w / 2, y - h / 2, w, h, 16)
      .fill({ color: darken(color, 0.16), alpha: 0.5 })
      .roundRect(W / 2 - w / 2, y - h / 2, w, h, 16)
      .stroke({ width: 3, color });

    this.overlay.addChild(frame, t);
    this.buttons.push({ x: W / 2 - w / 2, y: y - h / 2, w, h, action });
  }

  private dimPanel(): Graphics {
    const g = new Graphics().rect(0, 0, W, H).fill({ color: 0x030310, alpha: 0.72 });
    return g;
  }

  private bigTitle(text: string, color: number, y: number, size = 92): Text {
    const t = new Text({
      text,
      style: {
        ...chunkyStyle(size, color, 10),
        letterSpacing: 4,
        align: 'center',
      },
    });
    t.anchor.set(0.5);
    t.position.set(W / 2, y);
    return t;
  }

  private showStartScreen(): void {
    this.state = 'start';
    this.clearOverlay();
    this.clearOverlayTimersSafe();

    const panel = this.dimPanel();
    panel.alpha = 0.35;
    this.overlay.addChild(panel);

    const title1 = this.bigTitle('NEON', 0x00f5ff, 380, 150);
    const title2 = this.bigTitle('BRICKS', 0xff2d95, 520, 150);
    this.overlay.addChild(title1, title2);

    // slow pulse on titles
    tween(
      1.4,
      (t) => {
        const s = 1 + 0.035 * Math.sin(t * Math.PI * 2);
        if (!title1.destroyed) title1.scale.set(s);
        if (!title2.destroyed) title2.scale.set(2 - s > 1 ? 1 + (1 - s) + 0.035 : 1 + 0.035 * Math.sin(t * Math.PI * 2 + Math.PI));
      },
      {
        ease: Ease.linear,
        onComplete: () => {
          if (this.state === 'start') this.titlePulse(title1, title2);
        },
      },
    );

    const count = new Text({
      text: `${LEVEL_COUNT} LEVELS`,
      style: { ...chunkyStyle(30, 0x39ff14, 5), letterSpacing: 8 },
    });
    count.anchor.set(0.5);
    count.position.set(W / 2, 640);
    this.overlay.addChild(count);

    if (this.unlocked > 0) {
      // Returning player: default tap continues, with an explicit restart.
      this.menuButton(`CONTINUE  •  LEVEL ${this.unlocked + 1}`, 730, 0xffee32, 34, () =>
        this.startGame(this.unlocked),
      );
      this.menuButton('NEW GAME', 820, 0xff2d95, 26, () => this.startGame(0));
    } else {
      const sub = new Text({
        text: 'CLICK / TAP TO PLAY',
        style: { ...chunkyStyle(34, 0xffee32, 6), letterSpacing: 3 },
      });
      sub.anchor.set(0.5);
      sub.position.set(W / 2, 740);
      this.overlay.addChild(sub);
      this.blink(sub);
    }

    const hint = new Text({
      text: 'Move: mouse or drag  •  Launch: tap or SPACE',
      style: chunkyStyle(22, 0x8899dd),
    });
    hint.anchor.set(0.5);
    hint.position.set(W / 2, this.unlocked > 0 ? 890 : 800);
    this.overlay.addChild(hint);

    if (this.best > 0) {
      const b = new Text({
        text: `BEST SCORE  ${this.best}`,
        style: chunkyStyle(26, 0xb537f2),
      });
      b.anchor.set(0.5);
      b.position.set(W / 2, this.unlocked > 0 ? 940 : 860);
      this.overlay.addChild(b);
    }

    // entrance
    title1.scale.set(0);
    title2.scale.set(0);
    tween(0.7, (t) => !title1.destroyed && title1.scale.set(t), { ease: Ease.outBack });
    tween(0.7, (t) => !title2.destroyed && title2.scale.set(t), { ease: Ease.outBack, delay: 0.15 });
  }

  private titlePulse(...texts: Text[]): void {
    tween(
      2.2,
      (t) => {
        texts.forEach((tx, i) => {
          if (!tx.destroyed) tx.scale.set(1 + 0.035 * Math.sin(t * Math.PI * 2 + i * 1.4));
        });
      },
      {
        ease: Ease.linear,
        onComplete: () => {
          if (!texts[0].destroyed && this.state === 'start') this.titlePulse(...texts);
        },
      },
    );
  }

  private blink(t: Text): void {
    tween(
      1.1,
      (p) => {
        if (!t.destroyed) t.alpha = 0.45 + 0.55 * Math.abs(Math.sin(p * Math.PI));
      },
      {
        ease: Ease.linear,
        onComplete: () => {
          if (!t.destroyed) this.blink(t);
        },
      },
    );
  }

  private clearOverlayTimersSafe(): void {
    // tweens guard themselves with .destroyed checks — nothing else needed
  }

  private showEndScreen(win: boolean): void {
    this.state = win ? 'win' : 'gameover';
    // Global from /arcade/arcade.js — absent when this game runs standalone.
    (window as any).Arcade?.submit({ game: 'neon-bricks', value: this.score });
    this.clearOverlay();
    this.overlay.addChild(this.dimPanel());

    const title = win
      ? this.bigTitle('YOU WIN!', 0x39ff14, 420, 120)
      : this.bigTitle('GAME OVER', 0xff2d95, 420, 104);
    this.overlay.addChild(title);
    title.scale.set(0);
    tween(0.8, (t) => !title.destroyed && title.scale.set(t), { ease: Ease.outElastic });

    const sc = new Text({ text: `SCORE  ${this.score}`, style: chunkyStyle(44, 0xffee32, 6) });
    sc.anchor.set(0.5);
    sc.position.set(W / 2, 560);
    this.overlay.addChild(sc);

    const isBest = this.score >= this.best && this.score > 0;
    const bl = new Text({
      text: isBest ? 'NEW BEST SCORE!' : `BEST  ${this.best}`,
      style: chunkyStyle(28, isBest ? 0x00f5ff : 0x8899dd, isBest ? 5 : 0),
    });
    bl.anchor.set(0.5);
    bl.position.set(W / 2, 625);
    this.overlay.addChild(bl);
    if (isBest) this.blink(bl);

    const mc = new Text({ text: `MAX COMBO  x${this.maxCombo}`, style: chunkyStyle(24, 0xb537f2) });
    mc.anchor.set(0.5);
    mc.position.set(W / 2, 672);
    this.overlay.addChild(mc);

    const reached = new Text({
      text: win
        ? `ALL ${LEVEL_COUNT} LEVELS CLEARED!`
        : `REACHED LEVEL ${this.levelIndex + 1} OF ${LEVEL_COUNT}`,
      style: chunkyStyle(24, 0x00f5ff),
    });
    reached.anchor.set(0.5);
    reached.position.set(W / 2, 716);
    this.overlay.addChild(reached);

    if (win) {
      const again = new Text({
        text: 'CLICK / TAP TO PLAY AGAIN',
        style: { ...chunkyStyle(30, 0xffffff, 5), letterSpacing: 2 },
      });
      again.anchor.set(0.5);
      again.position.set(W / 2, 810);
      again.alpha = 0;
      this.overlay.addChild(again);
      tween(0.4, (t) => !again.destroyed && (again.alpha = t), {
        delay: 0.9,
        onComplete: () => !again.destroyed && this.blink(again),
      });
    } else {
      // Retrying the level you died on is the default — 50 levels is too far to redo.
      const retryAt = this.levelIndex;
      this.menuButton(`RETRY  •  LEVEL ${retryAt + 1}`, 810, 0xffee32, 32, () => this.startGame(retryAt));
      if (retryAt > 0) this.menuButton('START OVER', 895, 0xff2d95, 24, () => this.startGame(0));
    }

    if (win) {
      audio.winFanfare();
      this.confetti();
    } else {
      audio.gameOver();
    }
  }

  private confetti(): void {
    for (let i = 0; i < 120; i++) {
      this.fxOver.spawn(this.tex.shard, Math.random() * W, -20 - Math.random() * 300, {
        vx: (Math.random() - 0.5) * 160,
        vy: 120 + Math.random() * 240,
        vr: (Math.random() - 0.5) * 12,
        gravity: 240,
        life: 2.4 + Math.random() * 1.6,
        tint: NEON[i % NEON.length],
        scaleFrom: 1 + Math.random(),
        scaleTo: 0.7,
        additive: false,
        fadePow: 0.4,
      });
    }
  }

  // ------------------------------------------------------------ level flow

  private startGame(from = 0): void {
    this.score = 0;
    this.displayScore = 0;
    this.lives = 3;
    this.combo = 0;
    this.maxCombo = 0;
    const start = Math.max(0, Math.min(this.levels.length - 1, from));
    this.levelIndex = start;
    this.updateHearts();
    this.loadLevel(start);
  }

  private loadLevel(idx: number): void {
    this.levelIndex = idx;
    const level = this.levels[idx];
    this.ballSpeedBase = level.ballSpeed;
    this.state = 'transition';
    this.clearOverlay();
    this.clearEntities();
    this.levelText.text = `LV ${idx + 1}/${this.levels.length}`;
    this.saveProgress(idx);

    // Level banner
    const banner = this.bigTitle(`LEVEL ${idx + 1}`, NEON[idx % NEON.length], 480, 110);
    const name = new Text({ text: level.name.toUpperCase(), style: { ...chunkyStyle(36, 0xffffff, 5), letterSpacing: 6 } });
    name.anchor.set(0.5);
    name.position.set(W / 2, 580);
    name.alpha = 0;
    this.overlay.addChild(banner, name);
    banner.scale.set(0);
    tween(0.6, (t) => !banner.destroyed && banner.scale.set(t), { ease: Ease.outBack });
    tween(0.35, (t) => !name.destroyed && (name.alpha = t), { delay: 0.25 });
    tween(0.4, (t) => {
      if (!banner.destroyed) banner.alpha = 1 - t;
      if (!name.destroyed) name.alpha = 1 - t;
    }, {
      delay: 1.5,
      onComplete: () => this.clearOverlay(),
    });

    this.buildBricks(level);
    this.spawnBall(true);

    // playing (ball stuck) once cascade lands
    this.pendingLaunch = false;
    tween(0.01, () => {}, {
      delay: 1.2,
      onComplete: () => {
        if (this.state === 'transition') {
          this.state = 'playing';
          if (this.pendingLaunch) {
            this.pendingLaunch = false;
            this.launchStuckBalls();
          }
        }
      },
    });
  }

  private buildBricks(level: LevelDef): void {
    const fieldW = FIELD_R - FIELD_L;
    const bw = (fieldW - BRICK_GAP * (level.cols + 1)) / level.cols;
    level.grid.forEach((row, r) => {
      row.forEach((spec, c) => {
        if (!spec) return;
        const x = FIELD_L + BRICK_GAP + c * (bw + BRICK_GAP) + bw / 2;
        const y = BRICK_TOP + r * (BRICK_H + BRICK_GAP) + BRICK_H / 2;
        const cont = new Container();
        const body = new Sprite(this.tex.brick);
        body.anchor.set(0.5);
        body.width = bw;
        body.height = BRICK_H;
        body.tint = spec.color;
        const shine = new Sprite(this.tex.brickShine);
        shine.anchor.set(0.5);
        shine.width = bw;
        shine.height = BRICK_H;
        const crack = new Sprite(this.tex.crack1);
        crack.anchor.set(0.5);
        crack.width = bw;
        crack.height = BRICK_H;
        crack.visible = false;
        cont.addChild(body, shine, crack);
        cont.position.set(x, y);
        this.brickLayer.addChild(cont);

        const brick: Brick = { c: cont, body, shine, crack, spec, hp: spec.hp, x, y, w: bw, h: BRICK_H, alive: true };
        this.bricks.push(brick);

        // cascade entrance
        cont.scale.set(0);
        cont.y = y - 60;
        const delay = 0.25 + r * 0.055 + c * 0.018;
        tween(0.45, (t) => {
          if (cont.destroyed) return;
          cont.scale.set(t);
          cont.y = y - 60 * (1 - t);
        }, { ease: Ease.outBack, delay });
      });
    });
  }

  private clearEntities(): void {
    for (const b of this.bricks) b.c.destroy({ children: true });
    this.bricks = [];
    for (const ball of this.balls) ball.c.destroy({ children: true });
    this.balls = [];
    for (const p of this.powerups) p.c.destroy({ children: true });
    this.powerups = [];
    for (const l of this.lasers) l.sp.destroy();
    this.lasers = [];
    this.fxOver.clear();
    this.fxUnder.clear();
    this.wideT = 0;
    this.laserT = 0;
    this.paddleWTarget = 150;
    this.paddleW = 150;
    this.redrawPaddle();
  }

  private spawnBall(stuck: boolean, x?: number, y?: number, angle?: number): Ball {
    const c = new Container();
    const halo = new Sprite(this.tex.glow);
    halo.anchor.set(0.5);
    halo.scale.set(0.62);
    halo.tint = 0x77eeff;
    halo.alpha = 0.85;
    halo.blendMode = 'add';
    const core = new Sprite(this.tex.dot);
    core.anchor.set(0.5);
    core.scale.set(BALL_R / 10);
    core.tint = 0xffffff;
    c.addChild(halo, core);
    this.ballLayer.addChild(c);

    const speed = this.ballSpeedBase;
    const a = angle ?? -Math.PI / 2;
    const ball: Ball = {
      c,
      core,
      halo,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      speed,
      stuck,
      stuckOffset: 0,
    };
    if (stuck) {
      c.position.set(this.paddleX, PADDLE_Y - 24);
    } else {
      c.position.set(x ?? W / 2, y ?? H / 2);
    }
    this.balls.push(ball);
    return ball;
  }

  // ------------------------------------------------------------ input

  onPointerMove(gx: number): void {
    this.paddleTargetX = gx;
  }

  private launchStuckBalls(): void {
    let launched = false;
    for (const b of this.balls) {
      if (b.stuck) {
        b.stuck = false;
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
        b.vx = Math.cos(a) * b.speed;
        b.vy = Math.sin(a) * b.speed;
        launched = true;
      }
    }
    if (launched) {
      audio.launch();
      this.addShake(3);
    }
  }

  onPress(x?: number, y?: number): void {
    audio.unlock();

    // Overlay buttons win over the screen's default tap action.
    if (x !== undefined && y !== undefined) {
      const hit = this.buttons.find((btn) => x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h);
      if (hit) {
        this.clearOverlay();
        hit.action();
        return;
      }
    }

    switch (this.state) {
      case 'start':
        // Tapping anywhere else picks up where you left off.
        this.startGame(this.unlocked);
        break;
      case 'playing':
        this.launchStuckBalls();
        break;
      case 'paused':
        this.resume();
        break;
      case 'gameover':
        this.clearOverlay();
        this.startGame(this.levelIndex);
        break;
      case 'win':
        this.clearOverlay();
        this.startGame(0);
        break;
      case 'transition':
        // buffer the press — launch as soon as the level intro finishes
        this.pendingLaunch = true;
        break;
    }
  }

  pause(): void {
    if (this.state === 'playing' || this.state === 'transition') {
      this.pausedFrom = this.state;
      this.state = 'paused';
      this.clearOverlay();
      this.overlay.addChild(this.dimPanel());
      const t = this.bigTitle('PAUSED', 0x00f5ff, 540, 100);
      this.overlay.addChild(t);
      const sub = new Text({ text: 'CLICK / TAP TO RESUME', style: chunkyStyle(28, 0xffee32, 5) });
      sub.anchor.set(0.5);
      sub.position.set(W / 2, 660);
      this.overlay.addChild(sub);
      this.blink(sub);
    }
  }

  private resume(): void {
    this.clearOverlay();
    this.state = this.pausedFrom === 'transition' ? 'playing' : this.pausedFrom;
  }

  // ------------------------------------------------------------ juice helpers

  private addShake(mag: number): void {
    this.shakeMag = Math.min(26, Math.max(this.shakeMag, mag));
  }

  private hitStop(sec: number): void {
    this.freeze = Math.max(this.freeze, sec);
  }

  private flash(alpha: number, dur = 0.25): void {
    this.flashRect.alpha = Math.max(this.flashRect.alpha, alpha);
    tweenProps(this.flashRect, { alpha: 0 }, dur, { ease: Ease.outQuad });
  }

  private rgbKick(amount: number): void {
    this.rgbAmt = Math.max(this.rgbAmt, amount);
  }

  private shockwave(x: number, y: number): void {
    this.shock.center = { x, y };
    this.shock.time = 0;
    this.shockActive = true;
  }

  private ringBurst(x: number, y: number, color: number, scale = 1): void {
    this.fxOver.spawn(this.tex.ring, x, y, {
      life: 0.45,
      tint: color,
      scaleFrom: 0.15 * scale,
      scaleTo: 1.7 * scale,
      alpha: 0.9,
      fadePow: 1.2,
      rotation: 0,
    });
  }

  private scorePopup(x: number, y: number, amount: number, color: number): void {
    const t = new Text({ text: `+${amount}`, style: chunkyStyle(26, color, 4) });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.shakeRoot.addChild(t);
    tween(0.7, (p) => {
      if (t.destroyed) return;
      t.y = y - 55 * p;
      t.alpha = 1 - p * p;
      t.scale.set(1 + p * 0.3);
    }, {
      ease: Ease.outQuad,
      onComplete: () => !t.destroyed && t.destroy(),
    });
  }

  private brickShatter(brick: Brick): void {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 340;
      this.fxOver.spawn(this.tex.shard, brick.x + (Math.random() - 0.5) * brick.w, brick.y + (Math.random() - 0.5) * brick.h, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 120,
        vr: (Math.random() - 0.5) * 18,
        gravity: 900,
        life: 0.55 + Math.random() * 0.5,
        tint: Math.random() < 0.3 ? 0xffffff : brick.spec.color,
        scaleFrom: 0.7 + Math.random() * 0.9,
        scaleTo: 0.2,
        fadePow: 0.8,
      });
    }
    // sparks
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 200 + Math.random() * 300;
      this.fxOver.spawn(this.tex.dot, brick.x, brick.y, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        drag: 3,
        life: 0.3 + Math.random() * 0.25,
        tint: 0xffffff,
        scaleFrom: 0.35,
        scaleTo: 0.05,
      });
    }
    this.ringBurst(brick.x, brick.y, brick.spec.color, 0.9 + Math.min(this.combo, 10) * 0.06);
  }

  // ------------------------------------------------------------ scoring

  private addScore(base: number, x: number, y: number, color: number): void {
    const mult = Math.max(1, this.combo);
    const amount = base * mult;
    this.score += amount;
    this.scorePopup(x, y, amount, color);
  }

  private onBrickDestroyed(brick: Brick, byLaser = false): void {
    brick.alive = false;
    brick.c.destroy({ children: true });
    if (!byLaser) {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    }
    this.addScore(50, brick.x, brick.y, brick.spec.color);
    this.brickShatter(brick);
    this.addShake(2 + Math.min(this.combo, 12) * 0.7);
    audio.brickBreak(this.combo);
    if (this.combo >= 4 && this.combo % 4 === 0) this.rgbKick(4 + this.combo * 0.4);
    if (this.combo >= 6) this.hitStop(0.02);

    // powerup drop
    if (Math.random() < POWERUP_CHANCE) this.dropPowerUp(brick.x, brick.y);

    // level clear?
    if (this.bricks.every((b) => !b.alive)) this.onLevelClear();
  }

  private onLevelClear(): void {
    audio.levelClear();
    this.flash(0.5, 0.5);
    this.shockwave(W / 2, H / 2);
    this.addShake(12);
    this.combo = 0;
    const next = this.levelIndex + 1;
    this.saveBest();
    // small pause then next level / win
    this.state = 'transition';
    tween(0.01, () => {}, {
      delay: 1.0,
      onComplete: () => {
        if (next >= this.levels.length) {
          this.clearEntities();
          this.showEndScreen(true);
        } else {
          this.loadLevel(next);
        }
      },
    });
  }

  private saveProgress(idx: number): void {
    if (idx <= this.unlocked) return;
    this.unlocked = idx;
    try {
      localStorage.setItem('neon-bricks-progress', String(idx));
    } catch {
      // private browsing / storage full — progress just won't persist
    }
  }

  private saveBest(): void {
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem('neon-bricks-best', String(this.best));
      this.bestText.text = `BEST ${this.best}`;
    }
  }

  // ------------------------------------------------------------ powerups

  private dropPowerUp(x: number, y: number): void {
    const types: PowerType[] = ['wide', 'multi', 'laser'];
    const type = types[Math.floor(Math.random() * types.length)];
    const info = POWER_INFO[type];
    const c = new Container();
    const glow = new Sprite(this.tex.glow);
    glow.anchor.set(0.5);
    glow.scale.set(0.75);
    glow.tint = info.color;
    glow.alpha = 0.7;
    glow.blendMode = 'add';
    const capsule = new Graphics();
    capsule.roundRect(-30, -18, 60, 36, 14).fill({ color: darken(info.color, 0.22), alpha: 0.96 });
    capsule.roundRect(-30, -18, 60, 36, 14).stroke({ width: 3.5, color: info.color });
    const label = new Text({ text: info.label, style: chunkyStyle(26, info.color) });
    label.anchor.set(0.5);
    label.position.set(0, 1);
    c.addChild(glow, capsule, label);
    c.position.set(x, y);
    this.world.addChild(c);
    this.powerups.push({ c, type, vy: 60, spin: Math.random() * Math.PI * 2 });
  }

  private collectPowerUp(p: PowerUp): void {
    audio.powerUp();
    const info = POWER_INFO[p.type];
    this.ringBurst(this.paddleX, PADDLE_Y, info.color, 1.4);
    this.flash(0.18, 0.3);
    this.addShake(5);
    this.scoreTagline(info, p.type);
    switch (p.type) {
      case 'wide':
        this.wideT = 10;
        this.paddleWTarget = 225;
        break;
      case 'multi': {
        const src = this.balls.filter((b) => !b.stuck);
        const list = src.length > 0 ? src : this.balls;
        for (const b of list) {
          if (this.balls.length >= MAX_BALLS) break;
          const baseA = Math.atan2(b.vy, b.vx);
          for (const da of [-0.5, 0.5]) {
            if (this.balls.length >= MAX_BALLS) break;
            const nb = this.spawnBall(false, b.c.x, b.c.y, baseA + da);
            nb.speed = b.speed;
            nb.vx = Math.cos(baseA + da) * b.speed;
            nb.vy = Math.sin(baseA + da) * b.speed;
            if (nb.vy > -80 && nb.vy < 80) nb.vy = -120; // keep them lively
          }
        }
        this.shockwave(this.paddleX, PADDLE_Y);
        break;
      }
      case 'laser':
        this.laserT = 8;
        this.redrawPaddle();
        break;
    }
  }

  private scoreTagline(info: { color: number }, type: PowerType): void {
    const names: Record<PowerType, string> = { wide: 'WIDE PADDLE!', multi: 'MULTI-BALL!', laser: 'LASERS!' };
    const t = new Text({ text: names[type], style: { ...chunkyStyle(46, info.color, 7), letterSpacing: 2 } });
    t.anchor.set(0.5);
    t.position.set(W / 2, 880);
    this.shakeRoot.addChild(t);
    t.scale.set(0);
    tween(0.5, (p) => !t.destroyed && t.scale.set(p), { ease: Ease.outBack });
    tween(0.3, (p) => !t.destroyed && (t.alpha = 1 - p), {
      delay: 1.0,
      onComplete: () => !t.destroyed && t.destroy(),
    });
  }

  private fireLasers(): void {
    audio.laser();
    const w = this.paddleW;
    for (const sx of [-1, 1]) {
      const sp = new Sprite(this.tex.dot);
      sp.anchor.set(0.5);
      sp.scale.set(0.4, 2.4);
      sp.tint = 0xff5533;
      sp.blendMode = 'add';
      const x = this.paddleX + sx * (w / 2 - 16);
      sp.position.set(x, PADDLE_Y - 34);
      this.world.addChild(sp);
      this.lasers.push({ sp, x, y: PADDLE_Y - 34 });
      this.fxOver.spawn(this.tex.glow, x, PADDLE_Y - 30, {
        life: 0.2,
        tint: 0xffaa66,
        scaleFrom: 0.3,
        scaleTo: 0.05,
      });
    }
  }

  // ------------------------------------------------------------ life / death

  private loseLife(): void {
    this.lives--;
    this.combo = 0;
    audio.lifeLost();
    this.flash(0.35, 0.4);
    this.addShake(14);
    this.rgbKick(10);
    this.hitStop(0.12);

    // pop the heart
    const heart = this.hearts[this.lives];
    if (heart) {
      const hx = heart.x;
      tween(0.5, (t) => {
        if (heart.destroyed) return;
        heart.scale.set(1 + t * 1.6);
        heart.alpha = 1 - t;
        heart.x = hx;
      }, {
        ease: Ease.outCubic,
        onComplete: () => {
          if (!heart.destroyed) {
            heart.visible = false;
            heart.scale.set(1);
            heart.alpha = 1;
          }
        },
      });
    }

    if (this.lives <= 0) {
      this.saveBest();
      this.state = 'transition';
      tween(0.01, () => {}, {
        delay: 0.8,
        onComplete: () => {
          this.clearEntities();
          this.showEndScreen(false);
        },
      });
    } else {
      this.spawnBall(true);
    }
  }

  // ------------------------------------------------------------ update loop

  update(rawDt: number): void {
    this.time += rawDt;
    updateTweens(rawDt);

    // hitstop freezes the world but not tweens/UI
    if (this.freeze > 0) {
      this.freeze -= rawDt;
      this.updateJuice(rawDt);
      return;
    }

    const dt = Math.min(rawDt, 1 / 30);

    // background energy follows combo
    const energy = Math.min(1, this.combo / 12);
    this.bg.energy += (energy - this.bg.energy) * Math.min(1, dt * 3);
    this.bg.update(dt);
    audio.intensity = this.bg.energy;
    this.bloom.brightness = 1.0 + this.bg.energy * 0.16;
    this.bloom.bloomScale = 0.9 + this.bg.energy * 0.3;

    this.fxUnder.update(dt);
    this.fxOver.update(dt);
    this.updateJuice(dt);
    this.updateHud(dt);

    if (this.state !== 'playing' && this.state !== 'transition') return;

    // paddle
    const halfW = this.paddleW / 2;
    const targetX = Math.max(FIELD_L + halfW, Math.min(FIELD_R - halfW, this.paddleTargetX));
    const prevX = this.paddleX;
    this.paddleX += (targetX - this.paddleX) * Math.min(1, dt * 18);
    const paddleVel = (this.paddleX - prevX) / Math.max(dt, 0.0001);
    this.paddle.x = this.paddleX;
    // lean into movement
    this.paddle.rotation = Math.max(-0.09, Math.min(0.09, paddleVel * 0.00006));
    if (Math.abs(this.paddleW - this.paddleWTarget) > 0.5) {
      this.paddleW += (this.paddleWTarget - this.paddleW) * Math.min(1, dt * 8);
      this.redrawPaddle();
    }

    // powerup timers
    if (this.wideT > 0) {
      this.wideT -= dt;
      if (this.wideT <= 0) this.paddleWTarget = 150;
    }
    if (this.laserT > 0) {
      this.laserT -= dt;
      this.laserCooldown -= dt;
      if (this.laserCooldown <= 0 && this.state === 'playing') {
        const anyLive = this.balls.some((b) => !b.stuck);
        if (anyLive) {
          this.fireLasers();
          this.laserCooldown = 0.38;
        }
      }
      if (this.laserT <= 0) this.redrawPaddle();
    }

    if (this.state !== 'playing') {
      // during transition, still park stuck balls on the paddle
      for (const b of this.balls) if (b.stuck) b.c.position.set(this.paddleX + b.stuckOffset, PADDLE_Y - 24);
      return;
    }

    this.updateBalls(dt);
    this.updateLasers(dt);
    this.updatePowerUps(dt);
  }

  private updateJuice(dt: number): void {
    // screen shake
    if (this.shakeMag > 0.1) {
      this.shakeRoot.position.set(
        (Math.random() - 0.5) * 2 * this.shakeMag,
        (Math.random() - 0.5) * 2 * this.shakeMag,
      );
      this.shakeMag *= Math.pow(0.0015, dt); // fast decay
    } else {
      this.shakeRoot.position.set(0, 0);
      this.shakeMag = 0;
    }

    // rgb split decay
    const filters: any[] = [this.bloom];
    if (this.rgbAmt > 0.15) {
      const a = this.rgbAmt;
      this.rgb.red = { x: a, y: 0 };
      this.rgb.blue = { x: -a, y: a * 0.4 };
      this.rgb.green = { x: 0, y: -a * 0.4 };
      filters.push(this.rgb);
      this.rgbAmt *= Math.pow(0.005, dt);
    } else {
      this.rgbAmt = 0;
    }

    // shockwave
    if (this.shockActive) {
      this.shock.time += dt;
      if (this.shock.time > 1.1) {
        this.shockActive = false;
      } else {
        filters.push(this.shock);
      }
    }
    this.app.stage.filters = filters;
  }

  private updateHud(dt: number): void {
    // score ticker
    if (this.displayScore !== this.score) {
      const diff = this.score - this.displayScore;
      this.displayScore += Math.ceil(Math.abs(diff) * Math.min(1, dt * 10)) * Math.sign(diff);
      this.scoreText.text = String(this.displayScore);
      this.scoreText.scale.set(1.12);
    }
    this.scoreText.scale.set(Math.max(1, this.scoreText.scale.x - dt * 0.6));

    // combo meter
    if (this.combo >= 2) {
      this.comboText.text = `COMBO x${this.combo}`;
      this.comboText.visible = true;
      const pulse = 1 + Math.min(this.combo, 14) * 0.012 + Math.sin(this.time * 10) * 0.03 * Math.min(1, this.combo / 6);
      this.comboText.scale.set(pulse);
      const e = Math.min(1, this.combo / 12);
      this.comboText.tint = e > 0.7 ? 0xff2d95 : e > 0.35 ? 0xffee32 : 0xffffff;
      this.comboBar.clear();
      this.comboBar
        .roundRect(W / 2 - 120, 58, 240, 8, 4)
        .fill({ color: 0x101038, alpha: 0.9 })
        .roundRect(W / 2 - 120, 58, 240 * e, 8, 4)
        .fill({ color: 0x00f5ff, alpha: 0.95 });
      this.levelText.position.set(W / 2, 74);
    } else {
      this.comboText.visible = false;
      this.comboBar.clear();
      this.levelText.position.set(W / 2, 40);
    }
  }

  // ------------------------------------------------------------ balls & physics

  private updateBalls(dt: number): void {
    for (let bi = this.balls.length - 1; bi >= 0; bi--) {
      const ball = this.balls[bi];
      if (ball.stuck) {
        ball.c.position.set(this.paddleX + ball.stuckOffset, PADDLE_Y - 24);
        ball.halo.alpha = 0.7 + Math.sin(this.time * 6) * 0.2;
        continue;
      }

      // substep to avoid tunneling
      const dist = ball.speed * dt;
      const steps = Math.max(1, Math.ceil(dist / 9));
      const sdt = dt / steps;
      let died = false;
      for (let s = 0; s < steps && !died; s++) {
        ball.c.x += ball.vx * sdt;
        ball.c.y += ball.vy * sdt;
        this.collideWalls(ball);
        this.collidePaddle(ball);
        if (this.collideBricks(ball)) break; // brick hit consumed this step
        if (ball.c.y > H + 40) died = true;
      }

      if (died) {
        ball.c.destroy({ children: true });
        this.balls.splice(bi, 1);
        if (this.balls.length === 0) this.loseLife();
        continue;
      }

      // trail
      const speedN = Math.min(1, ball.speed / 900);
      this.fxUnder.spawn(this.tex.glow, ball.c.x, ball.c.y, {
        life: 0.38,
        tint: 0x33ddff,
        scaleFrom: 0.62,
        scaleTo: 0.05,
        alpha: 0.8,
        fadePow: 1.3,
      });
      this.fxUnder.spawn(this.tex.dot, ball.c.x, ball.c.y, {
        life: 0.16,
        tint: 0xffffff,
        scaleFrom: 0.75,
        scaleTo: 0.15,
        alpha: 0.9,
      });

      // stretch along velocity
      const stretch = 1 + speedN * 0.25;
      ball.c.rotation = Math.atan2(ball.vy, ball.vx);
      ball.core.scale.set((BALL_R / 10) * stretch, (BALL_R / 10) / Math.sqrt(stretch));
      ball.halo.alpha = 0.7 + speedN * 0.25;
    }
  }

  private collideWalls(ball: Ball): void {
    let bounced = false;
    if (ball.c.x < FIELD_L + BALL_R) {
      ball.c.x = FIELD_L + BALL_R;
      ball.vx = Math.abs(ball.vx);
      bounced = true;
    } else if (ball.c.x > FIELD_R - BALL_R) {
      ball.c.x = FIELD_R - BALL_R;
      ball.vx = -Math.abs(ball.vx);
      bounced = true;
    }
    if (ball.c.y < FIELD_T + BALL_R) {
      ball.c.y = FIELD_T + BALL_R;
      ball.vy = Math.abs(ball.vy);
      bounced = true;
    }
    if (bounced) {
      audio.wallHit();
      this.fxOver.spawn(this.tex.glow, ball.c.x, ball.c.y, {
        life: 0.22,
        tint: 0x4d6cff,
        scaleFrom: 0.5,
        scaleTo: 0.1,
        alpha: 0.8,
      });
    }
  }

  private collidePaddle(ball: Ball): void {
    if (ball.vy <= 0) return;
    const halfW = this.paddleW / 2;
    const px = this.paddleX;
    if (
      ball.c.y + BALL_R >= PADDLE_Y - 13 &&
      ball.c.y - BALL_R <= PADDLE_Y + 13 &&
      ball.c.x >= px - halfW - BALL_R &&
      ball.c.x <= px + halfW + BALL_R
    ) {
      ball.c.y = PADDLE_Y - 13 - BALL_R;
      const offset = Math.max(-1, Math.min(1, (ball.c.x - px) / halfW));
      const maxAngle = (72 * Math.PI) / 180;
      const a = -Math.PI / 2 + offset * maxAngle;
      // speed up slightly each paddle hit
      ball.speed = Math.min(980, ball.speed * 1.02);
      ball.vx = Math.cos(a) * ball.speed;
      ball.vy = Math.sin(a) * ball.speed;

      // juice
      const hadCombo = this.combo;
      this.combo = 0;
      if (hadCombo >= 6) this.rgbKick(3);
      audio.paddleHit();
      this.addShake(2.5);
      this.hitStop(0.03);
      this.paddleSquash();
      this.ringBurst(ball.c.x, PADDLE_Y - 10, 0x00f5ff, 0.6);
      this.fxOver.spawn(this.tex.glow, ball.c.x, PADDLE_Y - 12, {
        life: 0.25,
        tint: 0xffffff,
        scaleFrom: 0.7,
        scaleTo: 0.1,
        alpha: 0.9,
      });
    }
  }

  private paddleSquash(): void {
    tween(0.28, (t) => {
      const s = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
      this.paddle.scale.set(1 + 0.22 * s, 1 - 0.3 * s);
    }, { ease: Ease.linear, onComplete: () => this.paddle.scale.set(1, 1) });
  }

  private collideBricks(ball: Ball): boolean {
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      const hw = brick.w / 2 + BALL_R;
      const hh = brick.h / 2 + BALL_R;
      const dx = ball.c.x - brick.x;
      const dy = ball.c.y - brick.y;
      if (Math.abs(dx) > hw || Math.abs(dy) > hh) continue;

      // resolve on the shallow axis
      const overlapX = hw - Math.abs(dx);
      const overlapY = hh - Math.abs(dy);
      if (overlapX < overlapY) {
        ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
        ball.c.x += dx > 0 ? overlapX : -overlapX;
      } else {
        ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
        ball.c.y += dy > 0 ? overlapY : -overlapY;
      }

      this.damageBrick(brick);
      return true;
    }
    return false;
  }

  private damageBrick(brick: Brick, byLaser = false): void {
    brick.hp--;
    if (brick.hp <= 0) {
      this.onBrickDestroyed(brick, byLaser);
      return;
    }
    // damaged state: darker tint + cracks + flash + wobble
    audio.brickHit(this.combo);
    const f = 0.45 + 0.55 * (brick.hp / brick.spec.hp);
    brick.body.tint = darken(brick.spec.color, f);
    brick.crack.visible = true;
    brick.crack.texture = brick.hp === 1 ? this.tex.crack2 : this.tex.crack1;
    this.addShake(1.5);
    // impact flash
    const flash = new Sprite(this.tex.brick);
    flash.anchor.set(0.5);
    flash.width = brick.w;
    flash.height = brick.h;
    flash.tint = 0xffffff;
    flash.blendMode = 'add';
    brick.c.addChild(flash);
    tween(0.18, (t) => {
      if (!flash.destroyed) flash.alpha = 1 - t;
    }, { onComplete: () => !flash.destroyed && flash.destroy() });
    // wobble
    const bx = brick.c.x;
    tween(0.22, (t) => {
      if (!brick.c.destroyed) brick.c.x = bx + Math.sin(t * Math.PI * 4) * 4 * (1 - t);
    }, { ease: Ease.linear, onComplete: () => { if (!brick.c.destroyed) brick.c.x = bx; } });
    this.fxOver.spawn(this.tex.dot, brick.x, brick.y, {
      life: 0.2,
      tint: 0xffffff,
      scaleFrom: 0.5,
      scaleTo: 0.1,
    });
  }

  private updateLasers(dt: number): void {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.y -= 1300 * dt;
      l.sp.y = l.y;
      let dead = l.y < FIELD_T;
      if (!dead) {
        for (const brick of this.bricks) {
          if (!brick.alive) continue;
          if (Math.abs(l.x - brick.x) < brick.w / 2 + 4 && Math.abs(l.y - brick.y) < brick.h / 2 + 14) {
            this.damageBrick(brick, true);
            this.fxOver.spawn(this.tex.glow, l.x, brick.y + brick.h / 2, {
              life: 0.2,
              tint: 0xff8855,
              scaleFrom: 0.5,
              scaleTo: 0.1,
            });
            dead = true;
            break;
          }
        }
      }
      if (dead) {
        l.sp.destroy();
        this.lasers.splice(i, 1);
      }
    }
  }

  private updatePowerUps(dt: number): void {
    const halfW = this.paddleW / 2;
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.vy = Math.min(320, p.vy + 260 * dt);
      p.c.y += p.vy * dt;
      p.spin += dt * 3;
      p.c.rotation = Math.sin(p.spin) * 0.18;
      p.c.scale.set(1 + Math.sin(p.spin * 2) * 0.06);

      const caught =
        p.c.y > PADDLE_Y - 26 &&
        p.c.y < PADDLE_Y + 26 &&
        Math.abs(p.c.x - this.paddleX) < halfW + 26;
      if (caught) {
        this.collectPowerUp(p);
        p.c.destroy({ children: true });
        this.powerups.splice(i, 1);
      } else if (p.c.y > H + 40) {
        p.c.destroy({ children: true });
        this.powerups.splice(i, 1);
      }
    }
  }

  /** Exposed for smoke tests / debugging. */
  get currentState(): string {
    return this.state;
  }

  get ballCount(): number {
    return this.balls.length;
  }

  get currentScore(): number {
    return this.score;
  }

  get debugBallPos(): { x: number; y: number; stuck: boolean } | null {
    const b = this.balls[0];
    return b ? { x: b.c.x, y: b.c.y, stuck: b.stuck } : null;
  }

  debugLoadLevel(n: number): void {
    if (n >= 0 && n < this.levels.length) this.loadLevel(n);
  }

  get debugLevelInfo(): { index: number; name: string; bricks: number; hits: number; top: number; bottom: number } {
    const live = this.bricks.filter((b) => b.alive);
    return {
      index: this.levelIndex,
      name: this.levels[this.levelIndex].name,
      bricks: live.length,
      hits: live.reduce((s, b) => s + b.hp, 0),
      top: live.length ? Math.min(...live.map((b) => b.y - b.h / 2)) : 0,
      bottom: live.length ? Math.max(...live.map((b) => b.y + b.h / 2)) : 0,
    };
  }

  destroy(): void {
    killAllTweens();
  }
}
