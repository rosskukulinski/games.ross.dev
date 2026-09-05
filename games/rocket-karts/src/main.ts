import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { audio } from './audio.ts';
import { Hud } from './hud.ts';
import { Input, isTouchDevice, type Controls } from './input.ts';
import { LocalTransport } from './local.ts';
import { OnlineTransport, probeServer, resolveServerBase } from './net.ts';
import { Ui, placeLabel } from './ui.ts';
import { ChaseCamera } from './render/camera.ts';
import { Bursts, KartFx, makeFlareTexture, makeSquareTexture } from './render/fx.ts';
import { KartView, makeShadowTexture } from './render/kartMesh.ts';
import { Projectiles } from './render/projectiles.ts';
import { applyTheme, createRig, type Rig } from './render/scene.ts';
import { buildWorld, type World } from './render/world.ts';
import { isValidCode, randomCode } from './shared/codes.ts';
import { STAR_TIME, TURBO_TIME } from './shared/items.ts';
import {
  type KartInput,
  type KartState,
  BASE_MAX_SPEED,
  IDLE_INPUT,
  TICK_DT,
  applySpin,
  createKart,
  encodeKinematics,
  pushApart,
  stepKart,
} from './shared/kart.ts';
import { KARTS, findKart } from './shared/karts.ts';
import { type BotBrain, botInput, createBrain } from './shared/bot.ts';
import { type Difficulty, type RaceEvent, MAX_KARTS } from './shared/race.ts';
import { type KartSnap, type LobbyState, type ServerMessage, type Snapshot, type Transport, REPORT_RATE, decodeSnapshot } from './shared/protocol.ts';
import { type TrackGeom, BOX_RADIUS, angleDiff, buildTrack, deltaS, headingOf, locate, pointAt } from './shared/track.ts';
import { THEMES, findTrack } from './shared/tracks.ts';

type Mode = 'idle' | 'solo' | 'online';

interface Buffered {
  recvAt: number;
  snap: Snapshot;
}

// --- Session ----------------------------------------------------------------

let rig: Rig;
let chase: ChaseCamera;
let world: World | null = null;
let worldTrackId = '';
let geom: TrackGeom | null = null;
const kartViews: (KartView | null)[] = [null, null, null, null];
const kartFx: (KartFx | null)[] = [null, null, null, null];
const kartViewIds: string[] = ['', '', '', ''];
let bursts: Bursts;
let projectiles: Projectiles;
let shadowTex: ReturnType<typeof makeShadowTexture>;
let flareTex: ReturnType<typeof makeFlareTexture>;

let mode: Mode = 'idle';
let transport: Transport | null = null;
let mySlot = 0;
let isHost = false;
let roomCode = '';
let lobby: LobbyState | null = null;
let buffer: Buffered[] = [];
let latest: Snapshot | null = null;
let eventQueue: { dueAt: number; e: RaceEvent }[] = [];
let started = false;
let inRace = false;
let racing = false;
let resultsShown = false;
let sinceReport = 0;
let reportsSent = 0;
let simAcc = 0;
let local: KartState = createKart();
let autoBrain: BotBrain | null = null;
let lastPickupAt = 0;
let wrongWayTime = 0;
let lastCountdownN = -1;
let starWasOn = false;
let clock = 0;
const input = new Input();
const hud = new Hud();
const ui = new Ui();
const rand = Math.random;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

// --- Boot ------------------------------------------------------------------------

