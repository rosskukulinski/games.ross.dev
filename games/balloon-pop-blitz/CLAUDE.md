# Balloon Pop Blitz (v2)

A sunny, painterly balloon-popping arcade game built with **PixiJS v8 + pixi-filters + TypeScript + Vite**.
Rewritten from the original React/Canvas version; the rules are unchanged, the presentation is not.

## Game Mechanics (preserved from v1)

- Balloons rise from the bottom of the screen with a gentle wobble and drift.
- Tap/click a balloon to pop it and score points. Multi-touch works — several fingers can pop at once.
- A balloon that escapes off the top costs a heart. **3 hearts, then game over.**
- Level = `floor(score / 30) + 1`. Spawn interval `max(0.4s, 1.8s - (level-1)*0.12s)`; above level 3 there is
  a 30% chance of a double spawn — same pacing curve as v1.
- Best score persisted in `localStorage` under **`bpb-hs`** (same key as v1, so old scores carry over).

## Balloon Types

| Kind | Points | Notes |
|------|--------|-------|
| Red | 1 | |
| Blue | 2 | |
| Green | 2 | |
| Orange | 3 | |
| Purple | 4 | |
| Stripey (pink) | 6 | v2: 1.6x rise speed, unlocks level 2 |
| Cyan (clock) | 5 | Slow Motion — 30% speed for 5s |
| Gold (star) | 10 | Multi-Pop for 5s + confetti fountain, slow-mo beat, shockwave pulse |
| Rainbow | 8 | v2: instant +8 combo, ring burst, unlocks level 2 |
| Bomb | — | v2: **do not pop.** −5 points, combo reset, smoke puff. Escapes harmlessly. Appears from level 3. |

Combo: consecutive pops within 1.6s build a multiplier `min(5, 1 + floor(combo/4))` shown in a HUD meter;
pop pitch rises with the combo.

## Architecture (`src/`)

| File | Role |
|------|------|
| `main.ts` | Pixi boot, `resizeTo: window`, pointer/touch input, keyboard, visibility pause, `window.__game` debug hook |
| `game.ts` | Game state machine (menu / playing / gameover), HUD, screens, pop FX, filters |
| `balloons.ts` | Balloon kinds + weights, canvas-baked balloon textures, `Balloon` entity with wobbling bezier string |
| `fx.ts` | Procedural textures (clouds, shreds, confetti, rings), pooled `ParticleSystem`, `SunnyBackground` |
| `audio.ts` | Web Audio synth: pops, golden jingle, bomb womp, breeze, birdsong, music-box loop |
| `tween.ts` | Tiny tween engine with easing functions |

## Visual notes

- **Balloons** are baked once into canvas textures (radial gradient body, rim shading, reflected sky light,
  gloss sheen + hot spot, knot) and drawn as tinted sprites. Spawn plays a squash-stretch inflate tween.
- **Background** is a layered sky: two stacked gradient sprites cross-faded morning → golden hour as levels
  rise, a sun with rotating crepuscular rays, 8 parallax painterly clouds (far ones tinted haze-blue),
  drifting pollen motes, and occasional flapping bird silhouettes.
- **Filters**: `AdvancedBloomFilter` (threshold 0.85, bloomScale 0.22) on the **world layer only** — on the
  full stage it blows out the pale sky and white UI. `GlowFilter` only on gold/rainbow/bomb balloons.
  `ShockwaveFilter` on the scene container (sky + gameplay, never the HUD) for golden pops.
- Screen shake is deliberately tiny (young players); flashes are tinted, never full white.

## Gotchas

- Pixi v8 nulls `_position`/`_scale` when a `Container` is destroyed. Cache `x/y/r` **before** destroying a
  balloon, and cancel any tweens that still target it (`Balloon.cancels`).
- Use `app.screen.width/height`, not `renderer.width / resolution` — `renderer.width` is already CSS px.
- `base: './'` in `vite.config.ts` is required for subdirectory serving.

## Debug hook

`window.__game` exposes `state()`, `start()`, `popAt(x, y)`, `popAny()`, `spawn(n, spread)` for smoke tests.

## Build

```bash
npm install
npm run build   # tsc && vite build
npm run dev
```
