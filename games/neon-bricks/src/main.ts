import { Application } from 'pixi.js';
import { Game, H, W } from './game';
import { audio } from './audio';

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({
    width: W,
    height: H,
    backgroundColor: 0x05050f,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  const host = document.getElementById('app')!;
  host.appendChild(app.canvas);

  // Letterbox scaling: fixed logical resolution, CSS-scaled to fit.
  function resize(): void {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    app.canvas.style.width = `${Math.floor(W * scale)}px`;
    app.canvas.style.height = `${Math.floor(H * scale)}px`;
  }
  window.addEventListener('resize', resize);
  resize();

  const game = new Game(app);
  (window as unknown as { __NEON?: Game }).__NEON = game;
  // Read-only state for play-test validators.
  Object.defineProperty(window, '__game', {
    get: () => game.snapshot,
    configurable: true,
  });

  // pointer → game coords
  function toGame(clientX: number, clientY: number): { x: number; y: number } {
    const rect = app.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }
  let pointerDown = false;
  let downX = 0;
  let downTime = 0;
  let moved = false;
  /** The press landed on the mute button — it must not also start / launch. */
  let onMute = false;
  /**
   * A touch that starts while the ball rests on the paddle is a launch tap: it
   * leaves the paddle where it is (kids tap anywhere to launch, and the paddle
   * jumping under their finger lost them the ball). It only moves once the
   * finger actually drags.
   */
  let holdPaddle = false;

  window.addEventListener('pointermove', (e) => {
    if (pointerDown && Math.abs(e.clientX - downX) > 12) {
      moved = true;
      holdPaddle = false;
    }
    if (holdPaddle || onMute) return;
    game.onPointerMove(toGame(e.clientX, e.clientY).x);
  });
  window.addEventListener('pointerdown', (e) => {
    pointerDown = true;
    moved = false;
    downX = e.clientX;
    downTime = performance.now();
    audio.unlock();
    const p = toGame(e.clientX, e.clientY);
    onMute = game.isOnMute(p.x, p.y);
    holdPaddle = e.pointerType !== 'mouse' && game.hasStuckBall;
    if (!onMute && !holdPaddle) game.onPointerMove(p.x);
  });
  window.addEventListener('pointerup', (e) => {
    if (!pointerDown) return;
    pointerDown = false;
    holdPaddle = false;
    if (onMute) {
      onMute = false;
      return;
    }
    // treat as a tap when it wasn't a long drag
    const wasDrag = moved && Math.abs(e.clientX - downX) > 24 && performance.now() - downTime > 250;
    if (!wasDrag) game.onPress();
  });
  window.addEventListener('pointercancel', () => {
    pointerDown = false;
    holdPaddle = false;
    onMute = false;
  });

  // Arrow keys / A-D slide the paddle while held; the last key pressed wins.
  const held: number[] = [];
  const dirOf = (code: string): number =>
    code === 'ArrowLeft' || code === 'KeyA' ? -1 : code === 'ArrowRight' || code === 'KeyD' ? 1 : 0;
  const syncDir = (): void => game.setKeyDir(held.length ? held[held.length - 1] : 0);

  window.addEventListener('keydown', (e) => {
    const dir = dirOf(e.code);
    if (dir !== 0) {
      e.preventDefault();
      if (!e.repeat && !held.includes(dir)) {
        held.push(dir);
        syncDir();
      }
      return;
    }
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (e.repeat) return;
      audio.unlock();
      game.onPress();
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      game.pause();
    }
  });
  window.addEventListener('keyup', (e) => {
    const dir = dirOf(e.code);
    if (dir === 0) return;
    const i = held.indexOf(dir);
    if (i >= 0) held.splice(i, 1);
    syncDir();
  });
  window.addEventListener('blur', () => {
    held.length = 0;
    syncDir();
  });

  app.ticker.add((ticker) => {
    game.update(ticker.deltaMS / 1000);
  });
}

boot().catch((err) => {
  console.error('Failed to start Neon Bricks:', err);
  const el = document.createElement('div');
  el.style.cssText = 'color:#ff2d95;font:16px monospace;padding:20px;';
  el.textContent = 'Failed to start game. Your browser may not support WebGL.';
  document.body.appendChild(el);
});
