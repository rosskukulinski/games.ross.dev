/** Keyboard (WASD/arrows/space) + touch virtual joystick and jump button. */
export class Input {
  private keys = new Set<string>();
  private joyVec = { x: 0, y: 0 };
  private joyPointer: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  jumpQueued = false;
  jumpHeld = false;
  /** Fired on the very first user gesture (for audio unlock). */
  onGesture: (() => void) | null = null;
  private gestureFired = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) {
        if (this.isGameKey(e.code)) e.preventDefault();
        return;
      }
      this.keys.add(e.code);
      if (e.code === 'Space') {
        this.jumpQueued = true;
        this.jumpHeld = true;
      }
      if (this.isGameKey(e.code)) e.preventDefault();
      this.fireGesture();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.jumpHeld = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.jumpHeld = false;
    });
    window.addEventListener('pointerdown', () => this.fireGesture(), { passive: true });

    this.setupTouch();
    if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
      document.body.classList.add('touch');
    }
  }

  private fireGesture(): void {
    if (!this.gestureFired && this.onGesture) {
      this.gestureFired = true;
      this.onGesture();
    }
  }

  private isGameKey(code: string): boolean {
    return (
      code === 'Space' ||
      code.startsWith('Arrow') ||
      ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)
    );
  }

  private setupTouch(): void {
    const zone = document.getElementById('joy-zone');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    const jumpBtn = document.getElementById('jump-btn');
    if (!zone || !base || !knob || !jumpBtn) return;

    const MAX = 46;

    zone.addEventListener('pointerdown', (e) => {
      if (this.joyPointer !== null) return;
      this.joyPointer = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      base.style.display = 'block';
      base.style.left = `${e.clientX}px`;
      base.style.top = `${e.clientY}px`;
      knob.style.transform = 'translate(-50%, -50%)';
      e.preventDefault();
    });

    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointer) return;
      let dx = e.clientX - this.joyOrigin.x;
      let dy = e.clientY - this.joyOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > MAX) {
        dx = (dx / len) * MAX;
        dy = (dy / len) * MAX;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.joyVec.x = dx / MAX;
      this.joyVec.y = dy / MAX;
    });

    const joyEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      this.joyVec.x = 0;
      this.joyVec.y = 0;
      base.style.display = 'none';
    };
    zone.addEventListener('pointerup', joyEnd);
    zone.addEventListener('pointercancel', joyEnd);

    jumpBtn.addEventListener('pointerdown', (e) => {
      this.jumpQueued = true;
      this.jumpHeld = true;
      e.preventDefault();
    });
    jumpBtn.addEventListener('pointerup', () => (this.jumpHeld = false));
    jumpBtn.addEventListener('pointercancel', () => (this.jumpHeld = false));
  }

  /** Screen-space movement vector: x = right, y = forward. Length <= 1. */
  move(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    x += this.joyVec.x;
    y -= this.joyVec.y; // screen-down = backward
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  consumeJump(): boolean {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }
}
