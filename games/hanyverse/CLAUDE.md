# Hanyverse - Mobile Browser Game

## Project Overview
A mobile browser game inspired by Dopiverse, where kids create avatars, explore a town, get jobs, and decorate their home. Built with Phaser.js and Vite.

## Current Status: MVP Complete
The Avatar Creation screen is fully functional with all core features working.

## Tech Stack
- **Framework:** Phaser.js 3.80+
- **Build Tool:** Vite 5.4
- **Storage:** localStorage (no backend)
- **Target:** Mobile portrait (390x844 base resolution)

## Running the Project
```bash
npm install
npm run dev
# Opens at http://localhost:3000 (or 3001 if 3000 is in use)
```

## Project Structure
```
src/
├── main.js                    # Game initialization, exposes window.game
├── config.js                  # Phaser config (390x844, FIT scaling)
├── scenes/
│   ├── BootScene.js           # Minimal setup, WebGL check
│   ├── PreloaderScene.js      # Generates placeholder assets
│   ├── AvatarCreationScene.js # MVP screen (complete)
│   └── TownScene.js           # Placeholder
├── components/
│   ├── Avatar.js              # Layered sprite system with skin tinting
│   └── ui/
│       ├── Button.js          # Touch-friendly button
│       ├── ToggleGroup.js     # Radio-style selection (Girl/Boy)
│       ├── ColorPicker.js     # Vertical color swatches
│       ├── GridSelector.js    # Grid of selectable items
│       └── TextInput.js       # DOM-backed text input
├── data/
│   ├── skinColors.js          # 8 skin tones
│   ├── faceData.js            # 6 face expressions
│   └── clothingData.js        # Tops, bottoms, hair styles
├── managers/
│   └── StorageManager.js      # localStorage wrapper
└── utils/
    ├── responsive.js          # Screen scaling utilities
    └── constants.js           # Colors, fonts, animation timings
```

## Avatar System
- **Layering:** shadow → legs → body → bottom → top → arms → head → face → hair
- **Skin tinting:** Body parts are grayscale, tinted with Phaser's setTint()
- **Gender filtering:** Clothing options change based on gender selection
- **Dress logic:** Selecting a dress clears bottom clothing

## Completed Features
1. Gender toggle (Girl/Boy)
2. Skin color picker (8 tones)
3. Face selector (6 expressions)
4. Hair selector (5 styles)
5. Tops selector (shirts + dresses)
6. Bottoms selector (pants, shorts, skirts)
7. Real-time avatar preview
8. Name input with validation
9. localStorage persistence
10. Scene transitions with fade effects

## Original Wireframes
Located in project root:
- `IMG_8093.jpeg` - Avatar Creation (reference for current MVP)
- `IMG_8094.jpeg` - Town Map (Vet, Pizza shop, Hospital, streets)
- `IMG_8095.jpeg` - Job System (step-by-step workflow)
- `IMG_8096.jpeg` - Home Decoration (drag-and-drop)

## Next Features to Build
Based on wireframes, in priority order:

### 1. Town Scene (IMG_8094)
- Top-down or isometric town map
- Walkable streets with crosswalks
- Buildings: Vet, Hospital (medical cross), Pete's Pizza
- Player avatar walking around
- Tap-to-move or joystick controls

### 2. Job System (IMG_8095)
- Enter buildings to talk to NPCs
- Job selection menu
- Daily pay system
- "Continue" / "Quit" job flow
- Example workflow: Restaurant job

### 3. Home Decoration (IMG_8096)
- Player's house interior
- Drag-and-drop furniture/decorations
- Item categories: plants, slides, swings, etc.
- Save decorated state

## Known Issues
- TextInput uses hidden DOM element; works on real mobile but Playwright automation can't type into it directly
- Placeholder graphics are programmatically generated; replace with actual art assets

## localStorage Keys
- `hanyverse_avatar` - Avatar configuration
- `hanyverse_settings` - Game settings (future)
- `hanyverse_state` - Game progress (future)

## Asset Requirements for Polish
When replacing placeholder graphics:
- Avatar body parts: grayscale PNGs for tinting
- Faces: 50x50 transparent PNGs
- Hair: 80x85 transparent PNGs
- Clothing: 80x95 (tops), 80x60 (bottoms)
- UI: buttons, panels, icons

## Style Notes
- Target: Polished cartoon graphics (like Dopiverse)
- Mobile-first, touch-friendly
- Large tap targets (minimum 44px)
- Bright, cheerful colors
