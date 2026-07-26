# Unicorn Dragon - 3D Flying Game (v2)

## Project Overview
Browser-based 3D flying game where players ride unicorns (or a floating pony)
through a dreamy dawn-lit sky, do tricks under a fantasy bridge, and battle
dragons with magic bolts. v2 is a **visual overhaul**: the game design and all
v1 mechanics are unchanged, but every visual is rebuilt.

## Tech Stack
- **Build**: Vite + TypeScript (`npm run build` = `tsc && vite build`, strict TS)
- **Rendering**: Three.js (r170) + EffectComposer post-processing
- **Model**: `public/Horse.glb` from the three.js examples (see LICENSE-ASSETS.md)
- **Audio**: Web Audio API synthesis (no files)
- **Run**: `npm run dev`

## Controls
| Action | Input |
|--------|-------|
| Move/Accelerate | W/S or Up/Down (or virtual joystick) |
| Turn | A/D or Left/Right (or joystick) |
| Climb/Dive | Space / Ctrl (or ▲ / ▼ buttons) |
| Look | Mouse (click canvas to lock) |
| Shoot | Left Click (or FIRE button) |
| Somersault | Q (or TRICK button) |
| Switch Mount | 1, 2, 3, 4 (or tap the mount slots) |
| Mute | 🔊 button (top right) |

## Project Structure
```
public/
└── Horse.glb               # animated horse (three.js examples asset)
src/
├── main.ts                 # Entry point; installs the window.__game debug hook
├── Game.ts                 # Game loop, state, HUD, scoring, wiring
├── core/
│   ├── SceneManager.ts     # Renderer, ACES tonemapping, bloom/FXAA composer,
│   │                       # gradient sky shader, sun sprite, drifting clouds,
│   │                       # PALETTE (shared dawn/dusk colours)
│   ├── CameraController.ts # Follow camera + FOV kick + shake + snap()
│   ├── InputManager.ts     # Keyboard/mouse (+ touch state merge, onGesture)
│   ├── TouchControls.ts    # Virtual joystick + FIRE/TRICK/▲/▼ (coarse pointers)
│   └── Audio.ts            # All-synth SFX + speed-tracking wind loop
├── world/
│   └── World.ts            # Cloud sea, merged low-poly islands, stone bridge
├── entities/
│   ├── mounts/
│   │   ├── HorseModel.ts   # GLB load/normalise, anchors, horn + wing builders
│   │   ├── Mount.ts        # Base class: velocity, tricks, speed ratio
│   │   ├── Unicorn.ts      # Flying unicorn (3 variants)
│   │   └── Pony.ts         # Floating pony (bubble + halo)
│   ├── enemies/
│   │   └── Dragon.ts       # Articulated serpentine dragon, 3 types
│   └── projectiles/
│       └── Projectile.ts   # Glowing bolt + comet tail + world-space sparks
├── systems/
│   └── CombatSystem.ts     # Firing, collisions, damage callbacks
├── fx/
│   ├── Effects.ts          # Particle bursts, rainbow Ribbon, SpeedLines
│   └── textures.ts         # Shared soft round particle sprite
└── config/
    └── mounts.ts           # Mount configs (stats + colour + accent)
```

## What v2 changed

### Mounts (real model)
`public/Horse.glb` (three.js examples, morph-target gallop) is loaded once and
stamped out per mount. Per-variant tinting works because the model's baked brown
vertex colours are converted to a **greyscale brightness mask**, so
`material.color` becomes the coat colour. `AnimationMixer` plays the gallop with
`action.timeScale` tied to airspeed. Procedural extras: emissive spiral horn
(cone + helix tube), glowing mane blobs along the neck crest, a 5-puff flowing
tail, and feathered wings on shoulder pivots. The pony reuses the same mesh with
chubby proportions, a magic bubble and a glowing halo ring.

