// Shared helpers for the arcade score API.
//
// This file exports no `onRequest*` handler, so Pages' filepath router creates
// no route for it — it is bundled into the handlers that import it.

import { GAMES, compareScores, pointsForRank } from '../../landing/arcade/games.js';

export { GAMES };

const MAX_NAME_LENGTH = 16;

// Generous enough that a family never notices, tight enough that a script
// can't fill the table.
const RATE_LIMIT_PER_MINUTE = 20;
const RATE_LIMIT_PER_DAY = 300;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Scores change constantly and the payloads are tiny.
      'cache-control': 'no-store',
    },
  });
}

/**
 * The D1 binding is configured in the Pages dashboard rather than in git (see
 * docs/leaderboard.md). Until that is done `env.DB` is undefined, and every
 * endpoint should say so plainly instead of throwing — the games and the rest
 * of the site keep working either way.
 */
export function requireDb(env) {
  if (!env || !env.DB) {
    return json(
      { error: 'not_configured', message: 'No D1 binding named DB on this deployment.' },
      503
    );
  }
  return null;
}

/**
 * Reject writes carrying a cross-origin `Origin` header. Browsers always send
 * one on a cross-site POST, so this blocks other sites from posting scores on a
 * visitor's behalf. A missing Origin (curl, same-origin GET) is allowed
 * through — this is a spam guard, not an authentication boundary.
 */
export function isForeignOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

/**
 * Normalise a typed-in player name.
 * Returns `{ key, name }`, or null when the name is unusable.
 */
export function normalizeName(raw) {
  if (typeof raw !== 'string') return null;
  // Strip control characters, then collapse runs of whitespace.
  const name = raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  if (!name) return null;
  return { key: name.toLowerCase(), name };
}

/**
 * Validate a submitted score against the game registry.
 * Returns `{ value }` or `{ error }`.
 */
export function validateSubmission(slug, value) {
  const game = GAMES[slug];
  if (!game) return { error: `Unknown game "${slug}"` };

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return { error: 'Score must be a finite number' };

  const min = game.min ?? 0;
  if (num < min) return { error: `Score below the minimum for this game (${min})` };
  if (num > game.max) return { error: `Score above the maximum for this game (${game.max})` };

  return { value: num };
}

/**
 * Read a `?limit=` query parameter, clamped to [1, max].
 *
 * Note the explicit null check: `Number(null)` is 0, not NaN, so a missing
 * parameter would otherwise clamp to a single row.
 */
export function readLimit(request, fallback, max) {
  const raw = new URL(request.url).searchParams.get('limit');
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 1), max);
}

/** Salted hash of the caller's IP. Used only to rate limit; never returned. */
export async function hashIp(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const salt = (env && env.ARCADE_SALT) || 'games.ross.dev';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${salt}:${ip}`)
  );
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Returns an error Response when this caller has posted too much, else null. */
export async function checkRateLimit(db, ipHash, now) {
  const { results } = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN created_at > ?2 THEN 1 ELSE 0 END) AS last_minute,
         COUNT(*) AS last_day
       FROM scores
       WHERE ip_hash = ?1 AND created_at > ?3`
    )
    .bind(ipHash, now - 60_000, now - 86_400_000)
    .all();

  const row = results[0] || {};
  if ((row.last_minute || 0) >= RATE_LIMIT_PER_MINUTE || (row.last_day || 0) >= RATE_LIMIT_PER_DAY) {
    return json({ error: 'rate_limited', message: 'Too many scores too quickly. Try again shortly.' }, 429);
  }
  return null;
}

/**
 * Standard competition ranking (1, 2, 2, 4) over rows already sorted best-first.
 * Mutates each row, adding `rank`.
 */
export function assignRanks(rows) {
  let lastValue = null;
  let lastRank = 0;
  rows.forEach((row, i) => {
    if (lastValue !== null && row.best === lastValue) {
      row.rank = lastRank;
    } else {
      row.rank = i + 1;
      lastRank = row.rank;
      lastValue = row.best;
    }
  });
  return rows;
}

