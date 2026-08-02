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

  // pointer → game coords
  function toGameX(clientX: number): number {
    const rect = app.canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * W;
  }
  let pointerDown = false;
  let downX = 0;
  let downTime = 0;
  let moved = false;

  window.addEventListener('pointermove', (e) => {
    game.onPointerMove(toGameX(e.clientX));
  });
  window.addEventListener('pointerdown', (e) => {
    pointerDown = true;
    moved = false;
    downX = e.clientX;
    downTime = performance.now();
    audio.unlock();
    game.onPointerMove(toGameX(e.clientX));
  });
  window.addEventListener('pointerup', (e) => {
    if (!pointerDown) return;
    pointerDown = false;
    // treat as a tap when it wasn't a long drag
    const wasDrag = moved && Math.abs(e.clientX - downX) > 24 && performance.now() - downTime > 250;
    if (!wasDrag) game.onPress();
  });
  window.addEventListener('pointercancel', () => {
    pointerDown = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (pointerDown && Math.abs(e.clientX - downX) > 12) moved = true;
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      audio.unlock();
      game.onPress();
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      game.pause();
    }
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
