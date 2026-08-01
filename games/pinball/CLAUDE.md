# Cosmic Pinball

A real pinball table — flippers, pop bumpers, drop targets, a scoop, multiball —
rendered in PixiJS v8 with a hand-written 2D physics engine. Built for young
players: forgiving ball saves, big readable hardware, no tilt.

## Stack

PixiJS v8 + `pixi-filters` + TypeScript + Vite. No external assets: all art is
procedural (canvas-painted felt, `Graphics`-drawn hardware) and all audio is
synthesised Web Audio. `base: './'` in `vite.config.ts` is required for
subdirectory serving.

## Files

| File | What's in it |
|------|--------------|
| `src/physics.ts` | Collision primitives and the flipper. Everything reduces to "closest point + effective radius", so one circle-vs-circle resolver handles walls, arcs, bumpers, targets and flippers. |
| `src/table.ts` | Every playfield dimension, the collider list, and the static art (felt texture, painted lanes, chrome rails, apron). |
| `src/game.ts` | Table hardware, rules, HUD, screens, juice. |
| `src/fx.ts` | Procedural textures, pooled particles, reactive backdrop. |
| `src/audio.ts` | Synth sound effects + ambient bed. |
| `src/tween.ts` | Tiny tween engine driven by the game loop. |

## Physics notes

- Fixed `1/240 s` substeps with an accumulator (max 14 per frame). At the 2400
  px/s speed cap the ball moves ~10 px per substep, well under its 14 px radius,
  so it can't tunnel through a wall.
- A collider is a **capsule**: a straight segment, an arc, or a circle, each with
  a radius. Arc capsules collide correctly from either side, which is what lets
  the same primitive serve as both the outer arch and the inner orbit wall.
- Flippers pass the ball their **surface velocity** at the contact point
  (`omega x r`) — that's what produces a real flip kick rather than a bounce.
  Contacts near the pivot borrow a minimum lever arm so a ball resting in the
  crook is still flippable.
- One-way gate at the orbit mouth: it only collides when the ball's velocity
  points into the lane, so the plunger shot exits but nothing re-enters.

### Geometry traps found by playtesting

These were all real bugs; the numbers matter.

- **Clearances are surface-to-surface, not centre-to-centre.** The flipper tips
  are 9 px capsules, so a 54 px centre gap leaves a 36 px mouth for a 28 px
  ball. At the original 42 px centre spacing the two tips *cradled* the ball and
  the centre drain never opened.
- Any corridor the ball must pass through needs **> 28 px of clear width along
  its narrowest perpendicular**, not just horizontally. The inlane pinched shut
  against the slingshot and wedged the ball permanently.
- Don't leave a shallow shelf within the flipper's swing but outside its reach —
  the ball nestles there forever. The inlane guide's lower run is deliberately
  steep (~27°) and ends above the bat.
- A soft plunge that doesn't clear the arch drops the ball back into the shooter
  lane; there's an explicit hand-back to the plunger so it can't strand.
- **The outlanes were eating every ball.** A passive-player run measured 17 of
  19 balls dying in the left outlane, where a flipper can never reach — the
  left outlane mouth was 109 px against a 68 px inlane, backwards from a real
  table, and the orbit returns the ball down the left every launch. Fixed by
  pulling the outer walls in and adding kickbacks. Flipper contacts went from
  near zero to ~40 per ball.
- **That fix did not hold, and `flipHits / serves` did not catch it.** Contacts
  per ball stayed in the tens while 76% of balls still died in the outlanes —
  the autoplay bot flips ~5x/second, so it racks up contacts on the few balls
  that do come down and tells you nothing about the ones that never arrive.
  What exposes it is dropping balls with **no flipping at all** and asking how
  many reach the bats. Only 24% did.
- **The lane commit is binary, and it happens at y≈1000.** Bucketing passive
  drops by the x they cross y=1000 gives ~100% reaching the bats inside a
  corridor and ~0% outside it — there is no gradient. So the number to move is
  the *width of that corridor*, not anything about the outlane itself. It was
  x∈[200,600]; it is now x∈[160,680], which took reach from 24% to 73%.
- **Guide height matters far more than mouth width.** A 37 px aperture at
  y=968 let 13% of balls into the outlane; a 36 px aperture at y=1000 let in
  45%. Near-identical gaps, wildly different outcomes — what counts is how
  early the guide's inward-leaning face starts shedding balls, not how tight
  the gap is. Tune `GUIDE_LEFT[0]` (currently `[133, 980]`); lower/inboard is
  harder, higher/outboard is more forgiving.
