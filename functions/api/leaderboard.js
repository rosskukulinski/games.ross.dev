// GET /api/leaderboard — cross-game standings plus each game's champion.

import { buildLeaderboard, json, requireDb } from '../_lib/arcade.js';

export async function onRequestGet({ env }) {
  const unconfigured = requireDb(env);
  if (unconfigured) return unconfigured;

  const { standings, games } = await buildLeaderboard(env.DB);

  return json({
    // Stated here as well as on the page so the rule travels with the data.
    scoring: 'Arcade Points per game = round(100 / your rank) + 10 for taking part.',
    standings,
    games,
  });
}
