# Grand Hotel Tycoon

A sunny 3D island-resort management game built with **Babylon.js 8 + TypeScript + Vite**.
You are the hotel manager: check guests in, keep everyone smiling, and grow one
room into a full resort.

## Tech Stack

- `@babylonjs/core` ^8 (only runtime dependency), tree-shaken deep imports
- TypeScript (strict) + Vite, `base: './'` (required for subdirectory serving)
- Zero external assets: every texture is painted with `DynamicTexture`, every
  sound is synthesized with the Web Audio API. No network requests at runtime.

## Commands

```bash
npm install
npm run dev      # vite dev server
npm run build    # tsc && vite build  -> dist/
npm run preview
```

## Design brief

Built for **ages 5–8**, and that constraint drives nearly every decision:

- **There is no lose state.** An impatient guest walks out costing you a fare
  and a sliver of star rating — both recover. Nothing ends the game.
- **No menus and almost no reading.** The shop is physical: glowing pads in the
  world with a pictogram, a price and a ghost of what will appear there.
- **No precision required.** Cash magnets to you from 3.4 m away, jobs trigger
  on proximity rather than a button, and the camera can't be rotated.
- **No busywork.** There was originally a safe you had to carry cash to before
  you could spend it. It was an errand that taught nothing, so it's gone.

Two consequences of that last rule are load-bearing in `updateJob` / `pickJob`:

- **Jobs have a grace radius.** Once a job is underway, drifting slightly out
  of range keeps it alive (`INTERACT_R * 1.9`) instead of discarding the
  progress. Without it, a player nudging the stick on the edge of the trigger
  radius resets the ring every frame and the room can *never* be cleaned.
- **`Job.atX/atZ` is where you stand; `Job.x/z` is where the ring floats.**
  For a room those differ — the ring sits over the roof, the trigger is at the
  door — so the grace check must use `atX/atZ`.
- **Cleaning triggers anywhere in the room**, measured to the room *footprint*
  (`distToRoom`) rather than a point at the door, and the walls fade to 0.18
  via per-mesh `visibility` while the manager is inside so they aren't
  swallowed by the building. Per-mesh visibility is what lets every room keep
  sharing one wall material.
- **`bestD` is clamped to `INTERACT_R`** after the desk check. The desk has a
  longer reach so you can stand behind the counter, and letting that inflated
  distance carry into the comparisons below it changes the bar for every other
  job.

## The loop

1. Guests arrive along the road to the west and form a queue at the desk.
   They join `queue` the moment they *spawn*, ~27 m away, so `queue[0]` is not
   on its own permission to serve anyone — `readyGuest()` gates check-in on the
   front guest actually having reached the counter (`CHECKIN_REACH`).
2. Stand near the desk → a ring fills → the guest is checked in, pays a fare
   (dropped as a cash pile) and walks to a free room.
3. They stay `ROOM_STAY` seconds, tipping every `TIP_PERIOD`, then check out and
   leave the room **dirty**. Dirty rooms can't be re-let until cleaned.

Room state is `free → reserved → busy → dirty → free`. **`reserved` is
load-bearing**: a guest is several seconds of walking away from the door when
they're checked in, and without claiming the room up front it still reads
`free`, so the next check-in hands out the same room. That double-booked rooms
and stranded the first guest in `inRoom` forever — invisible, never checked
out, never disposed, and permanently counted against the guest total.

Each of those four states has **its own cell** in the room-status sheet
(bed / walker / zzz / broom), indexed by the named `ROOM_ICON` constants in
`world.ts`. Reserved and busy briefly shared cell `1`, which showed a guest
asleep in a room they hadn't reached yet — hence the names, so a future edit
can't silently reintroduce it.
4. Walk over cash to pick it up. The manager simply carries everything — there
   is no safe, no banking errand and no carry cap. One `money` pool, spent
   straight from hand at a pad.