function boot(): void {
  const canvas = el<HTMLCanvasElement>('game-canvas');
  rig = createRig(canvas);
  chase = new ChaseCamera(rig.camera);
  shadowTex = makeShadowTexture(rig.scene);
  flareTex = makeFlareTexture(rig.scene);
  bursts = new Bursts(rig.scene, flareTex, makeSquareTexture(rig.scene));
  projectiles = new Projectiles(rig.scene, flareTex);

  ensureWorld(ui.trackId);
  parkMenuKarts();

  wireUi();
  input.onAnyPress = () => audio.unlock();
  window.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
  el('menu-hint').textContent = isTouchDevice()
    ? 'Steer with the arrows, hold DRIFT through corners, tap the gift box to use an item.'
    : 'Arrows or WASD to steer · hold Shift to drift · Space to use an item · gamepads work too';

  let last = performance.now();
  rig.engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    frame(dt, now);
    rig.scene.render();
  });
  window.addEventListener('resize', () => rig.engine.resize());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.suspend();
      if (transport instanceof LocalTransport) transport.setPaused(true);
    } else {
      audio.resume();
      buffer = [];
      eventQueue = [];
      if (transport instanceof LocalTransport) transport.setPaused(false);
    }
  });

  ui.show('menu');
  const hash = location.hash.replace('#', '').toUpperCase();
  if (isValidCode(hash)) {
    ui.show('join');
    ui.prefillCode(hash);
  }

  (window as unknown as { __game?: unknown }).__game = {
    get mode() {
      return mode;
    },
    get slot() {
      return mySlot;
    },
    get code() {
      return roomCode;
    },
    get phase() {
      return latest?.phase ?? null;
    },
    get snapshot() {
      return latest;
    },
    get lobby() {
      return lobby;
    },
    get local() {
      return local;
    },
    get serverBase() {
      return resolveServerBase();
    },
    get worldTrack() {
      return worldTrackId;
    },
    get trackLength() {
      return geom?.length ?? 0;
    },
    get reports() {
      return reportsSent;
    },
    get boxesVisible() {
      return world ? world.boxes.filter((b) => b.outer.isEnabled()).length : 0;
    },
    get boxesTotal() {
      return world ? world.boxes.length : 0;
    },
    /** Test hook: drive the kart like a bot regardless of real input. */
    autopilot: false,
    /** Test hook: jump the local kart to a place on the track (for lap tests). */
    teleport(s: number, lateral = 0) {
      if (!geom) return;
      const p = pointAt(geom, s, lateral);
      local.x = p.x;
      local.z = p.z;
      local.heading = headingOf(p.tx, p.tz);
      local.index = -1;
    },
  };
}

// --- World -------------------------------------------------------------------------

function ensureWorld(trackId: string): void {
  if (worldTrackId === trackId && world) return;
  world?.dispose();
  const def = findTrack(trackId);
  geom = buildTrack(def);
  const theme = THEMES[def.theme];
  applyTheme(rig, theme, rand);
  world = buildWorld(rig.scene, geom, theme, rand);
  worldTrackId = trackId;
  hud.setTrack(geom, theme);
  chase.snap();
}

function kartViewFor(slot: number, kartId: string): KartView {
  let view = kartViews[slot];
  if (view && kartViewIds[slot] === kartId) return view;
  view?.dispose();
  kartFx[slot]?.dispose();
  const def = findKart(kartId);
  view = new KartView(rig.scene, def, shadowTex);
  kartViews[slot] = view;
  kartViewIds[slot] = kartId;
  kartFx[slot] = new KartFx(rig.scene, flareTex, {
    wheelL: view.wheelL,
    wheelR: view.wheelR,
    exhaustL: view.exhaustL,
    exhaustR: view.exhaustR,
    rear: view.rearAnchor,
    root: view.root,
  });
  return view;
}

/** Four karts on the grid behind the menus, so the title screen has a scene. */
function parkMenuKarts(): void {
  if (!geom) return;
  const w = geom.def.width;
  for (let i = 0; i < MAX_KARTS; i++) {
    const view = kartViewFor(i, KARTS[i].id);
    const p = pointAt(geom, -6 - Math.floor(i / 2) * 4.5, (i % 2 === 0 ? -1 : 1) * w * 0.2);
    view.setVisible(true);
    view.pose(
      { x: p.x, z: p.z, heading: headingOf(p.tx, p.tz), speed: 0, steer: 0, drift: 0, driftCharge: 0, boostTime: 0, spinTime: 0, starTime: 0, offroad: false },
      0,
      0
    );
    kartFx[i]?.update({ drift: 0, driftCharge: 0, boostTime: 0, offroad: false, speed: 0, starTime: 0 }, 0);
  }
}

// --- UI wiring ---------------------------------------------------------------------

