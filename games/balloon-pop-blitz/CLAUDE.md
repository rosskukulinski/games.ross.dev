# Balloon Pop Blitz

A fast-paced balloon popping game built with React + Vite + Canvas.

## Game Mechanics

- Colorful balloons float upward with a gentle wobble
- Click/tap balloons to pop them and earn points
- Miss a balloon (it flies off screen) = lose a life
- Lose all 3 lives = game over
- Difficulty increases every 30 points (faster balloons, faster spawn rate)

## Balloon Types

| Color  | Points | Special |
|--------|--------|---------|
| Red    | 1      | —       |
| Blue   | 2      | —       |
| Green  | 2      | —       |
| Orange | 3      | —       |
| Purple | 4      | —       |
| Cyan   | 5      | ⏱️ Slow Motion (30% speed for 5 sec) |
| Gold   | 5      | 💥 Multi-Pop (pops nearby balloons for 5 sec) |

## Tech Stack

- React 18 + Vite 5
- HTML5 Canvas for game rendering
- CSS for HUD and overlay UI
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
