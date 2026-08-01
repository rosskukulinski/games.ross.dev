// Arcade score registry — the single source of truth for which games post
// scores and how those scores are interpreted.
//
// This module is imported from two places:
//   - the browser, as /arcade/games.js (the leaderboard page and landing badges)
//   - the Pages Functions, as ../../landing/arcade/games.js (validation + ranking)
//
// It lives under landing/ because scripts/build-all.js already copies that
// directory to the dist root, so no build-script change is needed to publish it.
//
// Fields:
//   name  - display name, matching the card on the landing page
//   dir   - 'high' if a bigger value is better, 'low' for times
//   unit  - 'points' or 'seconds'; drives formatting
//   min   - smallest plausible value (defaults to 0); submissions below are rejected
//   max   - largest plausible value; submissions above are rejected
//
// Bounds are deliberately generous. They exist to reject obvious garbage
// (negatives, Infinity, a stray timestamp submitted as a score), not to
// second-guess a genuinely good run.
//
// To add a game: add an entry here, drop
// `<script defer src="/arcade/arcade.js"></script>` into its index.html, and
// call `window.Arcade?.submit({ game: '<slug>', value })` where it already
// records a personal best.

export const GAMES = {
  'asteroid-dodger': {
    name: 'Asteroid Dodger',
    dir: 'high',
    unit: 'points',
    max: 1_000_000,
  },
  'balloon-pop-blitz': {
    name: 'Balloon Pop Blitz',
    dir: 'high',
    unit: 'points',
    max: 1_000_000,
  },
  'comet-dash': {
    name: 'Comet Dash',
    dir: 'high',
    unit: 'points',
    max: 1_000_000,
  },
  'kpop-rythm-tap': {
    name: 'K-Pop Rhythm Tap',
    dir: 'high',
    unit: 'points',
    max: 5_000_000,
    note: 'Ranked on your best run, whichever track you played.',
  },
  'neon-bricks': {
    name: 'Neon Bricks',
    dir: 'high',
    unit: 'points',
    max: 1_000_000,
  },
  pinball: {
    name: 'Cosmic Pinball',
    dir: 'high',
    unit: 'points',
    max: 100_000_000,
  },
  'robot-rally': {
    name: 'Robot Rally',
    dir: 'low',
    unit: 'seconds',
    min: 3,
    max: 900,
  },
  'skee-ball': {
    name: 'Skee-Ball',
    dir: 'high',
    unit: 'points',
    max: 100_000,
  },
  'treasure-hunt-island': {
    name: 'Treasure Hunt Island',
    dir: 'low',
    unit: 'seconds',
    min: 1,
    max: 3600,
  },
};

/** Slugs in a stable display order. */
export const GAME_SLUGS = Object.keys(GAMES).sort((a, b) =>
  GAMES[a].name.localeCompare(GAMES[b].name)
);

/** True when `a` is a better score than `b` for this game. */
export function isBetter(slug, a, b) {
  if (b === null || b === undefined) return true;
  return GAMES[slug]?.dir === 'low' ? a < b : a > b;
}

/** Sort comparator putting the best score first. */
export function compareScores(slug, a, b) {
  return GAMES[slug]?.dir === 'low' ? a - b : b - a;
}

/**
 * Arcade Points earned for placing `rank` (1-based) in a single game.
 *
 * 1st = 110, 2nd = 60, 3rd = 43, 4th = 35 ... and everyone who shows up gets
 * at least 11. Rewarding every entry means playing a lot of games counts for
 * something, not just topping one of them.
 */
export function pointsForRank(rank) {
  return Math.round(100 / rank) + 10;
}

/** Format a raw score for display, e.g. `12,340` or `48.20s`. */
export function formatScore(slug, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (GAMES[slug]?.unit === 'seconds') return `${value.toFixed(2)}s`;
  return Math.round(value).toLocaleString();
}