function wireUi(): void {
  ui.onTrackPreview = (id) => {
    if (mode === 'idle') {
      ensureWorld(id);
      parkMenuKarts();
    }
  };
  ui.onSolo = (kart, track, difficulty) => startSolo(kart, track, difficulty);
  ui.onHost = (name, kart) => void startHost(name, kart);
  ui.onJoin = (code, name, kart) => void startJoin(code, name, kart);
  ui.onQuit = () => quitToMenu();
  ui.onLobbyKart = (id) => transport?.send({ t: 'pick', kart: id });
  ui.onLobbyTrack = (id) => {
    transport?.send({ t: 'track', id });
    ensureWorld(id);
    parkMenuKarts();
  };
  ui.onLobbyDifficulty = (d) => transport?.send({ t: 'difficulty', d });
  ui.onReady = (ready) => transport?.send({ t: 'ready', ready });
  ui.onStart = () => transport?.send({ t: 'start' });
  ui.onAgain = () => {
    if (mode === 'solo' && transport instanceof LocalTransport) {
      const { trackId, difficulty } = transport.race;
      startSolo(ui.kartId, trackId, difficulty);
    } else {
      transport?.send({ t: 'again' });
      ui.setLobbyStatus('');
    }
  };
  ui.onChangeTrack = () => {
    teardown();
    mode = 'idle';
    parkMenuKarts();
    ui.show('track');
  };
}

function teardown(): void {
  transport?.close();
  transport = null;
  buffer = [];
  latest = null;
  eventQueue = [];
  lobby = null;
  started = false;
  inRace = false;
  racing = false;
  resultsShown = false;
  autoBrain = null;
  local = createKart();
  projectiles.clear();
  hud.show(false);
  hud.reset();
  audio.setEngine(false, 0, false);
  audio.setDrift(false, 0);
  audio.starOn(false);
  chase.snap();
}

function quitToMenu(): void {
  teardown();
  mode = 'idle';
  roomCode = '';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  parkMenuKarts();
  ui.show('menu');
}

function attach(t: Transport): void {
  transport = t;
  t.onMessage = (msg) => handleMessage(msg);
  t.onError = (reason) => {
    teardown();
    mode = 'idle';
    parkMenuKarts();
    ui.setError(reason);
  };
}

function startSolo(kart: string, track: string, difficulty: Difficulty): void {
  teardown();
  mode = 'solo';
  isHost = true;
  roomCode = '';
  ensureWorld(track);
  ui.show('none');
  attach(new LocalTransport(track, kart, difficulty, 'You'));
}

async function startHost(name: string, kart: string): Promise<void> {
  ui.setConnectingText('Setting up your race…');
  ui.show('connecting');
  if (!(await probeServer())) {
    ui.setError("Racing with friends isn't set up on this server yet, so nobody can join right now.");
    return;
  }
  const code = randomCode();
  teardown();
  mode = 'online';
  isHost = true;
  roomCode = code;
  ui.setLobbyCode(code);
  attach(new OnlineTransport(code, name, kart));
}

async function startJoin(code: string, name: string, kart: string): Promise<void> {
  ui.setConnectingText('Joining the race…');
  ui.show('connecting');
  if (!isValidCode(code)) {
    ui.setError("That code doesn't look right. Codes are 4 letters or numbers.");
    return;
  }
  if (!(await probeServer())) {
    ui.setError("Racing with friends isn't set up on this server yet.");
    return;
  }
  teardown();
  mode = 'online';
  isHost = false;
  roomCode = code;
  ui.setLobbyCode(code);
  attach(new OnlineTransport(code, name, kart));
}

// --- Messages ----------------------------------------------------------------------------

