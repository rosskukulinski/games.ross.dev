export type ItemId = 'turbo' | 'rocket' | 'bubble' | 'star' | 'zap';

export interface ItemInfo {
  id: ItemId;
  name: string;
  /** What the HUD says the first time you hold one. */
  hint: string;
}

export const ITEMS: Record<ItemId, ItemInfo> = {
  turbo: { id: 'turbo', name: 'Turbo', hint: 'A big burst of speed' },
  rocket: { id: 'rocket', name: 'Rocket', hint: 'Chases the kart ahead of you' },
  bubble: { id: 'bubble', name: 'Bubble Trap', hint: 'Drops behind you and spins whoever hits it' },
  star: { id: 'star', name: 'Super Star', hint: 'Invincible and extra fast for a few seconds' },
  zap: { id: 'zap', name: 'Zap', hint: 'Spins out everyone else' },
};

export const TURBO_TIME = 1.5;
export const STAR_TIME = 6;
export const ROCKET_SPEED = 46;
export const ROCKET_LIFE = 9;
export const ROCKET_HIT_RADIUS = 1.7;
export const TRAP_LIFE = 45;
export const TRAP_HIT_RADIUS = 1.5;
export const BOX_RESPAWN = 3;

type Weights = Partial<Record<ItemId, number>>;

/**
 * Rubber-banded item table: the leader mostly gets traps, the back of the
 * pack gets stars and zaps. `place` is 1-based.
 */
export function rollItem(place: number, total: number, rand: () => number): ItemId {
  const frac = total <= 1 ? 0 : (place - 1) / (total - 1);
  let weights: Weights;
  if (frac < 0.34) {
    weights = { bubble: 45, turbo: 35, rocket: 20 };
  } else if (frac < 0.67) {
    weights = { rocket: 35, turbo: 35, bubble: 15, star: 15 };
  } else {
    weights = { star: 30, turbo: 25, zap: 22, rocket: 23 };
  }
  let sum = 0;
  for (const w of Object.values(weights)) sum += w;
  let r = rand() * sum;
  for (const [id, w] of Object.entries(weights) as [ItemId, number][]) {
    r -= w;
    if (r <= 0) return id;
  }
  return 'turbo';
}
