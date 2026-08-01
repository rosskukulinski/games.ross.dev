// Leaderboard page: cross-game standings, a tab per game, and a recent feed.
//
// Everything is built with DOM calls rather than innerHTML — player names are
// typed in by whoever is playing and are never treated as markup.

import { GAMES, GAME_SLUGS, formatScore } from './games.js';

const board = document.getElementById('board');
const params = new URLSearchParams(location.search);
let selected = params.get('game') && GAMES[params.get('game')] ? params.get('game') : 'overall';

function el(tag, props, children) {
  const node = document.createElement(tag);
  Object.assign(node, props || {});
  for (const child of children || []) node.append(child);
  return node;
}

function status(message) {
  board.replaceChildren(el('p', { className: 'board-status', textContent: message }));
}

async function getJson(path) {
  const response = await fetch(path);
  if (response.status === 503) throw new Error('not_configured');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function relativeTime(ms) {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function medal(rank) {
  return ['🥇', '🥈', '🥉'][rank - 1] || `${rank}`;
}

function tabs(data) {
  const played = new Set(data.games.map((g) => g.slug));
  const row = el('nav', { className: 'tabs' });

  const make = (slug, label) => {
    const tab = el('button', {
      className: `tab${selected === slug ? ' tab-on' : ''}`,
      type: 'button',
      textContent: label,
    });
    tab.addEventListener('click', () => {
      selected = slug;
      const url = slug === 'overall' ? location.pathname : `?game=${encodeURIComponent(slug)}`;
      history.replaceState(null, '', url);
      render(data);
    });
    return tab;
  };

  row.append(make('overall', 'Overall'));
  for (const slug of GAME_SLUGS) {
    // Games nobody has played yet still get a tab, dimmed — an empty board that
    // says "be the first" is more useful than a game that silently isn't there.
    const tab = make(slug, GAMES[slug].name);
    if (!played.has(slug)) tab.classList.add('tab-empty');
    row.append(tab);
  }
  return row;
}

function overall(data) {
  const section = el('section', { className: 'panel' });

  if (!data.standings.length) {
    section.append(
      el('p', { className: 'board-status', textContent: 'No scores yet — go play something!' })
    );
    return section;
  }

  const table = el('table', { className: 'board-table' });
  table.append(
    el('thead', {}, [
      el('tr', {}, [
        el('th', { className: 'c-rank', textContent: '#' }),
        el('th', { textContent: 'Player' }),
        el('th', { className: 'c-num', textContent: 'Arcade pts' }),
        el('th', { className: 'c-num c-hide', textContent: 'Games' }),
        el('th', { className: 'c-num c-hide', textContent: 'Golds' }),
      ]),
    ])
  );

  const body = el('tbody');
  for (const player of data.standings) {
    body.append(
      el('tr', {}, [
        el('td', { className: 'c-rank', textContent: medal(player.rank) }),
        el('td', { textContent: player.name }),
        el('td', { className: 'c-num c-strong', textContent: String(player.points) }),
        el('td', { className: 'c-num c-hide', textContent: String(player.gamesPlayed) }),
        el('td', { className: 'c-num c-hide', textContent: player.golds ? `🏆 ${player.golds}` : '—' }),
      ])
    );
  }
  table.append(body);

  section.append(
    table,
    el('p', { className: 'board-note', textContent: data.scoring })
  );
  return section;
}

function gamePanel(slug, detail) {
  const game = GAMES[slug];
  const section = el('section', { className: 'panel' });

  const heading = el('div', { className: 'panel-head' }, [
    el('h2', { textContent: game.name }),
    el('a', { className: 'panel-play', href: `./${slug}/`, textContent: 'Play →' }),
  ]);
  section.append(heading);

  if (game.note) section.append(el('p', { className: 'board-note', textContent: game.note }));

  if (!detail.scores.length) {
    section.append(
      el('p', {
        className: 'board-status',
        textContent: 'Nobody has posted a score here yet. Be the first!',
      })
    );
    return section;
  }

  const table = el('table', { className: 'board-table' });
  table.append(
    el('thead', {}, [
      el('tr', {}, [
        el('th', { className: 'c-rank', textContent: '#' }),
        el('th', { textContent: 'Player' }),
        el('th', { className: 'c-num', textContent: game.dir === 'low' ? 'Best time' : 'Best score' }),
        el('th', { className: 'c-num c-hide', textContent: 'Plays' }),
      ]),
    ])
  );

  const body = el('tbody');
  for (const row of detail.scores) {
    body.append(
      el('tr', {}, [
        el('td', { className: 'c-rank', textContent: medal(row.rank) }),
        el('td', { textContent: row.name }),
        el('td', { className: 'c-num c-strong', textContent: formatScore(slug, row.best) }),
        el('td', { className: 'c-num c-hide', textContent: String(row.plays) }),
      ])
    );
  }
  table.append(body);
  section.append(table);
  return section;
}

function feed(entries) {
  const section = el('section', { className: 'panel' });
  section.append(el('h2', { className: 'feed-head', textContent: 'Recent scores' }));

  if (!entries.length) {
    section.append(el('p', { className: 'board-status', textContent: 'Nothing posted yet.' }));
    return section;
  }

  const list = el('ul', { className: 'feed' });
  for (const entry of entries) {
    list.append(
      el('li', {}, [
        el('span', { className: 'feed-who', textContent: entry.name }),
        el('span', { className: 'feed-what', textContent: entry.gameName }),
        el('span', { className: 'feed-score', textContent: formatScore(entry.game, entry.value) }),
        el('span', { className: 'feed-when', textContent: relativeTime(entry.createdAt) }),
      ])
    );
  }
  section.append(list);
  return section;
}

async function render(data) {
  board.replaceChildren(tabs(data));

  if (selected === 'overall') {
    board.append(overall(data), feed(data.recent));
    return;
  }

  const placeholder = el('section', {
    className: 'panel',
    textContent: 'Loading…',
  });
  board.append(placeholder);

  try {
    const detail = await getJson(`/api/scores/${encodeURIComponent(selected)}?limit=50`);
    placeholder.replaceWith(gamePanel(selected, detail));
  } catch {
    placeholder.replaceWith(
      el('section', { className: 'panel' }, [
        el('p', { className: 'board-status', textContent: "Couldn't load that game's scores." }),
      ])
    );
  }
}

async function load() {
  let data;
  try {
    data = await getJson('/api/leaderboard');
  } catch (error) {
    status(
      error.message === 'not_configured'
        ? 'The leaderboard database is not connected yet. See docs/leaderboard.md for the one-time setup.'
        : "Couldn't reach the arcade. Try again in a moment."
    );
    return;
  }

  // A missing feed shouldn't take the whole page down with it.
  try {
    data.recent = (await getJson('/api/recent?limit=15')).entries;
  } catch {
    data.recent = [];
  }

  render(data);
}

load();