function handleMessage(msg: ServerMessage): void {
  switch (msg.t) {
    case 'joined': {
      mySlot = msg.slot;
      isHost = msg.host;
      if (msg.code) roomCode = msg.code;
      if (mode === 'solo') transport?.send({ t: 'start' });
      break;
    }
    case 'lobby': {
      const prevPhase = lobby?.phase;
      lobby = msg;
      // The host seat passes on if the host leaves.
      isHost = msg.players[mySlot]?.host ?? isHost;
      if (msg.phase === 'lobby') {
        if (mode === 'online') {
          if (prevPhase && prevPhase !== 'lobby') {
            // Back from a race: reset for the next one.
            hud.show(false);
            hud.reset();
            started = false;
            inRace = false;
            racing = false;
            resultsShown = false;
            buffer = [];
            latest = null;
            projectiles.clear();
            local = createKart();
            audio.setEngine(false, 0, false);
          }
          ensureWorld(msg.track);
          parkMenuKarts();
          ui.renderLobby(msg, mySlot, isHost);
          ui.show('lobby');
        }
      } else if (msg.phase === 'countdown' || msg.phase === 'racing') {
        if (inRace) refreshDrivers(msg);
        else beginRace(msg);
      }
      break;
    }
    case 'snap': {
      const now = performance.now();
      const snap = decodeSnapshot(msg.s);
      buffer.push({ recvAt: now, snap });
      while (buffer.length > 2 && now - buffer[0].recvAt > 1500) buffer.shift();
      latest = snap;
      if (!started && (snap.phase === 'countdown' || snap.phase === 'racing') && lobby) {
        if (lobby.phase === 'lobby') beginRace({ ...lobby, phase: snap.phase });
        adoptGrid(snap);
      }
      syncOwn(snap);
      if (msg.e) for (const e of msg.e) handleEvent(e, now);
      break;
    }
    default:
      break;
  }
}

/** Kart models for whoever is in the race right now. */
function refreshDrivers(state: LobbyState): void {
  lobby = state;
  for (let i = 0; i < MAX_KARTS; i++) {
    const p = state.players[i];
    if (p.kind === 'empty') {
      kartViews[i]?.setVisible(false);
      continue;
    }
    kartViewFor(i, p.kart).setVisible(true);
  }
}

function beginRace(state: LobbyState): void {
  inRace = true;
  ensureWorld(state.track);
  refreshDrivers(state);
  // A menu button may still have focus; Space must fire items, not buttons.
  (document.activeElement as HTMLElement | null)?.blur?.();
  hud.reset();
  hud.setLap(1, findTrack(state.track).laps);
  hud.show(true);
  hud.showTouch(isTouchDevice());
  ui.show('none');
  racing = state.phase === 'racing';
  resultsShown = false;
  lastCountdownN = -1;
  autoBrain = null;
  wrongWayTime = 0;
  chase.snap();
  audio.unlock();
  audio.music(true);
}

function adoptGrid(snap: Snapshot): void {
  const k = snap.karts[mySlot];
  if (!k || !geom) return;
  local = createKart();
  local.x = k.x;
  local.z = k.z;
  local.heading = k.heading;
  const loc = locate(geom, local.x, local.z, -1);
  local.index = loc.index;
  local.prog = loc.s;
  local.prevProg = loc.s;
  started = true;
  chase.snap();
}

/** Fields the race owns for our own kart. */
function syncOwn(snap: Snapshot): void {
  const k = snap.karts[mySlot];
  if (!k) return;
  local.lap = k.lap;
  local.next = k.next;
  local.place = k.place;
  local.item = k.item;
  if (k.finished && !local.finished) {
    local.finished = true;
    local.finishTime = k.finishTime;
  }
  if (world) {
    snap.boxes.forEach((active, i) => {
      const b = world!.boxes[i];
      if (b) b.active = active;
    });
  }
  if (snap.phase === 'racing') racing = true;
}

function kartPos(slot: number): { x: number; z: number } {
  if (slot === mySlot) return { x: local.x, z: local.z };
  const k = latest?.karts[slot];
  return k ? { x: k.x, z: k.z } : { x: 0, z: 0 };
}

