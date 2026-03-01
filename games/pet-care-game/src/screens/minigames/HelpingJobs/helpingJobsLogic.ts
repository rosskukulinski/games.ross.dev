import { randomBetween } from '../../../utils/randomBetween';

export type ItemType = 'potion_red' | 'potion_blue' | 'book' | 'tool' | 'food' | 'gem';

export const ITEM_ICONS: Record<ItemType, string> = {
  potion_red: '🧪',
  potion_blue: '🔵',
  book: '📕',
  tool: '🔧',
  food: '🍞',
  gem: '💎',
};

export interface JobOrder {
  items: { type: ItemType; count: number }[];
}

const ALL_TYPES: ItemType[] = ['potion_red', 'potion_blue', 'book', 'tool', 'food', 'gem'];

export function generateOrder(orderNum: number): JobOrder {
  const itemCount = Math.min(2 + Math.floor(orderNum / 2), 4);
  const shuffled = [...ALL_TYPES].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, itemCount);

  return {
    items: chosen.map(type => ({
      type,
      count: randomBetween(1, 3),
    })),
  };
}

export function checkDelivery(order: JobOrder, delivered: ItemType[]): boolean {
  // Build expected counts
  const expected: Record<string, number> = {};
  for (const item of order.items) {
    expected[item.type] = item.count;
  }

  // Build delivered counts
  const actual: Record<string, number> = {};
  for (const type of delivered) {
    actual[type] = (actual[type] ?? 0) + 1;
  }

  // Compare
  const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of allKeys) {
    if ((expected[key] ?? 0) !== (actual[key] ?? 0)) return false;
  }
  return true;
}

export function calculateReward(score: number): number {
  return Math.max(0, Math.floor(score * 1.2));
}