5. Stand on a build pad and banked coins drain into it until the thing builds.
6. Hired staff take over jobs 2–4 one at a time, which is the whole progression
   fantasy: you start doing everything and end up supervising.

Decor is expected to *do* something you can watch, not just move a hidden
stat. The **Ice Cream Cart** is the model: departing guests detour to it,
queue, buy a cone and drop a tip. A decoration that only nudged `stars` and
`draw` wasn't worth 45 coins.

Star rating (0.5–5) is `baseStars + Σ build bonuses − mess penalty`. It scales
what guests pay and, with `draw`, how fast they arrive.

## Layout

The resort is deliberately one open promenade at `z≈0` with every building
hanging off it north or south, all entrances facing the promenade. That is what
lets navigation be a simple L-path with no A\* and nothing to get stuck on
(`nav.ts`). The plot grows eastward through four tiers.

The north band starts at `x=2`, not `x=-2` — the camera is locked to a
fixed north-east view, and a lot any further west sits behind the lobby, which
made the player's *first* room invisible.

## Architecture (`src/`)

| File | Role |
|------|------|
| `main.ts` | Engine bootstrap, Babylon side-effect imports, render loop, resize + visibilitychange, `window.__game` debug hook |
| `config.ts` | Palette and every tunable: lot positions, plot tiers, timings, economy, camera |
| `content.ts` | The entire buildable catalogue as one declarative table (rooms, amenities, decor, staff, land, perks) with `requires` gating |
| `world.ts` | Scene build: island, sky, lighting, shadows, lobby, rooms, pool, water slide, decor, camera follow |
| `textures.ts` | Every procedural texture — grass, paving, stucco, roof tiles, facades, water, palm fronds, signs, pad faces, mood sheets |
| `agents.ts` | Merged vertex-coloured character prototypes, instanced guests/staff, the jointed manager rig, mood-bubble pool |
| `nav.ts` | L-path routing, per-agent lane offsets, spatial-hash separation, steering |
| `pads.ts` | Drain-to-buy build pads: glowing disc, ghost preview, price plaque, persisted partial payment |
| `game.ts` | The simulation: guests, queue, rooms, cash, mess, staff AI, jobs, economy, HUD wiring |
| `fx.ts` | Pooled particle systems, shockwave rings, the progress gauge |
| `hud.ts` | DOM HUD wrapper — money, stars, room chips, hints, toasts, minimap, floating popups |
| `input.ts` | Keyboard + floating touch joystick, emitted as a screen-relative stick vector |
| `save.ts` | Versioned save blob, validation, capped offline earnings |
| `audio.ts` | Web Audio synth: marimba SFX, steel-drum loop, surf ambience |
| `tween.ts` | Tiny tween engine with an easing table |

## Persistence

One key, `grandHotel.save`, holding a versioned JSON blob validated on load
(anything that fails validation is discarded rather than half-applied).
Autosaves every 3 s plus on pause, `visibilitychange`, `pagehide` and
`beforeunload`. A reset sets a `disableSaving` flag before clearing so a queued
autosave can't resurrect the deleted hotel.

Away time pays out at 55% of the idle rate, capped at 4 hours, and is clamped at
*both* ends so a backwards device clock can't produce a negative payout.

Mute persists separately in `grandHotel.muted`.

## Visual notes / hard-won gotchas

These all cost a screenshot iteration to find, so don't undo them:

- **`GlowLayer` must use `addExcludedMesh`, not `addIncludedOnlyMesh`.** The
  allow-list path composites a broken fullscreen quad that paints a stray
  billboard texture over the entire frame. `noGlow()` is the deny-list helper;
  every ground plane and billboard goes through it.
- **Babylon planes front-face toward −Z.** `rotation.y = 0` faces the camera;
  `Math.PI` shows the mirrored back (and is back-face culled, so it vanishes).
  Getting this backwards rendered the hotel sign as "LETOH DNARG".
