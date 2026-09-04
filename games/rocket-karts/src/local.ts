/**
 * Solo play: the race runs in the page, speaking the same protocol as the
 * Durable Object. `main.ts` never branches on game mode.
 */
import { Race, type Difficulty } from './shared/race.ts';
import { TICK_DT } from './shared/kart.ts';
import { encodeSnapshot, lobbyState, type ClientMessage, type ServerMessage, type Transport } from './shared/protocol.ts';

const MAX_CATCHUP = 0.25;

export class LocalTransport implements Transport {
  readonly interpDelayMs = 45;
  onMessage: ((msg: ServerMessage) => void) | null = null;
  onError: ((reason: string) => void) | null = null;

  readonly race: Race;
  readonly slot: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private acc = 0;
  private paused = false;

  constructor(trackId: string, kartId: string, difficulty: Difficulty, name: string) {
    this.race = new Race(trackId, difficulty);
    this.slot = this.race.addHuman(name, kartId, true);
    // Let the caller attach handlers before the first messages land.
    setTimeout(() => {
      this.emit({ t: 'joined', slot: this.slot, code: '', host: true });
      this.emitLobby();
    }, 0);
  }

  private emit(msg: ServerMessage): void {
    this.onMessage?.(msg);
  }

  private emitLobby(): void {
    this.emit({ t: 'lobby', ...lobbyState(this.race) });
  }

  send(msg: ClientMessage): void {
    const race = this.race;
    switch (msg.t) {
      case 'kart':
        race.reportHuman(this.slot, msg.k);
        break;
      case 'pick':
        race.setKart(this.slot, msg.kart);
        this.emitLobby();
        break;
      case 'track':
        race.setTrack(msg.id);
        this.emitLobby();
        break;
      case 'difficulty':
        race.setDifficulty(msg.d);
        this.emitLobby();
        break;
      case 'start':
        if (race.phase !== 'lobby') break;
        race.beginCountdown();
        this.emitLobby();
        this.emitSnapshot();
        this.startLoop();
        break;
      case 'pickup':
        race.requestPickup(this.slot, msg.box);
        break;
      case 'use':
        race.useItem(this.slot);
        break;
      case 'again':
        race.backToLobby();
        this.stopLoop();
        this.emitLobby();
        break;
      case 'ready':
        break;
      case 'ping':
        this.emit({ t: 'pong', id: msg.id });
        break;
    }
  }

  setPaused(p: boolean): void {
    this.paused = p;
    this.last = performance.now();
  }

  private startLoop(): void {
    if (this.timer) return;
    this.last = performance.now();
    this.acc = 0;
    this.timer = setInterval(() => this.tick(), 1000 / 60);
  }

  private stopLoop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const now = performance.now();
    let elapsed = (now - this.last) / 1000;
    this.last = now;
    if (this.paused) return;
    if (elapsed > MAX_CATCHUP) elapsed = MAX_CATCHUP;
    this.acc += elapsed;
    let stepped = false;
    while (this.acc >= TICK_DT) {
      this.race.step(TICK_DT);
      this.acc -= TICK_DT;
      stepped = true;
    }
    if (stepped) this.emitSnapshot();
  }

  private emitSnapshot(): void {
    const events = this.race.takeEvents();
    const msg: ServerMessage = { t: 'snap', s: encodeSnapshot(this.race) };
    if (events.length) msg.e = events;
    this.emit(msg);
  }

  close(): void {
    this.stopLoop();
    this.onMessage = null;
  }
}
