import {
  Application,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { Fx } from './fx';
import {
  type EventKind,
  type Phase,
  type Side,
  GOAL_HALF_W,
  PADDLE_R,
  PHASE_COUNTDOWN,
  PHASE_GOAL,
  PHASE_OVER,
  PHASE_PLAY,
  PHASE_WAITING,
  PUCK_R,
  TABLE_H,
  TABLE_W,
  TARGET_SCORE,
} from './shared/rules';

// --- Layout ---------------------------------------------------------------

/** Pixels per table unit. */
const S = 5.4;
const TABLE_PX_W = TABLE_W * S; // 540
const TABLE_PX_H = TABLE_H * S; // 864
const MARGIN_X = 30;
const MARGIN_Y = 58;

export const VIEW_W = TABLE_PX_W + MARGIN_X * 2; // 600
export const VIEW_H = TABLE_PX_H + MARGIN_Y * 2; // 980

const TX = MARGIN_X;
const TY = MARGIN_Y;

const TRAIL_LEN = 12;
/** How far inside the felt the name/pip row sits. */
const PIP_INSET = 38;

// --- Palette --------------------------------------------------------------

const COL_BG = 0x04060f;
const COL_FELT = 0x0b1330;
const COL_FELT_EDGE = 0x142253;
const COL_YOU = 0x3fe8ff;
const COL_OPP = 0xff4f9d;
const COL_PUCK = 0xfff2c4;
const COL_PUCK_GLOW = 0xffb03a;
const COL_LINE = 0x4d7cff;

const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

export interface RenderState {
  puck: { x: number; y: number };
  paddles: [{ x: number; y: number }, { x: number; y: number }];
  scores: [number, number];
  phase: Phase;
  timer: number;
  winner: number;
}

/**
 * Everything on screen is built once and then moved. Rebuilding Pixi Graphics
 * every frame re-tessellates and re-uploads geometry, which was enough to drop
 * a software renderer to single-digit fps.
 */
export class View {
  private readonly world = new Container();
  private readonly bloomLayer = new Container();
  private readonly staticArt = new Graphics();
  private readonly flashOverlay = new Graphics();
  private readonly flashBlob: Sprite;
  private readonly trailSprites: Sprite[] = [];
  private readonly trailPoints: { x: number; y: number }[] = [];
  private readonly paddleNodes: [Container, Container];
  private readonly puckNode = new Container();
  private readonly hud = new Container();
  private readonly bigScore: [Text, Text];
  private readonly pips: [Graphics, Graphics];
  private readonly nameText: [Text, Text];
  private readonly centerText: Text;
  private readonly centerSub: Text;
  private readonly softGlow: Texture;

  readonly fx: Fx;

  private mySide: Side = 0;
  private names: [string, string] = ['You', 'Opponent'];
  private centerPop = 0;
  private goalFlash = 0;
  private goalFlashAtTop = false;
  private lastPips: [number, number] = [-1, -1];

  constructor(private readonly app: Application) {
    this.app.stage.addChild(this.world);

    // One soft radial texture, reused for every glow in the scene.
    const blob = new Graphics();
    for (let i = 12; i >= 1; i--) {
      blob.circle(64, 64, (64 * i) / 12).fill({ color: 0xffffff, alpha: 0.055 });
    }
    this.softGlow = this.app.renderer.generateTexture({ target: blob, resolution: 1 });
    blob.destroy();

    this.buildBackground();

    // Full-resolution: the filter renders the whole layer through itself, so
    // dropping its resolution softens the table lines, not just the glow.
    this.bloomLayer.filters = [
      new AdvancedBloomFilter({
        threshold: 0.4,
        bloomScale: 1.1,
        brightness: 1.0,
        blur: 6,
        quality: 3,
      }),
    ];
    // Without an explicit area Pixi recomputes filter bounds every frame.
    this.bloomLayer.filterArea = new Rectangle(0, 0, VIEW_W, VIEW_H);
    this.world.addChild(this.bloomLayer);

    this.bloomLayer.addChild(this.staticArt);

    // Goal flash: drawn white once, tinted per goal.
    this.flashOverlay.roundRect(TX, TY, TABLE_PX_W, TABLE_PX_H, 26).fill({ color: 0xffffff });
    this.flashOverlay.alpha = 0;
    this.flashBlob = new Sprite(this.softGlow);
    this.flashBlob.anchor.set(0.5);
    this.flashBlob.width = GOAL_HALF_W * S * 3.2;
    this.flashBlob.height = 150;
    this.flashBlob.blendMode = 'add';
    this.flashBlob.alpha = 0;
    this.bloomLayer.addChild(this.flashOverlay, this.flashBlob);

    // Puck trail: pooled sprites rather than a Graphics rebuilt every frame.
    const trailLayer = new Container();
    for (let i = 0; i < TRAIL_LEN; i++) {
      const s = new Sprite(this.softGlow);
      s.anchor.set(0.5);
      s.tint = COL_PUCK_GLOW;
      s.blendMode = 'add';
      s.visible = false;
      trailLayer.addChild(s);
      this.trailSprites.push(s);
    }
    this.bloomLayer.addChild(trailLayer);

    this.paddleNodes = [this.buildPaddle(COL_YOU), this.buildPaddle(COL_OPP)];
    this.buildPuck();
    this.bloomLayer.addChild(this.paddleNodes[0], this.paddleNodes[1], this.puckNode);

    this.fx = new Fx(this.app.renderer, this.bloomLayer);

    this.drawTable();

    // --- HUD (unfiltered, so text stays crisp) ---
    this.world.addChild(this.hud);

    const bigStyle = new TextStyle({
      fontFamily: FONT_STACK,
      fontSize: 300,
      fontWeight: '800',
      fill: 0xffffff,
    });
    this.bigScore = [new Text({ text: '0', style: bigStyle }), new Text({ text: '0', style: bigStyle })];
    for (const t of this.bigScore) {
      t.anchor.set(0.5);
      t.alpha = 0.05;
      this.hud.addChild(t);
    }

    this.pips = [new Graphics(), new Graphics()];
    this.hud.addChild(this.pips[0], this.pips[1]);

    // Each label needs its OWN style object: a TextStyle shared between two
    // Text nodes means recolouring one recolours both.
    const nameStyle = (fill: number): TextStyle =>
      new TextStyle({
        fontFamily: FONT_STACK,
        fontSize: 20,
        fontWeight: '700',
        fill,
        letterSpacing: 1.5,
      });
    this.nameText = [
      new Text({ text: '', style: nameStyle(COL_YOU) }),
      new Text({ text: '', style: nameStyle(COL_OPP) }),
    ];
    this.nameText[0].anchor.set(0, 0.5);
    this.nameText[1].anchor.set(0, 0.5);
    this.hud.addChild(this.nameText[0], this.nameText[1]);

    this.centerText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONT_STACK,
        fontSize: 96,
        fontWeight: '800',
        fill: 0xffffff,
        align: 'center',
      }),
    });
    this.centerText.anchor.set(0.5);
    this.centerText.position.set(VIEW_W / 2, VIEW_H / 2 - 24);

    this.centerSub = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONT_STACK,
        fontSize: 26,
        fontWeight: '600',
        fill: 0xbcd0ff,
        align: 'center',
      }),
    });
    this.centerSub.anchor.set(0.5);
    this.centerSub.position.set(VIEW_W / 2, VIEW_H / 2 + 52);
    this.hud.addChild(this.centerText, this.centerSub);

    this.layoutHud();
  }

  // --- Coordinate transform ------------------------------------------------

  /** Table units → screen pixels, flipped so "your" goal is always at the bottom. */
  private px(x: number, y: number): { x: number; y: number } {
    const fx = this.mySide === 1 ? TABLE_W - x : x;
    const fy = this.mySide === 1 ? TABLE_H - y : y;
    return { x: TX + fx * S, y: TY + fy * S };
  }

  /** Screen pixels → table units, for pointer input. */
  toTable(px: number, py: number): { x: number; y: number } {
    const x = (px - TX) / S;
    const y = (py - TY) / S;
    return this.mySide === 1 ? { x: TABLE_W - x, y: TABLE_H - y } : { x, y };
  }

  setSide(side: Side): void {
    if (side === this.mySide) return;
    this.mySide = side;
    this.trailPoints.length = 0;
    // Colours are assigned by "is this me", so both paddles need repainting.
    this.repaintPaddle(this.paddleNodes[0], side === 0 ? COL_YOU : COL_OPP);
    this.repaintPaddle(this.paddleNodes[1], side === 1 ? COL_YOU : COL_OPP);
    this.drawTable();
    this.lastPips = [-1, -1];
    this.layoutHud();
  }

  setNames(names: [string, string]): void {
    this.names = names;
    this.layoutHud();
  }

  // --- Built-once nodes ----------------------------------------------------

  private buildPaddle(color: number): Container {
    const node = new Container();
    node.addChild(new Graphics());
    this.repaintPaddle(node, color);
    return node;
  }

  private repaintPaddle(node: Container, color: number): void {
    const g = node.children[0] as Graphics;
    const r = PADDLE_R * S;
    g.clear();
    g.circle(0, 5, r * 0.98).fill({ color: 0x000000, alpha: 0.4 });
    g.circle(0, 0, r).fill({ color: 0x0a1230, alpha: 0.95 });
    g.circle(0, 0, r).stroke({ width: 4, color, alpha: 1 });
    g.circle(0, 0, r * 0.62).stroke({ width: 2, color, alpha: 0.55 });
    g.circle(0, 0, r * 0.3).fill({ color, alpha: 0.9 });
    g.circle(-r * 0.28, -r * 0.3, r * 0.16).fill({ color: 0xffffff, alpha: 0.5 });
  }

  private buildPuck(): void {
    const r = PUCK_R * S;
    const glow = new Sprite(this.softGlow);
    glow.anchor.set(0.5);
    glow.width = r * 7;
    glow.height = r * 7;
    glow.tint = COL_PUCK_GLOW;
    glow.blendMode = 'add';
    glow.alpha = 0.75;

    const g = new Graphics();
    g.circle(0, 4, r).fill({ color: 0x000000, alpha: 0.35 });
    g.circle(0, 0, r).fill({ color: COL_PUCK });
    g.circle(0, 0, r).stroke({ width: 2, color: COL_PUCK_GLOW, alpha: 0.9 });
    g.circle(-r * 0.3, -r * 0.3, r * 0.3).fill({ color: 0xffffff, alpha: 0.85 });

    this.puckNode.addChild(glow, g);
  }

  // --- Static art ----------------------------------------------------------

  private buildBackground(): void {
    const bg = new Graphics();
    bg.rect(0, 0, VIEW_W, VIEW_H).fill({ color: COL_BG });
    // Faint cabinet grid so the letterboxed area isn't dead space.
    for (let x = 0; x <= VIEW_W; x += 30) {
      bg.rect(x, 0, 1, VIEW_H).fill({ color: 0x121a3a, alpha: 0.5 });
    }
    for (let y = 0; y <= VIEW_H; y += 30) {
      bg.rect(0, y, VIEW_W, 1).fill({ color: 0x121a3a, alpha: 0.5 });
    }
    this.world.addChild(bg);

    // Ambient pool of light under the table.
    const halo = new Sprite(this.softGlow);
    halo.anchor.set(0.5);
    halo.position.set(VIEW_W / 2, VIEW_H / 2);
    halo.width = VIEW_W * 1.7;
    halo.height = VIEW_H * 1.2;
    halo.tint = 0x1d3a8f;
    halo.alpha = 0.5;
    halo.blendMode = 'add';
    this.world.addChild(halo);
  }

  private drawTable(): void {
    const g = this.staticArt;
    const myColor = COL_YOU;
    const oppColor = COL_OPP;
    g.clear();

    // Rail and felt.
    g.roundRect(TX - 12, TY - 12, TABLE_PX_W + 24, TABLE_PX_H + 24, 34).fill({ color: 0x070c1e });
    g.roundRect(TX - 12, TY - 12, TABLE_PX_W + 24, TABLE_PX_H + 24, 34).stroke({
      width: 3,
      color: 0x2b3f8a,
      alpha: 0.9,
    });
    g.roundRect(TX, TY, TABLE_PX_W, TABLE_PX_H, 26).fill({ color: COL_FELT });
    g.roundRect(TX, TY, TABLE_PX_W, TABLE_PX_H, 26).stroke({ width: 2.5, color: COL_FELT_EDGE });

    // Half tints: your end reads cool, theirs warm.
    g.rect(TX, TY + TABLE_PX_H / 2, TABLE_PX_W, TABLE_PX_H / 2 - 4).fill({
      color: myColor,
      alpha: 0.035,
    });
    g.rect(TX, TY + 4, TABLE_PX_W, TABLE_PX_H / 2 - 4).fill({ color: oppColor, alpha: 0.03 });

    // Centre line (dashed) + circle.
    const midY = TY + TABLE_PX_H / 2;
    for (let x = TX + 10; x < TX + TABLE_PX_W - 10; x += 26) {
      g.rect(x, midY - 1.5, 15, 3).fill({ color: COL_LINE, alpha: 0.45 });
    }
    g.circle(VIEW_W / 2, midY, 17 * S).stroke({ width: 3, color: COL_LINE, alpha: 0.4 });
    g.circle(VIEW_W / 2, midY, 3.2 * S).stroke({ width: 2, color: COL_LINE, alpha: 0.55 });
    g.circle(VIEW_W / 2, midY, 5).fill({ color: COL_LINE, alpha: 0.6 });

    // Goal creases. arc() draws a line from wherever the path currently is to
    // the arc's start point, so each one needs an explicit moveTo first.
    const creaseR = 27 * S;
    g.moveTo(VIEW_W / 2 + creaseR, TY)
      .arc(VIEW_W / 2, TY, creaseR, 0, Math.PI)
      .stroke({ width: 2.5, color: oppColor, alpha: 0.32 });
    g.moveTo(VIEW_W / 2 - creaseR, TY + TABLE_PX_H)
      .arc(VIEW_W / 2, TY + TABLE_PX_H, creaseR, Math.PI, Math.PI * 2)
      .stroke({ width: 2.5, color: myColor, alpha: 0.32 });

    // Goal mouths.
    const mouthW = GOAL_HALF_W * 2 * S;
    const mouthX = VIEW_W / 2 - mouthW / 2;
    g.rect(mouthX, TY - 7, mouthW, 8).fill({ color: oppColor });
    g.rect(mouthX, TY + TABLE_PX_H - 1, mouthW, 8).fill({ color: myColor });
    for (const gx of [mouthX, mouthX + mouthW]) {
      g.circle(gx, TY, 5).fill({ color: 0xffffff, alpha: 0.85 });
      g.circle(gx, TY + TABLE_PX_H, 5).fill({ color: 0xffffff, alpha: 0.85 });
    }

    // Corner accents.
    const corner = 30;
    for (const [cx, cy, sx, sy] of [
      [TX, TY, 1, 1],
      [TX + TABLE_PX_W, TY, -1, 1],
      [TX, TY + TABLE_PX_H, 1, -1],
      [TX + TABLE_PX_W, TY + TABLE_PX_H, -1, -1],
    ] as const) {
      g.moveTo(cx + sx * 14, cy + sy * corner)
        .lineTo(cx + sx * 14, cy + sy * 22)
        .lineTo(cx + sx * 22, cy + sy * 14)
        .lineTo(cx + sx * corner, cy + sy * 14)
        .stroke({ width: 2, color: 0x3b56b8, alpha: 0.55 });
    }
  }

  private layoutHud(): void {
    const midY = TY + TABLE_PX_H / 2;
    // Index 0 is always the bottom half on screen = the local player.
    this.bigScore[0].position.set(VIEW_W / 2, midY + TABLE_PX_H / 4);
    this.bigScore[1].position.set(VIEW_W / 2, midY - TABLE_PX_H / 4);

    // Names and pips sit just inside the felt. The margin strip above the
    // table is where the floating DOM chips live, and they would collide at
    // some window sizes.
    this.nameText[0].position.set(TX + 18, TY + TABLE_PX_H - PIP_INSET);
    this.nameText[1].position.set(TX + 18, TY + PIP_INSET);
    this.setText(this.nameText[0], this.names[this.mySide] || 'You');
    this.setText(this.nameText[1], this.names[this.mySide === 0 ? 1 : 0] || 'Waiting…');
  }

  private setText(node: Text, value: string): void {
    if (node.text !== value) node.text = value;
  }

  private drawPips(target: Graphics, score: number, color: number, y: number): void {
    target.clear();
    const r = 6;
    const gap = 19;
    const startX = TX + TABLE_PX_W - (TARGET_SCORE - 1) * gap - 22;
    for (let i = 0; i < TARGET_SCORE; i++) {
      const x = startX + i * gap;
      if (i < score) target.circle(x, y, r).fill({ color });
      else target.circle(x, y, r).stroke({ width: 2, color, alpha: 0.35 });
    }
  }

  // --- Per-event feedback --------------------------------------------------

  /** Turn a rules event into particles, shake and a flash. */
  impact(kind: EventKind, x: number, y: number, power: number, side: Side): void {
    const p = this.px(x, y);
    switch (kind) {
      case 'paddle': {
        const color = side === this.mySide ? COL_YOU : COL_OPP;
        this.fx.burst(p.x, p.y, 8 + Math.round(power * 14), {
          color,
          speed: 120 + power * 340,
          life: 0.34,
          size: 5,
        });
        this.fx.addShake(0.06 + power * 0.14);
        break;
      }
      case 'wall': {
        this.fx.burst(p.x, p.y, 4 + Math.round(power * 7), {
          color: 0x9fc6ff,
          speed: 90 + power * 220,
          life: 0.26,
          size: 4,
        });
        this.fx.addShake(power * 0.06);
        break;
      }
      case 'post': {
        this.fx.burst(p.x, p.y, 14, { color: 0xffffff, speed: 260, life: 0.4, size: 5 });
        this.fx.addShake(0.12 + power * 0.1);
        break;
      }
      case 'goal': {
        const scoredByMe = side === this.mySide;
        const color = scoredByMe ? COL_YOU : COL_OPP;
        this.fx.burst(p.x, p.y, 80, { color, speed: 520, life: 0.9, size: 8 });
        this.fx.burst(p.x, p.y, 36, { color: 0xffffff, speed: 300, life: 0.6, size: 6 });
        this.fx.addShake(0.55);
        this.goalFlash = 1;
        // A goal I scored lands in the far net, at the top of my screen.
        this.goalFlashAtTop = scoredByMe;
        this.flashOverlay.tint = color;
        this.flashBlob.tint = color;
        this.flashBlob.position.set(VIEW_W / 2, this.goalFlashAtTop ? TY : TY + TABLE_PX_H);
        this.centerPop = 1;
        break;
      }
      case 'win':
        this.fx.addShake(0.7);
        break;
    }
  }

  celebrate(won: boolean): void {
    const color = won ? COL_YOU : COL_OPP;
    for (let i = 0; i < 6; i++) {
      const x = TX + 40 + Math.random() * (TABLE_PX_W - 80);
      const y = TY + 60 + Math.random() * (TABLE_PX_H - 120);
      this.fx.burst(x, y, 24, { color, speed: 340, life: 1.1, size: 7 });
    }
  }

  // --- Frame ---------------------------------------------------------------

  render(state: RenderState, dt: number): void {
    this.fx.update(dt);
    this.world.position.set(this.fx.shakeX, this.fx.shakeY);

    // Scores, indexed by screen position rather than side id.
    const mine = state.scores[this.mySide];
    const theirs = state.scores[this.mySide === 0 ? 1 : 0];
    this.setText(this.bigScore[0], String(mine));
    this.setText(this.bigScore[1], String(theirs));
    if (this.lastPips[0] !== mine || this.lastPips[1] !== theirs) {
      this.lastPips = [mine, theirs];
      this.drawPips(this.pips[0], mine, COL_YOU, TY + TABLE_PX_H - PIP_INSET);
      this.drawPips(this.pips[1], theirs, COL_OPP, TY + PIP_INSET);
    }

    // Puck.
    const puckPx = this.px(state.puck.x, state.puck.y);
    const puckVisible = state.phase !== PHASE_WAITING;
    this.puckNode.visible = puckVisible;
    this.puckNode.position.set(puckPx.x, puckPx.y);

    // Trail.
    if (state.phase === PHASE_PLAY) {
      this.trailPoints.unshift({ x: puckPx.x, y: puckPx.y });
      if (this.trailPoints.length > TRAIL_LEN) this.trailPoints.pop();
    } else {
      this.trailPoints.length = 0;
    }
    for (let i = 0; i < TRAIL_LEN; i++) {
      const s = this.trailSprites[i];
      const pt = this.trailPoints[i];
      if (!pt) {
        s.visible = false;
        continue;
      }
      const k = 1 - i / TRAIL_LEN;
      s.visible = true;
      s.position.set(pt.x, pt.y);
      const size = PUCK_R * S * (1.6 + k * 2.4);
      s.width = size;
      s.height = size;
      s.alpha = k * 0.38;
    }

    // Paddles.
    for (const side of [0, 1] as Side[]) {
      const p = this.px(state.paddles[side].x, state.paddles[side].y);
      this.paddleNodes[side].position.set(p.x, p.y);
    }

    // Goal flash.
    if (this.goalFlash > 0) {
      this.goalFlash = Math.max(0, this.goalFlash - dt * 1.4);
      const eased = this.goalFlash * this.goalFlash;
      this.flashOverlay.alpha = eased * 0.12;
      this.flashBlob.alpha = eased * 0.55;
    } else if (this.flashOverlay.alpha !== 0) {
      this.flashOverlay.alpha = 0;
      this.flashBlob.alpha = 0;
    }

    this.updateCenterMessage(state, dt);
  }

  private updateCenterMessage(state: RenderState, dt: number): void {
    let text = '';
    let sub = '';

    switch (state.phase) {
      case PHASE_COUNTDOWN: {
        const n = Math.ceil(state.timer);
        text = n <= 0 ? 'GO!' : String(n);
        break;
      }
      case PHASE_GOAL:
        text = 'GOAL!';
        sub = this.goalFlashAtTop ? 'Nice shot!' : '';
        break;
      case PHASE_OVER:
        text = state.winner === this.mySide ? 'YOU WIN!' : 'YOU LOSE';
        sub = `${state.scores[this.mySide]} – ${state.scores[this.mySide === 0 ? 1 : 0]}`;
        break;
      default:
        text = '';
    }

    if (this.centerText.text !== text) {
      this.centerText.text = text;
      if (text) this.centerPop = 1;
    }
    this.setText(this.centerSub, sub);

    // The puck sits at centre during the countdown, so lift the digit clear
    // of it rather than stacking the two on top of each other.
    this.centerText.y = state.phase === PHASE_COUNTDOWN ? VIEW_H / 2 - 158 : VIEW_H / 2 - 24;

    // outBack-ish pop on every change.
    this.centerPop = Math.max(0, this.centerPop - dt * 3.2);
    const t = 1 - this.centerPop;
    const overshoot = 1 + 0.45 * Math.sin(Math.PI * Math.min(1, t) ** 0.7) * this.centerPop;
    this.centerText.scale.set(overshoot);
    this.centerText.alpha = this.centerText.text ? Math.min(1, 0.3 + t * 1.6) : 0;
    this.centerSub.alpha = this.centerSub.text ? Math.min(1, t * 1.6) : 0;
  }
}
