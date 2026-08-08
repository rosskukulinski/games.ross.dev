import type { Snapshot, StepEvent } from './shared/rules';

export interface RosterEntry {
  id: number;
  name: string;
  bot: boolean;
}

export type ClientMessage =
  | { t: 'input'; x: number; y: number }
  | { t: 'ping'; id: number };

export type ServerMessage =
  | {
      t: 'joined';
      /** Your hole id. */
      id: number;
      code: string;
      tickRate: number;
      /** Arena seed — regenerate the identical prop layout locally. */
      seed: number;
      /** Prop ids currently eaten, so a mid-round joiner sees the right arena. */
      gone: number[];
    }
  | { t: 'roster'; players: RosterEntry[] }
  | { t: 'snap'; s: Snapshot; e?: StepEvent[] }
  | { t: 'pong'; id: number }
  | { t: 'full' };

/**
 * Everything the game loop needs from "a thing that runs an arena".
 *
 * Implemented twice — once over a WebSocket to the Durable Object, once
 * entirely in-page against bots — so `main.ts` never branches on game mode.
 */
export interface Transport {
  send(msg: ClientMessage): void;
  close(): void;
  /**
   * How far behind the newest snapshot to render, in ms. Buffered
   * interpolation needs at least one snapshot interval of slack; online play
   * needs more to ride out jitter.
   */
  readonly interpDelayMs: number;
  onMessage: ((msg: ServerMessage) => void) | null;
  /** Called with a human-readable reason when the arena can't continue. */
  onError: ((reason: string) => void) | null;
}