function handleEvent(e: RaceEvent, now: number): void {
  const me = 'slot' in e && e.slot === mySlot;
  switch (e.k) {
    case 'go':
      racing = true;
      hud.countdown('GO!', true);
      audio.countdown(true);
      chase.shake(0.2);
      return;
    case 'hit':
      if (me) {
        applySpin(local);
        chase.shake(0.9);
        hud.flash(0.3);
        audio.hit();
        bursts.hitAt(local.x, local.z);
      } else {
        defer(now, e);
      }
      return;
    case 'boost':
      if (me && e.tier === 4) {
        local.boostTime = Math.max(local.boostTime, TURBO_TIME);
        audio.boost(3);
        chase.shake(0.2);
      }
      return;
    case 'item':
      if (me) {
        local.item = e.item;
        hud.setItem(e.item);
        audio.pickup();
        bursts.sparkleAt(local.x, local.z);
      } else {
        defer(now, e);
      }
      return;
    case 'use':
      if (me) {
        local.item = null;
        hud.setItem(null);
        audio.useItem(e.item);
      } else if (e.item === 'zap') {
        hud.flash(0.5);
        audio.useItem('zap');
      }
      return;
    case 'star':
      if (me) {
        local.starTime = STAR_TIME;
        audio.starOn(true);
      }
      return;
    case 'lap':
      if (me) {
        const laps = geom?.def.laps ?? 3;
        hud.setLap(e.lap, laps);
        hud.banner(e.lap === laps ? 'FINAL LAP!' : `LAP ${e.lap}`);
        audio.lap();
      }
      return;
    case 'finish':
      if (me) {
        local.finished = true;
        local.finishTime = e.time;
        audio.finish(e.place);
        hud.banner(e.place === 1 ? 'YOU WIN! 🏆' : `${placeLabel(e.place)} PLACE!`, 2600);
        bursts.confettiAt(local.x, local.z);
        chase.shake(0.3);
        audio.starOn(false);
      } else {
        defer(now, e);
      }
      return;
    case 'over':
      setTimeout(() => showResults(), 400);
      return;
    case 'rocketPop':
    case 'trapPop':
    case 'box':
    case 'pad':
      defer(now, e);
      return;
  }
}

/** Effects on other karts wait until the frame they belong to is drawn. */
function defer(now: number, e: RaceEvent): void {
  eventQueue.push({ dueAt: now + (transport?.interpDelayMs ?? 0), e });
}

function playDeferred(e: RaceEvent): void {
  const near = (x: number, z: number): boolean => Math.hypot(x - local.x, z - local.z) < 45;
  switch (e.k) {
    case 'hit': {
      const p = kartPos(e.slot);
      bursts.hitAt(p.x, p.z);
      if (near(p.x, p.z)) audio.hit();
      break;
    }
    case 'item': {
      const p = kartPos(e.slot);
      bursts.sparkleAt(p.x, p.z);
      break;
    }
    case 'finish': {
      const p = kartPos(e.slot);
      bursts.confettiAt(p.x, p.z);
      break;
    }
    case 'rocketPop':
      bursts.rocketPopAt(e.x, e.z);
      if (near(e.x, e.z)) audio.rocketPop();
      break;
    case 'trapPop':
      bursts.bubblePopAt(e.x, e.z);
      if (near(e.x, e.z)) audio.trapPop();
      break;
    default:
      break;
  }
}

function showResults(): void {
  if (resultsShown || !latest || !lobby) return;
  resultsShown = true;
  const rows = latest.karts
    .map((k, i) => ({ k, i }))
    .filter(({ k }) => k.kind !== 'empty')
    .map(({ k, i }) => ({
      name: lobby!.players[i].name,
      color: findKart(lobby!.players[i].kart).color,
      place: k.place,
      time: k.finishTime,
      me: i === mySlot,
    }));
  ui.showResults(rows, { online: mode === 'online', isHost });
  hud.speedlines(false);
  audio.setDrift(false, 0);
}

