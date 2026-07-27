# Kingdom Bloom

An idle-arcade kingdom tycoon (React + canvas + Vite). Run around as Pip the
young ruler, collect coins that pop out of your buildings, and stand on
glowing pads to pay for repairs — rebuilding the kingdom of Bloomvale across
three zones.

## Story

The Sunstone that kept Bloomvale bright has cracked. Pip and friends — Fern
the fox gardener, Bramble the badger builder, Luna the owl scholar, and Poppy
the bunny baker — rebuild the kingdom one structure at a time: Castle
Courtyard → Village Row → Sunstone Keep (15 builds total, ending with the
Sunstone itself).

## Mechanics

- **Movement**: WASD/arrow keys, or press-and-drag anywhere (virtual
  joystick) on touch. Camera follows Pip across a 2400×800 world.
- **Producers** spawn coin piles nearby on a timer (capped at 6 lying around
  each); walk over coins to collect them.
- **Build pads**: glowing dashed circles with a price. Standing on one drains
  coins from your wallet (over ~2 seconds) until it's paid, then the building
  pops in with a story dialogue line.
- **Boosters** (lamps, windmill) multiply coin values in their zone. 
- **Helpers**: hiring Fern/Poppy/Luna spawns an NPC that auto-collects coins
  in their zone — this is also what powers offline earnings (capped at 1h,
  60% rate).
- **Gates** unlock the next zone (fence + darkened area until opened).
- **Finale**: building the Sunstone triggers the ending dialogue, a golden
  world glow, and confetti; the game keeps running afterwards.
- **Save**: money + built list in `localStorage` (`kingdom-bloom-v2`),
  autosaved every 3s and on tab hide. Reset via the ↺ HUD button.

## Code map

- `src/game/data.js` — world/zones, the 16 pads (costs, production rates),
  characters, dialogue
- `src/game/engine.js` — the whole game loop: input, movement, coin
  spawning/pickup, pad payment, helper AI, canvas rendering, save/load
- `src/components/Dialogue.jsx` — story dialogue overlay (pauses the game)
- `src/App.jsx` — canvas mount, HUD, dialogue queue, toast, confetti

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build to `dist/` (used by the monorepo build)

Note: `base: './'` in vite.config.js is required for serving from
`/kingdom-bloom/` on games.ross.dev.
