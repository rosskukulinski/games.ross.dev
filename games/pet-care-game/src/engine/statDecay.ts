import { clamp } from '../utils/clamp';
import { DECAY_RATES, CRITICAL_THRESHOLD, HEALTHY_THRESHOLD, HEALTH_DECAY_PER_CRITICAL, HEALTH_REGEN_PER_HEALTHY } from './constants';
import type { DragonStats } from '../store/gameStoreTypes';

export function tickStats(stats: DragonStats, deltaSeconds: number): DragonStats {
  const next = { ...stats };

  // Apply base decay
  next.hunger = clamp(next.hunger + DECAY_RATES.hunger * deltaSeconds, 0, 100);
  next.thirst = clamp(next.thirst + DECAY_RATES.thirst * deltaSeconds, 0, 100);
  next.happiness = clamp(next.happiness + DECAY_RATES.happiness * deltaSeconds, 0, 100);
  next.energy = clamp(next.energy + DECAY_RATES.energy * deltaSeconds, 0, 100);
  next.hygiene = clamp(next.hygiene + DECAY_RATES.hygiene * deltaSeconds, 0, 100);

  // Derive health from other stats
  const coreStats = [next.hunger, next.thirst, next.happiness, next.energy, next.hygiene];
  const criticalCount = coreStats.filter(v => v < CRITICAL_THRESHOLD).length;
  const healthyCount = coreStats.filter(v => v > HEALTHY_THRESHOLD).length;

  const healthDelta = (healthyCount * HEALTH_REGEN_PER_HEALTHY + criticalCount * HEALTH_DECAY_PER_CRITICAL) * deltaSeconds;
  next.health = clamp(next.health + healthDelta, 0, 100);

  return next;
}
