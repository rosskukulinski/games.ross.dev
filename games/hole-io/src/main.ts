import { Application } from 'pixi.js';
import { audio } from './audio';
import { LocalTransport } from './local';
import { OnlineTransport, probeServer, resolveServerBase } from './net';
import type { RosterEntry, ServerMessage, Transport } from './protocol';
import { Ui } from './ui';
import { PLAYER_COLORS, View, type RenderHole, type RenderState } from './view';
import {
  type Phase,
  type Prop,
  type Snap,
  type StepEvent,
  HOLE_BASE_R,
  PHASE_COUNTDOWN,
  PHASE_OVER,
  PHASE_PLAY,
  ROUND_TIME,
  WORLD_H,
  WORLD_W,
  advanceHole,
  canEatKind,
  decodeSnapshot,
  generateProps,
  isValidCode,
  randomCode,
} from './shared/rules';

type Mode = 'idle' | 'solo' | 'online';

interface BufferedSnap {
  recvAt: number;
  snap: Snap;
}

// --- Session state ---------------------------------------------------------

let transport: Transport | null = null;
let mode: Mode = 'idle';
let myId = -1;
let roomCode = '';

let roster = new Map<number, RosterEntry>();
let colorIdx = new Map<number, number>();
let nextColor = 1;

let props: Prop[] = [];
let buffer: BufferedSnap[] = [];
let eventQueue: { dueAt: number; event: StepEvent }[] = [];

/** Locally predicted position of our own hole, so steering never lags. */
let localPos = { x: WORLD_W / 2, y: WORLD_H / 2 };
let myR = HOLE_BASE_R;
let myAliveLast = true;

const keys = new Set<string>();
let pointer = { x: 0, y: 0, active: false };
let joystick = { id: -1, originX: 0, originY: 0, dx: 0, dy: 0 };
let forcedInput: { x: number; y: number } | null = null;
let autoPilot = false;

let sinceInputSend = 0;
let sinceHud = 0;
let lastCountdownBeep = -1;
let lastTickSecond = -1;
let lastPhase: Phase = PHASE_COUNTDOWN;
let hitstop = 0;
let streak = 0;
let lastEatAt = 0;

// --- Boot ------------------------------------------------------------------

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    backgroundColor: 0x070b14,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    autoDensity: true,
  });

  const host = document.getElementById('app');
  if (!host) throw new Error('missing #app');
  host.appendChild(app.canvas);

  const view = new View(app);
  const ui = new Ui();

  window.addEventListener('resize', () => view.resize());

  wireInput(app, view, ui);
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
    void startJoin(hash, localStorage.getItem('hole-io-name') ?? 'Player', ui, view);
  }

  // Debug hook for the Playwright smoke test — headless renderers are far too
  // slow to assert on wall-clock timing, so assert on state instead.
  (window as unknown as { __game?: unknown }).__game = {
    get mode() {
      return mode;
    },
    get myId() {
      return myId;
    },
    get code() {
      return roomCode;
    },
    get snapshot() {
      return buffer.length ? buffer[buffer.length - 1].snap : null;
    },
    get myScore() {
      const snap = buffer.length ? buffer[buffer.length - 1].snap : null;
      return snap?.holes.find((h) => h.id === myId)?.score ?? 0;
    },
    get propsLeft() {
      return props.filter((p) => p.alive).length;
    },
    get rosterSize() {
      return roster.size;
    },
    get roster() {
      return [...roster.values()];
    },
    get serverBase() {
      return resolveServerBase();
    },
    setInput(x: number, y: number) {
      forcedInput = { x, y };
    },
    clearInput() {
      forcedInput = null;
    },
    setAuto(on: boolean) {
      autoPilot = on;
    },
  };
}

// --- Input -----------------------------------------------------------------