- **Don't make the flume `DOUBLESIDE`.** The flipped-normal copy z-fights the
  lit outer surface and turns candy pink into mud.
- **Instance sources are parked at `y = -500`, not hidden.** `setEnabled(false)`
  / `isVisible = false` on a source can take its instances down with it.
- **Pin the directional light's ortho box.** Auto-fitting it around every caster
  in a 60-unit resort spreads the 2048 shadow map until shadows disappear.
- **Ground planes need real vertical separation** (0.03 / 0.04 / 0.06). At this
  grazing camera angle, coplanar grounds z-fight into vertical stripes.
- Tiling textures on large surfaces need `anisotropicFilteringLevel = 8` or the
  sea and lawn moiré badly.
- `getForwardRay()` needs `@babylonjs/core/Culling/ray`; the camera basis is
  derived from `camera.alpha` instead to avoid the dependency.

## Geometry that is load-bearing

- **There is no reception counter.** A desk box tall enough to read as
  furniture also hid the 1.78 m manager from this fixed camera and was a thing
  to walk into; it earned neither. Check-in still happens at `DESK` — marked by
  a welcome mat and a bell on a stand, both low enough to see over.
- `World.solids` is the (currently empty) list of boxes the manager can't walk
  through. Guest rooms are deliberately never in it — cleaning happens inside.
- **Walking lanes are biased to the south half of the promenade** (`laneFor`).
  Agents have no collision, and the counter sits on the north half, so an
  unbiased lane sent a steady stream of guests straight through the desk.
- The queue forms **in front of** the counter (`QUEUE_HEAD` south of `DESK`).
  It used to run along z=0 straight through the old desk's own footprint.
- **Build pads require you to stand still** (`PAD_DWELL` 0.9 s, gated on
  `pSpeed01`). Crossing a pad on the way somewhere used to start draining money
  immediately, which felt like being pickpocketed. The disc visibly winds up
  during the dwell so the wait reads as charging, not as nothing happening.
- **The pool is 12 x 6.5 with a 1.1 m coping and its sun deck on the south
  side.** At 14 x 9 with loungers on the near edge it pushed 2.6 m into the
  walkway apron; it now lines up with the rest of the south band.
- **Palm Avenue is planted behind the north rooms** (`PALM_Z`), not on the
  strip beside its own pad — a row of trunks down the walkway was just an
  obstacle. The crowns clear the rooflines, so they still read as a backdrop.
- **Staff instances are positioned in `addStaff`.** A new instance inherits its
  prototype's transform, and prototypes are parked at y = -500, so a staff
  member restored from a save was invisible until the first update tick —
  which reads as "my employees vanished while I was away".
- **Pad pictograms come from `def.glyph ?? def.kind`.** Without the override
  every decor item drew the same flower, so the Ice Cream Cart advertised
  itself with a daisy.

## Layout self-check

Pad positions in `content.ts` are hand-placed against hand-placed geometry in
`world.ts`, and they silently drifted into each other: the housekeeper pad, the
receptionist pad **and the safe** all ended up inside the lobby box, invisible.
`window.__game.layout()` now walks the real Babylon bounding boxes of every
structure (tagged into `World.structures`) and reports anything buried or
overlapping. Run it with the whole resort built after moving anything:

```js
window.__game.give(200000); /* buy everything */ window.__game.layout()
```

Pads live in three rows — south `z=-4`, north `z=+4`, land pads on the
centreline — spaced ≥4.6 apart. Pairs that can never be visible together (one
transitively `requires` the other) are allowed to share space.

## Debug hook

`window.__game` exposes `state()`, `start()`, `pause(p)`, `goto(x, z)`,
`give(n)`, `buy(id)` and **`sim(seconds)`**. Headless WebGL runs at a fraction
of GPU speed, so automated tests must advance time with `sim()` and assert on
`state()` rather than waiting on frames.
