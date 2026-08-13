# Arcade multiplayer server

A Cloudflare Worker + Durable Objects that host the arcade's real-time games.
One Durable Object per room code; it is the authority for the simulation, so
browsers can never disagree.

Two games share the Worker, each with its own Durable Object class:

- **Air Hockey** (`AirHockeyRoom`): two seats, **60Hz** physics tick, **30Hz**
  snapshot broadcast. Paddle input is clamped server-side to the sending
  player's own half, so a tampered client can't reach across the table.
- **Hole Munchers** (`HoleRoom`, `games/hole-io`): a drop-in arena for up to 8
  humans plus bots, **30Hz** tick and snapshots. The arena layout is
  deterministic from a seed sent on join; movement input is a clamped
  direction vector, so a tampered client can't speed-hack.

Each simulation is shared verbatim with its client
(`games/<slug>/src/shared/rules.ts`) — the clients use the same file for
solo-vs-bot play, so the game behaves identically online and off.

## Endpoints

| Route | Purpose |
|-------|---------|
| `GET /health` | Liveness probe — returns `{"ok":true}` |
| `GET /room/<CODE>?name=<name>` | WebSocket upgrade into an Air Hockey room (4-char code) |
| `GET /hole/room/<CODE>?name=<name>` | WebSocket upgrade into a Hole Munchers arena (4-char code) |

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
cd ../games/air-hockey
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
