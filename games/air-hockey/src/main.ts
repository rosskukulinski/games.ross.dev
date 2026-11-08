import { Application } from 'pixi.js';
import { audio } from './audio';
import { BotTransport, type Difficulty } from './bot';
import { OnlineTransport, probeServer, resolveServerBase } from './net';
import type { ServerMessage, Transport } from './protocol';
import { Ui, type ScreenName } from './ui';
import { VIEW_H, VIEW_W, View, type RenderState } from './view';
import {
  type Match,
  type Phase,
  type Side,
  type StepEvent,
  PADDLE_R,
  PHASE_COUNTDOWN,
  PHASE_OVER,
  PHASE_PLAY,
  PHASE_WAITING,
  TABLE_H,
  TABLE_W,
  TARGET_SCORE,
  advancePaddle,
  clampPaddleTarget,
  decodeSnapshot,
  isValidCode,
  randomCode,
} from './shared/rules';

type Mode = 'idle' | 'solo' | 'online';

interface BufferedSnapshot {
  recvAt: number;
  match: Match;
}

// --- Session state ---------------------------------------------------------

let transport: Transport | null = null;
let mode: Mode = 'idle';
let mySide: Side = 0;
let isHost = false;
let everStarted = false;
let roomCode = '';

let buffer: BufferedSnapshot[] = [];
let eventQueue: { dueAt: number; event: StepEvent }[] = [];

/** Where the pointer is asking our paddle to go, in table units. */
let localTarget = { x: TABLE_W / 2, y: TABLE_H - PADDLE_R - 12 };
/** Locally predicted paddle position, so our own paddle never lags. */
let localPaddle = { ...localTarget };

let opponentPresent = false;
let names: [string, string] = ['You', 'Opponent'];
let rematchFlags: [boolean, boolean] = [false, false];
let lastCountdownBeep = -1;
let sinceInputSend = 0;
const keys = new Set<string>();
/** Seconds the movement keys have been held, for keyboard acceleration. */
let keyHeld = 0;
let soloDifficulty: Difficulty | null = null;

// --- Boot ------------------------------------------------------------------

/** Logical px of the empty margin strip (above and below the table) cropped in landscape. */
const LANDSCAPE_CROP_Y = 40;

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: 0x04060f,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    autoDensity: true,
  });

  const host = document.getElementById('app');
  if (!host) throw new Error('missing #app');
  host.appendChild(app.canvas);

  // Fixed logical resolution, CSS-scaled to fit the window. On a landscape
  // screen (an iPad on its stand) the tall table is height-bound and was only
  // ~420px wide, so let the empty strips above and below the rails run off
  // screen: the felt, rails and goals all stay visible and the table grows ~9%.
  // In portrait those strips hold the HUD chips, so nothing is cropped there.
  const resize = (): void => {
    const landscape = window.innerWidth > window.innerHeight;
    const visibleH = landscape ? VIEW_H - 2 * LANDSCAPE_CROP_Y : VIEW_H;
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / visibleH);
    app.canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
    const h = Math.floor(VIEW_H * scale);
    app.canvas.style.height = `${h}px`;
    // A grid item taller than its container overflows downward only; shift it
    // up so the crop is shared equally between the top and bottom strips.
    const overflow = Math.max(0, h - window.innerHeight);
    app.canvas.style.transform = overflow ? `translateY(${-overflow / 2}px)` : '';
  };
  window.addEventListener('resize', resize);
  resize();

  const view = new View(app);
  const ui = new Ui();

  wireInput(app, view);
  wireUi(ui, view);

  app.ticker.add(() => {
    const dt = Math.min(app.ticker.deltaMS, 100) / 1000;
    frame(dt, view, ui);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Coming back from a background tab: the buffer is stale, so drop it
      // rather than interpolating across a multi-second gap.
      buffer = [];
      eventQueue = [];
    }
  });

  ui.show('menu');

  // A shared invite link lands here with #CODE.
  const hash = location.hash.replace('#', '').toUpperCase();
  if (isValidCode(hash)) {
    ui.show('join');
    ui.prefillCode(hash);
    void startJoin(hash, ui, view);
  }

  // Debug hook for the Playwright smoke test — headless renderers are far too
  // slow to assert on wall-clock timing, so assert on state instead.
  (window as unknown as { __game?: unknown }).__game = {
    get mode() {
      return mode;
    },
    get side() {
      return mySide;
    },
    get code() {
      return roomCode;
    },
    get opponentPresent() {
      return opponentPresent;
    },
    get snapshot() {
      return buffer.length ? buffer[buffer.length - 1].match : null;
    },
    get serverBase() {
      return resolveServerBase();
    },
    setTarget(x: number, y: number) {
      localTarget = clampPaddleTarget(mySide, x, y);
    },
    /** Solo difficulty in play ('easy' | 'normal' | 'hard'), or null online / idle. */
    get difficulty() {
      return soloDifficulty;
    },
    /** Goals needed to win the current match (3/5/7 solo, 7 online). */
    get targetScore() {
      return view.targetScore;
    },
    /** Table units -> CSS client pixels, for harnesses that drag the paddle. */
    tableToClient(x: number, y: number) {
      const logical = view.toLogical(x, y);
      const rect = app.canvas.getBoundingClientRect();
      return {
        x: rect.left + (logical.x / VIEW_W) * rect.width,
        y: rect.top + (logical.y / VIEW_H) * rect.height,
      };
    },
  };
}

