/**
 * Air Hockey room: the Durable Object that hosts one two-player match. It is
 * the authority for the puck — it runs the physics at 60Hz and broadcasts
 * snapshots at 30Hz, so the two browsers can never disagree.
 *
 * The simulation is shared verbatim with the client:
 *   games/air-hockey/src/shared/rules.ts
 */
import {
  type Match,
  type Side,
  type Snapshot,
  type StepEvent,
  PHASE_OVER,
  PHASE_WAITING,
  TICK_DT,
  TICK_RATE,
  beginCountdown,
  createMatch,
  encodeSnapshot,
  resetMatch,
  setInput,
  step,
} from '../../games/air-hockey/src/shared/rules';
import type { Env } from './env';

const SNAPSHOT_EVERY = 2; // ticks — 60Hz simulation, 30Hz on the wire
const EMPTY_ROOM_GRACE_MS = 60_000;

interface Player {
  socket: WebSocket;
  side: Side;
  name: string;
  wantsRematch: boolean;
}

export class AirHockeyRoom {
  private players: Player[] = [];
  private match: Match = createMatch();
  private loop: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private sinceSnapshot = 0;
  private pendingEvents: StepEvent[] = [];

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

    if (this.players.length >= 2) {
      // Tell the joiner why rather than dropping them silently.
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      server.accept();
      server.send(JSON.stringify({ t: 'full' }));
      server.close(4001, 'Room is full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();

    const takenSides = new Set(this.players.map((p) => p.side));
    const side: Side = takenSides.has(0) ? 1 : 0;
    const player: Player = { socket: server, side, name, wantsRematch: false };
    this.players.push(player);

    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    server.addEventListener('message', (event: MessageEvent) => {
      this.onMessage(player, event.data);
    });
    const drop = (): void => this.onLeave(player);
    server.addEventListener('close', drop);
    server.addEventListener('error', drop);

    this.send(player, {
      t: 'joined',
      side,
      code: url.pathname.split('/').pop()?.toUpperCase() ?? '',
      tickRate: TICK_RATE,
    });
    this.broadcastRoster();

    // Two players present and nothing in flight: start a fresh match.
    if (this.players.length === 2 && this.match.phase === PHASE_WAITING) {
      resetMatch(this.match);
      this.broadcastRoster();
    }
    this.startLoop();

    return new Response(null, { status: 101, webSocket: client });
  }

  private onMessage(player: Player, raw: unknown): void {
    if (typeof raw !== 'string') return;
    let msg: { t?: string; x?: number; y?: number; id?: number };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.t) {
      case 'input': {
        if (typeof msg.x !== 'number' || typeof msg.y !== 'number') return;
        if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return;
        // setInput clamps to the player's own half, so a tampered client
        // still cannot reach across the table.
        setInput(this.match, player.side, msg.x, msg.y);
        break;
      }
      case 'rematch': {
        player.wantsRematch = true;
        if (this.match.phase !== PHASE_OVER) break;
        const others = this.players.filter((p) => p !== player);
        if (others.length === 0 || others.every((p) => p.wantsRematch)) {
          for (const p of this.players) p.wantsRematch = false;
          resetMatch(this.match);
        }
        this.broadcastRoster();
        break;
      }
      case 'ping': {
        this.send(player, { t: 'pong', id: msg.id });
        break;
      }
    }
  }

  private onLeave(player: Player): void {
    const idx = this.players.indexOf(player);
    if (idx === -1) return;
    this.players.splice(idx, 1);

    if (this.players.length < 2 && this.match.phase !== PHASE_OVER) {
      // Freeze the match — scores are kept so a dropped player can rejoin
      // the same room code and carry on.
      this.match.phase = PHASE_WAITING;
      this.match.timer = 0;
    }
    this.broadcastRoster();

    if (this.players.length === 0) {
      this.stopLoop();
      this.idleTimer = setTimeout(() => {
        this.match = createMatch();
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

    if (this.players.length === 2 && this.match.phase === PHASE_WAITING) {
      beginCountdown(this.match);
    }

    const events = step(this.match, TICK_DT);
    if (events.length) this.pendingEvents.push(...events);

    if (++this.sinceSnapshot >= SNAPSHOT_EVERY) {
      this.sinceSnapshot = 0;
      const payload: { t: 'snap'; s: Snapshot; e?: StepEvent[] } = {
        t: 'snap',
        s: encodeSnapshot(this.match),
      };
      if (this.pendingEvents.length) {
        payload.e = this.pendingEvents;
        this.pendingEvents = [];
      }
      this.broadcast(payload);
    }
  }

  private broadcastRoster(): void {
    const names: [string, string] = ['', ''];
    const present: [boolean, boolean] = [false, false];
    for (const p of this.players) {
      names[p.side] = p.name;
      present[p.side] = true;
    }
    this.broadcast({
      t: 'roster',
      names,
      present,
      rematch: [
        this.players.find((p) => p.side === 0)?.wantsRematch ?? false,
        this.players.find((p) => p.side === 1)?.wantsRematch ?? false,
      ],
    });
  }

  private send(player: Player, msg: unknown): void {
    try {
      player.socket.send(JSON.stringify(msg));
    } catch {
      // Socket already gone; the close handler will clean it up.
    }
  }

  private broadcast(msg: unknown): void {
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
