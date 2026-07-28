/**
 * Steering input. Produces a screen-relative stick vector that the game
 * rotates into world space using the camera basis — so "up" always means
 * "away from you on screen", which is the only thing a young player expects.
 *
 * Keyboard and touch both feed the same two numbers. On touch the joystick
 * floats: it appears wherever the finger lands rather than in a fixed corner,
 * which matters a lot on a tablet held in unpredictable ways.
 */

const KNOB_RANGE = 52;
const DEAD_ZONE = 0.14;

export interface InputHooks {
  /** Any interaction at all — used to unlock audio. */
  onAny: () => void;
  onPause: () => void;
}

export class Input {
  /** Screen-space stick, magnitude clamped to 1. +y is up the screen. */
  x = 0;
  y = 0;

  private keys = new Set<string>();
  private stickEl: HTMLElement;
  private knobEl: HTMLElement;
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private touchX = 0;
  private touchY = 0;
  private disposers: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, hooks: InputHooks) {
    this.stickEl = document.getElementById("stick")!;
    this.knobEl = document.getElementById("knob")!;

    if (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) {
      document.body.classList.add("touch");
    }

    // ------------------------------------------------------------ keyboard
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const c = e.code;
      if (MOVE_KEYS.has(c)) {
        e.preventDefault();
        this.keys.add(c);
        hooks.onAny();
      } else if (c === "KeyP" || c === "Escape") {
        e.preventDefault();
        hooks.onPause();
      } else if (c === "Space" || c === "Enter") {
        hooks.onAny();
      }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => this.keys.clear();

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    this.disposers.push(() => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    });

    // --------------------------------------------------------------- touch
    const pDown = (e: PointerEvent) => {
      if (this.pointerId !== null) return;
      // let the HUD buttons keep their taps
      if ((e.target as HTMLElement)?.closest("button")) return;
      this.pointerId = e.pointerId;
      this.originX = e.clientX;
      this.originY = e.clientY;
      this.touchX = e.clientX;
      this.touchY = e.clientY;
      this.stickEl.style.left = `${e.clientX}px`;
      this.stickEl.style.top = `${e.clientY}px`;
      this.stickEl.classList.add("on");
      canvas.setPointerCapture?.(e.pointerId);
      hooks.onAny();
    };
    const pMove = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.touchX = e.clientX;
      this.touchY = e.clientY;
    };
    const pUp = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.stickEl.classList.remove("on");
      this.knobEl.style.transform = "translate(0px, 0px)";
      canvas.releasePointerCapture?.(e.pointerId);
    };

    canvas.addEventListener("pointerdown", pDown);
    window.addEventListener("pointermove", pMove);
    window.addEventListener("pointerup", pUp);
    window.addEventListener("pointercancel", pUp);
    this.disposers.push(() => {
      canvas.removeEventListener("pointerdown", pDown);
      window.removeEventListener("pointermove", pMove);
      window.removeEventListener("pointerup", pUp);
      window.removeEventListener("pointercancel", pUp);
    });

    // stop the page rubber-banding under a dragging finger
    const noScroll = (e: TouchEvent) => e.preventDefault();
    canvas.addEventListener("touchmove", noScroll, { passive: false });
    this.disposers.push(() => canvas.removeEventListener("touchmove", noScroll));
  }

  /** Recompute the stick. Call once per frame before moving the player. */
  update(): void {
    let kx = 0;
    let ky = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) kx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) kx += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) ky += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) ky -= 1;

    if (kx !== 0 || ky !== 0) {
      const l = Math.hypot(kx, ky);
      this.x = kx / l;
      this.y = ky / l;
      return;
    }

    if (this.pointerId !== null) {
      let dx = this.touchX - this.originX;
      let dy = this.touchY - this.originY;
      const len = Math.hypot(dx, dy);
      if (len > KNOB_RANGE) {
        dx = (dx / len) * KNOB_RANGE;
        dy = (dy / len) * KNOB_RANGE;
      }
      this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      const nx = dx / KNOB_RANGE;
      const ny = -dy / KNOB_RANGE; // screen y grows downward
      const mag = Math.hypot(nx, ny);
      if (mag < DEAD_ZONE) {
        this.x = 0;
        this.y = 0;
      } else {
        // rescale past the dead zone so slow walking is still possible
        const scaled = (mag - DEAD_ZONE) / (1 - DEAD_ZONE);
        this.x = (nx / mag) * scaled;
        this.y = (ny / mag) * scaled;
      }
      return;
    }

    this.x = 0;
    this.y = 0;
  }

  get magnitude(): number {
    return Math.min(1, Math.hypot(this.x, this.y));
  }

  /** Force the stick to centre — used when the game pauses. */
  release(): void {
    this.keys.clear();
    this.x = 0;
    this.y = 0;
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers.length = 0;
  }
}

const MOVE_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);
