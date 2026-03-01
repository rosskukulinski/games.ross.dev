import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';

export function useGameLoop() {
  const tickGameLoop = useGameStore(s => s.tickGameLoop);
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      tickGameLoop(delta);
    }, 1000);

    return () => clearInterval(interval);
  }, [tickGameLoop]);
}
