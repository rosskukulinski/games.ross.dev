/**
 * Hole Munchers (hole-io) arena room — one Durable Object per room code.
 *
 * Unlike Air Hockey's two-seat rooms these are drop-in arenas: up to eight
 * humans share one world, bots top the population up, and rounds restart on
 * their own. The Durable Object is the authority: it runs the simulation at
 * 30Hz and broadcasts a snapshot every tick. The simulation itself lives in
 * the game directory and is shared verbatim with the client (which uses it
 * for solo play):
 *   games/hole-io/src/shared/rules.ts
 */

import {
  type StepEvent,
  type World,
  BOT_NAMES,
  MAX_HUMANS,
  PHASE_WAITING,
  TARGET_POPULATION,
  TICK_DT,
  TICK_RATE,
  addHole,
  beginCountdown,
  createWorld,
  encodeSnapshot,
  getHole,
  removeHole,
  setHoleInput,
  step,
} from '../../games/hole-io/src/shared/rules';

const EMPTY_ROOM_GRACE_MS = 60_000;

/** Bot hole ids live far above any human id so the two never collide. */
const BOT_ID_BASE = 1000;

interface HolePlayer {
  socket: WebSocket;
  id: number;
  name: string;
}

export class HoleRoom {
  private players: HolePlayer[] = [];
  private world: World = createWorld(Math.floor(Math.random() * 0xffffffff));
  private loop: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 0;
  private botCount = 0;

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: unknown
  ) {
    void this.ctx;
    void this.env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const name = (url.searchParams.get('name') || 'Player').slice(0, 12);

    if (this.players.length >= MAX_HUMANS) {
      // Tell the joiner why rather than dropping them silently.
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      server.accept();
      server.send(JSON.stringify({ t: 'full' }));
      server.close(4001, 'Arena is full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();

    const id = this.nextId++;
    const player: HolePlayer = { socket: server, id, name };
    this.players.push(player);
    addHole(this.world, id, false);

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
      id,
      code: url.pathname.split('/').pop()?.toUpperCase() ?? '',
      tickRate: TICK_RATE,
      seed: this.world.seed,
      gone: this.world.props.filter((p) => !p.alive).map((p) => p.id),
    });

    this.fillBots();
    this.broadcastRoster();

    if (this.world.phase === PHASE_WAITING) beginCountdown(this.world);
    this.startLoop();

    return new Response(null, { status: 101, webSocket: client });
  }

  private onMessage(player: HolePlayer, raw: unknown): void {
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
        // setHoleInput sanitizes and clamps, so a tampered client still can't
        // move faster than anyone else.
        setHoleInput(this.world, player.id, msg.x, msg.y);
        break;
      }
      case 'ping': {
        this.send(player, { t: 'pong', id: msg.id });
        break;
      }
    }
  }

  private onLeave(player: HolePlayer): void {
    const idx = this.players.indexOf(player);
    if (idx === -1) return;
    this.players.splice(idx, 1);
    removeHole(this.world, player.id);
    this.broadcastRoster();

    if (this.players.length === 0) {
      this.stopLoop();
      this.idleTimer = setTimeout(() => {
        this.world = createWorld(Math.floor(Math.random() * 0xffffffff));
        this.nextId = 0;
        this.botCount = 0;
        this.idleTimer = null;
      }, EMPTY_ROOM_GRACE_MS);
    }
  }

  /**
   * Top the arena up with bots so the first human still has a lively world.
   * Bots are only ever added — pulling one mid-round because a human arrived
   * would look like a player vanishing.
   */
  private fillBots(): void {
    while (this.players.length + this.botCount < TARGET_POPULATION) {
      addHole(this.world, BOT_ID_BASE + this.botCount, true);
      this.botCount++;
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

    const events = step(this.world, TICK_DT);
    const payload: { t: 'snap'; s: number[]; e?: StepEvent[] } = {
      t: 'snap',
      s: encodeSnapshot(this.world),
    };
    if (events.length) payload.e = events;
    this.broadcast(payload);
  }

  private broadcastRoster(): void {
    const players = [
      ...this.players.map((p) => ({ id: p.id, name: p.name, bot: false })),
      ...Array.from({ length: this.botCount }, (_, i) => ({
        id: BOT_ID_BASE + i,
        name: BOT_NAMES[i % BOT_NAMES.length],
        bot: true,
      })).filter((b) => getHole(this.world, b.id) !== undefined),
    ];
    this.broadcast({ t: 'roster', players });
  }

  private send(player: HolePlayer, msg: unknown): void {
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
