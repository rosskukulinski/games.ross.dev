export interface InputHandlers {
  onLeft: () => void;
  onRight: () => void;
  onJump: () => void;
  /** A short tap at a screen position — the game maps it to a tap zone. */
  onTap: (x: number, y: number) => void;
  /**
   * Any interaction — used to start/restart, unpause and unlock audio.
   * Returns true when the interaction was consumed (it started a run,
   * restarted, or unpaused), so it should not also steer or jump.
   */
  onAny: (source: "key" | "pointer") => boolean;
}

/** Keyboard + touch (tap zones and swipes) input. */
export function setupInput(h: InputHandlers): void {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.repeat) return;
      // ignore pure modifier presses
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(e.code)) e.preventDefault();
      if (h.onAny("key")) return;
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          h.onLeft();
          break;
        case "ArrowRight":
        case "KeyD":
          h.onRight();
          break;
        case "ArrowUp":
        case "KeyW":
        case "Space":
          h.onJump();
          break;
      }
    },
    { passive: false }
  );

  // --- touch / pointer: taps (zones) and swipes ---
  let startX = 0;
  let startY = 0;
  let tracking = false;

  const SWIPE_DIST = 28;

  window.addEventListener("pointerdown", (e) => {
    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
  });

  window.addEventListener("pointercancel", () => {
    tracking = false;
  });

  window.addEventListener("pointerup", (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (h.onAny("pointer")) return;
    if (Math.abs(dx) < SWIPE_DIST && Math.abs(dy) < SWIPE_DIST) {
      // tap: left third = left lane, right third = right lane, middle = jump.
      // Use where the finger came down — a wobbly tap still counts there.
      h.onTap(startX, startY);
      return;
    }
    // swipe — slow or wobbly ones still count; the dominant axis wins
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) h.onRight();
      else h.onLeft();
    } else if (dy < 0) {
      h.onJump();
    }
  });

  window.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
}
