# games.ross.dev

Family Game Arcade — a monorepo of browser games built with Claude Code, deployed to Cloudflare Pages.

## Project Structure

```
games.ross.dev/
  landing/          # Landing page (index.html, styles.css, icons/)
  games/            # Each game in its own directory
  scripts/          # Build orchestrator
  dist/             # Build output (gitignored)
  .github/          # CI/CD workflows + Claude integration
```

## Game Inventory

| Slug | Display Name | Tech Stack | Build |
|------|-------------|-----------|-------|
| asteroid-dodger | Asteroid Dodger | React + Vite | `vite build` |
| balloon-pop-blitz | Balloon Pop Blitz | React + Vite | `vite build` |
| comet-dash | Comet Dash | Babylon.js + TS + Vite | `vite build` |
| connect-four | Connect Four | Static (HTML/CSS/JS) | copy only |
| grand-hotel-tycoon | Grand Hotel Tycoon | Babylon.js + TS + Vite | `tsc && vite build` |
| guess-the-drawing | Guess the Drawing | Vanilla JS | `node build.js` |
| hangman | Word Guess | Static (HTML/CSS/JS) | copy only |
| hanyverse | Hanyverse | Phaser + Vite | `vite build` |
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
3. Add the game slug to the `games` array in `scripts/build-all.js`
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
landing/leaderboard.html
```

The D1 binding (`DB`) is configured in the Cloudflare Pages dashboard, not in
git. Without it the API returns 503 and the games play normally.

## Build System

`scripts/build-all.js` handles the full build:
- For each game with a `package.json`: runs `npm ci && npm run build`, copies `dist/` output
- For static games (ojoj): copies files directly
- Copies `landing/` to `dist/` root

## Deployment

- **Production**: Push to `main` → GitHub Actions deploys to Cloudflare Pages at `games.ross.dev`
- **PR Previews**: Open a PR → preview deployed to `<branch>.games-ross-dev.pages.dev`
- Secrets needed: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## Key Convention

All Vite-based games MUST have `base: './'` in their vite.config. Without this, assets won't load when served from a subdirectory (e.g., `/phase-10/`).
