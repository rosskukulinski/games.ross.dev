# Unicorn Dragon - 3D Flying Game

## Project Overview
Browser-based 3D flying game where players ride unicorns (or a floating pony) and battle dragons using projectile attacks. Features trick mechanics for performing flips under bridges and somersaults in the air.

## Tech Stack
- **Build**: Vite + TypeScript
- **Rendering**: Three.js
- **AI**: Yuka.js (for enemy behavior - Phase 3)
- **Run**: `npm run dev` (currently on port 5177)

## Current State: Phase 2 Complete

### What's Working
- 4 mounts: 3 flying unicorns + 1 floating pony (keys 1-4 to switch)
- Full flight physics with WASD, Space/Ctrl, mouse look
- Third-person camera that follows player
- Bridge structure - flying under it triggers auto-flip
- Manual somersault with Q key
- Score/combo system for tricks
- Full HUD (health, score, combo, mount selector)
- Skybox, clouds, floating islands
- **NEW: Combat system with projectiles**
- **NEW: 3 dragon enemy types (Fire Drake, Frost Wyrm, Shadow Dragon)**
- **NEW: Shooting with left-click, hit detection, particle effects**
- **NEW: Dragons respawn after being killed**
- **NEW: Player takes damage and can die (game over)**

### Controls
| Action | Input |
|--------|-------|
| Move/Accelerate | W/S or Up/Down |
| Turn | A/D or Left/Right |
| Climb/Dive | Space / Ctrl |
| Look | Mouse (click to lock) |
| Shoot | Left Click |
| Somersault | Q |
| Switch Mount | 1, 2, 3, 4 |

## Project Structure
```
src/
├── main.ts                 # Entry point
├── Game.ts                 # Main game loop, state management
├── core/
│   ├── SceneManager.ts     # Three.js scene, lighting, skybox
│   ├── InputManager.ts     # Keyboard/mouse input
│   └── CameraController.ts # Third-person camera
├── entities/
│   ├── mounts/
│   │   ├── Mount.ts        # Base mount class
│   │   ├── Unicorn.ts      # Flying unicorn (3 variants)
│   │   └── Pony.ts         # Floating pony
│   ├── enemies/
│   │   └── Dragon.ts       # Dragon enemy with 3 types
│   └── projectiles/
│       └── Projectile.ts   # Magic bolt projectiles
├── systems/
│   └── CombatSystem.ts     # Firing, collision detection, damage
├── config/
│   └── mounts.ts           # Mount configurations
└── ui/                     # TODO: Phase 5
```

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETE
- Project setup, Three.js scene, flight physics, mounts, camera, HUD

### Phase 2: Combat ✅ COMPLETE
- [x] Create Projectile class (magic bolts with glow + trail)
- [x] Add CombatSystem to handle firing and collisions
- [x] Left-click fires projectile in aim direction
- [x] Particle effects on hit
- [x] Dragon enemies with 3 types (Fire Drake, Frost Wyrm, Shadow Dragon)
- [x] Damage system, death, respawning

### Phase 3: Enemy AI (NEXT)
- [ ] Dragon AI using Yuka.js
- [ ] Patrol, chase, attack states
- [ ] Dragons fire back at player
- [ ] SpawnSystem for enemy waves with difficulty scaling

### Phase 4: Mount Abilities
- [ ] Unique special abilities per mount (E key)
- [ ] Visual effects for abilities

### Phase 5: Polish
- [ ] Real 3D models (GLTF)
- [ ] More particle effects
- [ ] Sound effects
- [ ] More bridges/obstacles
- [ ] Improved game over / restart UI

## Key Files for Phase 3

**To Create:**
- `src/systems/AISystem.ts` - Yuka.js integration for dragon AI
- `src/systems/SpawnSystem.ts` - Wave-based enemy spawning

**To Modify:**
- `src/entities/enemies/Dragon.ts` - Add AI state machine, pursuit, attack logic
- `src/Game.ts` - Integrate AI system, have dragons fire at player

## Dragon Types (src/entities/enemies/Dragon.ts)
- Fire Drake: Red, 100 HP, balanced
- Frost Wyrm: Blue, 150 HP, slower but tankier
- Shadow Dragon: Purple, 80 HP, faster and smaller

## Mount Configurations (src/config/mounts.ts)
- Celestial Unicorn: White, balanced stats
- Storm Unicorn: Blue, fastest
- Shadow Unicorn: Purple, most agile
- Meadow Pony: Pink, floats instead of flies
