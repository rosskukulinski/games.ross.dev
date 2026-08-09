# Hole Munchers (hole-io)

Real-time multiplayer hole.io: you are a hole, you eat everything smaller
than you, you grow, and you can swallow smaller rival holes — their whole
score becomes yours. Up to 8 humans share a drop-in arena via a Cloudflare
Durable Object, with bots topping the arena up to six holes. Solo play runs
the identical simulation in-page.

Rendered in 3D from a gently tilted chase camera, with three map themes
picked by the arena seed: a **city park** (glowing towers, houses, cars), a
**moon base** (rockets, domes, antennas, crystals), and **pirate islands**
(ships, palms, treasure, whales). The theme is pure cosmetics — one
simulation, ten prop size-tiers, three sets of clothes for them.

**Stack:** Three.js + TypeScript + Vite.
**Server:** [`multiplayer-server/`](../../multiplayer-server) (`HoleRoom` Durable
Object, rooms at `/hole/room/:code` on the same Worker as Air Hockey).

## How a match works

The server is authoritative: it runs the simulation at 30Hz and broadcasts a
snapshot every tick, so browsers can never disagree about who swallowed whom,
and a tampered client can't move faster or eat things it shouldn't — input is
a direction vector clamped server-side.

The arena is **deterministic from a seed**. On join the server sends the seed
plus the ids of currently-eaten props; both sides generate the identical prop
layout with `generateProps(seed)` and after that only prop ids cross the wire
(`eat` / `prop` regrow events). Snapshots carry just the holes.

The client renders ~100ms behind the newest snapshot with buffered
interpolation. Its *own* hole is drawn from local prediction instead
(`advanceHole`, the same speed rule the server applies) and soft-corrected
toward the authoritative position, so steering never feels laggy. Impact
events are queued and fired when the frame they belong to is drawn.

Rounds are drop-in: countdown → 2 minutes of play → standings for a few
seconds → automatic next round. Players joining mid-round spawn immediately.
Getting swallowed costs you your score and respawns you small after ~2.6s with
brief spawn protection.

Solo play is not a separate code path: `LocalTransport` runs the identical
simulation in-page (5 bots) and speaks the same protocol as the Durable
Object, so `main.ts` never branches on game mode.

## Files

| File | Role |
|------|------|
| `src/shared/rules.ts` | The simulation + arena generator + bot AI + theme picker. **Shared verbatim with the Worker.** |
| `src/protocol.ts` | Message types + the `Transport` interface both modes implement |
| `src/net.ts` | WebSocket transport, server discovery, health probe |
| `src/local.ts` | In-page transport for solo play (bots included) |
| `src/view.ts` | All Three.js rendering: tilted camera, themed 3D prop kits, holes, particles, popups |
| `src/audio.ts` | Synthesized Web Audio (no asset files) |
| `src/ui.ts` | DOM menus, room-code entry, HUD, leaderboard, joystick |
| `src/main.ts` | Boot, input, prediction + interpolation, frame loop |

`rules.ts` lives here rather than beside the Worker on purpose: the monorepo
build cache only hashes `games/<slug>/`, so rules changes must live in this
directory to invalidate it.

## Design notes worth knowing

- **Bot ids start at 1000** in online rooms so they can never collide with
  human ids (humans count up from 0). In solo play ids 1–5 are bots.
- **Growth is a power curve** (`radiusForScore`): fast early, slow late, capped
  at `HOLE_MAX_R`. Speed falls off with size, so big holes are menacing but
  escapable.
- **The swallow check runs biggest-first** so an A>B>C overlap resolves
  top-down in a single tick.
- **Props never regrow under a hole** that could instantly re-eat them (the
  regrow check retries every 2s) — otherwise a parked hole becomes a point
  fountain.
- **The arena is dense on purpose** (~580 props): there should always be
  something to munch nearby. The four smallest tiers spawn in clumps of 4–8
  (`CLUSTERED_KINDS`) so the map reads as flower fields and cone rows rather
  than confetti; keep the numerous tiers to one mesh each (no glow parts) so
  density stays cheap to draw.
- **Themes are client-side only** (`themeForSeed` in rules.ts): same seed →
  same theme on every client, nothing on the wire, the server doesn't care.
  `?theme=city|moon|pirate` overrides it for testing/screenshots.
- **Each prop kind is one merged vertex-colored geometry** (plus an optional
  unlit "glow" geometry whose HDR vertex colors are what the bloom pass
  catches), shared by every instance — two draw calls per visible prop, one
  material each. The grounding shadow is a small dark disc baked into the
  geometry; keep it subtle or it reads as a hole.
- **ACES pushes luminance past 1.0**, so the bloom threshold sits at 1.05 and
  palettes are brighter than they'd be unlit — colors that looked right in 2D
  render nearly black under Lambert + ACES (found via the screenshot loop).
- **Pirate islands are painted under the land props** on the ground canvas;
  boats, ships and whales are excluded and bob gently instead.
- **Camera distance is tied to your radius**; name labels are canvas sprites
  scaled by camera distance so they stay readable at any size.
- Interpolation never lerps across a death/respawn teleport (>140 units or an
  alive-flag flip snaps instead).

## Local development

```bash
# terminal 1 — the game server
cd ../../multiplayer-server && npm install && npm run dev

# terminal 2 — the game
npm install && npm run dev
# then open http://localhost:5173/?server=ws://localhost:8787
```

Solo play needs no server at all.

## Smoke test

`test/smoke.mjs` serves the built `dist/` under a subpath and checks solo play
(props get eaten, score rises, growth happens) plus — when a local
`wrangler dev` server is reachable — a real two-browser networked match
asserting both clients agree on the arena.

```bash
npm i -D playwright          # not a committed dependency
npm run build && node test/smoke.mjs

# optionally, for the networked half:
cd ../../multiplayer-server && npm run dev &
```

It writes screenshots to `test/screenshots/` (gitignored).