- **Do not extend the guides much above y≈980.** At `[128, 968]` reach hits
  88% and the outlanes effectively close, but the guide then walls off the
  channels the ball uses to get *back up* to the targets and orbit, and games
  stop ending. Closing an outlane and blocking a shot lane are the same edit
  at different heights.
- **An aperture narrower than 28 px seals rather than narrows.** `[128, 1000]`
  computes to 22.6 px of clear width, so no ball ever enters the outlane —
  it wedges in the mouth instead. Always check the arithmetic against the ball
  diameter before trusting a probe result that looks too good.
- **`POSTS` is empty and should stay that way unless a post earns its place.**
  All five sat where they deflected balls outward into an outlane, and they
  cost ~14 points of reach between them. The pair at y=924 is the subtle one:
  it sits just above the outer star rollovers, close enough that players blame
  the stars — which are triggers with no collider and cannot trap anything.
  Before moving a rollover, check whether a post is the real culprit.
- **The slingshots were 22% too big.** At their original size the bodies
  crowded the space directly in front of the bats and left only a 56px channel
  between their inner tips. Scaling them down about their centroids opened
  that to 84px and lifted the bottom corner clear of the flipper, worth ~5
  points of reach on its own.
- `WALL_RIGHT` now mirrors `WALL_LEFT` instead of repeating the literals.
  While they were independent, a change to the left wall left the right
  aperture 8 px narrower — under a ball width — and balls wedged there. If you
  edit one outer wall, the other must follow, so let the code do it.
- A kickback must fire the ball **from where it stands**. Teleporting it onto
  the kicker's own coordinates put it inside the outer wall, so it was shoved
  back out and drained anyway — 97 kicks produced 97 outlane drains.
- The kickback trigger has to reach all the way to the flipper pivot. A 20 px
  band between the trigger edge and the bat became the single most common
  death.
- Unlimited kickbacks make the ball unloseable: games stopped ending and scores
  ran to 20M. Two per ball is the balance point.

## Rules

- 3 balls, plus an extra ball at 250,000.
- **Ball save**: 12 s from each fresh ball's launch. A saved ball is re-served
  and auto-plunged. The saver arms once per ball, not per launch.
- **Outlane kickbacks**: 2 per ball, recharged on each new ball. A ball
  committed to either outlane is fired back up the lane. The arrows go dark
  once spent, so the stakes visibly change.
- **Pop bumpers** 500+ (rises with the chain), **slingshots** 250,
  **drop targets** 1,000, **standing targets** 1,500, **rollovers** 750,
  **spinner** 120/half-turn (capped so one orbit rip can't dwarf the table).
- **Rollover set** (all four stars): +10,000 and the multiplier steps up to 6x.
  The multiplier persists across balls.
- **Clearing either 3-target bank** starts **multiball** (2 extra balls, all
  scoring doubled). Clearing a bank during multiball lights a 12,000 jackpot.
- **Star Gate scoop**: 15,000, or a 50,000 jackpot during multiball.

## Controls

Left/right arrows, A/D, Z//, or either Shift for the flippers; tap the left or
right half of the screen on touch. Hold Space (or touch anywhere while a ball
waits) to charge the plunger, release to fire. P/Esc pauses, M mutes.

## Verifying changes

Both harnesses need Playwright, which is deliberately not a checked-in
dependency: `npm i -D playwright` first, then remove it again when done.

```bash
npm run build
node smoke.mjs      # built dist under a subpath: console errors, screenshots
node playtest.mjs 5 # autoplay pacing: ball lifetimes, zone coverage, stalls
```

`smoke.mjs` writes screenshots to `shots/` — **look at them**, that's the point.
`playtest.mjs` drives the game through `window.__game.sim()`, which advances the
simulation without waiting on the renderer; headless WebGL runs at a few fps, so
pacing must be measured in game time, not wall time. Watch for `longest stall`
above ~0.5 s (a ball trapped somewhere) and check every feature in the
`features:` line still fires.

**The metric that matters is `stats.drainX` — where balls actually die.** Bucket
it and check the deaths are near the flipper gap (x ~384-420) rather than out at
the edges (x ~235-260 and ~540-570, the outlanes). `flipHits / serves` is *not*
sufficient on its own: it sat in the tens through a period when three quarters of
balls were dying unreachably, because the bot flails at whatever does come down.

Neither harness answers "can the ball reach the flippers at all", because both
flip constantly. For that, drop balls with no flipping and count how many reach
the bats — see the passive-drop findings above. Note also that the bot defends
the centre drain near-perfectly, so once the outlanes are fair it stops losing
and games run past the 600 s cap; that is an artefact of the bot, not
necessarily of the table. Judge difficulty from `drainX` and from playing it.
