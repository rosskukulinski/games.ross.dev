# Game Engine Research — Leveling Up Visual Quality

*July 2026. Context: the arcade's games so far are plain HTML5/canvas/DOM with programmer art. This doc captures research into more capable browser game engines, and the three experiments built to compare approaches before codifying one (or more) into the `/new-game` skill.*

## Why the current games look flat

The gap isn't primarily the rendering tech — it's what the tech makes *easy*:

1. **No real lighting or materials.** Flat fills and CSS gradients can't produce depth, specularity, or glow.
2. **No post-processing.** Bloom is the single biggest "this looks like a real game" multiplier for both 2D neon styles and 3D emissives.
3. **Programmer art instead of assets.** Good CC0 asset packs (animated glTF characters, low-poly environment kits) exist and are free — we just weren't using them.
4. **Missing "juice".** Particles, screen shake, hitstop, squash/stretch, tweened easing on every state change. Engines ship these as primitives; hand-rolled canvas code rarely bothers.

## Engine landscape (2026)

| Engine | Type | Renderer | Sweet spot | Fit for this repo |
|--------|------|----------|-----------|-------------------|
| **Babylon.js 8/9** | Full 3D engine | WebGL2 + WebGPU | Batteries-included 3D: PBR, glow, particles, physics, GUI | ✅ Excellent — npm + Vite, TypeScript-first |
| **Three.js** | 3D rendering library | WebGL2 (WebGPU renderer maturing) | 3D when you want control; huge ecosystem, best glTF tooling | ✅ Already used (unicorn-dragon) — the upgrade is *assets + post-processing*, not the library |
| **PixiJS v8** | 2D rendering library | WebGL2 + WebGPU | Fast sprite/filter-heavy 2D; `pixi-filters` gives bloom/glow/shockwave/CRT for free | ✅ Excellent for 2D arcade games |
| **Phaser 3/4** | Full 2D game framework | WebGL2 (no WebGPU yet) | Complete 2D framework: scenes, arcade physics, input, tilemaps | ✅ Already used (hanyverse). Visual ceiling lower than Pixi's filter stack unless you write pipelines |
| **PlayCanvas** | 3D engine + editor | WebGL2 + WebGPU (most mature WebGPU path) | Browser-first 3D, tiny runtime, Gaussian splats | ⚠️ Engine-only npm use is fine, but its strength is the hosted editor, which doesn't fit a git monorepo flow |
| **Godot 4.x web export** | Full engine + editor | WebGL2 only | Real editor, GDScript, huge feature set | ❌ Requires the desktop editor binary in CI to export; ~30MB+ wasm payloads; poor fit for this npm-based build |
| **Unity WebGL** | Full engine | WebGL2 | AAA-ish pipelines | ❌ Licensing, huge builds, no fit |

WebGPU note: as of Safari 26 (Sept 2025) WebGPU is available in all major browsers. Babylon and Pixi auto-detect and fall back to WebGL2, so we get it "for free" without dropping older devices.

## Asset pipeline findings

- Direct downloads from kenney.nl / quaternius.com are blocked by the CI proxy, but **raw.githubusercontent.com works**, which unlocks CC0 assets mirrored on GitHub (e.g. three.js example models like `RobotExpressive.glb` — CC0, animated, 450KB).
- Assets are committed into each game's `public/` dir and served relatively (`./model.glb`) so subdirectory hosting works. Always add a `LICENSE-ASSETS.md` per game noting source + license.
- Synthesized Web Audio remains the right call for sound (no asset weight, no licensing).

## The three experiments

| Game | Engine | Approach being tested |
|------|--------|----------------------|
| **Comet Dash** | Babylon.js | Engine-driven visuals: PBR materials, GlowLayer, particle systems, procedural geometry — zero external assets |
| **Robot Rally** | Three.js | Asset-driven visuals: real animated CC0 glTF character + AnimationMixer crossfades + UnrealBloomPass + composed low-poly diorama |
| **Neon Bricks** | PixiJS v8 + pixi-filters | 2D shader/juice-driven visuals: full-stage bloom, shockwaves, particle shards, hitstop, combo-reactive feedback |

## Learnings from the experiments

*(filled in after the builds)*

## Recommendations for the `/new-game` skill

*(to be finalized after playtest feedback)*

- Default 3D stack: Babylon.js (or Three.js when a specific glTF asset drives the concept) + TypeScript + Vite, `base: './'`.
- Default 2D stack: PixiJS v8 + pixi-filters + TypeScript + Vite.
- Every game should ship: bloom/glow where fitting, particles on every reward/impact, tweened easing on all state changes, synth audio, touch + keyboard input, localStorage best-score.
- Bake a "juice checklist" into the skill so polish is a requirement, not an afterthought.
- Mandatory Playwright screenshot loop during development: build, screenshot, *look at it*, iterate.
