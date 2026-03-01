import type { DragonElement } from '../store/gameStoreTypes';
import { EGG_COSTS } from '../engine/constants';

export interface EggType {
  element: DragonElement;
  name: string;
  cost: number;
  description: string;
}

export const EGG_TYPES: EggType[] = [
  { element: 'fire', name: 'Fire Egg', cost: EGG_COSTS.fire, description: 'A warm, glowing egg that radiates heat' },
  { element: 'nature', name: 'Nature Egg', cost: EGG_COSTS.nature, description: 'A mossy green egg with tiny leaves' },
  { element: 'ice', name: 'Ice Egg', cost: EGG_COSTS.ice, description: 'A crystalline egg that chills the air' },
  { element: 'storm', name: 'Storm Egg', cost: EGG_COSTS.storm, description: 'A crackling egg with sparks of lightning' },
];
