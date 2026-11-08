import { useEffect, useRef } from 'react';

/**
 * Runs `onFinish` once each time `done` becomes true (and re-arms when it goes
 * false again, e.g. on "Play Again").
 *
 * Minigames used to pay out with `if (done && reward === 0) setReward(...)`
 * during render. A zero-coin round (a 5-year-old who taps nothing) never
 * changed `reward`, so React re-rendered forever and threw error #301.
 */
export function useOnFinish(done: boolean, onFinish: () => void) {
  const fired = useRef(false);
  const latest = useRef(onFinish);

  useEffect(() => {
    latest.current = onFinish;
  });

  useEffect(() => {
    if (!done) {
      fired.current = false;
      return;
    }
    if (fired.current) return;
    fired.current = true;
    latest.current();
  }, [done]);
}
