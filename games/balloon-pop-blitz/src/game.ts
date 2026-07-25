/**
 * Balloon Pop Blitz v2 — game logic, HUD, screens, juice.
 *
 * Preserves v1's identity: balloons rise, tap to pop, escapes cost one of
 * 3 lives, level = score/30, cyan = slow-motion, gold = multi-pop,
 * best score in localStorage 'bpb-hs'. Adds combo multiplier, striped
 * speedster, rainbow combo balloon, and a bomb balloon to avoid.
 */

import { Application, Container, Graphics, Sprite, Text, TextStyleOptions, Texture } from 'pixi.js';
import { AdvancedBloomFilter, ShockwaveFilter } from 'pixi-filters';
import { audio } from './audio';
import { GameTextures, makeTextures, ParticleSystem, SunnyBackground } from './fx';
import { bakeBalloonTextures, Balloon, BalloonKind, BOMB_KIND, pickKind, PowerUpId } from './balloons';
import { Ease, killAllTweens, tween, updateTweens } from './tween';

type Phase = 'menu' | 'playing' | 'gameover';

const HS_KEY = 'bpb-hs';
const COMBO_WINDOW = 1.6;
const CONFETTI_COLORS = [0xff5c5c, 0xff9e2e, 0xffd23a, 0x3fc24e, 0x3d9bff, 0xae58ff, 0xff66ae, 0xffffff];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function chunkyStyle(size: number, fill: number | string, stroke?: number, strokeW = 0): TextStyleOptions {
  return {
    fontFamily: '"Trebuchet MS", "Comic Sans MS", Verdana, sans-serif',
    fontSize: size,
    fontWeight: '900',
    fill,
    ...(strokeW > 0 ? { stroke: { color: stroke ?? 0x2b4a6b, width: strokeW, join: 'round' } } : {}),
  };
}

const ENCOURAGE = [
  'Great popping!',
  'Wow — quick fingers!',
  'The sky ran out of balloons!',
  'So close! One more go?',
  'Pop-tastic effort!',
  'You made the sun smile!',
];

export class Game {
  private app: Application;
  private tex: GameTextures;
  private balloonTex: Map<string, Texture>;

  // layers
  private bg: SunnyBackground;
  /** sky + gameplay; the shockwave ripples this, never the HUD */
  private scene = new Container();
  private world = new Container();
  private balloonLayer = new Container();
  private fxLayer = new Container();
  private hud = new Container();
  private overlay = new Container();
  private particles = new ParticleSystem(900);
  private flashRect = new Graphics();

  // filters
  private bloom: AdvancedBloomFilter;
  private shock: ShockwaveFilter;
  private shockActive = false;

  // state
  phase: Phase = 'menu';
  paused = false;
  score = 0;
  lives = 3;
  level = 1;
  combo = 0;
  private comboTimer = 0;
  best = 0;
  private newBest = false;
  private balloons: Balloon[] = [];
  private spawnTimer = 0.6;
  private pu: PowerUpId | null = null;
  private puTime = 0;
  private dilationTimer = 0;
  private dilation = 1;
  private shakeAmp = 0;
  private shakeT = 0;
  private t = 0;
  private displayScore = 0;

  private w: number;
  private h: number;

  // HUD nodes
  private scorePanel = new Graphics();
  private scoreText!: Text;
  private bestHudText!: Text;
  private heartSprites: Sprite[] = [];
  private heartPanel = new Graphics();
  private levelText!: Text;
  private levelPanel = new Graphics();
  private comboText!: Text;
  private comboBar = new Graphics();
  private muteBtn = new Container();
  private muteIcon = new Graphics();
  private puBar = new Graphics();
  private puText!: Text;
  private pauseText!: Text;

  // screens
  private menuUI = new Container();
  private overUI = new Container();

  constructor(app: Application) {
    this.app = app;
    this.w = app.screen.width;
    this.h = app.screen.height;
    this.best = parseInt(localStorage.getItem(HS_KEY) ?? '0', 10) || 0;

    this.tex = makeTextures(app.renderer);
    this.balloonTex = bakeBalloonTextures();

    this.bg = new SunnyBackground(this.tex, this.w, this.h);
    this.world.addChild(this.balloonLayer, this.fxLayer);
    this.fxLayer.addChild(this.particles.container);
    this.scene.addChild(this.bg.container, this.world);
    app.stage.addChild(this.scene);
    app.stage.addChild(this.hud);
    app.stage.addChild(this.overlay);
    this.flashRect.alpha = 0;
    app.stage.addChild(this.flashRect);

    // Gentle bloom for a bright scene. It lives on the world layer only —
    // put it on the whole stage and the white sky/UI blows out instantly.
    this.bloom = new AdvancedBloomFilter({
      threshold: 0.85,
      bloomScale: 0.22,
      brightness: 1.0,
      blur: 4,
      quality: 4,
    });
    this.shock = new ShockwaveFilter({
      center: { x: this.w / 2, y: this.h / 2 },
      amplitude: 22,
      wavelength: 160,
      brightness: 1.08,
      radius: 900,
      speed: 1100,
    });
    this.world.filters = [this.bloom];
    this.world.filterArea = app.renderer.screen;

    this.buildHud();
    this.buildMenu();
    this.buildGameOver();
    this.layout();
    this.showMenu();
  }

