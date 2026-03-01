# K-Pop Rhythm Tap

A rhythm/music tapping game featuring 10 original K-pop tracks from the KPOP Demon Hunters soundtrack.

## Game Mechanics

- Notes (diamonds) scroll down 4 colored lanes toward a hit zone
- Players tap in time with the beat using arrow keys or touch
- Scoring based on timing accuracy: Perfect (50ms), Great (100ms), Good (150ms), Miss
- Combo system with multiplier (+1x every 10 hits, max 5x)
- No lives — songs always play to completion
- Letter grades: S (95%+), A (90%+), B (80%+), C (70%+), D (<70%)
- High scores per song saved to localStorage

## Controls

- **Desktop**: Arrow keys (←↓↑→) or D F J K
- **Mobile**: Tap the 4 lane zones at bottom of canvas
- **Pause**: Escape key or pause button

## Lanes

| Lane | Key | Color |
|------|-----|-------|
| Left | ← / D | Pink (#FF69B4) |
| Down | ↓ / F | Cyan (#00D4FF) |
| Up | ↑ / J | Green (#39FF14) |
| Right | → / K | Purple (#BF40FF) |

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
