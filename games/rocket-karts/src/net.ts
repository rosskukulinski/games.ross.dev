import type { ClientMessage, ServerMessage, Transport } from './shared/protocol.ts';
import { CODE_LENGTH } from './shared/codes.ts';

/**
 * Resolve the multiplayer server, in priority order:
 *   1. `?server=` — for local testing against `wrangler dev`
 *   2. `VITE_MP_SERVER_URL` — baked in at build time by CI
 *   3. `<same origin>/mp` — works if the Worker is mounted on a route
 */
export function resolveServerBase(): string {
  const override = new URLSearchParams(location.search).get('server');
  const configured = import.meta.env.VITE_MP_SERVER_URL as string | undefined;
  const raw = override || configured || `${location.origin}/mp`;
  return raw.replace(/\/+$/, '');
}

function toWebSocketUrl(base: string, path: string): string {
  const url = new URL(base + path, location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : url.protocol === 'http:' ? 'ws:' : url.protocol;
  return url.toString();
}

/** Is a multiplayer server reachable? Checked before showing anyone a room code. */
export async function probeServer(timeoutMs = 4000): Promise<boolean> {
  const base = resolveServerBase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(base + '/health', location.href);
    url.protocol = url.protocol === 'wss:' ? 'https:' : url.protocol === 'ws:' ? 'http:' : url.protocol;
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export class OnlineTransport implements Transport {
  readonly interpDelayMs = 100;
  onMessage: ((msg: ServerMessage) => void) | null = null;
  onError: ((reason: string) => void) | null = null;

  private socket: WebSocket | null = null;
  private closedByUs = false;
  private opened = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  latencyMs = 0;

  constructor(
    readonly code: string,
    private readonly name: string,
    private readonly kartId: string
  ) {
    if (code.length !== CODE_LENGTH) throw new Error('bad code');
    this.connect();
  }

  private connect(): void {
    const url = toWebSocketUrl(
      resolveServerBase(),
      `/rocket-karts/room/${this.code}?name=${encodeURIComponent(this.name)}&kart=${encodeURIComponent(this.kartId)}`
    );
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.onError?.("Couldn't reach the game server.");
      return;
    }
    this.socket = socket;

    const openTimeout = setTimeout(() => {
      if (!this.opened) {
        this.closedByUs = true;
        socket.close();
        this.onError?.("Couldn't reach the game server.");
      }
    }, 8000);

    socket.addEventListener('open', () => {
      this.opened = true;
      clearTimeout(openTimeout);
      this.pingTimer = setInterval(() => this.send({ t: 'ping', id: Math.floor(performance.now()) }), 2000);
    });

    socket.addEventListener('message', (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      if (msg.t === 'pong') {
        const rtt = performance.now() - msg.id;
        this.latencyMs = this.latencyMs === 0 ? rtt : this.latencyMs * 0.7 + rtt * 0.3;
        return;
      }
      if (msg.t === 'full') {
        this.closedByUs = true;
        this.onError?.('That race already has four drivers.');
        return;
      }
      if (msg.t === 'busy') {
        this.closedByUs = true;
        this.onError?.('That race has already started. Ask the host to start a new one after it ends.');
        return;
      }
      if (msg.t === 'closed') {
        this.closedByUs = true;
        this.onError?.(msg.reason);
        return;
      }
      this.onMessage?.(msg);
    });

    socket.addEventListener('close', () => {
      clearTimeout(openTimeout);
      if (this.pingTimer !== null) clearInterval(this.pingTimer);
      this.pingTimer = null;
      if (!this.closedByUs) {
        this.onError?.(this.opened ? 'Lost connection to the race.' : "Couldn't reach the game server.");
      }
    });
    socket.addEventListener('error', () => {
      // `close` always follows.
    });
  }

  send(msg: ClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(msg));
  }

  close(): void {
    this.closedByUs = true;
    if (this.pingTimer !== null) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.socket?.close();
    this.socket = null;
    this.onMessage = null;
  }
}
