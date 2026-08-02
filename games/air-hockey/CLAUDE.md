# Air Hockey

Real-time two-player air hockey. Two browsers on two devices share one table
via a Cloudflare Durable Object, or one player can take on a bot.

**Stack:** PixiJS v8 + pixi-filters + TypeScript + Vite.
**Server:** [`multiplayer-server/`](../../multiplayer-server) (Worker + Durable Object).

## How a match works

The server is authoritative. It runs the physics at 60Hz and broadcasts a
snapshot 30 times a second; clients never simulate the puck during online play.
That means the two browsers can't disagree about the score, and a tampered
client can't cheat — paddle input is clamped to the sender's own half
server-side.

The client smooths that 30Hz feed with **buffered interpolation**: it renders
~95ms behind the newest snapshot and interpolates between the two that straddle
that moment. Its *own* paddle is drawn from local prediction instead
(`advancePaddle`, the same speed limit the server applies), so your hand never
feels laggy. Impact events are queued and fired at the moment the frame they
belong to is actually drawn, so a goal sound never precedes the goal.

Solo play is not a separate code path. `BotTransport` runs the identical
simulation in-page and speaks the same protocol as the Durable Object, so
`main.ts` never branches on game mode.

## Files

| File | Role |
|------|------|
| `src/shared/rules.ts` | The simulation. **Shared verbatim with the Worker.** |
| `src/protocol.ts` | Message types + the `Transport` interface both modes implement |
| `src/net.ts` | WebSocket transport, server discovery, health probe |
| `src/bot.ts` | In-page transport with a bot opponent (easy/normal/hard) |
| `src/view.ts` | All Pixi rendering |
| `src/fx.ts` | Pooled additive particles + screen shake |
| `src/audio.ts` | Synthesized Web Audio (no asset files) |
| `src/ui.ts` | DOM menus, room-code entry, HUD chips |
| `src/main.ts` | Boot, input, interpolation, frame loop |

`rules.ts` lives here rather than beside the Worker on purpose: the monorepo
build cache only hashes `games/<slug>/`, so rules changes must live in this
directory to invalidate it.

## Gotchas worth knowing

- **Build every node once, then move it.** Rebuilding Pixi Graphics each frame
  re-tessellates and re-uploads geometry; doing that dropped a software
  renderer to 8fps. Paddles, puck, trail and flashes are built in the
  constructor and only repositioned.
- **`arc()` continues the current path.** Without an explicit `moveTo()` to the
  arc's start point, Pixi draws a line to it from wherever the path was, which
  put a stray diagonal across the table.
- **A `TextStyle` shared between two `Text` nodes is shared state.** Recolouring
  one recoloured both; each label needs its own style object.
- **Don't lower the bloom filter's resolution.** The filter renders the whole
  layer through itself, so half-res softens the crisp table lines, not just the
  glow.
- **The puck can get pinned.** A paddle held against a wall makes the wall clamp
  and the paddle's outward push cancel every tick, freezing the puck (kids do
  this in corners deliberately). `rules.ts` watches for a puck that hasn't
  travelled and slides it back out *around* the paddle.
- **Fixed-timestep with catch-up.** The bot transport advances by real elapsed
  time, so a slow device drops frames instead of playing in slow motion.

## Local development

```bash
# terminal 1 — the game server
cd ../../multiplayer-server && npm install && npm run dev

# terminal 2 — the game
npm install && npm run dev
# then open http://localhost:5173/?server=ws://localhost:8787
```

Solo-vs-bot needs no server at all.

## Smoke test

`test/smoke.mjs` serves the built `dist/` under a subpath and drives **two
independent browser contexts** through a real networked match — asserting both
browsers agree on the score and the puck, and that a disconnect is noticed.

```bash
npm i -D playwright          # not a committed dependency
cd ../../multiplayer-server && npm run dev &
cd ../games/air-hockey && npm run build && node test/smoke.mjs
```

It writes screenshots to `test/screenshots/` (gitignored).
