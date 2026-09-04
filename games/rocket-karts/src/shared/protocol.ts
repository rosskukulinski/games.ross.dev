/**
 * Wire format between a driver (browser) and the race (Durable Object, or the
 * in-page solo host). Everything is JSON; snapshots are packed into arrays
 * because they go out twenty times a second.
 */
import type { Difficulty, Phase, Race, RaceEvent, SlotKind } from './race.ts';
import { PHASE_INDEX } from './race.ts';
import type { ItemId } from './items.ts';

export const SNAPSHOT_RATE = 20;
export const REPORT_RATE = 20;

export type ClientMessage =
  | { t: 'kart'; k: number[] }
  | { t: 'pick'; kart: string }
  | { t: 'ready'; ready: boolean }
  | { t: 'track'; id: string }
  | { t: 'difficulty'; d: Difficulty }
  | { t: 'start' }
  | { t: 'pickup'; box: number }
  | { t: 'use' }
  | { t: 'again' }
  | { t: 'ping'; id: number };

export interface LobbyPlayer {
  slot: number;
  name: string;
  kart: string;
  ready: boolean;
  kind: SlotKind;
  host: boolean;
}

export interface LobbyState {
  players: LobbyPlayer[];
  track: string;
  difficulty: Difficulty;
  phase: Phase;
}

export type ServerMessage =
  | { t: 'joined'; slot: number; code: string; host: boolean }
  | ({ t: 'lobby' } & LobbyState)
  | { t: 'snap'; s: SnapWire; e?: RaceEvent[] }
  | { t: 'pong'; id: number }
  | { t: 'full' }
  | { t: 'busy' }
  | { t: 'closed'; reason: string };

/**
 * Everything the game loop needs from "a thing that runs a race".
 * Implemented over a WebSocket for online play and entirely in-page for solo.
 */
export interface Transport {
  send(msg: ClientMessage): void;
  close(): void;
  /** How far behind the newest snapshot to render remote karts, in ms. */
  readonly interpDelayMs: number;
  onMessage: ((msg: ServerMessage) => void) | null;
  onError: ((reason: string) => void) | null;
}

export const ITEM_ORDER: ItemId[] = ['turbo', 'rocket', 'bubble', 'star', 'zap'];

export interface KartSnap {
  kind: SlotKind;
  x: number;
  z: number;
  heading: number;
  speed: number;
  steer: number;
  drift: number;
  driftCharge: number;
  boostTime: number;
  spinTime: number;
  starTime: number;
  offroad: boolean;
  lap: number;
  next: number;
  prog: number;
  place: number;
  item: ItemId | null;
  finished: boolean;
  finishTime: number;
  wrongWay: boolean;
}

export interface Snapshot {
  phase: Phase;
  timer: number;
  time: number;
  karts: KartSnap[];
  projectiles: { id: number; x: number; z: number; heading: number }[];
  traps: { id: number; x: number; z: number }[];
  boxes: boolean[];
}

export interface SnapWire {
  ph: number;
  tm: number;
  t: number;
  k: number[][];
  p: number[][];
  tr: number[][];
  bx: number[];
}

const KIND_INDEX: SlotKind[] = ['empty', 'human', 'bot'];

function r(v: number, places: number): number {
  const m = 10 ** places;
  return Math.round(v * m) / m;
}

export function encodeSnapshot(race: Race): SnapWire {
  return {
    ph: PHASE_INDEX.indexOf(race.phase),
    tm: r(race.timer, 2),
    t: r(race.time, 2),
    k: race.karts.map((k, i) => [
      KIND_INDEX.indexOf(race.slots[i].kind),
      r(k.x, 2),
      r(k.z, 2),
      r(k.heading, 3),
      r(k.speed, 2),
      r(k.steer, 2),
      k.drift,
      r(k.driftCharge, 2),
      r(k.boostTime, 2),
      r(k.spinTime, 2),
      r(k.starTime, 2),
      k.offroad ? 1 : 0,
      k.lap,
      k.next,
      r(k.prog, 1),
      k.place,
      k.item ? ITEM_ORDER.indexOf(k.item) : -1,
      k.finished ? 1 : 0,
      r(k.finishTime, 2),
      k.wrongWayTime > 1 ? 1 : 0,
    ]),
    p: race.projectiles.map((p) => [p.id, r(p.x, 2), r(p.z, 2), r(p.heading, 3)]),
    tr: race.traps.map((t) => [t.id, r(t.x, 2), r(t.z, 2)]),
    bx: race.boxes.map((b) => (b.active ? 1 : 0)),
  };
}

export function decodeSnapshot(w: SnapWire): Snapshot {
  return {
    phase: PHASE_INDEX[w.ph] ?? 'lobby',
    timer: w.tm,
    time: w.t,
    karts: w.k.map((a) => ({
      kind: KIND_INDEX[a[0]] ?? 'empty',
      x: a[1],
      z: a[2],
      heading: a[3],
      speed: a[4],
      steer: a[5],
      drift: a[6],
      driftCharge: a[7],
      boostTime: a[8],
      spinTime: a[9],
      starTime: a[10],
      offroad: a[11] === 1,
      lap: a[12],
      next: a[13],
      prog: a[14],
      place: a[15],
      item: a[16] >= 0 ? ITEM_ORDER[a[16]] : null,
      finished: a[17] === 1,
      finishTime: a[18],
      wrongWay: a[19] === 1,
    })),
    projectiles: w.p.map((a) => ({ id: a[0], x: a[1], z: a[2], heading: a[3] })),
    traps: w.tr.map((a) => ({ id: a[0], x: a[1], z: a[2] })),
    boxes: w.bx.map((b) => b === 1),
  };
}

export function lobbyState(race: Race): LobbyState {
  return {
    players: race.slots.map((s, i) => ({
      slot: i,
      name: s.name,
      kart: s.kartId,
      ready: s.ready,
      kind: s.kind,
      host: s.host,
    })),
    track: race.trackId,
    difficulty: race.difficulty,
    phase: race.phase,
  };
}
