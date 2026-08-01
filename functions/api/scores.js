// POST /api/scores    — submit a score
// DELETE /api/scores?id=123 — remove a bogus row (admin key required)

import {
  bestsForGame,
  checkRateLimit,
  hashIp,
  isForeignOrigin,
  json,
  normalizeName,
  requireDb,
  validateSubmission,
} from '../_lib/arcade.js';

const MAX_META_BYTES = 512;

export async function onRequestPost({ request, env }) {
  const unconfigured = requireDb(env);
  if (unconfigured) return unconfigured;

  if (isForeignOrigin(request)) {
    return json({ error: 'forbidden', message: 'Cross-origin submissions are not accepted.' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request', message: 'Body must be JSON.' }, 400);
  }

  const player = normalizeName(body.name);
  if (!player) {
    return json({ error: 'bad_request', message: 'A name is required.' }, 400);
  }

  const slug = String(body.game || '');
  const check = validateSubmission(slug, body.value);
  if (check.error) {
    return json({ error: 'bad_request', message: check.error }, 400);
  }

  const variant = typeof body.variant === 'string' ? body.variant.slice(0, 64) : '';

  let meta = null;
  if (body.meta && typeof body.meta === 'object') {
    const encoded = JSON.stringify(body.meta);
    if (encoded.length <= MAX_META_BYTES) meta = encoded;
  }

  const now = Date.now();
  const ipHash = await hashIp(request, env);

  const limited = await checkRateLimit(env.DB, ipHash, now);
  if (limited) return limited;

  await env.DB.prepare(
    `INSERT INTO scores (game, variant, player_key, player_name, value, meta, created_at, ip_hash)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  )
    .bind(slug, variant, player.key, player.name, check.value, meta, now, ipHash)
    .run();

  // Report back where that score landed, so the game can say "2nd place!".
  const board = await bestsForGame(env.DB, slug, 10);
  const all = await bestsForGame(env.DB, slug, 1000);
  const mine = all.find((row) => row.playerKey === player.key);

  return json({
    ok: true,
    game: slug,
    name: player.name,
    value: check.value,
    best: mine ? mine.best : check.value,
    rank: mine ? mine.rank : 1,
    players: all.length,
    top: board,
  });
}

export async function onRequestDelete({ request, env }) {
  const unconfigured = requireDb(env);
  if (unconfigured) return unconfigured;

  const key = env.ARCADE_ADMIN_KEY;
  const provided = request.headers.get('X-Arcade-Admin-Key');
  if (!key || provided !== key) {
    return json({ error: 'unauthorized' }, 401);
  }

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: 'bad_request', message: 'Pass ?id=<score id>.' }, 400);
  }

  const result = await env.DB.prepare('DELETE FROM scores WHERE id = ?1').bind(id).run();
  return json({ ok: true, deleted: result.meta?.changes ?? 0 });
}
