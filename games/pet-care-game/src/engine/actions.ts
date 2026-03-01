import type { DragonStats } from '../store/gameStoreTypes';

export interface CareAction {
  id: string;
  label: string;
  icon: string;
  cooldownSeconds: number;
  effects: Partial<DragonStats>;
  currencyCost?: number;
}

export const CARE_ACTIONS: CareAction[] = [
  {
    id: 'feed-basic',
    label: 'Feed',
    icon: '🍖',
    cooldownSeconds: 5,
    effects: { hunger: 25, happiness: 5, hygiene: -2 },
  },
  {
    id: 'feed-premium',
    label: 'Treat',
    icon: '🥩',
    cooldownSeconds: 5,
    effects: { hunger: 40, happiness: 15, thirst: 5, energy: 5, hygiene: -2 },
    currencyCost: 10,
  },
  {
    id: 'water',
    label: 'Water',
    icon: '💧',
    cooldownSeconds: 3,
    effects: { thirst: 30, happiness: 3 },
  },
  {
    id: 'play',
    label: 'Play',
    icon: '🎾',
    cooldownSeconds: 10,
    effects: { happiness: 30, thirst: -5, energy: -15, hygiene: -10 },
  },
  {
    id: 'walk',
    label: 'Walk',
    icon: '🚶',
    cooldownSeconds: 15,
    effects: { happiness: 20, hunger: -10, thirst: -10, energy: -20, hygiene: -5 },
  },
  {
    id: 'bathe',
    label: 'Bathe',
    icon: '🛁',
    cooldownSeconds: 20,
    effects: { hygiene: 40, happiness: -5, energy: -5 },
  },
  {
    id: 'sleep',
    label: 'Sleep',
    icon: '😴',
    cooldownSeconds: 30,
    effects: { energy: 50, happiness: 5 },
  },
];

export function applyAction(stats: DragonStats, effects: Partial<DragonStats>): DragonStats {
  const next = { ...stats };
  for (const [key, value] of Object.entries(effects)) {
    const k = key as keyof DragonStats;
    if (k in next && typeof value === 'number') {
      next[k] = Math.min(100, Math.max(0, next[k] + value));
    }
  }
  return next;
}
