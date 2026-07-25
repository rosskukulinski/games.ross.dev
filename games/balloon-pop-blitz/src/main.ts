/** Entry point: Pixi app boot, responsive canvas, multi-touch input. */

import { Application } from 'pixi.js';
import { Game } from './game';
import { audio } from './audio';

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    backgroundColor: 0x8ecdf2,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: 'webgl',
  });

  const host = document.getElementById('app')!;
  host.appendChild(app.canvas);

  const game = new Game(app);

  // Pointer → stage coords (canvas fills the window, so CSS px == stage px).
  function toStage(clientX: number, clientY: number): { x: number; y: number } {
    const rect = app.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * app.screen.width,
      y: ((clientY - rect.top) / rect.height) * app.screen.height,
    };
  }

  // Multiple fingers can pop simultaneously: every pointerdown is independent.
  const onDown = (clientX: number, clientY: number): void => {
    audio.unlock();
    const p = toStage(clientX, clientY);
    game.onPointerDown(p.x, p.y);
  };

  app.canvas.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        onDown(t.clientX, t.clientY);
      }
    },
    { passive: false },
  );

  app.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // handled by touchstart
    onDown(e.clientX, e.clientY);
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      audio.unlock();
      if (game.phase !== 'playing') game.start();
    }
    if (e.code === 'KeyM') audio.toggleMuted();
    if (e.code === 'KeyP' || e.code === 'Escape') game.setPaused(!game.paused);
  });

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      game.layout();
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.setPaused(true);
  });

  app.ticker.add((ticker) => {
    game.update(ticker.deltaMS / 1000);
  });

  (window as unknown as { __game?: unknown }).__game = {
    game,
    app,
    state: () => game.debugState(),
    start: () => game.start(),
    popAt: (x: number, y: number) => game.popAt(x, y),
    spawn: (n = 1, spread = false) => game.debugSpawn(n, spread),
    /** pop the first balloon on screen; returns true if one was hit */
    popAny: () => {
      const s = game.debugState();
      if (!s.balloons.length) return false;
      const b = s.balloons[0];
      return game.popAt(b.x, b.y);
    },
  };
}

boot().catch((err) => {
  console.error('Failed to start Balloon Pop Blitz:', err);
  const el = document.createElement('div');
  el.style.cssText = 'color:#2b4a6b;font:16px sans-serif;padding:20px;';
  el.textContent = 'Failed to start game. Your browser may not support WebGL.';
  document.body.appendChild(el);
});
