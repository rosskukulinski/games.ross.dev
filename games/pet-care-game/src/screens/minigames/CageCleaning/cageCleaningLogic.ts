import { randomBetween } from '../../../utils/randomBetween';

export interface DirtSpot {
  id: string;
  x: number;
  y: number;
  size: 'small' | 'medium' | 'large';
  cleanProgress: number; // 0 to 1
  radius: number;
}

const SIZE_CONFIG = {
  small: { radius: 20, scrubTime: 1 },
  medium: { radius: 30, scrubTime: 2 },
  large: { radius: 40, scrubTime: 3 },
};

export function getDirtEmoji(size: DirtSpot['size']): string {
  return size === 'large' ? '💩' : size === 'medium' ? '🟤' : '🟫';
}

export function generateDirtSpots(count: number): DirtSpot[] {
  const sizes: DirtSpot['size'][] = ['small', 'medium', 'large'];
  return Array.from({ length: count }, (_, i) => {
    const size = sizes[randomBetween(0, sizes.length - 1)];
    return {
      id: `dirt-${i}`,
      x: randomBetween(10, 85),
      y: randomBetween(10, 80),
      size,
      cleanProgress: 0,
      radius: SIZE_CONFIG[size].radius,
    };
  });
}

export function scrubRate(size: DirtSpot['size']): number {
  return 1 / SIZE_CONFIG[size].scrubTime;
}

export function calculateReward(spots: DirtSpot[]): number {
  const totalCleaned = spots.filter(s => s.cleanProgress >= 1).length;
  const total = spots.length;
  const percentage = totalCleaned / total;
  const base = Math.floor(percentage * 50);
  const perfectBonus = totalCleaned === total ? 15 : 0;
  return base + perfectBonus;
}
