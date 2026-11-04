/**
 * Keyboard, touch buttons and gamepad, merged into one kart input. Throttle
 * is automatic (kids never have to hold "go"); the down arrow or brake
 * button slows and reverses.
 */
import type { KartInput } from './shared/kart.ts';

export interface Controls extends KartInput {
  /** True for exactly one frame when the item button was pressed. */
  use: boolean;
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node;
}

export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

export class Input {
  private keys = new Set<string>();
  private touch = { left: false, right: false, drift: false, brake: false };
  private usePending = false;
  private padUseDown = false;
  private steer = 0;
  onAnyPress: (() => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k) && (k === ' ' || k === 'enter' || k === 'x' || k === 'control' || k === 'e')) this.usePending = true;
      this.keys.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      this.onAnyPress?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touch = { left: false, right: false, drift: false, brake: false };
    });

    const bind = (id: string, key: keyof typeof this.touch | 'use'): void => {
      const btn = el(id);
      const down = (e: Event): void => {
        e.preventDefault();
        btn.classList.add('pressed');
        if (key === 'use') this.usePending = true;
        else this.touch[key] = true;
        this.onAnyPress?.();
      };
      const up = (e: Event): void => {
        e.preventDefault();
        btn.classList.remove('pressed');
        if (key !== 'use') this.touch[key] = false;
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    bind('t-left', 'left');
    bind('t-right', 'right');
    bind('t-drift', 'drift');
    bind('t-brake', 'brake');
    bind('t-item', 'use');
    // The item slot itself is a big tap target too.
    el('item-slot').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.usePending = true;
    });
  }

  private gamepad(): { steer: number; brake: boolean; drift: boolean; use: boolean } | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const axis = p.axes[0] ?? 0;
      let steer = Math.abs(axis) > 0.15 ? axis : 0;
      if (p.buttons[14]?.pressed) steer = -1;
      if (p.buttons[15]?.pressed) steer = 1;
      const pressed = (i: number): boolean => !!p.buttons[i]?.pressed;
      return {
        steer,
        brake: pressed(1) || pressed(13),
        drift: pressed(5) || pressed(7) || pressed(6) || pressed(4),
        use: pressed(2) || pressed(3) || pressed(0),
      };
    }
    return null;
  }

  read(dt: number): Controls {
    const k = this.keys;
    let target = 0;
    if (k.has('arrowleft') || k.has('a') || this.touch.left) target -= 1;
    if (k.has('arrowright') || k.has('d') || this.touch.right) target += 1;
    let brake = k.has('arrowdown') || k.has('s') || this.touch.brake;
    let drift = k.has('shift') || k.has('z') || this.touch.drift;
    let use = this.usePending;
    this.usePending = false;

    const pad = this.gamepad();
    let analog = false;
    if (pad) {
      if (pad.steer !== 0) {
        target = pad.steer;
        analog = Math.abs(pad.steer) < 0.98;
      }
      brake = brake || pad.brake;
      drift = drift || pad.drift;
      if (pad.use && !this.padUseDown) use = true;
      this.padUseDown = pad.use;
      if (pad.use || pad.drift || pad.brake || pad.steer !== 0) this.onAnyPress?.();
    }

    // Ramp digital steering so a tap is a nudge and a hold is a full turn.
    if (analog) {
      this.steer = target;
    } else if (target === 0) {
      this.steer += (0 - this.steer) * Math.min(1, 16 * dt);
      if (Math.abs(this.steer) < 0.02) this.steer = 0;
    } else {
      const rate = Math.sign(target) === Math.sign(this.steer) || this.steer === 0 ? 5.5 : 12;
      this.steer += (target - this.steer) * Math.min(1, rate * dt);
    }

    const forward = k.has('arrowup') || k.has('w');
    const throttle = brake ? -1 : forward ? 1 : 1;
    return { throttle, steer: this.steer, drift, use };
  }
}
