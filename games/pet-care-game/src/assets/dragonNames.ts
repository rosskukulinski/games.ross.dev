import type { DragonElement } from '../store/gameStoreTypes';

// Short, easy-to-say names so a pre-reader never has to type one.
const NAMES: Record<DragonElement, string[]> = {
  fire: ['Ember', 'Sparky', 'Blaze', 'Cinder', 'Flicker', 'Toasty'],
  nature: ['Mossy', 'Sprout', 'Clover', 'Fern', 'Pebble', 'Leafy'],
  ice: ['Frosty', 'Snowball', 'Icicle', 'Flurry', 'Glacier', 'Chilly'],
  storm: ['Zappy', 'Thunder', 'Bolt', 'Breezy', 'Stormy', 'Zigzag'],
};

const SHARED = ['Pip', 'Biscuit', 'Noodle', 'Puff', 'Ziggy', 'Bean'];

export function randomDragonName(element: DragonElement, avoid?: string): string {
  const pool = [...NAMES[element], ...SHARED].filter(n => n !== avoid);
  return pool[Math.floor(Math.random() * pool.length)];
}
