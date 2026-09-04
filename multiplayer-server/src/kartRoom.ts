/**
 * Rocket Karts room: one Durable Object per room code, hosting a lobby and
 * then a race for up to four drivers.
 *
 * Each browser simulates its own kart and reports it here twenty times a
 * second; this object owns everything the drivers cannot decide for
 * themselves — the countdown, checkpoints and laps, standings, item boxes,
 * projectiles and the computer drivers that fill empty seats. The race logic
 * is shared verbatim with the client (which runs it in-page for solo play):
 *   games/rocket-karts/src/shared/race.ts
 */
import { Race, type Difficulty } from '../../games/rocket-karts/src/shared/race.ts';
import { TICK_DT, TICK_RATE, isKinematics } from '../../games/rocket-karts/src/shared/kart.ts';
import { SNAPSHOT_RATE, encodeSnapshot, lobbyState, type ClientMessage, type ServerMessage } from '../../games/rocket-karts/src/shared/protocol.ts';
import { KARTS } from '../../games/rocket-karts/src/shared/karts.ts';
import { TRACKS } from '../../games/rocket-karts/src/shared/tracks.ts';
import type { Env } from './env';

const SNAPSHOT_EVERY = Math.round(TICK_RATE / SNAPSHOT_RATE);
const EMPTY_ROOM_GRACE_MS = 60_000;
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

interface Player {
  socket: WebSocket;
  slot: number;
  name: string;
}

export class KartRoom {
  private players: Player[] = [];
  private race = new Race(TRACKS[0].id, 'normal');
  private loop: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private sinceSnapshot = 0;

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env
  ) {
    void this.ctx;
    void this.env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const name = (url.searchParams.get('name') || 'Player').slice(0, 12);
    const wantKart = url.searchParams.get('kart') || KARTS[0].id;
    const kart = KARTS.some((k) => k.id === wantKart) ? wantKart : KARTS[0].id;
    const code = url.pathname.split('/').pop()?.toUpperCase() ?? '';

    const reject = (msg: ServerMessage, status: number, reason: string): Response => {
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      server.accept();
      server.send(JSON.stringify(msg));
      server.close(status, reason);
      return new Response(null, { status: 101, webSocket: client });
    };

    if (this.race.phase !== 'lobby') return reject({ t: 'busy' }, 4002, 'Race in progress');
    const slot = this.race.addHuman(name, kart, this.players.length === 0);
    if (slot === -1) return reject({ t: 'full' }, 4001, 'Room is full');

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    const player: Player = { socket: server, slot, name };
    this.players.push(player);
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    server.addEventListener('message', (event: MessageEvent) => this.onMessage(player, event.data));
    const drop = (): void => this.onLeave(player);
    server.addEventListener('close', drop);
    server.addEventListener('error', drop);

    this.send(player, { t: 'joined', slot, code, host: this.race.slots[slot].host });
    this.broadcastLobby();
    return new Response(null, { status: 101, webSocket: client });
  }

  private isHost(player: Player): boolean {
    return this.race.slots[player.slot].host;
  }

  private onMessage(player: Player, raw: unknown): void {
    if (typeof raw !== 'string') return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    const race = this.race;
    switch (msg.t) {
      case 'kart':
        if (isKinematics(msg.k)) race.reportHuman(player.slot, msg.k);
        break;
      case 'pick':
        if (typeof msg.kart === 'string') {
          race.setKart(player.slot, msg.kart);
          this.broadcastLobby();
        }
        break;
      case 'ready':
        race.setReady(player.slot, msg.ready === true);
        this.broadcastLobby();
        break;
      case 'track':
        if (this.isHost(player) && typeof msg.id === 'string') {
          race.setTrack(msg.id);
          this.broadcastLobby();
        }
        break;
      case 'difficulty':
        if (this.isHost(player) && DIFFICULTIES.includes(msg.d)) {
          race.setDifficulty(msg.d);
          this.broadcastLobby();
        }
        break;
      case 'start': {
        if (!this.isHost(player) || race.phase !== 'lobby') break;
        const waiting = race.slots.some((s) => s.kind === 'human' && !s.host && !s.ready);
        if (waiting) break;
        race.beginCountdown();
        this.broadcastLobby();
        this.sinceSnapshot = SNAPSHOT_EVERY; // snapshot on the very next tick
        this.startLoop();
        break;
      }
      case 'pickup':
        if (typeof msg.box === 'number') race.requestPickup(player.slot, msg.box);
        break;
      case 'use':
        race.useItem(player.slot);
        break;
      case 'again':
        if (this.isHost(player) && race.phase === 'finished') {
          race.backToLobby();
          this.stopLoop();
          this.broadcastLobby();
        }
        break;
      case 'ping':
        this.send(player, { t: 'pong', id: msg.id });
        break;
    }
  }

  private onLeave(player: Player): void {
    const idx = this.players.indexOf(player);
    if (idx === -1) return;
    this.players.splice(idx, 1);
    const wasHost = this.isHost(player);
    this.race.removeHuman(player.slot);
    if (wasHost) {
      const next = this.players[0];
      if (next) this.race.slots[next.slot].host = true;
    }
    this.broadcastLobby();

    if (this.players.length === 0) {
      this.stopLoop();
      this.idleTimer = setTimeout(() => {
        this.race = new Race(TRACKS[0].id, 'normal');
        this.idleTimer = null;
      }, EMPTY_ROOM_GRACE_MS);
    }
  }

  private startLoop(): void {
    if (this.loop !== null) return;
    this.loop = setInterval(() => this.tick(), 1000 / TICK_RATE);
  }

  private stopLoop(): void {
    if (this.loop === null) return;
    clearInterval(this.loop);
    this.loop = null;
  }

  private tick(): void {
    if (this.players.length === 0) {
      this.stopLoop();
      return;
    }
    this.race.step(TICK_DT);
    if (++this.sinceSnapshot >= SNAPSHOT_EVERY) {
      this.sinceSnapshot = 0;
      const msg: ServerMessage = { t: 'snap', s: encodeSnapshot(this.race) };
      const events = this.race.takeEvents();
      if (events.length) msg.e = events;
      this.broadcast(msg);
    }
  }

  private broadcastLobby(): void {
    this.broadcast({ t: 'lobby', ...lobbyState(this.race) });
  }

  private send(player: Player, msg: ServerMessage): void {
    try {
      player.socket.send(JSON.stringify(msg));
    } catch {
      // Socket already gone; the close handler cleans up.
    }
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const p of this.players) {
      try {
        p.socket.send(data);
      } catch {
        // Ignore; close handler removes it.
      }
    }
  }
}
