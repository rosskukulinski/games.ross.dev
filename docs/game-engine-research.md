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

All three shipped, verified with headless-Chromium screenshot loops (build → screenshot → look → iterate, 4 visual iterations each). Bundle sizes: Comet Dash 367 kB gzip, Neon Bricks 109 kB gzip, Robot Rally 180 kB gzip + 464 kB glb.

### Babylon.js (Comet Dash)
- Tree-shaking requires deep imports (`@babylonjs/core/Meshes/Builders/...`) **plus** non-obvious side-effect imports (`Animations/animatable`, `Layers/effectLayerSceneComponent`, ...) or features silently no-op. Even trimmed, floor is ~367 kB gzip — the heaviest of the three, but it buys scene graph, particles, glow, and post pipelines built-in.
- PBR without an environment texture is a trap: metallic > ~0.5 under direct lights reads washed-out gray. For stylized scenes keep metallic low and lean on emissive + colored lights (or generate an env via ReflectionProbe).
- `GlowLayer` is the best effort-to-payoff feature: one line makes every emissive material bloom. Tune `blurKernelSize` or small distant geometry floods into blobs.
- Rich look achieved with zero custom shaders: ParticleSystem (stretched billboards), DefaultRenderingPipeline (FXAA/vignette/chromatic aberration), DynamicTexture canvas-painted skies, `Animation.CreateAndStartAnimation` + easings.

### Three.js + glTF (Robot Rally)
- **The GLB was the single highest-leverage asset**: 450 kB buys a rigged, animated, characterful protagonist; `AnimationMixer` crossfades (Idle/Run/Jump/Dance) took ~20 lines and instantly outclasses programmer art. Normalize scale from `Box3` at load.
- Bloom thresholds live in HDR space: with ACES tonemapping, scene luminance exceeds 1.0, so UnrealBloom threshold must be >1 or lighting tweaks detonate the whole frame. Post order: RenderPass → Bloom → OutputPass → FXAA.
- Two classic silent failures: shadow camera bounds need an explicit `updateProjectionMatrix()`, and a bright `scene.environment` (RoomEnvironment) can wash directional shadows into invisibility. Screenshot-diffing variants beats theorizing.
- `mergeGeometries` + per-facet vertex colors + `flatShading` is a superb stylized-world pipeline: all decor in ~1 draw call, zero textures, palette lives in code.
- Verify asset assumptions against the file (parse the glTF JSON chunk), not from memory.

### PixiJS v8 + pixi-filters (Neon Bricks)
- v8's chained Graphics API + `renderer.generateTexture()` makes an all-procedural art pipeline pleasant: everything is tintable white textures, zero asset files. Smallest bundle of the three (109 kB gzip) with WebGPU renderer lazy-loaded only if available.
- Whole-stage `AdvancedBloomFilter` is the biggest visual win but needs tuning discipline (threshold ~0.38, bloomScale ~0.9) or bright sprites nuke to white.
- Swapping `stage.filters` arrays per-frame (bloom ± RGBSplit ± Shockwave) is a clean event-driven pattern that avoids paying for idle filter passes.
- v8's `ParticleContainer` requires `Particle` objects, not Sprites; a plain `Container` of pooled additive Sprites handled ~800 particles with far less friction.
- Pixi's Ticker caps `deltaMS` at 100 ms — on slow renderers (headless CI) game time silently dilates, so tests must poll game state, never wall-clock.

### Cross-cutting
- Headless SwiftShader runs WebGL at a small fraction of real GPU speed — smoke tests should assert via debug hooks (`window.__game`) and game state, not wall-clock timing; screenshots still catch visual regressions.
- The screenshot-and-look iteration loop caught every real visual bug (washed-out PBR, bloom flooding, dead shadows, unreadable geometry). It should be mandatory in the skill.
- Synth-everything (audio, art where possible) keeps bundles small and licensing trivial; the one committed asset (CC0 glb) carried its LICENSE-ASSETS.md.

## Recommendations for the `/new-game` skill

*(to be finalized after playtest feedback)*

- Default 3D stack: Babylon.js (or Three.js when a specific glTF asset drives the concept) + TypeScript + Vite, `base: './'`.
- Default 2D stack: PixiJS v8 + pixi-filters + TypeScript + Vite.
- Every game should ship: bloom/glow where fitting, particles on every reward/impact, tweened easing on all state changes, synth audio, touch + keyboard input, localStorage best-score.
- Bake a "juice checklist" into the skill so polish is a requirement, not an afterthought.
- Mandatory Playwright screenshot loop during development: build, screenshot, *look at it*, iterate.
