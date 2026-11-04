# Rocket Karts

Mario Kart-style racing for the family: drift through corners for mini-turbos,
grab item boxes, fire rockets and drop bubble traps, first across the line
after three laps wins. Race the computer alone, or up to four karts with each
player on their own device via a room code.

**Stack:** Babylon.js 8 + TypeScript + Vite. Everything is procedural — no
asset files, synthesized audio.
**Server:** [`multiplayer-server/`](../../multiplayer-server) (`KartRoom`
Durable Object).

## How a race works

Each browser simulates **its own kart** (`src/shared/kart.ts`) from local input
at a fixed 60Hz and reports its position twenty times a second. The race
(`src/shared/race.ts`) owns everything a driver cannot decide alone:
countdown, checkpoints and laps, standings, item boxes, what an item box
hands out, rockets, bubble traps, zaps, and the computer drivers that fill
empty seats. Being hit, receiving an item and finishing arrive as **events**;
the client applies a spin or a star to its own kart when told to.

This is deliberately not server-authoritative for the karts themselves: a
paddle under your finger tolerates lag, steering does not, and nobody cheats
at a family racer. It means no prediction/reconciliation code at all. Remote
karts are drawn with the same buffered interpolation Air Hockey uses (~100ms
behind the newest snapshot online, ~45ms in solo play).

Solo play is not a separate code path. `LocalTransport` runs the identical
`Race` in-page and speaks the same protocol as the Durable Object, so
`main.ts` never branches on game mode.

## Files

| File | Role |
|------|------|
| `src/shared/track.ts` | Catmull-Rom loop → evenly spaced samples with tangents/normals; `locate()` for progress and lateral offset |
| `src/shared/tracks.ts` | The three track definitions and their themes (colours only; the server ignores them) |
| `src/shared/kart.ts` | Kart handling: throttle, steering, drift charge and mini-turbo tiers, off-road, barriers, boost pads |
| `src/shared/karts.ts` | The six karts and their stats |
| `src/shared/items.ts` | Item table (rubber-banded by place) and tuning |
| `src/shared/bot.ts` | Computer driver: look-ahead point, lanes, drifts through bends, item use |
| `src/shared/race.ts` | The race orchestrator. **Shared verbatim with the Worker.** |
| `src/shared/protocol.ts` | Wire messages, packed snapshots, the `Transport` interface |
| `src/local.ts` / `src/net.ts` | In-page and WebSocket transports |
| `src/render/world.ts` | Road, curbs, barriers, start gantry, item boxes, boost pads, themed scenery (thin instances) |
| `src/render/kartMesh.ts` | Procedural kart model and per-frame pose (wheels, lean, hop, spin, star shimmer) |
| `src/render/fx.ts` | Drift sparks, boost flames, dust, star trail, hit/pickup/confetti bursts |
| `src/render/camera.ts` | Chase camera with lag, FOV kick, shake; menu orbit |
| `src/ui.ts` / `src/hud.ts` | Menus, pickers, lobby, results / in-race overlay, minimap, name tags |
| `src/input.ts` | Keyboard, touch buttons, gamepad → one `KartInput` (auto-throttle) |
| `src/audio.ts` | Synthesized engine, drift, items, countdown, fanfare and a chiptune loop |

`src/shared/` imports use explicit `.ts` extensions so Node can run the
simulation tests directly with type stripping; the Worker's tsconfig allows
that too.

## Gotchas worth knowing

- **Babylon adds an emissive texture to `emissiveColor`.** Leave the colour
  black or a textured sky/banner/pad saturates to white.
- **`DynamicTexture.update(invertY)` decides which way is up.** The sky sphere
  and boost pads want `update(false)` (canvas row 0 → v=0), a `CreatePlane`
  banner wants `update(true)`. The symptom is upside-down text.
- **Checkpoints need small steps.** A report that jumps more than 30 units
  along the lap skips its checkpoint on purpose (it is a teleport). The smoke
  test's warp therefore waits for each position report.
- **The race ends when every human has finished** (or 35s after the first
  finisher). Unfinished computer drivers are ranked by where they are and shown
  without a time.
- **A driver who disconnects mid-race becomes a bot**, so the race stays a
  race; their seat is freed when the room returns to the lobby.
- **The world's meshes have frozen world matrices** for speed. Anything that
  moves after build (the item boxes) is skipped from the freeze in
  `buildWorld`; freeze it and it silently stops animating or hiding.
- **Headless CSS animations may stall** on the software renderer; the
  countdown pop is transform-only so it can never be invisible.

## Local development

```bash
# terminal 1 — the game server (solo play needs none)
cd ../../multiplayer-server && npm install && npm run dev

# terminal 2 — the game
npm install && npm run dev
# then open http://localhost:5173/?server=ws://localhost:8787
```

## Tests

```bash
npm run test:sim                     # headless: geometry checks + four bots race every track
npm i -D playwright                  # not a committed dependency
npm run build && node test/smoke.mjs # built dist under a subpath: solo race to the results screen
MP=ws://127.0.0.1:8787 node test/smoke.mjs   # + two browsers in one room (needs wrangler dev)
node test/tour.mjs                   # screenshots of every track for the eyeball loop
node test/track-preview.ts           # top-down PNGs of the track layouts (run with --experimental-strip-types)
```

Screenshots land in `test/screenshots/` and `test/out/` (both gitignored).
