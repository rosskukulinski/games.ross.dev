import { randomBetween } from '../utils/randomBetween';
import {
  EXPEDITION_MIN_MINUTES,
  EXPEDITION_MAX_MINUTES,
  EXPEDITION_RETURN_MIN_MINUTES,
  EXPEDITION_RETURN_MAX_MINUTES,
  EXPEDITION_MIN_COINS,
  EXPEDITION_MAX_COINS,
} from './constants';
import type { WildDragon } from '../store/gameStoreTypes';

export function releaseDragon(
  name: string,
  element: string,
): WildDragon {
  const expeditionMinutes = randomBetween(EXPEDITION_MIN_MINUTES, EXPEDITION_MAX_MINUTES);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    element,
    releasedAt: Date.now(),
    nextReturnAt: Date.now() + expeditionMinutes * 60 * 1000,
    totalPrizesCollected: 0,
    status: 'exploring',
  };
}

export function checkExpeditions(dragons: WildDragon[], now: number): WildDragon[] {
  return dragons.map(dragon => {
    if (dragon.status === 'exploring' && now >= dragon.nextReturnAt) {
      return { ...dragon, status: 'returned' as const };
    }
    return dragon;
  });
}

export function collectPrize(dragon: WildDragon): { coins: number; updatedDragon: WildDragon } {
  const coins = randomBetween(EXPEDITION_MIN_COINS, EXPEDITION_MAX_COINS);
  const nextExpeditionMinutes = randomBetween(EXPEDITION_RETURN_MIN_MINUTES, EXPEDITION_RETURN_MAX_MINUTES);

  return {
    coins,
    updatedDragon: {
      ...dragon,
      status: 'exploring',
      nextReturnAt: Date.now() + nextExpeditionMinutes * 60 * 1000,
      totalPrizesCollected: dragon.totalPrizesCollected + coins,
    },
  };
}
