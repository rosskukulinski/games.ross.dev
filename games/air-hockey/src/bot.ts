import type { ClientMessage, ServerMessage, Transport } from './protocol';
import {
  type Match,
  type StepEvent,
  PADDLE_R,
  PHASE_OVER,
  PHASE_WAITING,
  PUCK_R,
  TABLE_H,
  TABLE_W,
  TICK_DT,
  TICK_RATE,
  clampPaddleTarget,
  createMatch,
  encodeSnapshot,
  resetMatch,
  setInput,
  step,
} from './shared/rules';

export type Difficulty = 'easy' | 'normal' | 'hard';

/** Longest real-time gap the simulation will try to catch up on, in seconds. */
const MAX_CATCHUP_SECONDS = 0.25;
/**
 * Enough steps to fully drain a MAX_CATCHUP_SECONDS backlog. If this were any
 * smaller the match would drift into slow motion on a slow device instead of
 * simply rendering fewer frames.
 */
const MAX_CATCHUP_STEPS = Math.ceil(MAX_CATCHUP_SECONDS / TICK_DT);

interface BotConfig {
  /** Table units per second the bot's hand can travel. */
  speed: number;
  /** Seconds of puck movement the bot anticipates. */
  lead: number;
  /** Aim wobble, in table units. */
  noise: number;
  /** How often the wobble is re-rolled, in seconds. */
  reaction: number;
  /** Fraction of table depth (from the bot's end) it will chase the puck into. */
  attackDepth: number;
  /** 0..1 — how faithfully the bot mirrors the puck's x while guarding its goal. */
  defendGain: number;
  /** Chance per reaction re-roll that the bot loafs at home instead of playing. */
  napChance: number;
}

const CONFIG: Record<Difficulty, BotConfig> = {
  // Raw speed alone doesn't make a beatable opponent — a slow bot that never
  // stops trying still blocks everything. Easy is tuned for a five-year-old:
  // it dawdles, guards its goal half-heartedly, only chases the puck deep in
  // its own end, and regularly naps at home while a goal sails past.
  easy: {
    speed: 46,
    lead: 0,
    noise: 16,
    reaction: 0.55,
    attackDepth: 0.38,
    defendGain: 0.18,
    napChance: 0.35,
  },
  normal: {
    speed: 112,
    lead: 0.06,
    noise: 8,
    reaction: 0.22,
    attackDepth: 0.5,
    defendGain: 0.3,
    napChance: 0.08,
  },
  hard: {
    speed: 206,
    lead: 0.13,
    noise: 2.5,
    reaction: 0.07,
    attackDepth: 0.55,
    defendGain: 0.35,
    napChance: 0,
  },
};

/**
 * Runs a whole match in the page against a bot, speaking the same protocol as
 * the Durable Object. Solo play is therefore not a separate code path in the
 * game — it's the same loop with a different transport.
 */
export class BotTransport implements Transport {
  readonly interpDelayMs = 28;
  onMessage: ((msg: ServerMessage) => void) | null = null;
  onError: ((reason: string) => void) | null = null;

  private match: Match = createMatch();
  private loop: ReturnType<typeof setInterval> | null = null;
  private readonly cfg: BotConfig;

  // Bot hand position + current aim wobble.
  private handX = TABLE_W / 2;
  private handY = PADDLE_R + 14;
  private noiseX = 0;
  private noiseY = 0;
  private noiseTimer = 0;
  private napping = false;
  private lastTime = performance.now();
  private accumulator = 0;

  constructor(difficulty: Difficulty) {
    this.cfg = CONFIG[difficulty];
    // Deliver the handshake after construction so callers can attach handlers.
    setTimeout(() => {
      this.onMessage?.({ t: 'joined', side: 0, code: 'SOLO', tickRate: TICK_RATE });
      this.onMessage?.({
        t: 'roster',
        names: ['You', 'Computer'],
        present: [true, true],
        rematch: [false, false],
      });
      resetMatch(this.match);
      this.loop = setInterval(() => this.tick(), 1000 / TICK_RATE);
    }, 0);
  }

  send(msg: ClientMessage): void {
    switch (msg.t) {
      case 'input':
        setInput(this.match, 0, msg.x, msg.y);
        break;
      case 'rematch':
        if (this.match.phase === PHASE_OVER) resetMatch(this.match);
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
    if (this.match.phase === PHASE_WAITING) resetMatch(this.match);

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
      this.driveBot(TICK_DT);
      events.push(...step(this.match, TICK_DT));
    }
    if (steps === 0) return;

    this.onMessage?.({
      t: 'snap',
      s: encodeSnapshot(this.match),
      ...(events.length ? { e: events } : {}),
    });
  }

  private driveBot(dt: number): void {
    const { puck } = this.match;
    const cfg = this.cfg;

    this.noiseTimer -= dt;
    if (this.noiseTimer <= 0) {
      this.noiseTimer = cfg.reaction;
      this.noiseX = (Math.random() * 2 - 1) * cfg.noise;
      this.noiseY = (Math.random() * 2 - 1) * cfg.noise * 0.6;
      this.napping = Math.random() < cfg.napChance;
    }

    const homeY = PADDLE_R + 14;
    let wantX: number;
    let wantY: number;
    let speed = cfg.speed;

    if (this.napping) {
      // Zoned out — amble home and ignore the puck until the next re-roll.
      wantX = TABLE_W / 2;
      wantY = homeY;
      speed *= 0.5;
    } else if (puck.y < TABLE_H * cfg.attackDepth) {
      // Puck is in reach — line up behind it so the hit goes downfield.
      wantX = puck.x + puck.vx * cfg.lead;
      wantY = puck.y + puck.vy * cfg.lead - (PADDLE_R + PUCK_R) * 0.8;
    } else {
      // Puck is down the other end — shadow it from the goal line.
      wantX = TABLE_W / 2 + (puck.x - TABLE_W / 2) * cfg.defendGain;
      wantY = homeY;
    }

    wantX += this.noiseX;
    wantY += this.noiseY;

    const dx = wantX - this.handX;
    const dy = wantY - this.handY;
    const d = Math.hypot(dx, dy);
    const maxStep = speed * dt;
    if (d > maxStep && d > 0) {
      this.handX += (dx / d) * maxStep;
      this.handY += (dy / d) * maxStep;
    } else {
      this.handX = wantX;
      this.handY = wantY;
    }

    const clamped = clampPaddleTarget(1, this.handX, this.handY);
    this.handX = clamped.x;
    this.handY = clamped.y;
    setInput(this.match, 1, this.handX, this.handY);
  }
}