**Two traps this model sets (both fixed, don't reintroduce):**
1. `geometry.computeBoundingBox()` expands the box by **every morph target**
   (~10x the rest pose here). Measure the base `position` attribute by hand or
   the horse ends up scaled to nothing.
2. The GLB has **no NORMAL attribute** (glTF spec: flat shading). Any replacement
   material must set `flatShading: true` or the mesh renders solid black.

Anchor points (poll / withers / tail root) are derived from the mesh vertices at
load time, so the horn, mane, wings and tail attach to real anatomy.

### Dragons
Fully rebuilt as articulated creatures: an 11-link nested spine that undulates
with a travelling sine wave, tapering body segments with belly plates and
emissive dorsal fins, hinged wings (bone arm + 3 membrane panels + fingers) that
flap with an eased downstroke and bank, a horned head with glowing eyes and a
hinged jaw, and a tail blade. Per element: fire = ember orange with rising
embers, frost = ice blue with orbiting crystal shards, shadow = purple with dark
smoke. Dragons now **patrol a slow circle and track the player with the head**
(v1 pointed the whole body at the player, which hid the body). Death = big
particle burst + tumbling, shrinking fall; the corpse is removed after ~2.2s.

### World
Gradient sky shader with a sun halo, additive sun sprite, layered drifting
blob clouds, a "sea of clouds" floor, 11 floating islands (merged flat-shaded
vertex-coloured geometry: rock cone, grass cap, trees, flowers, hanging chunks),
and a proper fantasy bridge (towers, crenellations, conical roofs, stone arch,
walled deck, flickering torches, pennant flags). Fog and lighting are tuned to a
shared dawn/dusk pastel `PALETTE` exported from SceneManager.

### Post-processing
`EffectComposer` = RenderPass → UnrealBloom (strength 0.65, radius 0.45,
**threshold 1.05**) → OutputPass → FXAA, with `ACESFilmicToneMapping` and
pixel ratio capped at 2. Only HDR emissives (horn, bolts, dragon eyes/fins,
torches, halo ring, sun) bloom — the threshold above 1 is what keeps the pastel
world from turning into a white smear.

### Juice
Glowing bolts with comet tails and world-space spark trails, hit sparks,
kill bursts, rainbow ribbon trail + burst on tricks, canvas speed lines at high
velocity, camera FOV kick on speed/dive, camera shake on hits and kills, and a
damage vignette flash.

### Audio & touch
`core/Audio.ts` synthesises everything (bolt zap, hit thud, dragon roar as a
filtered noise sweep, trick arpeggio, kill fanfare, game-over cadence) plus a
continuous wind loop whose gain/filter track airspeed. Context is created on the
first gesture; a mute button toggles it. `core/TouchControls.ts` adds a virtual
joystick and FIRE/TRICK/▲/▼ buttons on coarse-pointer devices; keyboard and
mouse keep working unchanged.

### HUD
Glassmorphism panels (blurred, bordered, soft shadows) for health, score/combo,
mount selector, controls hint, plus a loading overlay and a styled game-over
card with final score and stats. All v1 HUD data is preserved.

## Preserved from v1 (do not break)
- 4 mounts with 1-4 switching (3 flying unicorns + 1 floating pony)
- Flight physics, mouse look, banking, drag, ground clamp at y=5
- Trick system: auto-flip in the bridge zone (x -12..12, z 70..90, y 5..33),
  Q somersault, combo multiplier up to x5 with a 3s timer
- Combat: left-click magic bolts, 0.15s fire rate, 3 dragon types with their v1
  health/damage/speed stats, respawn 3s after a kill, +500 per kill
- Health, damage, game over

## Debug hook
`window.__game` exposes `getState()` plus `debugSwitchMount(n)`, `debugTrick()`,
`debugPlace(x, y, z, yaw)` and `debugCameraOffset(x, y, z)` for smoke tests and
screenshots. `getState()` reports ready/running/modelLoaded, health, score,
combo, tricks, kills, dragon count, mount, speed, position and live projectiles.

## Conventions
- `vite.config.ts` keeps `base: './'`; the model loads from `./Horse.glb` so the
  game works under the `/unicorn-dragon/` subpath on games.ross.dev.
- No runtime network requests other than the local GLB. No texture files.
- Keep `tsc` strict-clean (`noUnusedLocals`/`noUnusedParameters` are on).

## Dragon attacks (v2.1)
Dragons now breathe at the player. `Dragon.tryAttack(delta, target)` is called
each frame from the Game loop after `updateFlight` and returns a `DragonAction`:
`windup` on the frame the telegraph starts (Game plays the roar), `fire` on the
frame the breath launches (Game calls `CombatSystem.enemyFire`).

Tuned to stay fair for young players — do not "balance" these away casually:
- A dragon only fires when the player is inside `attackRange` (60–70) **and**
  its head has swung to within 0.5 rad of them, so you are never sniped from
  off-screen or from behind.
- Every shot is preceded by a **0.8s wind-up**: the jaw yawns open and the
  emissive glow swells and pulses. That telegraph is the dodge window.
- Breath travels at 32–44 vs the player's bolts at 80, aims at where the player
  *is* (never leads the target), and carries a small random scatter.
- `attackInterval` is 4.5–6.5s per type, jittered ±20%, and the initial timer is
  randomised so the three dragons never breathe in unison.
- Damage comes from each dragon's own v1 stat (15/20/25) via
  `getBreathConfig()`.
- **Killing a dragon heals +20** (capped at 100) — the only recovery in the
  game, and what keeps a long run from becoming an unwinnable slide.

## Possible next steps
- Per-mount special abilities (E key)
- Wave/difficulty progression and a persistent high score
