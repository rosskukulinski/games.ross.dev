Create a new game called "$ARGUMENTS" in this monorepo. Visual quality is a hard requirement — games here must look like real games, not programmer-art demos. Read `docs/game-engine-research.md` for the full engine findings before starting.

## 1. Pick the stack (by game concept, not habit)

| Concept | Stack | Notes |
|---------|-------|-------|
| 3D action/racing/physics | **Babylon.js** (`@babylonjs/core` ^8) + TS + Vite | Batteries included: PBR, GlowLayer, particles, post pipeline. Use tree-shaken deep imports AND the required side-effect imports (see comet-dash) or features silently no-op. |
| 3D built around a specific animated model | **Three.js** + TS + Vite | Best glTF pipeline. AnimationMixer crossfades + UnrealBloom (threshold > 1 under ACES) + merged flat-shaded low-poly worlds (see robot-rally). |
| 2D arcade/action | **PixiJS v8** (`pixi.js` ^8 + `pixi-filters` ^6) + TS + Vite | Procedural art via Graphics → generateTexture; AdvancedBloomFilter tuned (threshold ~0.38) — works for neon (neon-bricks) AND sunny/painterly moods. |
| Board/card/word/UI-driven | React + Vite (or static HTML/CSS/JS) | Engines add nothing here; polish with CSS animation instead. |

Reference implementations: `games/comet-dash` (Babylon), `games/robot-rally` (Three + glTF), `games/neon-bricks` (Pixi).

## 2. Assets

- CC0/CC-BY assets beat procedural art for characters. The CI proxy blocks kenney.nl/quaternius.com but **raw.githubusercontent.com works** — e.g. three.js example models (`RobotExpressive.glb` CC0, `Horse.glb`). Download into the game's `public/`, load via relative path (`./model.glb`), commit the file, and add `LICENSE-ASSETS.md` with source + license.
- Everything else procedural: DynamicTexture/Graphics-drawn textures, merged flat-shaded geometry with vertex colors, canvas-painted skies.
- Audio is always synthesized Web Audio (no files): unlock on first user gesture, provide a mute button, persist mute in localStorage.

## 3. Scaffold

- `games/$ARGUMENTS/` with `index.html`, `vite.config.ts` — **`base: './'` is REQUIRED** (subdirectory serving), `tsconfig.json` (strict), `package.json` (scripts: `dev`, `build` = `tsc && vite build`, `preview`), `src/*.ts`, `CLAUDE.md` documenting the game.
- No runtime network requests: no CDN scripts, no external fonts (system font stack), all assets local.
- Input: keyboard/mouse AND touch (tap/swipe/virtual joystick as appropriate — these games are played on tablets).
- Always: resize handling, `visibilitychange` pause, best score/time in localStorage, start screen with controls, game-over/win screen with restart.

## 4. The juice checklist (mandatory, not optional polish)

- Bloom/glow wherever the mood fits (GlowLayer / UnrealBloom / AdvancedBloomFilter).
- Particles on every reward and impact (pool them; ~800 pooled additive sprites is fine in Pixi).
- Tweened easing on every state change: score counters tick up, UI pops with outBack, entrances cascade.
- Game-feel: screen shake (subtle for young kids), 30ms hitstop on big impacts, squash & stretch, camera lag/FOV kicks in 3D.
- Escalating feedback tied to combos/speed (background, bloom, audio pitch respond to streaks).
- Cohesive palette chosen up front — never default colors.

## 5. Register the game

1. Add the slug to `scripts/games-list.js` (and the `staticGames` array in `scripts/build-all.js` only if it has no build step).
2. Add a card to `landing/index.html` in the `.game-grid` (alphabetical-ish position).
3. Create a real scene-depicting SVG icon at `landing/icons/$ARGUMENTS.svg` (100×100, rounded-rect background, style-matched to the game — look at existing icons; no generic gamepad placeholders).
4. Add a row to the Game Inventory table in the root `CLAUDE.md`.

## 6. Verify with the screenshot loop (mandatory)

1. `cd games/$ARGUMENTS && npm install && npm run build` — must pass clean.
2. Smoke-test the BUILT dist with Playwright (`npm i -D playwright`; `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` is preset with chromium installed — never run `playwright install`; fallback `executablePath: '/opt/pw-browsers/chromium'`). Serve dist under a subpath like production. Assert: zero console errors, zero failed requests, game starts, score/state changes. Headless SwiftShader runs at a fraction of GPU speed — expose a `window.__game` debug hook and assert on game state, never wall-clock timing.
3. Screenshot the start screen and mid-gameplay. **LOOK at the screenshots and iterate at least twice** — flat lighting, washed-out materials, unreadable shapes, and empty scenes only show up visually. This loop catches what code review can't.
4. Remove playwright from devDependencies when done, then run `npm run build` from the repo root to confirm monorepo integration.

## Known traps

- Babylon PBR without an environment texture: metallic > 0.5 renders washed-out gray — keep metallic low, lean on emissive + colored lights.
- Three.js UnrealBloom threshold must be > 1.0 with ACES tonemapping or the whole frame blooms; shadow camera edits need `updateProjectionMatrix()`; a bright `scene.environment` can wash out shadows.
- Pixi v8 `ParticleContainer` wants `Particle` objects — pooled Sprites in a plain `Container` are less friction; Ticker caps `deltaMS` at 100ms so slow renderers dilate game time.
