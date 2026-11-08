import type { DragonElement } from '../store/gameStoreTypes';
import { EGG_COSTS } from '../engine/constants';

export interface EggType {
  element: DragonElement;
  name: string;
  cost: number;
  description: string;
}

export const EGG_TYPES: EggType[] = [
  { element: 'fire', name: 'Fire Egg', cost: EGG_COSTS.fire, description: '🔥 Warm and glowing' },
  { element: 'nature', name: 'Nature Egg', cost: EGG_COSTS.nature, description: '🌿 Green and leafy' },
  { element: 'ice', name: 'Ice Egg', cost: EGG_COSTS.ice, description: '❄️ Cold and icy' },
  { element: 'storm', name: 'Storm Egg', cost: EGG_COSTS.storm, description: '⚡ Zappy and sparky' },
];
