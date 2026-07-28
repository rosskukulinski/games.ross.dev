/**
 * Persistence. One namespaced key holding a versioned JSON blob — the hotel is
 * meant to still be there tomorrow, so this is the one part of the game that
 * must never silently lose data.
 *
 * Every access is wrapped: Safari in private mode throws on localStorage
 * writes, and a save game is not worth crashing a five-year-old's hotel over.
 */
import { SAVE_KEY, SAVE_VERSION, OFFLINE_CAP_S, OFFLINE_RATE } from "./config";

export interface SaveBlob {
  version: number;
  /** Epoch ms at the moment of the last write. */
  ts: number;
  bank: number;
  /** Ids from content.ts that have been fully paid for. */
  built: string[];
  /** Partial drain-to-buy progress, so an interrupted purchase isn't lost. */
  payProgress: Record<string, number>;
  stars: number;
  served: number;
  walkouts: number;
}

/**
 * Set while a reset is in flight so a queued autosave can't resurrect the
 * hotel we just deleted.
 */
let savingDisabled = false;

export function disableSaving(): void {
  savingDisabled = true;
}

export function enableSaving(): void {
  savingDisabled = false;
}

export function emptySave(): SaveBlob {
  return {
    version: SAVE_VERSION,
    ts: Date.now(),
    bank: 0,
    built: [],
    payProgress: {},
    stars: 3,
    served: 0,
    walkouts: 0,
  };
}

export function load(): SaveBlob | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return migrate(parsed);
}

/**
 * Validate and upgrade an unknown blob. Anything that doesn't survive the
 * checks is discarded rather than half-applied — a corrupt save that loads
 * into a broken hotel is worse than starting over.
 */
function migrate(input: unknown): SaveBlob | null {
  if (typeof input !== "object" || input === null) return null;
  const s = input as Record<string, unknown>;

  // v1 is the first shipped format; future versions upgrade in place here.
  if (typeof s.version !== "number" || s.version > SAVE_VERSION) return null;

  if (!Array.isArray(s.built)) return null;
  const built = s.built.filter((v): v is string => typeof v === "string");

  const pay: Record<string, number> = {};
  if (typeof s.payProgress === "object" && s.payProgress !== null) {
    for (const [k, v] of Object.entries(s.payProgress as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) pay[k] = v;
    }
  }

  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;

  return {
    version: SAVE_VERSION,
    ts: num(s.ts, Date.now()),
    bank: Math.max(0, num(s.bank, 0)),
    built,
    payProgress: pay,
    stars: Math.min(5, Math.max(0, num(s.stars, 3))),
    served: Math.max(0, Math.floor(num(s.served, 0))),
    walkouts: Math.max(0, Math.floor(num(s.walkouts, 0))),
  };
}

export function write(blob: SaveBlob): void {
  if (savingDisabled) return;
  blob.ts = Date.now();
  blob.version = SAVE_VERSION;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
  } catch {
    // out of quota, or private mode — the session still plays fine
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * What the staff earned while the tab was closed.
 *
 * Clamped at *both* ends: a device clock that has moved backwards must not
 * produce a negative payout, and a month away must not produce a fortune.
 */
export function offlineEarnings(savedAt: number, ratePerSecond: number): { seconds: number; coins: number } {
  if (ratePerSecond <= 0) return { seconds: 0, coins: 0 };
  const raw = (Date.now() - savedAt) / 1000;
  const seconds = Math.min(OFFLINE_CAP_S, Math.max(0, raw));
  if (seconds < 60) return { seconds: 0, coins: 0 };
  return { seconds, coins: Math.floor(seconds * ratePerSecond * OFFLINE_RATE) };
}