// --- Interpolation -------------------------------------------------------------------

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Remote karts as they should be drawn now: a little behind the newest snapshot. */
function sampleKarts(now: number): KartSnap[] | null {
  if (buffer.length === 0) return null;
  const renderTime = now - (transport?.interpDelayMs ?? 0);
  const last = buffer[buffer.length - 1];
  if (buffer.length === 1 || renderTime >= last.recvAt) return last.snap.karts;
  if (renderTime <= buffer[0].recvAt) return buffer[0].snap.karts;
  for (let i = buffer.length - 2; i >= 0; i--) {
    const a = buffer[i];
    const b = buffer[i + 1];
    if (renderTime < a.recvAt) continue;
    const span = Math.max(1, b.recvAt - a.recvAt);
    const t = Math.min(1, Math.max(0, (renderTime - a.recvAt) / span));
    return a.snap.karts.map((ka, slot) => {
      const kb = b.snap.karts[slot];
      if (!kb) return ka;
      const jump = Math.hypot(kb.x - ka.x, kb.z - ka.z);
      if (jump > 12) return kb;
      return {
        ...ka,
        x: lerp(ka.x, kb.x, t),
        z: lerp(ka.z, kb.z, t),
        heading: ka.heading + angleDiff(kb.heading, ka.heading) * t,
        speed: lerp(ka.speed, kb.speed, t),
        steer: lerp(ka.steer, kb.steer, t),
      };
    });
  }
  return last.snap.karts;
}

// --- Simulation of our own kart --------------------------------------------------------

function stepLocal(dt: number, controls: Controls): void {
  if (!geom || !lobby) return;
  const stats = findKart(lobby.players[mySlot].kart).stats;
  let inp: KartInput;
  if (!racing) {
    inp = IDLE_INPUT;
  } else if (local.finished) {
    // Cruise round like the bots do once the race is run.
    autoBrain ??= createBrain(0.7, rand);
    const ctx = { geom, traps: [], karts: [], self: mySlot, rand };
    const b = botInput(local, autoBrain, ctx, dt);
    inp = { throttle: 0.45, steer: b.steer, drift: false };
  } else if ((window as unknown as { __game: { autopilot: boolean } }).__game.autopilot) {
    autoBrain ??= createBrain(0.9, rand);
    const ctx = { geom, traps: [], karts: [], self: mySlot, rand };
    inp = botInput(local, autoBrain, ctx, dt);
  } else {
    inp = controls;
  }
  const events = stepKart(local, inp, dt, geom, stats);
  for (const e of events) {
    if (e.kind === 'driftBoost') {
      audio.boost(e.tier);
      chase.shake(0.1 + e.tier * 0.08);
    } else if (e.kind === 'pad') {
      audio.padBoost();
    } else if (e.kind === 'bump') {
      audio.bump();
      chase.shake(0.35);
    }
  }
}