function wireInput(app: Application, view: View, ui: Ui): void {
  window.addEventListener('pointerdown', (e) => {
    audio.unlock();
    if (mode === 'idle') return;
    if (e.target instanceof HTMLElement && e.target.closest('.chip, .screen, button')) return;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      joystick = { id: e.pointerId, originX: e.clientX, originY: e.clientY, dx: 0, dy: 0 };
      ui.showJoystick(e.clientX, e.clientY);
    } else {
      pointer = { x: e.clientX, y: e.clientY, active: true };
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (mode === 'idle') return;
    if (e.pointerId === joystick.id) {
      let dx = (e.clientX - joystick.originX) / 58;
      let dy = (e.clientY - joystick.originY) / 58;
      const mag = Math.hypot(dx, dy);
      if (mag > 1) {
        dx /= mag;
        dy /= mag;
      }
      joystick.dx = dx;
      joystick.dy = dy;
      ui.moveJoystick(joystick.originX, joystick.originY, dx, dy);
    } else if (e.pointerType === 'mouse') {
      pointer = { x: e.clientX, y: e.clientY, active: true };
    }
  });

  const endTouch = (e: PointerEvent): void => {
    if (e.pointerId === joystick.id) {
      joystick = { id: -1, originX: 0, originY: 0, dx: 0, dy: 0 };
      ui.hideJoystick();
    }
  };
  window.addEventListener('pointerup', endTouch);
  window.addEventListener('pointercancel', endTouch);

  window.addEventListener('keydown', (e) => {
    keys.add(e.key.toLowerCase());
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  void app;
  void view;
}

/** The current steering vector, from whichever input is in charge. */
function currentInput(view: View): { x: number; y: number } {
  if (forcedInput) return forcedInput;

  if (autoPilot) {
    // Tiny built-in pilot for the smoke test: head for the nearest edible prop.
    let best: Prop | null = null;
    let bestD = Infinity;
    for (const prop of props) {
      if (!prop.alive || !canEatKind(myR * 0.95, prop.kind)) continue;
      const d = Math.hypot(prop.x - localPos.x, prop.y - localPos.y);
      if (d < bestD) {
        bestD = d;
        best = prop;
      }
    }
    if (best) {
      const d = Math.max(1, bestD);
      return { x: (best.x - localPos.x) / d, y: (best.y - localPos.y) / d };
    }
    return { x: 0, y: 0 };
  }

  let kx = 0;
  let ky = 0;
  if (keys.has('arrowleft') || keys.has('a')) kx -= 1;
  if (keys.has('arrowright') || keys.has('d')) kx += 1;
  if (keys.has('arrowup') || keys.has('w')) ky -= 1;
  if (keys.has('arrowdown') || keys.has('s')) ky += 1;
  if (kx !== 0 || ky !== 0) {
    const len = Math.hypot(kx, ky);
    return { x: kx / len, y: ky / len };
  }

  if (joystick.id !== -1) return { x: joystick.dx, y: joystick.dy };

  if (pointer.active) {
    const me = view.worldToScreen(localPos.x, localPos.y);
    const dx = pointer.x - me.x;
    const dy = pointer.y - me.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 16) return { x: 0, y: 0 };
    const mag = Math.min(1, (dist - 16) / 130);
    return { x: (dx / dist) * mag, y: (dy / dist) * mag };
  }

  return { x: 0, y: 0 };
}

// --- UI wiring -------------------------------------------------------------

function wireUi(ui: Ui, view: View): void {
  ui.onSolo = (name) => startSolo(name, ui, view);
  ui.onHost = (name) => void startHost(name, ui, view);
  ui.onJoin = (code, name) => void startJoin(code, name, ui, view);
  ui.onQuit = () => quitToMenu(ui);
  ui.onMute = () => audio.toggleMute();
  ui.onCopyInvite = () => {
    const url = `${location.origin}${location.pathname}#${roomCode}`;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).then(
        () => ui.toast('Invite link copied!'),
        () => ui.toast(`Code: ${roomCode}`)
      );
    } else {
      ui.toast(`Code: ${roomCode}`);
    }
  };
}

function teardown(): void {
  transport?.close();
  transport = null;
  buffer = [];
  eventQueue = [];
  roster = new Map();
  colorIdx = new Map();
  nextColor = 1;
  props = [];
  myId = -1;
  myAliveLast = true;
  lastCountdownBeep = -1;
  lastTickSecond = -1;
  hitstop = 0;
  streak = 0;
  forcedInput = null;
  autoPilot = false;
}

function quitToMenu(ui: Ui): void {
  teardown();
  mode = 'idle';
  roomCode = '';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  ui.setRoomChip('', '');
  ui.show('menu');
}

function attach(t: Transport, ui: Ui, view: View): void {
  transport = t;
  t.onMessage = (msg) => handleMessage(msg, ui, view);
  t.onError = (reason) => {
    teardown();
    mode = 'idle';
    ui.setRoomChip('', '');
    ui.setError(reason);
  };
}

