export const RACE_DURATION = 20;
export const MAX_SPEED = 100;
export const SPEED_GAIN_PER_TAP = 8;
export const SPEED_DECAY_PER_SECOND = 4;
export const DISTANCE_FACTOR = 0.5;

export function calculateReward(distance: number): number {
  if (distance >= 800) return 50;
  if (distance >= 600) return 40;
  if (distance >= 400) return 30;
  return 20;
}
