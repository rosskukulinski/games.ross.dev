-- Arcade leaderboard: one row per submitted score.
--
-- Append-only on purpose. Personal bests are a MAX()/MIN() aggregate rather
-- than an upserted column, which keeps submissions auditable and gives the
-- "recent activity" feed for free.

CREATE TABLE IF NOT EXISTS scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game        TEXT    NOT NULL,
  variant     TEXT    NOT NULL DEFAULT '',  -- e.g. k-pop song id; '' for most games
  player_key  TEXT    NOT NULL,             -- lowercased + trimmed name, for grouping
  player_name TEXT    NOT NULL,             -- display name exactly as typed
  value       REAL    NOT NULL,             -- points, or seconds for dir:'low' games
  meta        TEXT,                         -- optional JSON: grade, accuracy, level...
  created_at  INTEGER NOT NULL,             -- epoch ms
  ip_hash     TEXT                          -- salted hash, used only for rate limiting
);

CREATE INDEX IF NOT EXISTS idx_scores_game    ON scores(game, value);
CREATE INDEX IF NOT EXISTS idx_scores_player  ON scores(player_key);
CREATE INDEX IF NOT EXISTS idx_scores_created ON scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_ip      ON scores(ip_hash, created_at);
