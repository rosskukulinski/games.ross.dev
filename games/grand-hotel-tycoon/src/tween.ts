/** Tiny tween engine — no deps, driven by the game loop. */

export type EaseFn = (t: number) => number;

export const Ease = {
  linear: (t: number) => t,
  outQuad: (t: number) => t * (2 - t),
  inQuad: (t: number) => t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};

interface Tween {
  elapsed: number;
  duration: number;
  delay: number;
  ease: EaseFn;
  onUpdate: (t: number) => void;
  onComplete?: () => void;
  dead: boolean;
}

const tweens: Tween[] = [];

/**
 * Start a tween. `onUpdate` receives eased progress 0..1 — callers do their
 * own lerping. Returns a cancel function.
 */
export function tween(
  duration: number,
  onUpdate: (t: number) => void,
  opts: { ease?: EaseFn; delay?: number; onComplete?: () => void } = {},
): () => void {
  const tw: Tween = {
    elapsed: 0,
    duration: Math.max(0.0001, duration),
    delay: opts.delay ?? 0,
    ease: opts.ease ?? Ease.outQuad,
    onUpdate,
    onComplete: opts.onComplete,
    dead: false,
  };
  tweens.push(tw);
  return () => {
    tw.dead = true;
  };
}

/** Schedule a one-shot callback `delay` seconds from now. */
export function after(delay: number, fn: () => void): () => void {
  return tween(0.0001, () => {}, { delay, onComplete: fn });
}

/** Advance all tweens. Call once per frame with dt in seconds. */
export function updateTweens(dt: number): void {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (tw.dead) {
      tweens.splice(i, 1);
      continue;
    }
    if (tw.delay > 0) {
      tw.delay -= dt;
      if (tw.delay > 0) continue;
    }
    tw.elapsed += dt;
    const raw = Math.min(1, tw.elapsed / tw.duration);
    tw.onUpdate(tw.ease(raw));
    if (raw >= 1) {
      tweens.splice(i, 1);
      tw.onComplete?.();
    }
  }
}

export function killAllTweens(): void {
  tweens.length = 0;
}

/* ------------------------------------------------------------------ helpers */

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Frame-rate independent exponential approach. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}