function frame(dt: number, now: number): void {
  clock += dt;
  hud.tick(dt);
  world?.update(dt, clock);

  if (mode === 'idle' || !started || !geom || !lobby) {
    // Menus: slow orbit around the start line.
    if (geom) {
      const p = pointAt(geom, -4, 0);
      chase.orbit(p.x, p.z, dt, 30);
    }
    for (let i = 0; i < MAX_KARTS; i++) kartFx[i]?.update({ drift: 0, driftCharge: 0, boostTime: 0, offroad: false, speed: 0, starTime: 0 }, 0);
    projectiles.update([], [], clock);
    audio.setEngine(false, 0, false);
    return;
  }

  // --- our kart ---
  const controls = input.read(dt);
  if (controls.use && racing && local.item && !local.finished) transport?.send({ t: 'use' });
  simAcc += dt;
  let steps = 0;
  while (simAcc >= TICK_DT && steps < 8) {
    stepLocal(TICK_DT, controls);
    simAcc -= TICK_DT;
    steps++;
  }
  if (steps === 8) simAcc = 0;

  const others = sampleKarts(now);
  if (others) {
    for (let i = 0; i < MAX_KARTS; i++) {
      if (i === mySlot || others[i].kind === 'empty') continue;
      const o = others[i];
      const ghost = createKart();
      ghost.x = o.x;
      ghost.z = o.z;
      pushApart(local, ghost);
    }
  }

  sinceReport += dt;
  if (sinceReport >= 1 / REPORT_RATE) {
    sinceReport = 0;
    reportsSent++;
    transport?.send({ t: 'kart', k: encodeKinematics(local) });
  }

  // item boxes: we notice the pickup, the race decides what it holds
  if (racing && !local.item && !local.finished && latest && now - lastPickupAt > 400) {
    for (let i = 0; i < geom.boxes.length; i++) {
      if (!latest.boxes[i]) continue;
      const b = geom.boxes[i];
      if (Math.abs(deltaS(geom, b.s, local.prog)) > 4) continue;
      if (Math.hypot(b.x - local.x, b.z - local.z) < BOX_RADIUS) {
        transport?.send({ t: 'pickup', box: i });
        lastPickupAt = now;
        break;
      }
    }
  }

  // wrong way?
  if (racing && !local.finished) {
    const smp = geom.samples[local.index];
    const facing = angleDiff(local.heading, headingOf(smp.tx, smp.tz));
    wrongWayTime = Math.abs(facing) > 2.0 && local.speed > 4 ? wrongWayTime + dt : 0;
  } else {
    wrongWayTime = 0;
  }
  hud.wrongWay(wrongWayTime > 1.2);

  // --- deferred effects for other karts ---
  while (eventQueue.length > 0 && eventQueue[0].dueAt <= now) playDeferred(eventQueue.shift()!.e);

  // --- draw ---
  const myView = kartViews[mySlot];
  if (myView) {
    myView.setVisible(true);
    myView.pose(local, dt, clock);
    kartFx[mySlot]?.update(local, myView.driftTier(local));
  }
  const tags: { name: string; color: string; x: number; y: number; visible: boolean }[] = [];
  const mapKarts: { x: number; z: number; color: string; me: boolean; visible: boolean }[] = [];
  const canvas = rig.engine.getRenderingCanvas()!;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  for (let i = 0; i < MAX_KARTS; i++) {
    const def = findKart(lobby.players[i].kart);
    if (i === mySlot) {
      mapKarts.push({ x: local.x, z: local.z, color: def.color, me: true, visible: true });
      continue;
    }
    const view = kartViews[i];
    const o = others?.[i];
    if (!view || !o || o.kind === 'empty') {
      view?.setVisible(false);
      continue;
    }
    view.setVisible(true);
    view.pose(o, dt, clock);
    kartFx[i]?.update(o, view.driftTier(o));
    mapKarts.push({ x: o.x, z: o.z, color: def.color, me: false, visible: true });
    const projected = Vector3.Project(
      new Vector3(o.x, 2.3, o.z),
      Matrix.IdentityReadOnly,
      rig.scene.getTransformMatrix(),
      rig.camera.viewport.toGlobal(cw, ch)
    );
    const dist = Math.hypot(o.x - local.x, o.z - local.z);
    tags.push({
      name: lobby.players[i].name,
      color: def.color,
      x: projected.x,
      y: projected.y,
      visible: projected.z > 0 && projected.z < 1 && dist < 70,
    });
  }
  hud.updateTags(tags);
  hud.drawMap(mapKarts);

  if (latest) {
    projectiles.update(latest.projectiles, latest.traps, clock);
    hud.setPlace(local.place);
    hud.setLap(Math.max(1, local.lap), geom.def.laps);
    hud.setItem(local.item);
    if (latest.phase === 'countdown') {
      const t = latest.timer;
      if (t > 3) {
        hud.countdown('GET READY');
      } else {
        const n = Math.ceil(t);
        if (n !== lastCountdownN && n > 0) {
          lastCountdownN = n;
          audio.countdown(false);
        }
        hud.countdown(String(Math.max(1, n)));
      }
    }
  }

  chase.follow(local, dt);
  hud.speedlines(local.boostTime > 0 || local.starTime > 0);
  audio.setEngine(true, Math.min(1.3, Math.abs(local.speed) / BASE_MAX_SPEED), local.boostTime > 0);
  audio.setDrift(local.drift !== 0 && Math.abs(local.speed) > 6, myView ? myView.driftTier(local) : 0);
  if (starWasOn && local.starTime <= 0) audio.starOn(false);
  starWasOn = local.starTime > 0;

  if (transport instanceof OnlineTransport) {
    const ping = transport.latencyMs > 0 ? `${Math.round(transport.latencyMs)}ms` : '…';
    hud.setConnection(`${roomCode} · ${ping}`);
  } else if (lobby) {
    hud.setConnection(`${findTrack(lobby.track).name} · ${lobby.difficulty}`);
  }
}

boot();
