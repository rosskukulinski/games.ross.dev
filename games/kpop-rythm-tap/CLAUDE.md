# K-Pop Rhythm Tap

A rhythm/music tapping game featuring 10 original K-pop tracks from the KPOP Demon Hunters soundtrack.

## Game Mechanics

- Notes (diamonds) scroll down colored lanes toward a hit zone
- Players tap in time with the beat using arrow keys, touch or mouse click
- Difficulties live in `MODES` in `App.jsx`. **Starter** (`kid`) is the default,
  built for a 5-year-old: 2 wide lanes, ~1 note/sec, slower scroll, windows
  Perfect 120 / Great 200 / Good 300ms, edge-of-lane tap tolerance, and a
  60-second cut of the song that fades out. Easy / Medium / Hard use 4 lanes
  and Perfect (50ms), Great (100ms), Good (150ms), Miss (200ms)
- Every song gets a 3.5s 3-2-1-GO lead-in before its first note: long intros
  are skipped, and songs that start on a note get a silent pre-roll (negative
  song time in `audio.js`)
- Every tap gives feedback (ripple on empty taps, rings/particles on hits, red
  flash + shake on misses); combo cheers at 5/10/20/30/50
- Combo system with multiplier (+1x every 10 hits, max 5x)
- No lives — songs always play to the end (Starter: its 60-second cut)
- Results show 1-3 stars (3 at 80%+, 2 at 50%+) plus a letter grade —
  S (95%+), A (90%+), B (80%+), C (70%+), D (<70%) — hidden in Starter
- High scores per song saved to localStorage

## Controls

- **Desktop**: Arrow keys (←↓↑→) or D F J K
- **Touch / mouse**: Tap or click anywhere in a lane (pointer events)
- **Starter (2 lanes)**: ← ↓ D F hit the left lane, ↑ → J K the right
- **Pause**: Escape key or pause button; also auto-pauses when the tab/app is hidden

## Lanes

| Lane | Key | Color |
|------|-----|-------|
| Left | ← / D | Pink (#FF69B4) |
| Down | ↓ / F | Cyan (#00D4FF) |
| Up | ↑ / J | Green (#39FF14) |
| Right | → / K | Purple (#BF40FF) |

## Debug hook

`window.__game` is a read-only getter object for automated play-tests: `phase`,
`mode`, `lanes`, `score`, `combo`, `maxCombo`, `hits`, `misses`, `emptyTaps`,
`judgments`, `totalNotes`, `songTime`, `firstNoteTime`, `startAt`, `paused`, `endTime`, `notes`
(`{time, lane}`), `windows`.

## Architecture

- `App.jsx` — Main component: song select, game loop (canvas), input handling, results
- `App.css` — Dark K-pop neon theme
- `songs.js` — Song catalog with BPM/difficulty metadata
- `beatmap.js` — Procedural note generation from BPM (seeded PRNG for determinism)
- `audio.js` — Web Audio API wrapper for playback, pause/resume, time sync

## Songs

10 tracks sorted by difficulty (easy → hard). BPMs are estimated and may need tuning.

## Tech Stack

- React 18 + Vite 5
- HTML5 Canvas for note rendering
- Web Audio API for audio playback and timing
- CSS for HUD, song select, and results screens
- localStorage for high score persistence

## Build

```bash
npm install
npm run build
```

## Dev

```bash
npm run dev
```
