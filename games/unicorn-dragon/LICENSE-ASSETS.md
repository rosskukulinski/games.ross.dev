# Asset Licenses

## Horse.glb

- **Source:** three.js examples repository —
  https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Horse.glb
  (downloaded from `raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Horse.glb`)
- **Origin / attribution:** the model ships with the three.js examples, where it is
  credited to the **ROME "3 Dreams of Black"** project by **mirada.com**
  (https://github.com/mrdoob/three.js/tree/dev/examples — see
  `webgl_morphtargets_horse`, which links to https://github.com/mrdoob/rome and
  http://www.ro.me / http://mirada.com). The ROME assets were released for public
  use alongside the open-sourced ROME/WebGL codebase.
- **Used as:** the base mesh + morph-target gallop animation for all four mounts.
  The game recolours it per variant (white / storm blue / midnight / pony pink),
  normalises its baked vertex colours into a brightness mask, and attaches
  procedurally generated horns, manes, tails and wings on top.
- **Modifications:** vertex colours converted to a greyscale tint mask; the single
  morph-weight animation clip is re-bound to a stable node name so one clip can
  drive four independent AnimationMixers.

Everything else in this game is generated procedurally in code:
sky shader, sun sprite, clouds, floating islands, the fantasy bridge, all four
mount accessories, all three dragons, projectiles, particles and ribbons.
All sound is synthesised at runtime with the Web Audio API — there are no audio
files, no textures on disk and no runtime network requests beyond `./Horse.glb`.
