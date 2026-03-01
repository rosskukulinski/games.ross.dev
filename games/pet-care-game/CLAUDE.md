# Dragon Pet Care Game

## Overview
A browser-based pet care game where players raise dragons from eggs to adulthood, then release them into the wild. Released dragons return with prizes, funding the next egg purchase. The game is never-ending.

## Tech Stack
- **Framework**: React 19 + TypeScript
- **Build**: Vite
- **State**: Zustand with `persist` middleware (localStorage)
- **Styling**: CSS Modules
- **Art**: Inline SVG components + CSS animations
- **Testing**: Vitest

## Commands
- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run preview` - Preview production build
- `npm test` - Run tests

## Architecture

### Layers
- `src/engine/` - Pure game logic (no React). Stat decay, actions, growth, currency, wild dragons. All functions are pure and unit-testable.
- `src/store/` - Zustand store. Single source of truth for all game state. Uses `persist` middleware for localStorage.
- `src/screens/` - Top-level page components. Switched via `currentScreen` in store (no router).
- `src/components/` - Reusable UI components (Dragon SVG, StatBar, ActionButton, etc.)
- `src/hooks/` - Custom hooks (game loop, countdown timer, expeditions)
- `src/assets/` - Data definitions (color palettes, egg types, dragon stages, rewards)
- `src/utils/` - Small utilities (clamp, randomBetween, formatTime)

### Key Conventions
- CSS Modules for scoped styling (`.module.css` files)
- Engine logic is pure functions with zero React dependencies
- Use Zustand selectors to minimize re-renders
- All magic numbers live in `src/engine/constants.ts`
- SVG art is inline React components, not image files
- Screen navigation via `currentScreen` state, no React Router

### Game Loop
The game loop runs a 1-second tick interval that decays stats, checks growth, and updates care time. It only runs on the MainCare screen.

### Persistence
- localStorage key: `dragon-pet-save`
- Auto-saves on state changes via Zustand persist middleware
- Offline catchup on load (capped at 8 hours)
