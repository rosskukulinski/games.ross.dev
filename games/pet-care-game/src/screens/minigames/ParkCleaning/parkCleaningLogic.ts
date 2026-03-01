import { randomBetween } from '../../../utils/randomBetween';

export interface TrashItem {
  id: string;
  x: number;
  y: number;
  type: 'wrapper' | 'can' | 'leaf' | 'bottle';
  hidden: boolean;
  collected: boolean;
}

const TRASH_ICONS: Record<TrashItem['type'], string> = {
  wrapper: '🍬',
  can: '🥫',
  leaf: '🍂',
  bottle: '🍶',
};

export function getTrashIcon(type: TrashItem['type']): string {
  return TRASH_ICONS[type];
}

export function generateTrashItems(count: number): TrashItem[] {
  const types: TrashItem['type'][] = ['wrapper', 'can', 'leaf', 'bottle'];
  return Array.from({ length: count }, (_, i) => ({
    id: `trash-${i}`,
    x: randomBetween(5, 90),
    y: randomBetween(5, 85),
    type: types[randomBetween(0, types.length - 1)],
    hidden: Math.random() < 0.2,
    collected: false,
  }));
}

export function calculateReward(collected: number, total: number): number {
  const base = Math.floor(collected * 1.5);
  const perfectBonus = collected === total ? 10 : 0;
  return base + perfectBonus;
}