  /** balloon size unit relative to v1's 400x600 design space */
  private get unit(): number {
    return clamp(Math.min(this.w, this.h) / 560, 0.85, 2.2);
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  private buildHud(): void {
    this.scoreText = new Text({ text: '0', style: chunkyStyle(34, 0x2b4a6b) });
    this.bestHudText = new Text({ text: 'BEST 0', style: chunkyStyle(14, 0x5b7a99) });
    this.levelText = new Text({ text: 'Lv 1', style: chunkyStyle(22, 0xffffff, 0xe2892b, 4) });
    this.comboText = new Text({ text: '', style: chunkyStyle(26, 0xffffff, 0xd8598c, 5) });
    this.puText = new Text({ text: '', style: chunkyStyle(16, 0xffffff, 0x3a76b0, 4) });
    this.pauseText = new Text({ text: 'Paused — tap to continue', style: chunkyStyle(28, 0xffffff, 0x3a76b0, 6) });
    this.pauseText.anchor.set(0.5);
    this.pauseText.visible = false;

    for (let i = 0; i < 3; i++) {
      const hSp = new Sprite(this.tex.heart);
      hSp.anchor.set(0.5);
      hSp.tint = 0xff5470;
      this.heartSprites.push(hSp);
    }

    // mute button
    this.muteBtn.addChild(this.muteIcon);
    this.muteBtn.eventMode = 'static';
    this.muteBtn.cursor = 'pointer';
    this.muteBtn.on('pointerdown', (e) => {
      e.stopPropagation();
      audio.unlock();
      const muted = audio.toggleMuted();
      this.drawMuteIcon(muted);
      this.bump(this.muteBtn);
    });

    this.hud.addChild(
      this.scorePanel, this.scoreText, this.bestHudText,
      this.heartPanel, ...this.heartSprites,
      this.levelPanel, this.levelText,
      this.comboBar, this.comboText,
      this.puBar, this.puText,
      this.muteBtn, this.pauseText,
    );
    this.drawMuteIcon(false);
  }

  private drawMuteIcon(muted: boolean): void {
    const g = this.muteIcon;
    g.clear();
    g.circle(0, 0, 24).fill({ color: 0xffffff, alpha: 0.55 }).stroke({ width: 2.5, color: 0xffffff, alpha: 0.9 });
    // speaker body
    g.poly([-11, -4, -5, -4, 2, -11, 2, 11, -5, 4, -11, 4]).fill(0x2b4a6b);
    if (muted) {
      g.moveTo(7, -7).lineTo(16, 2).moveTo(16, -7).lineTo(7, 2)
        .stroke({ width: 3.5, color: 0xd8598c, cap: 'round' });
    } else {
      g.arc(4, 0, 9, -0.9, 0.9).stroke({ width: 3, color: 0x2b4a6b, cap: 'round' });
      g.arc(4, 0, 14, -0.8, 0.8).stroke({ width: 3, color: 0x2b4a6b, alpha: 0.6, cap: 'round' });
    }
  }

  /** true when the point lands on a HUD control (so taps there don't pop) */
  private hitsHudControl(x: number, y: number): boolean {
    const b = this.muteBtn;
    return Math.hypot(x - b.x, y - b.y) < 32;
  }

  private layoutHud(): void {
    const m = 14;
    const u = clamp(this.unit, 0.9, 1.5);
    // score panel top-left
    const pw = 168 * u;
    const ph = 74 * u;
    this.scorePanel.clear();
    this.scorePanel.roundRect(m, m, pw, ph, 18)
      .fill({ color: 0xffffff, alpha: 0.5 })
      .stroke({ width: 2.5, color: 0xffffff, alpha: 0.8 });
    this.scoreText.style.fontSize = 34 * u;
    this.scoreText.position.set(m + 16 * u, m + 8 * u);
    this.bestHudText.style.fontSize = 14 * u;
    this.bestHudText.position.set(m + 16 * u, m + ph - 24 * u);

    // hearts panel next to it
    const hw = 132 * u;
    this.heartPanel.clear();
    this.heartPanel.roundRect(m + pw + 10, m, hw, ph, 18)
      .fill({ color: 0xffffff, alpha: 0.5 })
      .stroke({ width: 2.5, color: 0xffffff, alpha: 0.8 });
    this.heartSprites.forEach((hSp, i) => {
      hSp.scale.set(1.05 * u);
      hSp.position.set(m + pw + 10 + (26 + i * 40) * u, m + ph / 2);
    });

    // level pill under score
    this.levelText.style.fontSize = 22 * u;
    const lw = this.levelText.width + 30;
    this.levelPanel.clear();
    this.levelPanel.roundRect(m, m + ph + 8, lw, 36 * u, 18 * u)
      .fill({ color: 0xffb648, alpha: 0.92 })
      .stroke({ width: 2.5, color: 0xffffff, alpha: 0.9 });
    this.levelText.position.set(m + 15, m + ph + 8 + 4 * u);

    // combo text below level pill
    this.comboText.position.set(m + 4, m + ph + 8 + 44 * u);

    // mute top-right
    this.muteBtn.position.set(this.w - 40, 40);
    this.muteBtn.scale.set(u);

    this.pauseText.position.set(this.w / 2, this.h / 2);

    // power-up bar bottom center is drawn dynamically in updateHud
  }

  private updateHud(dt: number): void {
    const playing = this.phase === 'playing';
    this.scorePanel.visible = playing;
    this.scoreText.visible = playing;
    this.bestHudText.visible = playing;
    this.heartPanel.visible = playing;
    for (const hSp of this.heartSprites) hSp.renderable = playing;
    this.levelPanel.visible = playing;
    this.levelText.visible = playing;

    // score tick-up
    if (this.displayScore !== this.score) {
      const diff = this.score - this.displayScore;
      this.displayScore += Math.ceil(Math.abs(diff) * Math.min(1, dt * 10)) * Math.sign(diff);
      this.scoreText.text = String(this.displayScore);
    }
    this.bestHudText.text = `BEST ${Math.max(this.best, this.score)}`;

    // combo meter
    const mult = this.multiplier;
    if (this.combo >= 2 && this.phase === 'playing') {
      this.comboText.visible = true;
      this.comboBar.visible = true;
      this.comboText.text = `COMBO x${mult}`;
      const frac = clamp(this.comboTimer / COMBO_WINDOW, 0, 1);
      const bw = 150 * clamp(this.unit, 0.9, 1.5);
      this.comboBar.clear();
      this.comboBar.roundRect(this.comboText.x, this.comboText.y + this.comboText.height + 2, bw, 10, 5)
        .fill({ color: 0xffffff, alpha: 0.35 });
      this.comboBar.roundRect(this.comboText.x, this.comboText.y + this.comboText.height + 2, bw * frac, 10, 5)
        .fill({ color: mult >= 4 ? 0xffd23a : 0xff8ab8, alpha: 0.95 });
    } else {
      this.comboText.visible = false;
      this.comboBar.visible = false;
    }

    // power-up bar
    if (this.pu && this.phase === 'playing') {
      this.puBar.visible = true;
      this.puText.visible = true;
      this.puText.text = this.pu === 'slow' ? 'SLOW MOTION' : 'MULTI-POP';
      const bw = 220;
      const frac = clamp(this.puTime / 5, 0, 1);
      const bx = this.w / 2 - bw / 2;
      const by = this.h - 46;
      this.puBar.clear();
      this.puBar.roundRect(bx - 8, by - 8, bw + 16, 30, 15)
        .fill({ color: 0xffffff, alpha: 0.4 })
        .stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
      this.puBar.roundRect(bx, by, bw * frac, 14, 7)
        .fill({ color: this.pu === 'slow' ? 0x25cff2 : 0xffc322, alpha: 0.95 });
      this.puText.position.set(this.w / 2 - this.puText.width / 2, by - 30);
    } else {
      this.puBar.visible = false;
      this.puText.visible = false;
    }
  }

  private get multiplier(): number {
    return Math.min(5, 1 + Math.floor(this.combo / 4));
  }

  // -------------------------------------------------------------------------
  // Screens
  // -------------------------------------------------------------------------

  private makeButton(label: string, color: number, onTap: () => void): Container {
    const c = new Container();
    const g = new Graphics();
    const txt = new Text({ text: label, style: chunkyStyle(30, 0xffffff, 0x000000, 0) });
    const bw = txt.width + 76;
    const bh = 68;
    g.roundRect(-bw / 2, -bh / 2 + 5, bw, bh, 24).fill({ color: 0x000000, alpha: 0.14 });
    g.roundRect(-bw / 2, -bh / 2, bw, bh, 24)
      .fill(color)
      .stroke({ width: 4, color: 0xffffff, alpha: 0.95 });
    g.roundRect(-bw / 2 + 8, -bh / 2 + 6, bw - 16, 16, 10).fill({ color: 0xffffff, alpha: 0.3 });
    txt.anchor.set(0.5);
    txt.y = -2;
    c.addChild(g, txt);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointerdown', (e) => {
      e.stopPropagation();
      audio.unlock();
      audio.click();
      this.bump(c);
      setTimeout(onTap, 90);
    });
    return c;
  }

  private bump(c: Container): void {
    const sx = c.scale.x;
    tween(0.3, (tt) => c.scale.set(sx * (1 + Math.sin(tt * Math.PI) * 0.12)), { ease: Ease.outQuad });
  }

  private panelCard(w: number, h: number): Graphics {
    const g = new Graphics();
    g.roundRect(-w / 2 + 4, -h / 2 + 8, w, h, 28).fill({ color: 0x53442e, alpha: 0.16 });
    g.roundRect(-w / 2, -h / 2, w, h, 28)
      .fill({ color: 0xfffdf6, alpha: 0.985 })
      .stroke({ width: 4, color: 0xffffff });
    return g;
  }

  private buildMenu(): void {
    const ui = this.menuUI;
    const card = this.panelCard(600, 616);
    ui.addChild(card);

    const title1 = new Text({ text: 'Balloon Pop', style: chunkyStyle(56, 0xff5470, 0xffffff, 0) });
    const title2 = new Text({ text: 'BLITZ!', style: chunkyStyle(64, 0xffb020, 0xffffff, 0) });
    title1.anchor.set(0.5);
    title2.anchor.set(0.5);
    title1.position.set(0, -258);
    title2.position.set(0, -200);
    ui.addChild(title1, title2);
    // idle sway for the title
    tween(9999, () => {
      title2.rotation = Math.sin(this.t * 1.6) * 0.03;
      title1.rotation = Math.sin(this.t * 1.3 + 1) * 0.02;
    }, { ease: Ease.linear });

    const sub = new Text({ text: 'Pop balloons before they float away!', style: chunkyStyle(22, 0x3a5a80) });
    sub.anchor.set(0.5);
    sub.position.set(0, -148);
    ui.addChild(sub);

    // legend: mini balloons with labels
    const rows: [string, string][] = [
      ['striped', 'Stripey — speedy! +6'],
      ['cyan', 'Cyan — slow motion!'],
      ['gold', 'Gold — multi-pop + confetti!'],
      ['rainbow', 'Rainbow — combo boost!'],
      ['bomb', "Bomb — don't pop this one!"],
    ];
    rows.forEach(([id, label], i) => {
      const sp = new Sprite(this.balloonTex.get(id));
      sp.anchor.set(0.5, 0.43);
      sp.scale.set(0.27);
      sp.position.set(-208, -88 + i * 54);
      const txt = new Text({ text: label, style: chunkyStyle(21, 0x3a5a80) });
      txt.anchor.set(0, 0.5);
      txt.position.set(-176, -88 + i * 54);
      ui.addChild(sp, txt);
    });

    const note = new Text({ text: 'Miss a balloon = lose a heart. You have 3!', style: chunkyStyle(17, 0x6f8098) });
    note.anchor.set(0.5);
    note.position.set(0, 178);
    ui.addChild(note);

    const btn = this.makeButton('Start!', 0x4ec65b, () => this.start());
    btn.position.set(0, 240);
    // breathing start button
    tween(9999, () => btn.scale.set(1 + Math.sin(this.t * 2.2) * 0.035), { ease: Ease.linear });
    ui.addChild(btn);

    this.overlay.addChild(ui);
  }

  private overScoreText!: Text;
  private overBestText!: Text;
  private overMsgText!: Text;
  private overNewBest!: Text;

  private buildGameOver(): void {
    const ui = this.overUI;
    const card = this.panelCard(520, 420);
    ui.addChild(card);

    this.overMsgText = new Text({ text: ENCOURAGE[0], style: chunkyStyle(38, 0xff5470) });
    this.overMsgText.anchor.set(0.5);
    this.overMsgText.position.set(0, -140);

    this.overScoreText = new Text({ text: 'Score 0', style: chunkyStyle(52, 0x2b4a6b) });
    this.overScoreText.anchor.set(0.5);
    this.overScoreText.position.set(0, -58);

    this.overNewBest = new Text({ text: 'NEW BEST!', style: chunkyStyle(30, 0xffffff, 0xe2892b, 6) });
    this.overNewBest.anchor.set(0.5);
    this.overNewBest.position.set(0, 4);

    this.overBestText = new Text({ text: 'Best 0', style: chunkyStyle(24, 0x8a94a8) });
    this.overBestText.anchor.set(0.5);
    this.overBestText.position.set(0, 46);

    const btn = this.makeButton('Play Again!', 0xff8a2e, () => this.start());
    btn.position.set(0, 130);
    ui.addChild(this.overMsgText, this.overScoreText, this.overNewBest, this.overBestText, btn);

    this.overlay.addChild(ui);
    ui.visible = false;
  }

  private layoutScreens(): void {
    const s = clamp(Math.min(this.w / 720, this.h / 820), 0.42, 1.0);
    this.menuUI.scale.set(s);
    this.menuUI.position.set(this.w / 2, this.h / 2);
    this.overUI.scale.set(s);
    this.overUI.position.set(this.w / 2, this.h / 2);
  }

  private showMenu(): void {
    this.phase = 'menu';
    this.menuUI.visible = true;
    this.overUI.visible = false;
    this.menuUI.alpha = 0;
    // a few balloons already drifting through the sky behind the card
    for (let i = 0; i < 5; i++) {
      this.spawnBalloon(true);
      const b = this.balloons[this.balloons.length - 1];
      b.root.y = this.h * (0.12 + Math.random() * 0.8);
      b.baseX = b.r + Math.random() * (this.w - b.r * 2);
    }
    tween(0.4, (t) => (this.menuUI.alpha = t), { ease: Ease.outCubic });
  }

  // -------------------------------------------------------------------------
  // Flow
  // -------------------------------------------------------------------------

  start(): void {
    // pop away any menu decor balloons with a little celebration
    for (const b of [...this.balloons]) this.explodeBalloon(b, false);
    this.balloons.length = 0;

    this.phase = 'playing';
    this.paused = false;
    this.score = 0;
    this.displayScore = 0;
    this.scoreText.text = '0';
    this.lives = 3;
    this.level = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.pu = null;
    this.puTime = 0;
    this.spawnTimer = 0.5;
    this.newBest = false;
    this.levelText.text = 'Lv 1';
    this.menuUI.visible = false;
    this.overUI.visible = false;
    for (const hSp of this.heartSprites) {
      hSp.alpha = 1;
      hSp.tint = 0xff5470;
      hSp.scale.set(1.05 * clamp(this.unit, 0.9, 1.5));
    }
    this.layoutHud();
    audio.start();
  }

  private endGame(): void {
    this.phase = 'gameover';
    this.pu = null;
    const prevBest = this.best;
    if (this.score > prevBest) {
      this.best = this.score;
      this.newBest = true;
      localStorage.setItem(HS_KEY, String(this.best));
    }
    audio.gameOver();

    this.overMsgText.text = ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)];
    this.overScoreText.text = `Score ${this.score}`;
    this.overBestText.text = `Best ${this.best}`;
    this.overNewBest.visible = this.newBest;
    if (this.newBest) {
      tween(0.8, (t) => this.overNewBest.scale.set(0.3 + t * 0.7), { ease: Ease.outElastic });
      this.confettiBurst(this.w / 2, this.h * 0.3, 70);
    }
    this.overUI.visible = true;
    this.overUI.alpha = 0;
    tween(0.5, (t) => (this.overUI.alpha = t), { ease: Ease.outCubic, delay: 0.45 });
  }

  setPaused(p: boolean): void {
    if (this.phase !== 'playing') return;
    this.paused = p;
    this.pauseText.visible = p;
  }

  // -------------------------------------------------------------------------
  // Spawning
  // -------------------------------------------------------------------------

  private spawnBalloon(decor = false): void {
    let kind: BalloonKind;
    if (!decor && this.level >= BOMB_KIND.minLevel && Math.random() < Math.min(0.13, 0.045 + this.level * 0.009)) {
      kind = BOMB_KIND;
    } else {
      kind = pickKind(decor ? 1 : this.level);
    }
    const u = this.unit;
    const r = kind.r * u * 1.12;
    const x = r + 8 + Math.random() * (this.w - (r + 8) * 2);
    const y = this.h + r + 30;
    const spd400 = (0.7 + this.level * 0.08 + Math.random() * 0.3) * kind.speedMul * (decor ? 0.55 : 1);
    const speed = spd400 * 60 * (this.h / 600);
    const b = new Balloon(kind, this.balloonTex.get(kind.id)!, x, y, r, speed);
    this.balloonLayer.addChild(b.root);
    this.balloons.push(b);

    // inflate squash-and-stretch
    const bs = b.body.scale.x;
    b.body.scale.set(bs * 0.25);
    b.cancels.push(
      tween(0.55, (t) => {
        b.body.scale.x = bs * (0.25 + 0.75 * t);
        b.body.scale.y = bs * (0.25 + 0.75 * Math.min(1, t * 1.15));
      }, { ease: Ease.outBack }),
    );
  }

  // -------------------------------------------------------------------------
  // Popping
  // -------------------------------------------------------------------------

  /** Route a pointer tap. Returns true if something popped. */
  onPointerDown(x: number, y: number): boolean {
    if (this.paused) {
      this.setPaused(false);
      return false;
    }
    if (this.hitsHudControl(x, y)) return false;
    if (this.phase === 'gameover') return false;
    return this.popAt(x, y);
  }

  /** Pop the topmost balloon at (x, y). Public — also used by the smoke test. */
  popAt(x: number, y: number): boolean {
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      if (b.popped) continue;
      if (b.hitTest(x, y)) {
        if (this.phase === 'menu') {
          this.explodeBalloon(b, true);
          audio.pop(0);
          return true;
        }
        this.handleHit(b);
        return true;
      }
    }
    return false;
  }

  private handleHit(hit: Balloon): void {
    if (hit.kind.special === 'bomb') {
      this.bombPopped(hit);
      return;
    }

    const toPop: Balloon[] = [hit];
    const multiActive = this.pu === 'multi' || hit.kind.special === 'gold';
    if (multiActive) {
      const radius = 92 * this.unit * 1.15;
      for (const b of this.balloons) {
        if (b === hit || b.popped || b.kind.special === 'bomb') continue;
        if (Math.hypot(b.x - hit.x, b.y - hit.y) < radius) toPop.push(b);
      }
    }

    // capture position: the sprite transform is gone once it is destroyed
    const hx = hit.x;
    const hy = hit.y;
    for (const b of toPop) this.scorePop(b);

    // power-up activation (preserved from v1: 5 second window)
    if (hit.kind.pu) {
      this.pu = hit.kind.pu;
      this.puTime = 5;
      if (hit.kind.pu === 'slow') audio.slowmo();
    }

    if (hit.kind.special === 'gold') {
      audio.golden();
      this.goldenBlast(hx, hy);
    } else if (hit.kind.special === 'rainbow') {
      audio.rainbow();
      this.combo += 8; // instant combo boost
      this.comboTimer = COMBO_WINDOW;
      this.rainbowBurst(hx, hy);
    }
  }

  private scorePop(b: Balloon): void {
    this.combo += 1;
    this.comboTimer = COMBO_WINDOW;
    const pts = b.kind.pts * this.multiplier;
    this.score += pts;
    audio.pop(this.combo);

    const newLevel = Math.floor(this.score / 30) + 1;
    if (newLevel !== this.level) {
      this.level = newLevel;
      this.levelText.text = `Lv ${this.level}`;
      this.layoutHud();
      this.levelBanner();
    }

    const px = b.x;
    const py = b.y - b.r * 0.6;
    const gold = b.kind.special === 'gold';
    this.explodeBalloon(b, true);
    this.floatScore(px, py, `+${pts}`, gold ? 0xffd75e : 0xfff6df);
    if (this.multiplier >= 2) {
      tween(0.25, (t) => this.comboText.scale.set(1 + Math.sin(t * Math.PI) * 0.25));
    }
  }

  private bombPopped(balloon: Balloon): void {
    const b = { x: balloon.x, y: balloon.y, r: balloon.r };
    this.removeBalloon(balloon);
    audio.bomb();
    this.combo = 0;
    this.comboTimer = 0;
    const penalty = Math.min(5, this.score);
    this.score -= penalty;
    if (penalty > 0) this.floatScore(b.x, b.y - b.r * 0.6, `-${penalty}`, 0xff7a5c);

    // smoke puffs + dark shreds, soft shake, brief dim
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      this.particles.spawn(this.tex.glow, b.x, b.y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.7 + Math.random() * 0.5,
        tint: 0x3d4048, alpha: 0.5, scaleFrom: 0.5 + Math.random() * 0.5, scaleTo: 1.6,
        drag: 2, fadePow: 1.4,
      });
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 150 + Math.random() * 330;
      this.particles.spawn(i % 2 ? this.tex.shred : this.tex.shred2, b.x, b.y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
        vr: (Math.random() - 0.5) * 14, gravity: 900, life: 0.9,
        tint: 0x2c2f3a, scaleFrom: 0.9, scaleTo: 0.5, fadePow: 0.7,
      });
    }
    this.shake(5);
    this.flash(0x554433, 0.24);
  }

  private explodeBalloon(b: Balloon, fancy: boolean): void {
    const { x, y, r } = b;
    const tint = b.kind.tint;
    this.removeBalloon(b);

    // rubber shreds
    const n = fancy ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = 220 + Math.random() * 380;
      const shredTint = b.kind.special === 'rainbow' ? CONFETTI_COLORS[i % CONFETTI_COLORS.length] : tint;
      this.particles.spawn(i % 2 ? this.tex.shred : this.tex.shred2, x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 160,
        vr: (Math.random() - 0.5) * 18,
        gravity: 1250, drag: 0.6, life: 0.75 + Math.random() * 0.35,
        tint: shredTint, scaleFrom: (0.7 + Math.random() * 0.6) * (r / 34), scaleTo: 0.4 * (r / 34),
        fadePow: 0.6,
      });
    }
    // mist droplets
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 200;
      this.particles.spawn(this.tex.dot, x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        gravity: 500, life: 0.45, tint: 0xffffff, alpha: 0.8,
        scaleFrom: 0.28 * (r / 34), scaleTo: 0.05, fadePow: 1,
      });
    }

    // ring shockwave
    const ring = new Sprite(this.tex.ring);
    ring.anchor.set(0.5);
    ring.position.set(x, y);
    ring.tint = tint;
    ring.blendMode = 'add';
    this.fxLayer.addChild(ring);
    const rScale = (r / 62) * 0.55;
    tween(0.38, (t) => {
      ring.scale.set(rScale + t * rScale * 2.6);
      ring.alpha = 0.85 * (1 - t);
    }, { ease: Ease.outCubic, onComplete: () => { this.fxLayer.removeChild(ring); ring.destroy(); } });

    // brief white flash puff
    const flash = new Sprite(this.tex.glow);
    flash.anchor.set(0.5);
    flash.position.set(x, y);
    flash.blendMode = 'add';
    this.fxLayer.addChild(flash);
    const fScale = r / 40;
    tween(0.22, (t) => {
      flash.scale.set(fScale * (0.6 + t * 1.2));
      flash.alpha = 0.9 * (1 - t);
    }, { onComplete: () => { this.fxLayer.removeChild(flash); flash.destroy(); } });
  }

  private goldenBlast(x: number, y: number): void {
    this.confettiBurst(x, y, 46);
    // slow-mo beat (100ms time dilation)
    this.dilationTimer = 0.1;
    // shockwave filter pulse
    this.shock.center = { x, y };
    (this.shock as unknown as { time: number }).time = 0;
    this.shockActive = true;
    this.applyFilters();
    this.flash(0xfff2c0, 0.18);
    this.shake(3);
  }

  private confettiBurst(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 260 + Math.random() * 480;
      this.particles.spawn(this.tex.confetti, x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        vr: (Math.random() - 0.5) * 16,
        gravity: 820, drag: 1.1, flutter: 60,
        life: 1.3 + Math.random() * 0.9,
        tint: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        scaleFrom: 0.8 + Math.random() * 0.5, scaleTo: 0.7,
        fadePow: 0.45,
      });
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 260;
      this.particles.spawn(this.tex.star4, x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        vr: (Math.random() - 0.5) * 8, gravity: 300, drag: 1.5,
        life: 0.8, tint: 0xffe27a, additive: true,
        scaleFrom: 0.7, scaleTo: 0.1, fadePow: 0.8,
      });
    }
  }

  private rainbowBurst(x: number, y: number): void {
    CONFETTI_COLORS.slice(0, 6).forEach((col, i) => {
      const ring = new Sprite(this.tex.ring);
      ring.anchor.set(0.5);
      ring.position.set(x, y);
      ring.tint = col;
      ring.blendMode = 'add';
      this.fxLayer.addChild(ring);
      tween(0.55, (t) => {
        ring.scale.set(0.3 + t * (1.4 + i * 0.5));
        ring.alpha = 0.7 * (1 - t);
      }, {
        delay: i * 0.05, ease: Ease.outCubic,
        onComplete: () => { this.fxLayer.removeChild(ring); ring.destroy(); },
      });
    });
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 150 + Math.random() * 300;
      this.particles.spawn(this.tex.star4, x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        vr: (Math.random() - 0.5) * 10, drag: 1.6,
        life: 0.9, tint: CONFETTI_COLORS[i % CONFETTI_COLORS.length], additive: true,
        scaleFrom: 0.8, scaleTo: 0.15, fadePow: 0.8,
      });
    }
  }

  private floatScore(x: number, y: number, txt: string, tint: number): void {
    const t = new Text({ text: txt, style: chunkyStyle(32, tint, 0x21456e, 7) });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.fxLayer.addChild(t);
    tween(0.35, (tt) => t.scale.set(0.3 + tt * 0.9), { ease: Ease.outBack });
    tween(0.9, (tt) => {
      t.y = y - tt * 70;
      t.alpha = 1 - Math.pow(tt, 2.2);
    }, { ease: Ease.outQuad, onComplete: () => { this.fxLayer.removeChild(t); t.destroy(); } });
  }

  private levelBanner(): void {
    const t = new Text({ text: `Level ${this.level}!`, style: chunkyStyle(46, 0xffffff, 0xe2892b, 8) });
    t.anchor.set(0.5);
    t.position.set(this.w / 2, this.h * 0.3);
    this.fxLayer.addChild(t);
    tween(0.5, (tt) => t.scale.set(0.2 + tt * 0.8), { ease: Ease.outBack });
    tween(0.6, (tt) => (t.alpha = 1 - tt), {
      delay: 0.8, onComplete: () => { this.fxLayer.removeChild(t); t.destroy(); },
    });
  }

  private removeBalloon(b: Balloon): void {
    if (b.popped && !this.balloons.includes(b)) return;
    b.popped = true;
    for (const c of b.cancels) c();
    b.cancels.length = 0;
    const i = this.balloons.indexOf(b);
    if (i >= 0) this.balloons.splice(i, 1);
    this.balloonLayer.removeChild(b.root);
    b.root.destroy({ children: true });
  }

  private loseLife(): void {
    this.lives -= 1;
    audio.lifeLost();
    const idx = this.lives;
    if (idx >= 0 && idx < this.heartSprites.length) {
      const hSp = this.heartSprites[idx];
      const s0 = hSp.scale.x;
      tween(0.5, (t) => {
        hSp.scale.set(s0 * (1 + Math.sin(t * Math.PI) * 0.8));
        if (t > 0.6) hSp.alpha = 1 - (t - 0.6) / 0.4 * 0.78;
      }, {
        ease: Ease.outQuad,
        onComplete: () => { hSp.alpha = 0.22; hSp.tint = 0x8a94a8; hSp.scale.set(s0); },
      });
    }
    this.flash(0xff9a8a, 0.16);
    if (this.lives <= 0) this.endGame();
  }

  private flash(color: number, alpha: number): void {
    this.flashRect.clear();
    this.flashRect.rect(0, 0, this.w, this.h).fill(color);
    this.flashRect.alpha = alpha;
    tween(0.4, (t) => (this.flashRect.alpha = alpha * (1 - t)));
  }

  private shake(amp: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
  }

  private applyFilters(): void {
    // shockwave rides on the stage (so the sky ripples too); bloom stays
    // on the world layer where it belongs
    this.scene.filters = (this.shockActive ? [this.shock] : []) as never;
    this.scene.filterArea = this.app.renderer.screen;
  }

  // -------------------------------------------------------------------------
  // Frame update
  // -------------------------------------------------------------------------

  update(rawDt: number): void {
    const dt = Math.min(rawDt, 0.05);
    this.t += dt;
    updateTweens(dt);

    // background always breathes; hue drifts with level
    this.bg.progress = clamp((this.level - 1) / 9, 0, 1);
    this.bg.update(dt);

    // shockwave filter lifecycle
    if (this.shockActive) {
      const sh = this.shock as unknown as { time: number };
      sh.time += dt;
      if (sh.time > 1.1) {
        this.shockActive = false;
        this.applyFilters();
      }
    }

    // world shake (very subtle)
    if (this.shakeAmp > 0.1) {
      this.shakeT += dt * 46;
      this.world.position.set(
        Math.sin(this.shakeT * 1.1) * this.shakeAmp,
        Math.cos(this.shakeT * 0.9) * this.shakeAmp * 0.7,
      );
      this.shakeAmp *= Math.max(0, 1 - dt * 6);
    } else {
      this.world.position.set(0, 0);
    }

    if (this.paused) return;

    // golden slow-mo dilation
    if (this.dilationTimer > 0) {
      this.dilationTimer -= dt;
      this.dilation = 0.15;
    } else {
      this.dilation += (1 - this.dilation) * Math.min(1, dt * 9);
    }
    const gdt = dt * this.dilation;

    this.particles.update(gdt);

    if (this.phase === 'menu') {
      // lazy decorative balloons to pop for fun
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.balloons.length < 6) {
        this.spawnBalloon(true);
        this.spawnTimer = 1.4 + Math.random() * 0.8;
      }
      for (let i = this.balloons.length - 1; i >= 0; i--) {
        if (this.balloons[i].update(dt, 1)) this.removeBalloon(this.balloons[i]);
      }
      this.updateHud(dt);
      return;
    }

    if (this.phase === 'gameover') {
      for (let i = this.balloons.length - 1; i >= 0; i--) {
        if (this.balloons[i].update(gdt, 0.4)) this.removeBalloon(this.balloons[i]);
      }
      this.updateHud(dt);
      return;
    }

    // ---- playing ----
    // combo window
    if (this.combo > 0) {
      this.comboTimer -= gdt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    // power-up expiry
    if (this.pu) {
      this.puTime -= gdt;
      if (this.puTime <= 0) this.pu = null;
    }

    // spawn waves — v1 pacing: 1.8s shrinking 0.12s per level, floor 0.4s
    this.spawnTimer -= gdt;
    if (this.spawnTimer <= 0) {
      this.spawnBalloon();
      if (this.level > 3 && Math.random() < 0.3) this.spawnBalloon();
      this.spawnTimer = Math.max(0.4, 1.8 - (this.level - 1) * 0.12);
    }

    // balloons
    const slowScale = this.pu === 'slow' ? 0.3 : 1;
    let escaped = 0;
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      if (b.update(gdt, slowScale)) {
        const isBomb = b.kind.special === 'bomb';
        this.removeBalloon(b);
        if (!isBomb) escaped += 1;
      } else if (b.kind.special === 'bomb' && Math.random() < gdt * 14) {
        // fuse sparks
        this.particles.spawn(this.tex.dot, b.x + b.r * 0.24, b.y - b.r * 0.22, {
          vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 60,
          life: 0.3, tint: 0xffd75e, additive: true,
          scaleFrom: 0.22, scaleTo: 0.03,
        });
      } else if (b.kind.special === 'rainbow' && Math.random() < gdt * 6) {
        this.particles.spawn(this.tex.star4, b.x + (Math.random() - 0.5) * b.r * 1.6, b.y + (Math.random() - 0.5) * b.r * 1.6, {
          vy: -20, life: 0.5, tint: CONFETTI_COLORS[Math.floor(Math.random() * 6)],
          additive: true, scaleFrom: 0.4, scaleTo: 0.05,
        });
      }
    }
    for (let i = 0; i < escaped && this.lives > 0; i++) this.loseLife();

    this.updateHud(dt);
  }

  // -------------------------------------------------------------------------
  // Resize + debug
  // -------------------------------------------------------------------------

  layout(): void {
    this.w = this.app.screen.width;
    this.h = this.app.screen.height;
    this.bg.layout(this.w, this.h);
    this.scene.filterArea = this.app.renderer.screen;
    this.world.filterArea = this.app.renderer.screen;
    this.layoutHud();
    this.layoutScreens();
    // keep in-flight balloons inside the new width
    for (const b of this.balloons) {
      b.baseX = clamp(b.baseX, b.r, this.w - b.r);
    }
  }

  /** Debug hook for smoke tests: force-spawn n balloons, optionally
   *  scattered up the screen instead of all at the bottom edge. */
  debugSpawn(n: number, spread = false): void {
    for (let i = 0; i < n; i++) {
      this.spawnBalloon();
      if (spread) {
        const b = this.balloons[this.balloons.length - 1];
        b.root.y = this.h * (0.12 + Math.random() * 0.78);
      }
    }
  }

  /** Debug hook for smoke tests. */
  debugState(): {
    phase: Phase;
    score: number;
    lives: number;
    level: number;
    combo: number;
    balloons: { x: number; y: number; kind: string }[];
    particles: number;
  } {
    return {
      phase: this.phase,
      score: this.score,
      lives: this.lives,
      level: this.level,
      combo: this.combo,
      balloons: this.balloons.map((b) => ({ x: b.x, y: b.y, kind: b.kind.id })),
      particles: this.particles.count,
    };
  }

  destroy(): void {
    killAllTweens();
  }
}
