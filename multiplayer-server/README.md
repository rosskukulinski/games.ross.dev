# Air Hockey multiplayer server

A Cloudflare Worker + Durable Object that hosts real-time air hockey matches
for `games/air-hockey`. One Durable Object per room code; it is the authority
for the puck, so the two browsers can never disagree.

- **60Hz** physics tick, **30Hz** snapshot broadcast.
- Simulation is shared verbatim with the client:
  [`games/air-hockey/src/shared/rules.ts`](../games/air-hockey/src/shared/rules.ts).
  The client uses the same file for solo-vs-bot play, so the puck behaves
  identically whether you're playing a human or the computer.
- Paddle input is clamped server-side to the sending player's own half, so a
  tampered client can't reach across the table.

## Endpoints

| Route | Purpose |
|-------|---------|
| `GET /health` | Liveness probe — returns `{"ok":true}` |
| `GET /room/<CODE>?name=<name>` | WebSocket upgrade into a room (4-char code) |

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
the existing `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets. Manually:

```bash
npx wrangler deploy
```

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
