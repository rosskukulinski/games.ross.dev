export interface Card {
  id: string;
  symbol: string;
  flipped: boolean;
  matched: boolean;
}

const SYMBOLS = ['💎', '🏆', '👑', '🗝️', '🪙', '⭐', '🔮', '🎁'];

export function generateCards(): Card[] {
  const pairs = SYMBOLS.map((s, i) => [
    { id: `${i}a`, symbol: s, flipped: false, matched: false },
    { id: `${i}b`, symbol: s, flipped: false, matched: false },
  ]).flat();

  // Shuffle
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

export function calculateReward(pairsFound: number, moves: number): number {
  const base = pairsFound * 5;
  const efficiency = moves > 0 ? Math.max(0, 20 - Math.floor(moves / 4)) : 0;
  return Math.min(40, base + efficiency);
}

export const GAME_TIME = 60;
export const TOTAL_PAIRS = SYMBOLS.length;
