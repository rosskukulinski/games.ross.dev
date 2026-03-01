import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';

export function useExpeditions() {
  const checkExpeditions = useGameStore(s => s.checkExpeditions);

  useEffect(() => {
    // Check every 10 seconds
    const interval = setInterval(() => {
      checkExpeditions();
    }, 10000);

    // Also check immediately on mount
    checkExpeditions();

    return () => clearInterval(interval);
  }, [checkExpeditions]);
}
