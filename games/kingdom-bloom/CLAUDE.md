# Kingdom Bloom

A merge-and-restore kingdom game (React + Vite). Merge items on a board, fill
character orders to earn stars, and spend stars to restore the kingdom of
Bloomvale across three story chapters.

## Story

The Sunstone that kept Bloomvale bright has cracked. Pip (the young ruler) and
friends — Fern the fox gardener, Bramble the badger builder, Luna the owl
scholar, and Poppy the bunny baker — restore the kingdom one spot at a time:
Castle Courtyard → Village Row → Sunstone Keep (15 spots total).

## Mechanics

- **Merge board** (7×8): tap generators (🪴⛲🛠️🛒) to spawn items (1 energy
  each), drag two identical items together to merge into the next tier.
  4 chains (flora / light / tools / treats) × 5 tiers each.
- **Energy**: 100 max, regenerates 1 per 5s (also while away); can buy +40
  for 60 coins.
- **Orders**: 3 active orders from characters; delivering consumes the items
  and pays coins + stars. Order difficulty scales with restoration progress.
- **Kingdom view**: SVG scenes per chapter; spend stars on pins to restore
  spots (broken art swaps to restored art). Generators unlock at 2 and 5
  restorations; chapters unlock sequentially; finale + confetti at 15/15.
- **Save**: full state in `localStorage` (`kingdom-bloom-v1`), including
  offline energy regen. Reset via the ↺ button in the HUD.

## Code map

- `src/game/data.js` — chains, generators, characters, chapters/spots, dialogue
- `src/game/state.js` — reducer, order generation, energy regen, save/load
- `src/components/Board.jsx` — grid + pointer-based drag/merge/tap logic
- `src/components/Orders.jsx` — order cards + deliver
- `src/components/Kingdom.jsx` — the three SVG scenes, pins, chapter tabs
- `src/components/Dialogue.jsx` — story dialogue overlay
- `src/App.jsx` — HUD, tabs, sell bar, toast, confetti

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build to `dist/` (used by the monorepo build)

Note: `base: './'` in vite.config.js is required for serving from
`/kingdom-bloom/` on games.ross.dev.
