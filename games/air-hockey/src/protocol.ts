import type { Side, Snapshot, StepEvent } from './shared/rules';

export type ClientMessage =
  | { t: 'input'; x: number; y: number }
  | { t: 'rematch' }
  | { t: 'ping'; id: number };

export type ServerMessage =
  | { t: 'joined'; side: Side; code: string; tickRate: number }
  | { t: 'roster'; names: [string, string]; present: [boolean, boolean]; rematch: [boolean, boolean] }
  | { t: 'snap'; s: Snapshot; e?: StepEvent[] }
  | { t: 'pong'; id: number }
  | { t: 'full' };

/**
 * Everything the game loop needs from "a thing that runs a match".
 *
 * Implemented twice — once over a WebSocket to the Durable Object, once
 * entirely in-page against a bot — so `main.ts` never branches on game mode.
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
  /** Called with a human-readable reason when the match can't continue. */
  onError: ((reason: string) => void) | null;
}
