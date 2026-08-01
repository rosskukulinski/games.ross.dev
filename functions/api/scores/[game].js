// GET /api/scores/:game — every player's personal best in one game, best first.

import { GAMES, bestsForGame, json, readLimit, requireDb } from '../../_lib/arcade.js';

export async function onRequestGet({ params, request, env }) {
  const unconfigured = requireDb(env);
  if (unconfigured) return unconfigured;

  const slug = String(params.game || '');
  const game = GAMES[slug];
  if (!game) return json({ error: 'not_found', message: `Unknown game "${slug}"` }, 404);

  const scores = await bestsForGame(env.DB, slug, readLimit(request, 20, 100));

  return json({
    game: slug,
    name: game.name,
    dir: game.dir,
    unit: game.unit,
    scores,
  });
}
