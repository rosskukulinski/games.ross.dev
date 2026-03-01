import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';

export function usePassiveIncome() {
  const collectDailyIncome = useGameStore(s => s.collectDailyIncome);
  const lovedCount = useGameStore(s => s.lovedDragons.length);

  useEffect(() => {
    if (lovedCount === 0) return;

    // Check immediately on mount
    collectDailyIncome();

    // Check every minute
    const interval = setInterval(() => {
      collectDailyIncome();
    }, 60_000);

    return () => clearInterval(interval);
  }, [collectDailyIncome, lovedCount]);
}
