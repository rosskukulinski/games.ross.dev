# Skee-Ball (v2)

A full 3D skee-ball arcade cabinet built with **Babylon.js 8 + TypeScript + Vite**.
Replaces the v1 2D React canvas game (same slug, same high-score key).

## Tech Stack

- `@babylonjs/core` ^8 (only runtime dependency), tree-shaken deep imports
- TypeScript (strict) + Vite 7, `base: './'` (required for subdirectory serving)
- No external assets: every texture is drawn procedurally with `DynamicTexture`,
  every sound is synthesized with the Web Audio API. Zero network requests at runtime.

## Commands

```bash
npm install
npm run dev      # vite dev server
npm run build    # tsc && vite build  -> dist/
npm run preview
```

## Source layout

| File | Role |
|------|------|
| `src/main.ts` | Engine bootstrap, render loop, resize + visibilitychange, `window.__game` debug hook |
| `src/config.ts` | All tuning constants + lane/board geometry + the power curve |
| `src/board.ts` | Target-board frame math (world <-> board `u,v` space) |
| `src/world.ts` | Scene build: lights, swept wooden cabinet, board, rings, marquee, rack, aim arrow, bokeh |
| `src/textures.ts` | Procedural wood / board / marquee / ball / carpet / flare / popup textures |
| `src/game.ts` | State machine, custom kinematics, scoring, camera punch, decor animation |
| `src/fx.ts` | Particle bursts (score sparks, ring flash, confetti) + billboard score popups |
| `src/audio.ts` | Web Audio synth: room hum, rolling rumble, thunk, ding, fanfare, game over |
| `src/hud.ts` | DOM HUD: tweened score counter, ball pips, streak, power bar, overlays, grade |
| `src/input.ts` | Pointer drag-and-release (mouse + touch) and keyboard fallback |

## Rules (carried over from v1)

- **9 balls per game**, running score, best score in `localStorage` under `sb-hs`
  (shared with v1 so old high scores survive).
- Streak bonuses: 2 in a row = `DOUBLE`, 3+ = `N×` on the popup and in the HUD.
- End screen shows the total, the per-ball shot history dots and the v1 grade curve
  (S ≥ 80 avg, A ≥ 60, B ≥ 40, C ≥ 20, else D).
- Scoring changed to classic skee-ball values: rings **10 / 20 / 30 / 40 / 50**
  (50 = bullseye) plus two **100** corner pockets. v1 had the 50s in the corners.

## Controls

- **Drag back and release** anywhere on the canvas: drag distance = power,
  horizontal offset = aim (slingshot; pull left to send the ball right).
  A quick upward flick just before release adds a small power bonus.
- **Keyboard**: `←` `→` aim, hold `Space` to charge the oscillating power meter, release to roll.
- Mute button bottom-right; the setting persists in `localStorage` (`skeeBall.muted`).

## Physics (hand-rolled, no physics engine)

Everything lives in `Game.stepRolling` / `stepFlying`:

1. **Rolling** — the ball tracks the lane surface `y = rampH(z) + r`. Horizontal
   deceleration is `-cos²θ · (g·slope + rollingFriction)`, which integrates to the
   correct energy loss up the parabolic hump. Side rails bounce with restitution.
2. **Launch** — at the crest the ball converts to a projectile with
   `vy = vz · slope(crest)`, plus a lateral "lip kick" proportional to the aim so the
   corner pockets are reachable without banking off a rail.
3. **Flight** — plain gravity; each substep tests the signed distance to the tilted
   board plane and resolves the crossing point in board `(u, v)` space.
4. **Capture** — pocket first, then ring radius. Landing within `RIM_BAND` of a ring
   boundary re-rolls the radius randomly, so rim hits are a coin flip.
5. **Failure modes** — too weak (stalls or rolls back down the ramp), short (drops in
   the catch pit), too strong (over the top), off the board.

`powerToSpeed()` is deliberately non-linear: because the board leans back 30°, the
landing height is a very non-linear function of launch speed. The cubic in `config.ts`
maps power to a roughly **linear landing position**, which is what makes the meter
feel fair (~0.43 = bullseye, ~0.79 = the 100 pockets, > 0.91 = over the top).

## Look

Arcade-at-night: warm spot over the lane, cool hemi fill, PBR wood with a procedural
grain texture, neon trim on every cabinet edge, emissive ring tori that pulse and flash
on a hit, a chasing-bulb marquee, bokeh dust motes and a dark room of background
cabinets. `GlowLayer` + a light bloom pass in `DefaultRenderingPipeline`.

**Gotcha:** large meshes with a non-zero `emissiveColor` (board felt, carpet) get
rendered as flat silhouettes by `GlowLayer` and smear a haze over the frame — they are
registered in `World.glowExcluded` and excluded explicitly.

## Debug hook

`window.__game` exposes `getState()`, `simulate(seconds)` and `debugRoll(power, aim)`.
Headless WebGL (SwiftShader) runs at ~10% speed, so automated tests should advance the
simulation with `simulate()` instead of waiting on wall-clock frames.
