// GET /api/recent — the latest scores posted, newest first.

import { GAMES, json, readLimit, requireDb } from '../_lib/arcade.js';

export async function onRequestGet({ request, env }) {
  const unconfigured = requireDb(env);
  if (unconfigured) return unconfigured;

  const limit = readLimit(request, 15, 50);

  const { results } = await env.DB.prepare(
    `SELECT id, game, variant, player_name AS name, value, created_at AS createdAt
       FROM scores
       ORDER BY created_at DESC
       LIMIT ?1`
  )
    .bind(limit)
    .all();

  const entries = (results || [])
    .filter((row) => GAMES[row.game])
    .map((row) => ({ ...row, gameName: GAMES[row.game].name }));

  return json({ entries });
}
