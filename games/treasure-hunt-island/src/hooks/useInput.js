import { useEffect, useRef } from 'react';

export function useInput() {
  const keys = useRef({ up: false, down: false, left: false, right: false, interact: false });
  const interactPressed = useRef(false);

  useEffect(() => {
    const setKey = (code, val) => {
      const k = keys.current;
      switch (code) {
        case 'KeyW': case 'ArrowUp':    k.up = val; break;
        case 'KeyS': case 'ArrowDown':  k.down = val; break;
        case 'KeyA': case 'ArrowLeft':  k.left = val; break;
        case 'KeyD': case 'ArrowRight': k.right = val; break;
        case 'KeyE': case 'Space':
          if (val && !interactPressed.current) {
            k.interact = true;
            interactPressed.current = true;
          }
          if (!val) {
            interactPressed.current = false;
          }
          break;
      }
    };

    const onDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      setKey(e.code, true);
    };
    const onUp = (e) => setKey(e.code, false);

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  return keys;
}
