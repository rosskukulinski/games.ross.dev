# games.ross.dev

Family Game Arcade — a monorepo of browser games built with Claude Code, deployed to Cloudflare Pages.

## Project Structure

```
games.ross.dev/
  landing/          # Landing page (index.html, styles.css, icons/)
  games/            # Each game in its own directory
  multiplayer-server/  # Cloudflare Worker + Durable Object for real-time multiplayer
  scripts/          # Build orchestrator
  dist/             # Build output (gitignored)
  .github/          # CI/CD workflows + Claude integration
```

## Multiplayer

`multiplayer-server/` is a Cloudflare Worker with a Durable Object per game
room, deployed separately from the static site. It hosts the real-time matches
for two games, each with its own Durable Object class and path prefix:

- **Air Hockey** (`/room/:code`, class `AirHockeyRoom`): two players, 60Hz
  authoritative physics, 30Hz snapshots over WebSockets.
- **Hole Munchers** (`/hole/room/:code`, class `HoleRoom`): up to 8 players in
  a drop-in arena topped up with bots, 30Hz simulation and snapshots.

Each simulation lives in `games/<slug>/src/shared/rules.ts` and is imported by
both the Worker and the game client (the client uses it for solo-vs-bot play).
It lives in the game directory on purpose — the build cache only hashes
`games/<slug>/`, so rules changes must live there to invalidate it.

It deploys twice: `air-hockey-server` from `main`, and
`air-hockey-server-preview` from every PR, so a preview client never joins a
room on the production server. Each build is pointed at the right one by the
`MP_SERVER_URL` / `MP_PREVIEW_SERVER_URL` repository variables.

The API token needs `Workers Scripts: Edit`, which is separate from the
`Cloudflare Pages: Edit` the site uses. The Worker deploys as its own CI job,
so if that permission is missing the site still ships green while the Worker
quietly stops updating.

See [`multiplayer-server/README.md`](multiplayer-server/README.md) for the
one-time setup needed to point the game at the deployed Worker.

## Game Inventory

| Slug | Display Name | Tech Stack | Build |
|------|-------------|-----------|-------|
| air-hockey | Air Hockey | PixiJS v8 + TS + Vite (+ Cloudflare Worker/DO) | `tsc && vite build` |
| asteroid-dodger | Asteroid Dodger | React + Vite | `vite build` |
| balloon-pop-blitz | Balloon Pop Blitz | React + Vite | `vite build` |
| comet-dash | Comet Dash | Babylon.js + TS + Vite | `vite build` |
| connect-four | Connect Four | Static (HTML/CSS/JS) | copy only |
| grand-hotel-tycoon | Grand Hotel Tycoon | Babylon.js + TS + Vite | `tsc && vite build` |
| guess-the-drawing | Guess the Drawing | Vanilla JS | `node build.js` |
| hangman | Word Guess | Static (HTML/CSS/JS) | copy only |
| hanyverse | Hanyverse | Phaser + Vite | `vite build` |
| hole-io | Hole Munchers | Three.js + TS + Vite (+ Cloudflare Worker/DO) | `tsc && vite build` |
| kpop-rythm-tap | K-Pop Rhythm Tap | React + Vite + Canvas + Web Audio | `vite build` |
| neon-bricks | Neon Bricks | PixiJS v8 + pixi-filters + TS + Vite | `vite build` |
| number-line-monster | Monster Hunt | Static (HTML/CSS/JS) | copy only |
| ojoj | OJOJ Racing | Static (HTML/CSS/JS) | copy only |
| pet-care-game | Dragon Keeper | React + TS + Zustand + Vite | `tsc -b && vite build` |
| phase-10 | Phase 10 | React + Vite | `vite build` |
| pinball | Cosmic Pinball | PixiJS v8 + pixi-filters + TS + Vite | `tsc && vite build` |
| robot-rally | Robot Rally | Three.js + glTF assets + TS + Vite | `vite build` |
| sir-name-alot | Sir-Name-Alot | Vue + Vite | `vite build` |
| skee-ball | Skee-Ball | React + Vite | `vite build` |
| sudoku | Sudoku | Static (HTML/CSS/JS) | copy only |
| tic-tac-toe | Tic-Tac-Toe | Static (HTML/CSS/JS) | copy only |
| treasure-hunt-island | Treasure Hunt Island | React + Vite | `vite build` |
| unicorn-dragon | Unicorn Dragon | Three.js + TS + Vite | `tsc && vite build` |

## Commands

```bash
npm run build        # Build changed games + landing page into dist/
npm run build:force  # Rebuild all games (ignore cache)
npm run serve        # Serve dist/ locally
npm run dev          # Build then serve
npm run clean        # Remove dist/

npm run db:local     # Create/migrate a local D1 database for the leaderboard
npm run dev:api      # Serve dist/ with the Pages Functions + local D1 bound
npm run db:migrate   # Apply db/migrations to the remote D1 database
```

The build script uses content-hash caching (`.build-cache.json`, gitignored) to skip unchanged games. It hashes all source files in each game directory and only rebuilds when the hash changes, `dist/<game>/` is missing, or the build script itself changes. Dependency installs (`npm ci`) are also skipped when `package-lock.json` hasn't changed.

## Adding a New Game

Use the `/new-game` slash command:
```
/new-game my-game-name
```

Or manually:
1. Create `games/<name>/` with your game code
2. If using Vite, set `base: './'` in vite.config (required for subdirectory serving)
3. Add the game slug to `scripts/games-list.js`
4. Add a card to `landing/index.html`
5. Add an SVG icon to `landing/icons/<name>.svg`
6. To put it on the leaderboard, follow "Adding a game" in `docs/leaderboard.md`

