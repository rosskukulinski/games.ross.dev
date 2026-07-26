import { Application } from 'pixi.js';
import { audio } from './audio';
import { Game } from './game';
import { H, W } from './table';

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({
    width: W,
    height: H,
    backgroundColor: 0x04030d,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  const host = document.getElementById('app')!;
  host.appendChild(app.canvas);

  // Fixed logical resolution, CSS-scaled to fit — letterboxed like a cabinet.
  function resize(): void {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    app.canvas.style.width = `${Math.floor(W * scale)}px`;
    app.canvas.style.height = `${Math.floor(H * scale)}px`;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  const game = new Game(app);
  (window as unknown as { __game?: unknown }).__game = {
    state: () => game.debugState(),
    start: () => game.debugStart(),
    launch: (p?: number) => game.debugLaunch(p),
    place: (x: number, y: number, vx?: number, vy?: number) => game.debugPlaceBall(x, y, vx, vy),
    sim: (secs: number, cb?: (t: number) => void) => game.debugSim(secs, cb),
    flip: (side: -1 | 1, down: boolean) => game.onFlip(side, down),
  };

  // ---- keyboard -----------------------------------------------------------
  const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA', 'KeyZ', 'ShiftLeft']);
  const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD', 'Slash', 'ShiftRight']);
  const held = new Set<string>();

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (LEFT_KEYS.has(e.code)) {
      e.preventDefault();
      audio.unlock();
      held.add(e.code);
      game.onFlip(-1, true);
    } else if (RIGHT_KEYS.has(e.code)) {
      e.preventDefault();
      audio.unlock();
      held.add(e.code);
      game.onFlip(1, true);
    } else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') {
      e.preventDefault();
      game.onPrimary(true);
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      game.togglePause();
    } else if (e.code === 'KeyM') {
      audio.unlock();
      audio.toggleMuted();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (LEFT_KEYS.has(e.code)) {
      held.delete(e.code);
      if (![...held].some((k) => LEFT_KEYS.has(k))) game.onFlip(-1, false);
    } else if (RIGHT_KEYS.has(e.code)) {
      held.delete(e.code);
      if (![...held].some((k) => RIGHT_KEYS.has(k))) game.onFlip(1, false);
    } else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') {
      game.onPrimary(false);
    }
  });

  window.addEventListener('blur', () => {
    held.clear();
    game.onFlip(-1, false);
    game.onFlip(1, false);
    game.onPrimary(false);
  });

  // ---- touch / mouse ------------------------------------------------------
  // Left half flips left, right half flips right. While a ball waits on the
  // plunger any touch charges it, so young players never have to aim for a
  // small target.
  const pointers = new Map<number, 'left' | 'right' | 'primary'>();

  function zoneFor(clientX: number): 'left' | 'right' {
    const rect = app.canvas.getBoundingClientRect();
    return clientX - rect.left < rect.width / 2 ? 'left' : 'right';
  }

  function release(id: number): void {
    const z = pointers.get(id);
    if (!z) return;
    pointers.delete(id);
    if (z === 'primary') {
      if (![...pointers.values()].includes('primary')) game.onPrimary(false);
    } else {
      const side = z === 'left' ? -1 : 1;
      if (![...pointers.values()].includes(z)) game.onFlip(side, false);
    }
  }

  app.canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audio.unlock();
    const st = game.state;
    if (st === 'start' || st === 'gameover' || st === 'paused' || st === 'launch') {
      pointers.set(e.pointerId, 'primary');
      game.onPrimary(true);
    } else {
      const z = zoneFor(e.clientX);
      pointers.set(e.pointerId, z);
      game.onFlip(z === 'left' ? -1 : 1, true);
    }
  });
  window.addEventListener('pointerup', (e) => release(e.pointerId));
  window.addEventListener('pointercancel', (e) => release(e.pointerId));

  app.ticker.add((ticker) => {
    game.update(ticker.deltaMS / 1000);
  });
}

boot().catch((err) => {
  console.error('Failed to start Cosmic Pinball:', err);
  const el = document.createElement('div');
  el.style.cssText = 'color:#3fe8ff;font:16px monospace;padding:24px;text-align:center;';
  el.textContent = 'Failed to start the game. Your browser may not support WebGL.';
  document.body.appendChild(el);
});