// --- Input -----------------------------------------------------------------

function wireInput(app: Application, view: View): void {
  const canvas = app.canvas;

  const toLogical = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW_W,
      y: ((clientY - rect.top) / rect.height) * VIEW_H,
    };
  };

  const aim = (clientX: number, clientY: number): void => {
    const logical = toLogical(clientX, clientY);
    const table = view.toTable(logical.x, logical.y);
    localTarget = clampPaddleTarget(mySide, table.x, table.y);
  };

  // Listening on the window (not the canvas) means the paddle keeps tracking
  // even when a finger strays into the letterbox area.
  window.addEventListener('pointermove', (e) => {
    if (mode === 'idle') return;
    aim(e.clientX, e.clientY);
  });
  window.addEventListener(
    'pointerdown',
    (e) => {
      audio.unlock();
      if (mode === 'idle') return;
      aim(e.clientX, e.clientY);
    },
    { passive: true }
  );

  window.addEventListener('keydown', (e) => {
    keys.add(e.key.toLowerCase());
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
}

/** Keyboard speed in table units per second: a quick tap nudges, a hold races. */
const KEY_SPEED_START = 120;
const KEY_SPEED_MAX = 230;
/** Seconds of holding to reach full keyboard speed. */
const KEY_RAMP = 0.5;

/**
 * Keyboard is a fallback for laptops without a comfortable mouse. It used to
 * crawl at 95 units/s, far too slow to get back in front of a shot; holding a
 * key now ramps up close to the paddle's own speed limit.
 */
function applyKeyboard(dt: number): void {
  let dx = 0;
  let dy = 0;
  if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
  if (keys.has('arrowright') || keys.has('d')) dx += 1;
  if (keys.has('arrowup') || keys.has('w')) dy -= 1;
  if (keys.has('arrowdown') || keys.has('s')) dy += 1;
  if (dx === 0 && dy === 0) {
    keyHeld = 0;
    return;
  }
  keyHeld += dt;
  const ramp = Math.min(1, keyHeld / KEY_RAMP);
  const speed = (KEY_SPEED_START + (KEY_SPEED_MAX - KEY_SPEED_START) * ramp) * dt;
  // Pull the target back onto the paddle first: if a drag left the target far
  // away, a key press should move the paddle from where it is, not from there.
  if (Math.hypot(localTarget.x - localPaddle.x, localTarget.y - localPaddle.y) > 6) {
    localTarget = { ...localPaddle };
  }
  const len = Math.hypot(dx, dy);
  // The view is flipped for side 1, so "up" on the keyboard is -y on screen
  // but +y in table space.
  const sign = mySide === 1 ? -1 : 1;
  localTarget = clampPaddleTarget(
    mySide,
    localTarget.x + (dx / len) * speed * sign,
    localTarget.y + (dy / len) * speed * sign
  );
}

// --- UI wiring -------------------------------------------------------------

function wireUi(ui: Ui, view: View): void {
  ui.onSolo = (difficulty) => startSolo(difficulty, ui, view);
  ui.onHost = () => void startHost(ui, view);
  ui.onJoin = (code) => void startJoin(code, ui, view);
  ui.onQuit = () => quitToMenu(ui);
  ui.onRematch = () => {
    transport?.send({ t: 'rematch' });
    if (mode === 'online') ui.setOverStatus('Waiting for the other player…');
  };
}

function teardown(): void {
  transport?.close();
  transport = null;
  buffer = [];
  eventQueue = [];
  opponentPresent = false;
  everStarted = false;
  rematchFlags = [false, false];
  lastCountdownBeep = -1;
}

function quitToMenu(ui: Ui): void {
  teardown();
  mode = 'idle';
  soloDifficulty = null;
  roomCode = '';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  ui.setOverStatus('');
  ui.show('menu');
}

function resetLocalPaddle(side: Side): void {
  const home = { x: TABLE_W / 2, y: side === 0 ? TABLE_H - PADDLE_R - 12 : PADDLE_R + 12 };
  localTarget = { ...home };
  localPaddle = { ...home };
}

function attach(t: Transport, ui: Ui, view: View): void {
  transport = t;
  t.onMessage = (msg) => handleMessage(msg, ui, view);
  t.onError = (reason) => {
    teardown();
    mode = 'idle';
    ui.setError(reason);
  };
}

function startSolo(difficulty: Difficulty, ui: Ui, view: View): void {
  teardown();
  mode = 'solo';
  soloDifficulty = difficulty;
  isHost = false;
  roomCode = '';
  names = ['You', 'Computer'];
  opponentPresent = true;
  everStarted = true;
  resetLocalPaddle(0);
  view.setSide(0);
  view.setNames(names);
  ui.setConnectionInfo('Solo · ' + difficulty);
  ui.setOverStatus('');
  ui.show('none');
  const bot = new BotTransport(difficulty);
  view.setTargetScore(bot.targetScore);
  attach(bot, ui, view);
}

async function startHost(ui: Ui, view: View): Promise<void> {
  ui.setConnectingText('Setting up your game…');
  ui.show('connecting');

  if (!(await probeServer())) {
    ui.setError(
      "Two-player mode isn't set up on this server yet, so a friend can't join right now."
    );
    return;
  }

  const code = randomCode();
  teardown();
  mode = 'online';
  soloDifficulty = null;
  view.setTargetScore(TARGET_SCORE);
  isHost = true;
  roomCode = code;
  ui.setHostCode(code);
  ui.setHostStatus('Waiting for the other player…');
  ui.setOverStatus('');
  ui.show('host');
  attach(new OnlineTransport(code, 'Player 1'), ui, view);
}

async function startJoin(code: string, ui: Ui, view: View): Promise<void> {
  ui.setConnectingText('Joining the game…');
  ui.show('connecting');

  if (!isValidCode(code)) {
    ui.setError("That code doesn't look right. Codes are 4 letters or numbers.");
    return;
  }
  if (!(await probeServer())) {
    ui.setError("Two-player mode isn't set up on this server yet.");
    return;
  }

  teardown();
  mode = 'online';
  soloDifficulty = null;
  view.setTargetScore(TARGET_SCORE);
  isHost = false;
  roomCode = code;
  ui.setOverStatus('');
  attach(new OnlineTransport(code, 'Player 2'), ui, view);
}

// --- Messages --------------------------------------------------------------

function handleMessage(msg: ServerMessage, ui: Ui, view: View): void {
  switch (msg.t) {
    case 'joined': {
      mySide = msg.side;
      roomCode = msg.code;
      resetLocalPaddle(mySide);
      view.setSide(mySide);
      view.setNames(names);
      break;
    }
    case 'roster': {
      names = msg.names.map((n, i) => n || (i === mySide ? 'You' : 'Waiting…')) as [string, string];
      if (mode === 'solo') names = ['You', 'Computer'];
      rematchFlags = msg.rematch;
      opponentPresent = msg.present[mySide === 0 ? 1 : 0];
      if (opponentPresent) everStarted = true;
      view.setNames(names);
      if (mode === 'online') {
        ui.setOverStatus(
          rematchFlags[mySide] && !rematchFlags[mySide === 0 ? 1 : 0]
            ? 'Waiting for the other player…'
            : ''
        );
      }
      break;
    }
    case 'snap': {
      const now = performance.now();
      buffer.push({ recvAt: now, match: decodeSnapshot(msg.s) });
      // Two seconds of history is far more than interpolation needs.
      while (buffer.length > 2 && now - buffer[0].recvAt > 2000) buffer.shift();
      if (msg.e && transport) {
        const dueAt = now + transport.interpDelayMs;
        for (const event of msg.e) eventQueue.push({ dueAt, event });
      }
      break;
    }
    default:
      break;
  }
}

// --- Interpolation ---------------------------------------------------------

function toRenderState(m: Match): RenderState {
  return {
    puck: { x: m.puck.x, y: m.puck.y },
    paddles: [
      { x: m.paddles[0].x, y: m.paddles[0].y },
      { x: m.paddles[1].x, y: m.paddles[1].y },
    ],
    scores: [m.scores[0], m.scores[1]],
    phase: m.phase,
    timer: m.timer,
    winner: m.winner,
  };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function sampleBuffer(now: number, delayMs: number): RenderState | null {
  if (buffer.length === 0) return null;
  const renderTime = now - delayMs;
  const last = buffer[buffer.length - 1];
  if (buffer.length === 1 || renderTime >= last.recvAt) return toRenderState(last.match);
  if (renderTime <= buffer[0].recvAt) return toRenderState(buffer[0].match);

  for (let i = buffer.length - 2; i >= 0; i--) {
    const a = buffer[i];
    const b = buffer[i + 1];
    if (renderTime < a.recvAt) continue;
    const span = Math.max(1, b.recvAt - a.recvAt);
    const t = Math.min(1, Math.max(0, (renderTime - a.recvAt) / span));

    // Discrete state comes from the older snapshot so that scores and phase
    // change in step with the puck position being drawn.
    const out = toRenderState(a.match);
    out.timer = lerp(a.match.timer, b.match.timer, t);

    // A goal teleports the puck back to centre; never interpolate across that.
    const jump = Math.hypot(b.match.puck.x - a.match.puck.x, b.match.puck.y - a.match.puck.y);
    if (jump < 30) {
      out.puck.x = lerp(a.match.puck.x, b.match.puck.x, t);
      out.puck.y = lerp(a.match.puck.y, b.match.puck.y, t);
    }
    for (const side of [0, 1] as Side[]) {
      out.paddles[side].x = lerp(a.match.paddles[side].x, b.match.paddles[side].x, t);
      out.paddles[side].y = lerp(a.match.paddles[side].y, b.match.paddles[side].y, t);
    }
    return out;
  }
  return toRenderState(last.match);
}

// --- Frame -----------------------------------------------------------------

function frame(dt: number, view: View, ui: Ui): void {
  const now = performance.now();

  if (mode !== 'idle') {
    applyKeyboard(dt);
    localPaddle = advancePaddle(mySide, localPaddle, localTarget.x, localTarget.y, dt);

    sinceInputSend += dt;
    if (sinceInputSend >= 0.02) {
      sinceInputSend = 0;
      transport?.send({ t: 'input', x: localTarget.x, y: localTarget.y });
    }
  }

  // Fire buffered events at the moment the frames they belong to are drawn.
  while (eventQueue.length > 0 && eventQueue[0].dueAt <= now) {
    const { event } = eventQueue.shift()!;
    playEvent(event, view);
  }

  const state = mode === 'idle' ? null : sampleBuffer(now, transport?.interpDelayMs ?? 60);
  if (state) {
    // Draw our own paddle from local prediction rather than the delayed
    // snapshot, unless the two have drifted so far that something is wrong.
    const authoritative = state.paddles[mySide];
    if (Math.hypot(authoritative.x - localPaddle.x, authoritative.y - localPaddle.y) > 14) {
      localPaddle = { x: authoritative.x, y: authoritative.y };
    }
    state.paddles[mySide] = { x: localPaddle.x, y: localPaddle.y };

    handleCountdownAudio(state.phase, state.timer);
    refreshScreens(state.phase, ui);
    updateConnectionChip(ui, state.phase);
    view.render(state, dt);
  } else {
    // Nothing to show yet (menu, or still connecting) — keep particles alive.
    view.render(idleState(), dt);
  }
}

function idleState(): RenderState {
  return {
    puck: { x: TABLE_W / 2, y: TABLE_H / 2 },
    paddles: [
      { x: TABLE_W / 2, y: TABLE_H - PADDLE_R - 12 },
      { x: TABLE_W / 2, y: PADDLE_R + 12 },
    ],
    scores: [0, 0],
    phase: PHASE_WAITING,
    timer: 0,
    winner: -1,
  };
}

function handleCountdownAudio(phase: Phase, timer: number): void {
  if (phase !== PHASE_COUNTDOWN) {
    if (phase === PHASE_PLAY && lastCountdownBeep !== 0) {
      lastCountdownBeep = 0;
      audio.countdownBeep(true);
    }
    if (phase !== PHASE_PLAY) lastCountdownBeep = -1;
    return;
  }
  const n = Math.ceil(timer);
  if (n !== lastCountdownBeep && n > 0) {
    lastCountdownBeep = n;
    audio.countdownBeep(false);
  }
}

function playEvent(event: StepEvent, view: View): void {
  view.impact(event.kind, event.x, event.y, event.power, event.side);
  switch (event.kind) {
    case 'paddle':
      audio.paddleHit(event.power);
      break;
    case 'wall':
      audio.wallHit(event.power);
      break;
    case 'post':
      audio.post(event.power);
      break;
    case 'goal':
      audio.goal(event.side === mySide);
      break;
    case 'win':
      audio.win(event.side === mySide);
      view.celebrate(event.side === mySide);
      break;
  }
}

function refreshScreens(phase: Phase, ui: Ui): void {
  if (mode === 'idle') return;

  let desired: ScreenName;
  if (phase === PHASE_OVER) {
    desired = 'over';
  } else if (mode === 'online' && !opponentPresent) {
    if (isHost && !everStarted) {
      desired = 'host';
    } else {
      ui.setWaitingText(
        everStarted
          ? 'The other player left. Waiting for them to come back…'
          : 'Waiting for the other player…'
      );
      desired = 'waiting';
    }
  } else {
    desired = 'none';
  }

  if (ui.screen !== desired) ui.show(desired);
}

function updateConnectionChip(ui: Ui, phase: Phase): void {
  if (mode === 'solo') return;
  const t = transport;
  if (t instanceof OnlineTransport) {
    const ping = t.latencyMs > 0 ? `${Math.round(t.latencyMs)}ms` : '…';
    ui.setConnectionInfo(`${roomCode} · ${ping}`);
  } else if (phase === PHASE_WAITING) {
    ui.setConnectionInfo(roomCode);
  }
}

void boot();