## Leaderboard

Scores are stored server-side in Cloudflare D1 and served by Pages Functions in
`functions/`. `landing/arcade/games.js` is the single registry of which games
rank and how; the browser and the Functions both import it. Nine games post
scores today. Full setup, API and conventions: **`docs/leaderboard.md`**.

```
db/migrations/     # D1 schema
functions/         # Pages Functions (repo root — wrangler resolves it from cwd)
landing/arcade/    # Published at /arcade/: registry, client SDK, page scripts
landing/leaderboard/index.html
```

The D1 binding (`DB`) is configured in the Cloudflare Pages dashboard, not in
git. Without it the API returns 503 and the games play normally.

## Build System

`scripts/build-all.js` handles the full build:
- For each game with a `package.json`: runs `npm ci && npm run build`, copies `dist/` output
- For static games (ojoj): copies files directly
- Injects the shared back button into every built game page (see below)
- Copies `landing/` to `dist/` root

## Leaving a Game

Installed on the Home Screen there is no browser chrome, so a game with no exit
of its own traps the player — and no game has one of its own. Every built game
page therefore gets a *‹ Arcade* button in the top-left corner, which asks for
confirmation and then returns to `/`.

`landing/arcade/home-button.js` is the whole implementation, served at
`/arcade/home-button.js` and shared by every game. `scripts/build-all.js`
injects the script tag into each `dist/<game>/**/*.html` after the game builds,
so **a new game needs no back-button code of its own** — and Vite never sees
the absolute path, which it would otherwise fail to resolve.

Because the injected tag is a fixed one-liner, editing the button's code never
requires rebuilding a game; only changing the tag itself does, and editing
`build-all.js` already rebuilds everything.

A game whose own UI already holds that corner moves the button with one line in
its `index.html`:

```html
<meta name="arcade-home-button" content="bottom-left" />
```

`top-left` (default), `top-right`, `bottom-left`, `bottom-right`, or `off` for a
game that grows a real arcade exit of its own. The rule used so far: move it to
a corner the game leaves free, and where a game holds all four (robot-rally,
treasure-hunt-island) leave it at the default and accept that it sits over a
score pill. Prefer covering a read-only panel over a control — bottom-left is
a joystick in robot-rally and touch controls in treasure-hunt-island.

The button only draws itself in an installed app (`display-mode: standalone`
and friends, or `navigator.standalone` on iOS). In an ordinary tab Safari's own
back button already does the job, so a second one would just cover the game. It
renders in a shadow root — like `arcade.js` — so no game's CSS can reach it, and
it sits inside `env(safe-area-inset-*)` to clear the notch.

## Deployment

- **Production**: Push to `main` → GitHub Actions deploys to Cloudflare Pages at `games.ross.dev`
- **PR Previews**: Open a PR → preview deployed to `<branch>.games-ross-dev.pages.dev`
- Secrets needed: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## Offline Support (PWA)

The whole arcade is installable and plays offline, once the visitor asks for it
with the *Save games for offline play* button in the header. The download is
opt-in on purpose — it is tens of megabytes — and the choice is remembered in
`localStorage` (`arcade-offline-enabled`), so later visits top the cache back
up on their own after a new build.

- `scripts/sw-template.js` is the service worker source. `scripts/build-all.js`
  injects the full `dist/` file list and a content-hash version into it and
  writes `dist/sw.js` on **every** build (never edit `dist/sw.js` by hand).
- One worker at the site root covers the landing page *and* every game, so
  games need no offline code of their own.
- `landing/offline.js` registers the worker on every visit (so anything already
  cached keeps working), but only starts the download once the user opts in. It
  also renders the progress line and the install tip, both of which stay hidden
  until then.
- `landing/manifest.webmanifest` + `landing/icons/app/` make it installable.
  Regenerate the icons with `node scripts/generate-icons.js`.
- A new build changes the version hash, which installs a fresh worker and drops
  the previous cache.

**Installing**: Mac — Safari's *Add to Dock*, or Chrome's install button.
iPad — Share → *Add to Home Screen*. On iOS this step matters: Safari evicts
site data for tabs unused for 7 days, but home screen web apps keep theirs.

**Verifying**: `npm run build && npm run verify:offline` clicks the save
button, precaches, kills the server, and loads every game from cache alone. Run it after touching anything
in the offline path. It serves through `scripts/pages-server.js`, which
imitates Cloudflare Pages — `npx serve dist` does **not**, and the difference
hides real bugs (see below).

**Safari gotchas** — both already handled, but easy to reintroduce:

- *Redirects.* Safari refuses a navigation response whose `redirected` flag is
  set ("Response served by service worker has redirections"). Pages
  308-redirects `/index.html` → `/`, so pages are cached under their directory
  URL (`/phase-10/`), and anything cached is rebuilt to clear the flag. Chromium
  serves redirected responses happily, so only the assertion in
  `verify-offline.js` catches this — not a passing page load.
- *Range requests.* Safari asks for audio with a `Range` header and rejects the
  plain 200 the Cache API returns, so the worker slices cached media into real
  206 responses.

Two rules to keep offline working when adding a game:

- **No external URLs.** No CDN scripts and no Google Fonts links — self-host
  instead (see `landing/fonts.css` for the pattern, regenerate with
  `scripts/fetch-fonts.js`). Anything fetched from another origin is simply
  missing offline.
- **Watch the download size.** Every byte in `dist/` is downloaded on first
  visit; the build prints the total. It is currently ~50 MB, most of it the
  K-Pop songs.

## Key Convention

All Vite-based games MUST have `base: './'` in their vite.config. Without this, assets won't load when served from a subdirectory (e.g., `/phase-10/`).
