import type { ClientMessage, RosterEntry, ServerMessage, Transport } from './protocol';
import {
  type StepEvent,
  type World,
  BOT_NAMES,
  PHASE_WAITING,
  TARGET_POPULATION,
  TICK_DT,
  TICK_RATE,
  addHole,
  beginCountdown,
  createWorld,
  encodeSnapshot,
  setHoleInput,
  step,
} from './shared/rules';

/** Longest real-time gap the simulation will try to catch up on, in seconds. */
const MAX_CATCHUP_SECONDS = 0.25;
/**
 * Enough steps to fully drain a MAX_CATCHUP_SECONDS backlog. If this were any
 * smaller the arena would drift into slow motion on a slow device instead of
 * simply rendering fewer frames.
 */
const MAX_CATCHUP_STEPS = Math.ceil(MAX_CATCHUP_SECONDS / TICK_DT);

const PLAYER_ID = 0;

/**
 * Runs a whole arena in the page against bots, speaking the same protocol as
 * the Durable Object. Solo play is therefore not a separate code path in the
 * game — it's the same loop with a different transport.
 */
export class LocalTransport implements Transport {
  readonly interpDelayMs = 50;
  onMessage: ((msg: ServerMessage) => void) | null = null;
  onError: ((reason: string) => void) | null = null;

  private world: World = createWorld(Math.floor(Math.random() * 0xffffffff));
  private loop: ReturnType<typeof setInterval> | null = null;
  private lastTime = performance.now();
  private accumulator = 0;

  constructor(playerName: string) {
    addHole(this.world, PLAYER_ID, false);
    const roster: RosterEntry[] = [{ id: PLAYER_ID, name: playerName, bot: false }];
    for (let i = 1; i < TARGET_POPULATION; i++) {
      addHole(this.world, i, true);
      roster.push({ id: i, name: BOT_NAMES[(i - 1) % BOT_NAMES.length], bot: true });
    }
    beginCountdown(this.world);

    // Deliver the handshake after construction so callers can attach handlers.
    setTimeout(() => {
      this.onMessage?.({
        t: 'joined',
        id: PLAYER_ID,
        code: 'SOLO',
        tickRate: TICK_RATE,
        seed: this.world.seed,
        gone: [],
      });
      this.onMessage?.({ t: 'roster', players: roster });
      this.loop = setInterval(() => this.tick(), 1000 / TICK_RATE);
    }, 0);
  }

  send(msg: ClientMessage): void {
    switch (msg.t) {
      case 'input':
        setHoleInput(this.world, PLAYER_ID, msg.x, msg.y);
        break;
      case 'ping':
        this.onMessage?.({ t: 'pong', id: msg.id });
        break;
    }
  }

  close(): void {
    if (this.loop !== null) clearInterval(this.loop);
    this.loop = null;
  }

  private tick(): void {
    if (this.world.phase === PHASE_WAITING) beginCountdown(this.world);

    // Catch up on real elapsed time rather than assuming the interval fired on
    // schedule. A slow device drops frames instead of playing in slow motion.
    const now = performance.now();
    const elapsed = Math.min((now - this.lastTime) / 1000, MAX_CATCHUP_SECONDS);
    this.lastTime = now;
    this.accumulator += elapsed;

    const events: StepEvent[] = [];
    let steps = 0;
    while (this.accumulator >= TICK_DT && steps < MAX_CATCHUP_STEPS) {
      this.accumulator -= TICK_DT;
      steps++;
      events.push(...step(this.world, TICK_DT));
    }
    if (steps === 0) return;

    this.onMessage?.({
      t: 'snap',
      s: encodeSnapshot(this.world),
      ...(events.length ? { e: events } : {}),
    });
  }
}
