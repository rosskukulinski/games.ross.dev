// Landing-page enhancement: show each game's current champion on its card.
//
// Purely additive. If the API is unreachable or has no D1 bound, the cards
// render exactly as they did before this file existed.

import { formatScore } from './games.js';

async function decorate() {
  let data;
  try {
    const response = await fetch('/api/leaderboard');
    if (!response.ok) return;
    data = await response.json();
  } catch {
    return;
  }

  for (const game of data.games || []) {
    if (!game.champion) continue;
    const card = document.querySelector(`.game-card[href="./${game.slug}/"]`);
    if (!card) continue;

    const badge = document.createElement('p');
    badge.className = 'card-champ';
    badge.textContent = `🏆 ${game.champion.name} · ${formatScore(game.slug, game.champion.best)}`;
    card.append(badge);
  }
}

decorate();