/**
 * Every player's personal best in one game, best first.
 *
 * The aggregate and sort direction come from the registry, never from user
 * input, so interpolating them into the SQL is safe. `player_name` needs the
 * correlated subquery rather than a bare column: SQLite only defines the
 * bare-column-with-MAX() shortcut for a single aggregate, and the leaderboard
 * query below uses both MAX and MIN.
 */
export async function bestsForGame(db, slug, limit = 100) {
  const low = GAMES[slug]?.dir === 'low';
  const agg = low ? 'MIN' : 'MAX';
  const order = low ? 'ASC' : 'DESC';

  const { results } = await db
    .prepare(
      `SELECT
         s.player_key AS playerKey,
         (SELECT n.player_name FROM scores n
           WHERE n.player_key = s.player_key
           ORDER BY n.created_at DESC LIMIT 1) AS name,
         ${agg}(s.value) AS best,
         COUNT(*)        AS plays,
         MAX(s.created_at) AS lastAt
       FROM scores s
       WHERE s.game = ?1
       GROUP BY s.player_key
       ORDER BY best ${order}
       LIMIT ?2`
    )
    .bind(slug, limit)
    .all();

  return assignRanks(results || []);
}

/**
 * Cross-game standings.
 *
 * One query pulls every (game, player) personal best; ranking and point
 * totals are done here in JS. At family scale that is a handful of rows, and
 * it keeps the Arcade Points rule in one readable place.
 */
export async function buildLeaderboard(db) {
  const { results } = await db
    .prepare(
      `SELECT
         s.game       AS game,
         s.player_key AS playerKey,
         (SELECT n.player_name FROM scores n
           WHERE n.player_key = s.player_key
           ORDER BY n.created_at DESC LIMIT 1) AS name,
         MAX(s.value)      AS hi,
         MIN(s.value)      AS lo,
         COUNT(*)          AS plays,
         MAX(s.created_at) AS lastAt
       FROM scores s
       GROUP BY s.game, s.player_key`
    )
    .all();

  const byGame = new Map();
  for (const row of results || []) {
    if (!GAMES[row.game]) continue; // a retired game still in the table
    if (!byGame.has(row.game)) byGame.set(row.game, []);
    byGame.get(row.game).push({
      playerKey: row.playerKey,
      name: row.name,
      best: GAMES[row.game].dir === 'low' ? row.lo : row.hi,
      plays: row.plays,
      lastAt: row.lastAt,
    });
  }

  const players = new Map();
  const games = [];

  for (const [slug, rows] of byGame) {
    rows.sort((a, b) => compareScores(slug, a.best, b.best));
    assignRanks(rows);

    games.push({
      slug,
      name: GAMES[slug].name,
      dir: GAMES[slug].dir,
      unit: GAMES[slug].unit,
      players: rows.length,
      champion: rows[0] ? { name: rows[0].name, best: rows[0].best } : null,
    });

    for (const row of rows) {
      const player = players.get(row.playerKey) || {
        playerKey: row.playerKey,
        name: row.name,
        points: 0,
        gamesPlayed: 0,
        golds: 0,
        plays: 0,
        lastAt: 0,
        bests: {},
      };
      player.name = row.name;
      player.points += pointsForRank(row.rank);
      player.gamesPlayed += 1;
      player.plays += row.plays;
      if (row.rank === 1) player.golds += 1;
      player.lastAt = Math.max(player.lastAt, row.lastAt);
      player.bests[slug] = { best: row.best, rank: row.rank };
      players.set(row.playerKey, player);
    }
  }

  const standings = [...players.values()].sort(
    (a, b) => b.points - a.points || b.golds - a.golds || a.name.localeCompare(b.name)
  );
  standings.forEach((p, i) => {
    p.rank = i > 0 && standings[i - 1].points === p.points ? standings[i - 1].rank : i + 1;
  });

  games.sort((a, b) => a.name.localeCompare(b.name));
  return { standings, games };
}
