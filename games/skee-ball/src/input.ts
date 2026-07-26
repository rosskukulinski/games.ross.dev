/**
 * Drag-and-release rolling for mouse + touch, with a keyboard fallback
 * (arrows to aim, hold Space to charge a power meter).
 */
export interface InputHandlers {
  /** Fired continuously while aiming. */
  onAim: (power: number, aim: number) => void;
  /** Fired on release with the final power (0..1) and aim (-1..1). */
  onRelease: (power: number, aim: number) => void;
  onCancel: () => void;
  /** Any interaction — used to unlock audio. */
  onGesture: () => void;
}

export interface InputController {
  update(dt: number): void;
  /** Gameplay only accepts input while this is true. */
  enabled: boolean;
  dispose(): void;
}

const AIM_PX = 200;

export function setupInput(canvas: HTMLCanvasElement, h: InputHandlers): InputController {
  let enabled = false;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let power = 0;
  let aim = 0;
  let lastY = 0;
  let lastT = 0;
  let flick = 0;

  // keyboard charge state
  let charging = false;
  let chargeDir = 1;
  let keyAim = 0;
  const heldAim = { left: false, right: false };

  const maxDragPx = () => Math.min(240, Math.max(110, window.innerHeight * 0.3));

  const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

  const onDown = (e: PointerEvent) => {
    h.onGesture();
    if (!enabled || charging) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    lastY = e.clientY;
    lastT = performance.now();
    flick = 0;
    power = 0;
    aim = keyAim;
    canvas.setPointerCapture?.(e.pointerId);
    h.onAim(power, aim);
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    // pulling the pointer *toward* the player (down the screen) loads power
    const pull = e.clientY - startY;
    power = clamp(pull / maxDragPx(), 0, 1);
    // slingshot aim: pull left to send the ball right
    aim = clamp((startX - e.clientX) / AIM_PX, -1, 1);
    // upward motion right before release adds a flick bonus
    const vy = (e.clientY - lastY) / dt; // px per ms
    flick = vy < -0.6 ? clamp(-vy / 3, 0, 1) : flick * 0.7;
    lastY = e.clientY;
    lastT = now;
    h.onAim(clamp(power + flick * 0.12, 0, 1), aim);
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    const finalPower = clamp(power + flick * 0.12, 0, 1);
    if (finalPower < 0.06) {
      h.onCancel();
      return;
    }
    h.onRelease(finalPower, aim);
  };

  const onCancelEvt = () => {
    if (!dragging) return;
    dragging = false;
    h.onCancel();
  };

  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancelEvt);

  const onKeyDown = (e: KeyboardEvent) => {
    h.onGesture();
    if (!enabled) return;
    if (e.code === "ArrowLeft") heldAim.left = true;
    else if (e.code === "ArrowRight") heldAim.right = true;
    else if (e.code === "Space") {
      if (!charging && !dragging) {
        charging = true;
        chargeDir = 1;
        power = 0;
      }
      e.preventDefault();
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft") heldAim.left = false;
    else if (e.code === "ArrowRight") heldAim.right = false;
    else if (e.code === "Space" && charging) {
      charging = false;
      e.preventDefault();
      if (!enabled) return;
      if (power < 0.06) h.onCancel();
      else h.onRelease(power, keyAim);
    }
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    get enabled() {
      return enabled;
    },
    set enabled(v: boolean) {
      enabled = v;
      if (!v) {
        dragging = false;
        charging = false;
        power = 0;
      }
    },
    update(dt: number) {
      if (!enabled) return;
      let changed = false;
      if (heldAim.left) {
        keyAim = clamp(keyAim - dt * 1.1, -1, 1);
        changed = true;
      }
      if (heldAim.right) {
        keyAim = clamp(keyAim + dt * 1.1, -1, 1);
        changed = true;
      }
      if (charging) {
        power += chargeDir * dt * 0.85;
        if (power >= 1) {
          power = 1;
          chargeDir = -1;
        } else if (power <= 0) {
          power = 0;
          chargeDir = 1;
        }
        changed = true;
      }
      if (changed && !dragging) h.onAim(power, keyAim);
    },
    dispose() {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancelEvt);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
