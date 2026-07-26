export interface InputHandlers {
  onLeft: () => void;
  onRight: () => void;
  onJump: () => void;
  /** Any interaction — used to start/restart and to unlock audio. */
  onAny: () => void;
}

/** Keyboard + touch (swipe) input. */
export function setupInput(h: InputHandlers): void {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.repeat) return;
      // ignore pure modifier presses
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      h.onAny();
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          e.preventDefault();
          h.onLeft();
          break;
        case "ArrowRight":
        case "KeyD":
          e.preventDefault();
          h.onRight();
          break;
        case "ArrowUp":
        case "KeyW":
        case "Space":
          e.preventDefault();
          h.onJump();
          break;
      }
    },
    { passive: false }
  );

  // --- touch / pointer swipes ---
  let startX = 0;
  let startY = 0;
  let startT = 0;
  let tracking = false;

  const SWIPE_DIST = 28;

  window.addEventListener("pointerdown", (e) => {
    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
    startT = performance.now();
  });

  window.addEventListener("pointerup", (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dt = performance.now() - startT;
    h.onAny();
    if (dt > 700) return; // slow drag, ignore
    if (Math.abs(dx) < SWIPE_DIST && Math.abs(dy) < SWIPE_DIST) {
      // tap = jump (also the start/restart trigger via onAny)
      h.onJump();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) h.onRight();
      else h.onLeft();
    } else if (dy < 0) {
      h.onJump();
    }
  });

  window.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
}
