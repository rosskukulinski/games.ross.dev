export interface KartStats {
  /** Top speed multiplier. */
  speed: number;
  /** Acceleration multiplier. */
  accel: number;
  /** Turn-rate multiplier. */
  handling: number;
}

export interface KartDef {
  id: string;
  name: string;
  /** Body colour. */
  color: string;
  /** Spoiler, helmet stripe, and glow accent. */
  accent: string;
  /** One-line personality shown on the picker. */
  blurb: string;
  stats: KartStats;
}

export const KARTS: KartDef[] = [
  {
    id: 'blaze',
    name: 'Blaze',
    color: '#ff3b3b',
    accent: '#ffd23b',
    blurb: 'Fastest on the straights',
    stats: { speed: 1.05, accel: 0.94, handling: 0.94 },
  },
  {
    id: 'bolt',
    name: 'Bolt',
    color: '#2f7bff',
    accent: '#7de3ff',
    blurb: 'Balanced all-rounder',
    stats: { speed: 1.0, accel: 1.0, handling: 1.0 },
  },
  {
    id: 'sprout',
    name: 'Sprout',
    color: '#3ecf5a',
    accent: '#f9f871',
    blurb: 'Quick off the line, loves corners',
    stats: { speed: 0.96, accel: 1.07, handling: 1.06 },
  },
  {
    id: 'sunny',
    name: 'Sunny',
    color: '#ffc02e',
    accent: '#ff6b2e',
    blurb: 'Zippy and easy to drive',
    stats: { speed: 0.98, accel: 1.08, handling: 1.02 },
  },
  {
    id: 'violet',
    name: 'Violet',
    color: '#9b5cff',
    accent: '#ff7ad9',
    blurb: 'Heavy hitter with big speed',
    stats: { speed: 1.03, accel: 0.97, handling: 0.97 },
  },
  {
    id: 'bubbles',
    name: 'Bubbles',
    color: '#ff5fb0',
    accent: '#7dfff0',
    blurb: 'Drifts like a dream',
    stats: { speed: 0.97, accel: 1.02, handling: 1.1 },
  },
];

export function findKart(id: string): KartDef {
  return KARTS.find((k) => k.id === id) ?? KARTS[0];
}

export const BOT_NAMES = ['Zoomer', 'Pip', 'Turbo', 'Nibbles', 'Skid', 'Captain Vroom'];
