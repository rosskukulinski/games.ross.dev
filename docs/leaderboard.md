# Arcade leaderboard

Server-side high scores for the arcade, plus a leaderboard that ranks players
across games. Scores live in **Cloudflare D1** and are served by **Pages
Functions** on the existing `games-ross-dev` Pages project.

There are no accounts. A player types their name each time they post a score;
the last name used is remembered in `localStorage` so the field comes
pre-filled, but it is always editable and posting always takes an explicit tap.

## Moving parts

| Path | What it is |
|------|-----------|
| `db/migrations/0001_init.sql` | The `scores` table |
| `landing/arcade/games.js` | Score registry — the one definition of which games rank, and how |
| `landing/arcade/arcade.js` | Client SDK, served at `/arcade/arcade.js` |
| `landing/arcade/leaderboard.js` | Leaderboard page logic |
| `landing/arcade/home-badges.js` | Champion line on each landing-page card |
| `landing/leaderboard/index.html` | The leaderboard page |
| `functions/_lib/arcade.js` | Validation, rate limiting, ranking |
| `functions/api/*` | The HTTP API |

`landing/` is copied wholesale to the dist root by `scripts/build-all.js`, so
`landing/arcade/*` is published at `/arcade/*` with no build-script changes.
The Functions import the registry straight from `landing/arcade/games.js`, which
is why the browser and the server can never disagree about a game's bounds or
scoring direction.

## One-time Cloudflare setup

Until this is done the site deploys and every game plays normally — the API just
returns `503 not_configured` and the leaderboard page says so.

1. **Create the databases** (production and PR previews are kept separate so a
   preview deploy can't scribble on real scores):

   ```bash
   npx wrangler d1 create arcade-scores
   npx wrangler d1 create arcade-scores-preview
   ```

2. **Apply the schema** to both:

   ```bash
   npm run db:migrate
   npx wrangler d1 execute arcade-scores-preview --remote --file=db/migrations/0001_init.sql
   ```

3. **Bind them** in the Cloudflare dashboard →
   *Workers & Pages → games-ross-dev → Settings → Bindings*:

   | Environment | Binding name | Database |
   |-------------|--------------|----------|
   | Production  | `DB`         | `arcade-scores` |
   | Preview     | `DB`         | `arcade-scores-preview` |

4. **Optional secrets**, same settings page:

   | Name | Purpose |
   |------|---------|
   | `ARCADE_SALT` | Salts the IP hash used for rate limiting. Any random string. |
   | `ARCADE_ADMIN_KEY` | Required by `DELETE /api/scores?id=…` to remove a bogus row. |

### Why the binding lives in the dashboard, not in `wrangler.toml`

A committed `wrangler.toml` for a Pages project must carry a real
`database_id`. A placeholder would fail every production and preview deploy
until it was filled in, whereas a missing dashboard binding only disables the
leaderboard. If you would rather have it in git, add a `wrangler.toml` with
`pages_build_output_dir = "dist"`, a top-level `[[d1_databases]]` block for
production and `[env.preview]` for previews — `wrangler pages deploy dist` picks
the environment from the branch, and the positional `dist` argument still wins
over `pages_build_output_dir`, so the workflows need no changes.

## Local development

```bash
npm run build      # produces dist/
npm run db:local   # create + migrate a local D1 file under .wrangler/state
npm run dev:api    # wrangler pages dev dist --d1 DB=arcade-scores
```

`wrangler pages dev` picks up `functions/` from the repo root — the same place
`wrangler pages deploy dist` looks, since both resolve it relative to the
current working directory rather than to the asset directory.

`db:local` passes `-c db/wrangler.dev.toml`: `wrangler d1 execute --local` needs
a config file to know which local database to create, and `--persist-to
.wrangler/state` puts it where `dev:api` will look for it. That config is
dev-only and no other command reads it — see the note above on why there is no
root `wrangler.toml`.

To exercise `ARCADE_SALT` or the admin delete locally, put them in a `.dev.vars`
file at the repo root (gitignored):

```
ARCADE_ADMIN_KEY = "anything"
ARCADE_SALT = "anything"
```

`npm run serve` still works for static-only checks, but the `/api/*` routes only
exist under `dev:api`.

`db:migrate` targets the remote database by name, so it needs `wrangler login`
or `CLOUDFLARE_API_TOKEN` in the environment.

## API

| Method | Route | Notes |
|--------|-------|-------|
| `POST` | `/api/scores` | `{game, value, name, variant?, meta?}` → `{rank, best, players, top}` |
| `GET`  | `/api/scores/:game` | Personal bests, best first. `?limit=` up to 100 |
| `GET`  | `/api/leaderboard` | Cross-game standings + each game's champion |
| `GET`  | `/api/recent` | Latest submissions. `?limit=` up to 50 |
| `DELETE` | `/api/scores?id=` | Needs the `X-Arcade-Admin-Key` header |

## Arcade Points

Scores aren't comparable between games — points in Neon Bricks mean nothing
against seconds in Robot Rally. So the cross-game table ranks *placings*:

> In each game you earn `round(100 / your rank) + 10` Arcade Points.

1st is worth 110, 2nd 60, 3rd 43, and simply showing up is worth 11. Totalled
across games, that rewards playing broadly as well as winning. Ties share a
rank, competition-style (1, 2, 2, 4).

## Adding a game to the leaderboard

Three edits:

1. Add an entry to `GAMES` in `landing/arcade/games.js` — `dir: 'high'` for
   points, `dir: 'low'` for times, plus plausible `min`/`max` bounds.
2. Add `<script defer src="/arcade/arcade.js"></script>` before `</body>` in the
   game's `index.html`. It must be a plain script, not `type="module"`: Vite
   resolves absolute module paths at build time and fails on a file that only
   exists at the site root.
3. Call `window.Arcade?.submit({ game: '<slug>', value })` where the game
   already records a personal best. In TypeScript games use
   `(window as any).Arcade?.submit(...)` — the global comes from outside the
   bundle. Keep the `?.`: running a game under its own `vite dev` server means
   `/arcade/arcade.js` 404s, and that has to stay harmless.

Times must be submitted in **seconds**, not milliseconds.

### Games not yet wired

Nine of the remaining games have an obvious metric and need only the three edits
above:

| Game | Suggested metric |
|------|------------------|
| sudoku | completion time per difficulty (`variant`) |
| tic-tac-toe | wins in a row against the computer |
| connect-four | wins in a row against the computer |
| hangman | words solved in a row |
| number-line-monster | correct answers per level |
| ojoj | race finish time |
| guess-the-drawing | stars earned in a session |
| unicorn-dragon | run score |
| phase-10 | lowest winning total |

The four sandbox games — hanyverse, pet-care-game, grand-hotel-tycoon and
sir-name-alot — have no terminal event, so they need a progress metric (coins,
hotel value) agreed on first.

## What this is not

Scores are submitted by the browser, so anyone willing to open devtools can post
whatever they like. The guards are proportionate to a family arcade, not to a
public tournament:

- values outside the registry's `min`/`max` are rejected
- names are trimmed to 16 characters with control characters stripped
- cross-origin `POST`s are rejected
- submissions are capped per IP (20/minute, 300/day) using a salted hash that is
  never returned by the API

If a bogus score does land, delete it with `DELETE /api/scores?id=…`; find the
id via `/api/recent`.
