// The way out of a game, served at /arcade/home-button.js.
//
// `scripts/build-all.js` injects a tag for this file into every game's HTML at
// build time, so games need no exit code of their own — and a new game gets one
// for free. Because the tag is a fixed one-liner pointing at the site root,
// editing this file never requires rebuilding any game.
//
// It only draws anything when the arcade is running as an installed app
// (Add to Home Screen on iPad/iPhone, or an installed PWA elsewhere). That is
// the case where there is no browser chrome and therefore no other way back to
// the menu — in a normal tab Safari's own back button already does the job, and
// a second one would just cover up the game.
//
// Deliberately a *classic* script, not a module, for the same reason as
// arcade.js: Vite resolves absolute `<script type="module" src>` paths at build
// time and fails on a file that only exists at the site root, while a plain
// script tag passes through untouched. It also renders inside a shadow root so
// that no game's CSS can reach it and it cannot reach into any game.

(function () {
  'use strict';

  // Installed-app detection. iOS Safari predates display-mode and reports
  // `navigator.standalone` instead; the extra display modes cover installed
  // apps on Android and desktop.
  function isInstalledApp() {
    if (window.navigator.standalone === true) return true;
    return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(
      (mode) => window.matchMedia(`(display-mode: ${mode})`).matches
    );
  }

  // The landing page is its own way home, and a game served from its own dev
  // server has no arcade to go back to.
  function isGamePage() {
    return window.location.pathname.replace(/\/+$/, '') !== '';
  }

  if (!isInstalledApp() || !isGamePage()) return;

  // Top-left is where a back button belongs, but a game that already has its
  // own chrome there can move this one out of the way with
  //   <meta name="arcade-home-button" content="top-right">
  // in its index.html. `off` suppresses it altogether, for a game that grows a
  // real arcade exit of its own.
  const CORNERS = {
    'top-left': 'top: max(env(safe-area-inset-top), 10px); left: max(env(safe-area-inset-left), 10px);',
    'top-right': 'top: max(env(safe-area-inset-top), 10px); right: max(env(safe-area-inset-right), 10px);',
    'bottom-left': 'bottom: max(env(safe-area-inset-bottom), 10px); left: max(env(safe-area-inset-left), 10px);',
    'bottom-right': 'bottom: max(env(safe-area-inset-bottom), 10px); right: max(env(safe-area-inset-right), 10px);',
  };

  const requested = (
    document.querySelector('meta[name="arcade-home-button"]')?.content || ''
  ).trim().toLowerCase();

  if (requested === 'off') return;

  // Own-property check, so a typo like "constructor" falls back rather than
  // reaching an inherited property — and the layout below follows the corner
  // actually used, not what was asked for.
  const placement = Object.prototype.hasOwnProperty.call(CORNERS, requested) ? requested : 'top-left';
  const corner = CORNERS[placement];
  // A card opening from the bottom of the screen has to grow upwards.
  const fromBottom = placement.startsWith('bottom');
  const alignRight = placement.endsWith('right');

  const STYLES = `
    :host {
      position: fixed;
      ${corner}
      z-index: 2147483000;
      /* Lays the confirm card out under the button — or above it, and edge-
         aligned, in whichever corner the game asked for. */
      display: flex;
      flex-direction: ${fromBottom ? 'column-reverse' : 'column'};
      align-items: ${alignRight ? 'flex-end' : 'flex-start'};
      gap: 8px;
      /* The host spans more than the button once the confirm card opens, so it
         stays transparent to taps and only the controls themselves catch them. */
      pointer-events: none;
      font-family: ui-rounded, system-ui, -apple-system, 'Segoe UI', sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    button {
      pointer-events: auto;
      font: inherit;
      cursor: pointer;
      border: 0;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }

    .home {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 8px 13px 8px 10px;
      /* Comfortably past the 44px iOS touch target once the padding is added,
         without the visual weight of a 44px-tall button over gameplay. */
      min-height: 36px;
      border-radius: 999px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.01em;
      background: rgba(24, 16, 44, 0.62);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.18);
      /* Held back from full strength so it reads as chrome, not as part of the
         game — but stays plainly visible to a kid looking for the way out. */
      opacity: 0.82;
      transition: opacity 0.15s ease, transform 0.15s ease;
    }

    .home:hover { opacity: 1; }
    .home:active { transform: scale(0.95); opacity: 1; }
    .home:focus-visible { outline: 3px solid #a78bfa; outline-offset: 2px; opacity: 1; }
    .home svg { flex: none; }

    .card {
      pointer-events: auto;
      width: max-content;
      max-width: min(78vw, 300px);
      padding: 14px;
      border-radius: 16px;
      color: #fff;
      background: rgba(24, 16, 44, 0.94);
      -webkit-backdrop-filter: blur(14px);
      backdrop-filter: blur(14px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.14);
    }

    .card p {
      margin: 0 0 12px;
      font-size: 14px;
      line-height: 1.4;
    }

    .actions { display: flex; gap: 8px; }

    .actions button {
      flex: 1;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 11px;
      font-size: 14px;
      font-weight: 600;
    }

    .leave { color: #fff; background: #7c3aed; }
    .leave:active { background: #6d28d9; }
    .stay { color: #fff; background: rgba(255, 255, 255, 0.14); }
    .stay:active { background: rgba(255, 255, 255, 0.22); }
    .actions button:focus-visible { outline: 3px solid #a78bfa; outline-offset: 2px; }

    @media (prefers-reduced-motion: reduce) {
      .home { transition: none; }
    }
  `;

  const host = document.createElement('div');
  // A game's own stylesheet can still reach the host element itself, so the
  // few properties that decide where it sits are repeated inline.
  host.style.cssText = `position:fixed;z-index:2147483000;pointer-events:none;${corner}`;
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLES;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'home';
  button.setAttribute('aria-label', 'Leave this game and go back to the arcade');
  button.innerHTML =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M15 5 8 12l7 7"/></svg><span>Arcade</span>';

  root.append(style, button);

  // Leaving is one tap away from the middle of a game and nothing here is
  // saved, so it asks first. The card is built on demand and thrown away, which
  // keeps the idle state to a single button.
  let card = null;

  function closeCard() {
    if (!card) return;
    card.remove();
    card = null;
    button.setAttribute('aria-expanded', 'false');
  }

  function leave() {
    // Absolute, so it works the same from /phase-10/ as from a game's nested
    // page, and stays inside the installed app's scope.
    window.location.href = '/';
  }

  function openCard() {
    if (card) return;
    card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Leave this game?');
    card.innerHTML =
      '<p>Leave this game and go back to the arcade? This game will start over.</p>' +
      '<div class="actions">' +
      '<button type="button" class="leave">Leave</button>' +
      '<button type="button" class="stay">Keep playing</button>' +
      '</div>';
    card.querySelector('.leave').addEventListener('click', leave);
    card.querySelector('.stay').addEventListener('click', () => {
      closeCard();
      button.focus();
    });
    root.appendChild(card);
    button.setAttribute('aria-expanded', 'true');
    card.querySelector('.leave').focus();
  }

  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => (card ? closeCard() : openCard()));

  // Tapping the game behind the card dismisses it. Capture, because a game that
  // stops propagation on its own canvas would otherwise leave it stuck open.
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (card && !event.composedPath().includes(host)) closeCard();
    },
    true
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && card) {
      closeCard();
      button.focus();
    }
  });

  function mount() {
    document.body.appendChild(host);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
