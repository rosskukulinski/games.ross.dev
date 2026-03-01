import { useEffect, useRef } from 'react';

export function useGameLoop(active, callback) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!active) return;
    let raf;
    let lastTime = 0;

    const loop = (ts) => {
      const dt = lastTime ? Math.min(ts - lastTime, 50) : 16;
      lastTime = ts;
      cbRef.current(dt, ts);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