function startSolo(name: string, ui: Ui, view: View): void {
  teardown();
  mode = 'solo';
  roomCode = '';
  ui.show('none');
  ui.setRoomChip('', '');
  attach(new LocalTransport(name), ui, view);
}

async function startHost(name: string, ui: Ui, view: View): Promise<void> {
  ui.setConnectingText('Setting up your arena…');
  ui.show('connecting');

  if (!(await probeServer())) {
    ui.setError(
      "Online play isn't set up on this server yet, so friends can't join right now."
    );
    return;
  }

  teardown();
  mode = 'online';
  roomCode = randomCode();
  attach(new OnlineTransport(roomCode, name), ui, view);
}

async function startJoin(code: string, name: string, ui: Ui, view: View): Promise<void> {
  ui.setConnectingText('Joining the arena…');
  ui.show('connecting');

  if (!isValidCode(code)) {
    ui.setError("That code doesn't look right. Codes are 4 letters or numbers.");
    return;
  }
  if (!(await probeServer())) {
    ui.setError("Online play isn't set up on this server yet.");
    return;
  }

  teardown();
  mode = 'online';
  roomCode = code;
  attach(new OnlineTransport(code, name), ui, view);
}

// --- Messages --------------------------------------------------------------

function handleMessage(msg: ServerMessage, ui: Ui, view: View): void {
  switch (msg.t) {
    case 'joined': {
      myId = msg.id;
      roomCode = msg.code;
      props = generateProps(msg.seed);
      for (const id of msg.gone) {
        if (props[id]) props[id].alive = false;
      }
      view.setWorld(msg.seed, msg.gone);
      localPos = { x: WORLD_W / 2, y: WORLD_H / 2 };
      myR = HOLE_BASE_R;
      ui.show('none');
      if (mode === 'online') {
        ui.setRoomChip(roomCode, '');
        ui.toast(`Arena code: ${roomCode} — tap to invite friends`);
      }
      break;
    }
    case 'roster': {
      roster = new Map(msg.players.map((p) => [p.id, p]));
      break;
    }
    case 'snap': {
      const now = performance.now();
      buffer.push({ recvAt: now, snap: decodeSnapshot(msg.s) });
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

// --- Colors ----------------------------------------------------------------

function colorOf(id: number): number {
  let idx = colorIdx.get(id);
  if (idx === undefined) {
    if (id === myId) {
      idx = 0;
    } else {
      idx = 1 + ((nextColor - 1) % (PLAYER_COLORS.length - 1));
      nextColor++;
    }
    colorIdx.set(id, idx);
  }
  return PLAYER_COLORS[idx];
}

const colorCss = (id: number): string => `#${colorOf(id).toString(16).padStart(6, '0')}`;

// --- Interpolation ---------------------------------------------------------

function sampleSnapshots(now: number, delayMs: number): { holes: RenderHole[]; phase: Phase; timer: number } | null {
  if (buffer.length === 0) return null;
  const renderTime = now - delayMs;

  let a = buffer[0];
  let b = buffer[buffer.length - 1];
  let t = 1;
  if (renderTime <= a.recvAt) {
    b = a;
    t = 0;
  } else if (renderTime < b.recvAt) {
    for (let i = buffer.length - 2; i >= 0; i--) {
      if (renderTime >= buffer[i].recvAt) {
        a = buffer[i];
        b = buffer[i + 1];
        const span = Math.max(1, b.recvAt - a.recvAt);
        t = Math.min(1, Math.max(0, (renderTime - a.recvAt) / span));
        break;
      }
    }
  } else {
    a = b;
  }

  const aById = new Map(a.snap.holes.map((h) => [h.id, h]));
  const holes: RenderHole[] = [];
  let leaderId = -1;
  let leaderScore = 0;
  for (const hb of b.snap.holes) {
    if (hb.alive && hb.score > leaderScore) {
      leaderScore = hb.score;
      leaderId = hb.id;
    }
  }

  for (const hb of b.snap.holes) {
    const ha = aById.get(hb.id) ?? hb;
    // A death or respawn teleports the hole; never interpolate across that.
    const jump = Math.hypot(hb.x - ha.x, hb.y - ha.y) > 140 || ha.alive !== hb.alive;
    const entry = roster.get(hb.id);
    holes.push({
      id: hb.id,
      x: jump ? hb.x : ha.x + (hb.x - ha.x) * t,
      y: jump ? hb.y : ha.y + (hb.y - ha.y) * t,
      r: ha.r + (hb.r - ha.r) * t,
      score: hb.score,
      alive: hb.alive,
      invuln: hb.invuln,
      name: entry?.name ?? (hb.id === myId ? 'You' : '???'),
      color: colorOf(hb.id),
      isMe: hb.id === myId,
      leader: hb.id === leaderId && leaderScore > 0,
    });
  }

  const latest = b.snap;
  return { holes, phase: latest.phase, timer: latest.timer };
}

// --- Events ----------------------------------------------------------------

function playEvent(event: StepEvent, ui: Ui, view: View): void {
  switch (event.kind) {
    case 'eat': {
      const prop = props[event.p];
      if (prop) prop.alive = false;
      view.propEaten(event.p, event.h);
      const mine = event.h === myId;
      view.eatFx(event.p, colorOf(event.h), event.pts, mine);
      if (mine) {
        const now = performance.now();
        streak = now - lastEatAt < 1800 ? streak + 1 : 1;
        lastEatAt = now;
        audio.eat(event.pts, streak);
        ui.bumpMeChip();
      }
      break;
    }
    case 'prop': {
      const prop = props[event.p];
      if (prop) prop.alive = true;
      view.propRespawned(event.p);
      break;
    }
    case 'swallow': {
      view.holeSwallowed(event.b, event.a);
      const iAte = event.a === myId;
      const iDied = event.b === myId;
      if (iAte) {
        audio.swallow(true);
        hitstop = 0.09;
        view.shake(0.7);
        const victim = roster.get(event.b);
        ui.showBanner(`You swallowed ${victim?.name ?? 'a hole'}! +${event.pts}`, {
          small: true,
          ttl: 2200,
        });
      } else if (iDied) {
        audio.died();
        view.shake(1);
        streak = 0;
        const eater = roster.get(event.a);
        ui.showBanner(`Swallowed by ${eater?.name ?? 'a bigger hole'}!\nRespawning…`, {
          small: true,
          ttl: 2600,
        });
      } else {
        audio.swallow(false);
        view.shake(0.25);
      }
      break;
    }
    case 'spawn': {
      view.holeSpawned(event.h);
      if (event.h === myId) {
        audio.respawned();
        ui.clearBanner();
        // Adopt the server's respawn position immediately.
        const latest = buffer[buffer.length - 1]?.snap.holes.find((h) => h.id === event.h);
        if (latest) localPos = { x: latest.x, y: latest.y };
      }
      break;
    }
    case 'over': {
      const snap = buffer[buffer.length - 1]?.snap;
      if (!snap) break;
      const rows = [...snap.holes]
        .sort((x, y) => y.score - x.score)
        .map((h) => ({
          name: roster.get(h.id)?.name ?? '???',
          score: h.score,
          colorCss: colorCss(h.id),
          isMe: h.id === myId,
          alive: true,
          bot: roster.get(h.id)?.bot ?? false,
        }));
      const iWon = event.winner === myId;
      const myScore = snap.holes.find((h) => h.id === myId)?.score ?? 0;
      const isBest = ui.recordBest(myScore);
      audio.roundEnd(iWon);
      ui.showStandings(rows, iWon);
      if (isBest && myScore > 0) ui.toast(`New best score: ${myScore}!`);
      break;
    }
    case 'round': {
      // The server reset the arena silently — regrow everything client-side.
      for (const prop of props) prop.alive = true;
      view.resetProps();
      ui.show('none');
      break;
    }
  }
}

// --- Frame -----------------------------------------------------------------

function frame(dt: number, view: View, ui: Ui): void {
  const now = performance.now();

  // Hitstop: swallowing a player freezes the world for a beat.
  if (hitstop > 0) {
    hitstop -= dt;
    dt *= 0.06;
  }

  const state = mode === 'idle' ? null : sampleSnapshots(now, transport?.interpDelayMs ?? 60);

  if (mode !== 'idle' && state) {
    const me = state.holes.find((h) => h.isMe);
    if (me) {
      myR = me.r;
      const input = currentInput(view);

      if (me.alive) {
        if (!myAliveLast) {
          // Respawned between snapshots — jump to the authoritative spot.
          localPos = { x: me.x, y: me.y };
        }
        localPos = advanceHole(localPos, myR, input.x, input.y, dt);
        // Soft-correct toward the authoritative position; snap if way off.
        const drift = Math.hypot(me.x - localPos.x, me.y - localPos.y);
        if (drift > 110) {
          localPos = { x: me.x, y: me.y };
        } else {
          const k = Math.min(1, dt * 2.2);
          localPos.x += (me.x - localPos.x) * k;
          localPos.y += (me.y - localPos.y) * k;
        }
        // Draw our own hole from prediction rather than the delayed snapshot.
        me.x = localPos.x;
        me.y = localPos.y;
      } else {
        localPos = { x: me.x, y: me.y };
      }
      myAliveLast = me.alive;

      sinceInputSend += dt;
      if (sinceInputSend >= 0.05) {
        sinceInputSend = 0;
        transport?.send({ t: 'input', x: input.x, y: input.y });
      }
    }
  }

  // Fire buffered events at the moment the frames they belong to are drawn.
  while (eventQueue.length > 0 && eventQueue[0].dueAt <= now) {
    const { event } = eventQueue.shift()!;
    playEvent(event, ui, view);
  }

  if (state) {
    handlePhaseAudio(state.phase, state.timer, ui);
    sinceHud += dt;
    if (sinceHud >= 0.2) {
      sinceHud = 0;
      refreshHud(state, ui);
    }
  }

  const focus = { x: localPos.x, y: localPos.y, r: myR };
  view.render(state ? toRenderState(state) : null, focus, dt);
}

function toRenderState(state: { holes: RenderHole[]; phase: Phase; timer: number }): RenderState {
  return { holes: state.holes, phase: state.phase, timer: state.timer };
}

function handlePhaseAudio(phase: Phase, timer: number, ui: Ui): void {
  if (phase === PHASE_COUNTDOWN) {
    const n = Math.ceil(timer);
    if (n !== lastCountdownBeep && n > 0) {
      lastCountdownBeep = n;
      ui.showBanner(String(n));
      audio.countdownBeep(false);
    }
  } else if (phase === PHASE_PLAY && lastPhase === PHASE_COUNTDOWN) {
    ui.showBanner('GO!', { ttl: 800 });
    audio.countdownBeep(true);
    lastCountdownBeep = -1;
  }

  if (phase === PHASE_PLAY && timer <= 5.8 && timer > 0) {
    const n = Math.ceil(timer);
    if (n !== lastTickSecond) {
      lastTickSecond = n;
      audio.tick();
    }
  }

  lastPhase = phase;
}

function refreshHud(state: { holes: RenderHole[]; phase: Phase; timer: number }, ui: Ui): void {
  const playTimer = state.phase === PHASE_PLAY ? state.timer : state.phase === PHASE_COUNTDOWN ? ROUND_TIME : 0;
  ui.setTimer(playTimer, state.phase === PHASE_PLAY && state.timer <= 10.5);

  const sorted = [...state.holes].sort((a, b) => b.score - a.score);
  ui.setBoard(
    sorted.slice(0, 6).map((h) => ({
      name: h.name,
      score: h.score,
      colorCss: `#${h.color.toString(16).padStart(6, '0')}`,
      isMe: h.isMe,
      alive: h.alive,
    }))
  );

  const rank = sorted.findIndex((h) => h.isMe) + 1;
  const me = sorted.find((h) => h.isMe);
  if (me && rank > 0) ui.setMeChip(me.score, rank, sorted.length);

  if (mode === 'online' && transport instanceof OnlineTransport) {
    const ping = transport.latencyMs > 0 ? `${Math.round(transport.latencyMs)}ms` : '';
    ui.setRoomChip(roomCode, ping);
  }

  if (state.phase === PHASE_OVER) {
    ui.setOverStatus(`Next round in ${Math.max(1, Math.ceil(state.timer))}…`);
    if (ui.screen !== 'over') {
      // We joined mid-standings (or missed the event) — show them now.
      const rows = sorted.map((h) => ({
        name: h.name,
        score: h.score,
        colorCss: `#${h.color.toString(16).padStart(6, '0')}`,
        isMe: h.isMe,
        alive: true,
        bot: roster.get(h.id)?.bot ?? false,
      }));
      ui.showStandings(rows, rows[0]?.isMe ?? false);
    }
  } else if (ui.screen === 'over') {
    ui.show('none');
  }
}

void boot();
