import type { DragonStats } from '../store/gameStoreTypes';

// Base love gain per action
const BASE_LOVE: Record<string, number> = {
  'feed-basic': 2,
  'feed-premium': 3,
  'water': 2,
  'play': 3,
  'walk': 3,
  'bathe': 2,
  'sleep': 2,
};

// Which stat each action primarily addresses
const ACTION_STAT_MAP: Record<string, keyof DragonStats> = {
  'feed-basic': 'hunger',
  'feed-premium': 'hunger',
  'water': 'thirst',
  'play': 'happiness',
  'walk': 'happiness',
  'bathe': 'hygiene',
  'sleep': 'energy',
};

const NEED_BONUS_THRESHOLD = 40;
const NEED_BONUS_LOVE = 4;

// Passive love gain/loss per second
const PASSIVE_LOVE_GAIN = 0.005;  // slow gain when stats are healthy
const PASSIVE_LOVE_LOSS = 0.01;   // loss when stats are critical

export function calculateLoveGain(actionId: string, stats: DragonStats): number {
  const base = BASE_LOVE[actionId] ?? 1;
  const statKey = ACTION_STAT_MAP[actionId];

  // Bonus love when the stat this action addresses is low (dragon needed this!)
  if (statKey && stats[statKey] < NEED_BONUS_THRESHOLD) {
    return base + NEED_BONUS_LOVE;
  }

  return base;
}

export function tickLove(love: number, stats: DragonStats, deltaSeconds: number): number {
  const criticalCount = [stats.hunger, stats.thirst, stats.happiness, stats.energy, stats.hygiene]
    .filter(v => v < 20).length;
  const healthyCount = [stats.hunger, stats.thirst, stats.happiness, stats.energy, stats.hygiene]
    .filter(v => v > 60).length;

  let delta = 0;

  if (criticalCount > 0) {
    delta -= PASSIVE_LOVE_LOSS * criticalCount * deltaSeconds;
  } else if (healthyCount >= 4) {
    delta += PASSIVE_LOVE_GAIN * deltaSeconds;
  }

  return Math.min(100, Math.max(0, love + delta));
}
