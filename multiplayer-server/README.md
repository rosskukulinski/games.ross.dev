# Arcade multiplayer server

A Cloudflare Worker that hosts the real-time rooms for every multiplayer game
in the arcade, one Durable Object class per game and one object per room code.
(The Worker is still named `air-hockey-server`, from when Air Hockey was the
only game, so existing deployments carry over.)

**Air Hockey** (`AirHockeyRoom`, `src/airHockeyRoom.ts`) — the object is the
authority for the puck, so the two browsers can never disagree.

- **60Hz** physics tick, **30Hz** snapshot broadcast.
- Simulation is shared verbatim with the client:
  [`games/air-hockey/src/shared/rules.ts`](../games/air-hockey/src/shared/rules.ts).
  The client uses the same file for solo-vs-bot play, so the puck behaves
  identically whether you're playing a human or the computer.
- Paddle input is clamped server-side to the sending player's own half, so a
  tampered client can't reach across the table.

**Rocket Karts** (`KartRoom`, `src/kartRoom.ts`) — up to four drivers. Each
browser simulates its own kart and reports it at 20Hz; the object owns the
race itself: lobby, countdown, checkpoints and laps, standings, item boxes,
rockets and traps, and the computer drivers filling empty seats.

- **60Hz** race tick, **20Hz** snapshot broadcast.
- Race logic is shared verbatim with the client:
  [`games/rocket-karts/src/shared/race.ts`](../games/rocket-karts/src/shared/race.ts),
  which runs it in-page for solo play.
- A driver who disconnects mid-race is handed to the computer.

## Endpoints

| Route | Purpose |
|-------|---------|
| `GET /health` | Liveness probe — returns `{"ok":true, ...}` |
| `GET /room/<CODE>?name=<name>` | Air Hockey: WebSocket upgrade into a room (4-char code); `/air-hockey/room/<CODE>` also works |
| `GET /rocket-karts/room/<CODE>?name=<name>&kart=<id>` | Rocket Karts: WebSocket upgrade into a room |

A `/mp` path prefix is stripped if present, so the same code works whether the
Worker is on `*.workers.dev` or mounted at `games.ross.dev/mp/*`.

## Local development

```bash
cd multiplayer-server
npm install
npm run dev          # wrangler dev on http://localhost:8787
```

Then run the game against it:

```bash
cd ../games/air-hockey        # or ../games/rocket-karts
npm install
npm run dev
# open http://localhost:5173/?server=ws://localhost:8787
```

## Deploying

CI (`.github/workflows/deploy.yml`) deploys this on every push to `main` using
the existing `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets. That
token needs **`Workers Scripts: Edit`** — a different permission from the
`Cloudflare Pages: Edit` the site deploy uses. Without it the Worker job fails
while the site still ships green, so the Worker silently freezes at its last
version while `rules.ts` moves on in the game. That drift shows up as desyncs
rather than as a clear error, so it is worth confirming.

The workflow has a `workflow_dispatch` trigger for exactly that check — run it
from the Actions tab and watch **Deploy multiplayer server** go green without
having to push to `main`. Manually, from here:

```bash
npx wrangler deploy
```

### Preview environment

PR previews get their own Worker, `air-hockey-server-preview`, deployed by
`.github/workflows/preview.yml`. Preview builds are pointed at it via the
`MP_PREVIEW_SERVER_URL` repository variable, so a client built from a PR can
never join a room on the production server — which matters because the server
is authoritative and `rules.ts` is shared verbatim, so a simulation change
under review would otherwise land a differently-behaved client in a live match.

Cloudflare's built-in preview URLs cannot cover this: they are [not generated
for Workers that implement a Durable Object][preview-urls], and DO lifecycle
changes only apply through `wrangler deploy`. A separate Worker is the only
option.

Every PR shares that one preview Worker, so two Air Hockey PRs open at once
overwrite each other. Deploy manually with:

```bash
npx wrangler deploy --env preview
```

### Changing either URL

The URL is baked into the bundle at build time, so changing `MP_SERVER_URL` or
`MP_PREVIEW_SERVER_URL` means the game has to be rebuilt. `scripts/build-all.js`
knows this — `BUILD_ENV` lists `VITE_MP_SERVER_URL` as part of Air Hockey's
cache key, so a changed URL invalidates that game (and only that game).

Without it the build cache would see byte-identical source files, skip the
game, and go on shipping the old URL indefinitely. If you ever add another
build-time variable to a game, add it to `BUILD_ENV` too.

[preview-urls]: https://developers.cloudflare.com/workers/configuration/previews/

## Pointing the game at it

The client resolves its server URL in this order:

1. `?server=` query parameter (handy for testing)
2. `VITE_MP_SERVER_URL`, baked in at build time
3. `<same origin>/mp` as a fallback

So there are two supported setups:

- **Simplest:** deploy, note the `https://air-hockey-server.<your-subdomain>.workers.dev`
  URL wrangler prints, and set it as a GitHub Actions repository **variable**
  named `MP_SERVER_URL`. The deploy workflow passes it through to the build.
- **Zero-config:** uncomment the `[[routes]]` block in `wrangler.toml` to mount
  the Worker at `games.ross.dev/mp/*`. The client then finds it on its own with
  no variable set. This needs the API token to have `Zone:Edit` on `ross.dev`.

If neither is configured, the game still works — it falls back to solo-vs-bot
and shows a clear "two-player mode isn't set up yet" message rather than
appearing broken.
