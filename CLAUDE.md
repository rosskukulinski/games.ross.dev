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
| guess-the-drawing | Guess the Drawing | Vanilla JS | `node build.js` |
| hanyverse | Hanyverse | Phaser + Vite | `vite build` |
| number-line-monster | Monster Hunt | Static (HTML/CSS/JS) | copy only |
| ojoj | OJOJ Racing | Static (HTML/CSS/JS) | copy only |
| pet-care-game | Dragon Keeper | React + TS + Zustand + Vite | `tsc -b && vite build` |
| phase-10 | Phase 10 | React + Vite | `vite build` |
| sir-name-alot | Sir-Name-Alot | Vue + Vite | `vite build` |
| unicorn-dragon | Unicorn Dragon | Three.js + TS + Vite | `tsc && vite build` |

## Commands

```bash
npm run build        # Build changed games + landing page into dist/
npm run build:force  # Rebuild all games (ignore cache)
npm run serve        # Serve dist/ locally
npm run dev          # Build then serve
npm run clean        # Remove dist/
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
