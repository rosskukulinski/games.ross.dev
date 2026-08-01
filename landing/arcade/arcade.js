// Arcade score client, served at /arcade/arcade.js and shared by every game.
//
// A game opts in with one line in its index.html:
//   <script defer src="/arcade/arcade.js"></script>
// and one line wherever it already records a personal best:
//   window.Arcade?.submit({ game: 'neon-bricks', value: this.score });
//
// The `?.` matters: running a game on its own `vite dev` server means this file
// 404s and `window.Arcade` is undefined, which must stay harmless.
//
// Deliberately a *classic* script, not a module. Vite resolves absolute
// `<script type="module" src>` paths at build time and fails the build for a
// file that only exists at the site root; a plain script tag passes through
// untouched. The game registry is pulled in with a dynamic import instead, so
// it still has exactly one definition.
//
// The prompt renders inside a shadow root so that no game's CSS can reach it
// and it cannot reach into any game.

(function () {
  'use strict';

  const NAME_STORAGE_KEY = 'arcade.lastName';
  const API = '/api';

  // Set once the API reports it has no database bound, so an unconfigured
  // deployment asks for a name exactly zero times.
  let apiUnavailable = false;
  let openCard = null;
  let registryPromise = null;

  /** Lazily load the shared game registry (slug -> name, direction, bounds). */
  function registry() {
    if (!registryPromise) registryPromise = import('/arcade/games.js');
    return registryPromise;
  }

  function lastName() {
    try {
      return localStorage.getItem(NAME_STORAGE_KEY) || '';
    } catch {
      return ''; // private mode, or storage disabled
    }
  }

  function rememberName(name) {
    try {
      localStorage.setItem(NAME_STORAGE_KEY, name);
    } catch {
      /* not important enough to break a game over */
    }
  }

  const STYLES = `
    :host {
      all: initial;
      display: block;
      position: fixed;
      left: 50%;
      bottom: max(16px, env(safe-area-inset-bottom));
      transform: translateX(-50%);
      z-index: 2147483000;
      font-family: 'Fredoka', 'Trebuchet MS', system-ui, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; }
    .card {
      width: min(92vw, 340px);
      background: #fff;
      color: #2d1b4e;
      border-radius: 1.1rem;
      padding: 1rem 1.1rem 1.1rem;
      box-shadow: 0 12px 40px rgba(45, 27, 78, 0.35);
      animation: rise 0.28s cubic-bezier(0.2, 1.1, 0.4, 1) both;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .card { animation: none; }
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .title {
      font-size: 0.95rem;
      font-weight: 600;
      background: linear-gradient(135deg, #7c3aed, #ec4899);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      color: #7c3aed;
    }
    .close {
      all: unset;
      cursor: pointer;
      color: #a397bd;
      font-size: 1.2rem;
      line-height: 1;
      padding: 0.15rem 0.35rem;
      border-radius: 0.4rem;
    }
    .close:hover { color: #2d1b4e; background: #f3edff; }
    .score {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin: 0.15rem 0 0.1rem;
    }
    .sub { font-size: 0.8rem; color: #7c6b9a; }
    form { display: flex; gap: 0.5rem; margin-top: 0.85rem; }
    input {
      flex: 1 1 auto;
      min-width: 0;
      font: inherit;
      font-size: 0.95rem;
      padding: 0.55rem 0.7rem;
      border: 2px solid #e4d9f8;
      border-radius: 0.7rem;
      background: #faf7ff;
      color: inherit;
    }
    input:focus { outline: none; border-color: #7c3aed; }
    button.post {
      all: unset;
      cursor: pointer;
      flex: 0 0 auto;
      padding: 0.55rem 0.95rem;
      border-radius: 0.7rem;
      font-weight: 600;
      font-size: 0.9rem;
      color: #fff;
      background: linear-gradient(135deg, #7c3aed, #ec4899);
    }
    button.post:disabled { opacity: 0.55; cursor: default; }
    .skip {
      all: unset;
      cursor: pointer;
      display: block;
      margin: 0.6rem auto 0;
      font-size: 0.78rem;
      color: #a397bd;
      text-decoration: underline;
    }
    .skip:hover { color: #7c3aed; }
    .error { margin-top: 0.6rem; font-size: 0.8rem; color: #d1345b; }
    .result { margin-top: 0.2rem; }
    .rank { font-size: 1.05rem; font-weight: 600; }
    ol {
      list-style: none;
      padding: 0;
      margin: 0.7rem 0 0;
      font-size: 0.85rem;
    }
    li {
      display: flex;
      justify-content: space-between;
      gap: 0.6rem;
      padding: 0.28rem 0.45rem;
      border-radius: 0.45rem;
    }
    li.me { background: #f3edff; font-weight: 600; }
    li .pos { color: #a397bd; width: 1.4rem; flex: 0 0 auto; }
    li .who { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a.more {
      display: block;
      margin-top: 0.7rem;
      text-align: center;
      font-size: 0.82rem;
      color: #7c3aed;
      font-weight: 600;
    }
  `;

  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.assign(node, props || {});
    for (const child of children || []) node.append(child);
    return node;
  }

  function ordinal(n) {
    const teens = n % 100;
    if (teens >= 11 && teens <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
  }

  /**
   * Show the prompt and post the score if the player chooses to.
   *
   * @param {{game: string, value: number, variant?: string, meta?: object}} entry
   * @returns {Promise<object|null>} the API result, or null if skipped/unavailable
   */
  async function submit(entry) {
    if (apiUnavailable) return null;
    if (!entry || !Number.isFinite(entry.value)) return null;

    let GAMES;
    let formatScore;
    try {
      ({ GAMES, formatScore } = await registry());
    } catch {
      apiUnavailable = true; // registry missing means this isn't a deployed build
      return null;
    }

    const game = GAMES[entry.game];
    if (!game) {
      console.warn(`[arcade] "${entry.game}" is not in the score registry — not posting.`);
      return null;
    }

    // A second game over shouldn't stack cards.
    if (openCard) openCard.remove();

    const host = el('div');
    const root = host.attachShadow({ mode: 'open' });
    root.append(el('style', { textContent: STYLES }));

    // Games listen for keys on window; typing a name must not steer the ship.
    for (const type of ['keydown', 'keyup', 'keypress']) {
      root.addEventListener(type, (event) => event.stopPropagation());
    }

    document.body.append(host);
    openCard = host;

    return new Promise((resolve) => {
      const finish = (result) => {
        if (openCard === host) openCard = null;
        host.remove();
        resolve(result);
      };

      const card = el('div', { className: 'card' });
      const closeBtn = el('button', { className: 'close', title: 'Close', textContent: '×' });
      closeBtn.addEventListener('click', () => finish(null));

      card.append(
        el('div', { className: 'head' }, [
          el('span', { className: 'title', textContent: game.name }),
          closeBtn,
        ]),
        el('div', { className: 'score', textContent: formatScore(entry.game, entry.value) }),
        el('div', {
          className: 'sub',
          textContent:
            game.dir === 'low' ? 'Post your time to the arcade' : 'Post your score to the arcade',
        })
      );

      const input = el('input', {
        type: 'text',
        maxLength: 16,
        placeholder: 'Your name',
        value: lastName(),
        autocomplete: 'off',
        spellcheck: false,
      });
      const postBtn = el('button', { className: 'post', type: 'submit', textContent: 'Post' });
      const form = el('form', {}, [input, postBtn]);
      const skip = el('button', { className: 'skip', type: 'button', textContent: 'Not this time' });
      skip.addEventListener('click', () => finish(null));

      const error = el('div', { className: 'error' });
      error.hidden = true;

      card.append(form, error, skip);
      root.append(card);

      input.focus();
      input.select();

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name) {
          input.focus();
          return;
        }

        postBtn.disabled = true;
        postBtn.textContent = '…';
        error.hidden = true;

        let response;
        let payload;
        try {
          response = await fetch(`${API}/scores`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              game: entry.game,
              variant: entry.variant || '',
              name,
              value: entry.value,
              meta: entry.meta,
            }),
          });
          payload = await response.json();
        } catch {
          postBtn.disabled = false;
          postBtn.textContent = 'Post';
          error.textContent = "Couldn't reach the arcade. Check your connection.";
          error.hidden = false;
          return;
        }

        if (response.status === 503) {
          // Nothing the player can do; stop asking for the rest of the session.
          apiUnavailable = true;
          finish(null);
          return;
        }

        if (!response.ok) {
          postBtn.disabled = false;
          postBtn.textContent = 'Post';
          error.textContent = (payload && payload.message) || 'That score was rejected.';
          error.hidden = false;
          return;
        }

        rememberName(payload.name);
        showResult(card, game, entry, payload, formatScore, finish);
        resolve(payload);
      });
    });
  }

  function showResult(card, game, entry, payload, formatScore, finish) {
    card.replaceChildren();

    const closeBtn = el('button', { className: 'close', title: 'Close', textContent: '×' });
    closeBtn.addEventListener('click', () => finish(payload));

    const headline =
      payload.rank === 1
        ? "🏆 1st place — you're the champion!"
        : `${ordinal(payload.rank)} of ${payload.players}`;

    card.append(
      el('div', { className: 'head' }, [
        el('span', { className: 'title', textContent: game.name }),
        closeBtn,
      ]),
      el('div', { className: 'result' }, [
        el('div', { className: 'rank', textContent: headline }),
        el('div', {
          className: 'sub',
          textContent: `Your best: ${formatScore(entry.game, payload.best)}`,
        }),
      ])
    );

    const list = el('ol');
    for (const row of (payload.top || []).slice(0, 5)) {
      const mine = row.name === payload.name && row.best === payload.best;
      list.append(
        el('li', { className: mine ? 'me' : '' }, [
          el('span', { className: 'pos', textContent: `${row.rank}.` }),
          el('span', { className: 'who', textContent: row.name }),
          el('span', { textContent: formatScore(entry.game, row.best) }),
        ])
      );
    }
    card.append(list);

    card.append(
      el('a', {
        className: 'more',
        href: `/leaderboard/?game=${encodeURIComponent(entry.game)}`,
        textContent: 'See the full leaderboard →',
      })
    );
  }

  /** Personal bests for one game, best first. Returns [] if unavailable. */
  async function scores(game, limit) {
    try {
      const response = await fetch(
        `${API}/scores/${encodeURIComponent(game)}?limit=${limit || 20}`
      );
      if (!response.ok) return [];
      return (await response.json()).scores || [];
    } catch {
      return [];
    }
  }

  window.Arcade = { submit, scores, registry };
})();
