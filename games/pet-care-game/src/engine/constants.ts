// Stat decay rates per second
export const DECAY_RATES = {
  hunger: -0.03,    // ~55 min to empty
  thirst: -0.05,    // ~33 min to empty
  happiness: -0.02, // ~83 min to empty
  energy: -0.015,   // ~111 min to empty
  hygiene: -0.01,   // ~167 min to empty
} as const;

// Stat thresholds
export const CRITICAL_THRESHOLD = 20;
export const HEALTHY_THRESHOLD = 60;
export const HEALTH_DECAY_PER_CRITICAL = -1.0;
export const HEALTH_REGEN_PER_HEALTHY = 0.2;

// Economy
export const STARTING_CURRENCY = 100;
export const PREMIUM_FOOD_COST = 10;

// Egg costs
export const EGG_COSTS = {
  fire: 80,
  ice: 100,
  nature: 90,
  storm: 120,
} as const;

// Hatch time in seconds
export const HATCH_TIME = 60;

// Love meter
export const MAX_LOVE = 100;
export const DAILY_INCOME_COINS = 5;
export const INCOME_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Growth stage requirements
export const GROWTH_STAGES = [
  { id: 0, name: 'Egg',       requiredCareMinutes: 0,   requiredLove: 0,   unlockedActions: [] },
  { id: 1, name: 'Hatchling', requiredCareMinutes: 0,   requiredLove: 0,   unlockedActions: ['feed-basic', 'feed-premium', 'water'] },
  { id: 2, name: 'Baby',      requiredCareMinutes: 5,   requiredLove: 15,  unlockedActions: ['feed-basic', 'feed-premium', 'water', 'play'] },
  { id: 3, name: 'Juvenile',  requiredCareMinutes: 15,  requiredLove: 35,  unlockedActions: ['feed-basic', 'feed-premium', 'water', 'play', 'walk'] },
  { id: 4, name: 'Teen',      requiredCareMinutes: 30,  requiredLove: 60,  unlockedActions: ['feed-basic', 'feed-premium', 'water', 'play', 'walk', 'bathe', 'sleep'] },
  { id: 5, name: 'Adult',     requiredCareMinutes: 60,  requiredLove: 100, unlockedActions: ['feed-basic', 'feed-premium', 'water', 'play', 'walk', 'bathe', 'sleep'] },
] as const;

// Max offline time for stat catchup (8 hours)
export const MAX_OFFLINE_SECONDS = 28800;

// Expedition timings (in minutes)
export const EXPEDITION_MIN_MINUTES = 5;
export const EXPEDITION_MAX_MINUTES = 30;
export const EXPEDITION_RETURN_MIN_MINUTES = 15;
export const EXPEDITION_RETURN_MAX_MINUTES = 60;

// Expedition rewards
export const EXPEDITION_MIN_COINS = 20;
export const EXPEDITION_MAX_COINS = 100;
