export function canAfford(current: number, cost: number): boolean {
  return current >= cost;
}

export function spend(current: number, cost: number): number | null {
  if (!canAfford(current, cost)) return null;
  return current - cost;
}

export function earn(current: number, amount: number): number {
  return current + amount;
}
