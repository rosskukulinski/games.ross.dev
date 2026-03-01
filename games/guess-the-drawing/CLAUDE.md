# Guess the Drawing

A browser-based game where a pencil animates drawing pictures on a canvas, and players guess what's being drawn using voice input.

## How to Play
1. Click "Start Game"
2. Watch the pencil draw a picture
3. Click the microphone and say what you see
4. Get +1 star for correct guesses, -2 stars if time runs out
5. Complete 10 rounds and see your final score

## Tech Stack
- Pure HTML/CSS/JavaScript (no frameworks)
- Web Speech API for voice recognition
- Canvas API for drawing animations
- Web Audio API for sound effects

## Project Structure
```
guess-the-drawing/
├── index.html              # Main game HTML
├── css/styles.css          # Paper aesthetic styling
└── js/
    ├── main.js             # Entry point, initialization
    ├── game.js             # Game state & flow management
    ├── drawing.js          # Canvas animation engine
    ├── paths.js            # Drawing path definitions
    ├── speech.js           # Voice recognition (Web Speech API)
    ├── timer.js            # 30-second countdown timer
    ├── audio.js            # Sound effects (Web Audio API)
    └── ui.js               # UI updates and screen transitions
```

## Key Files

- **paths.js** - Contains all drawing definitions. Each drawing has:
  - `id`, `name`, `acceptedAnswers` (for voice matching)
  - `paths` array with polylines, arcs, beziers defining the shape
  - Coordinates designed for 400x300 canvas (auto-scaled)

- **drawing.js** - Animation engine that:
  - Interpolates paths into points
  - Animates drawing stroke-by-stroke with `requestAnimationFrame`
  - Moves pencil sprite along the drawing path

- **game.js** - Controls game flow:
  - Round progression (10 rounds)
  - Scoring (+1 correct, -2 timeout, min 0)
  - Random drawing selection without repeats

## Live Site
**https://gtd.kukulinski.com**

## Building & Deploying

```bash
# Install dependencies
npm install

# Build (creates dist/ folder)
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

### Cloudflare Workers Configuration
- **wrangler.toml** - Configures Worker name and static assets directory
- Hosted on Cloudflare Workers with static assets
- Auto-deploys via GitHub integration

## Running Locally
```bash
# Option 1: Simple HTTP server
python3 -m http.server 8080

# Option 2: Build and serve dist
npm run build
cd dist && python3 -m http.server 8080
```

## Browser Support
- Chrome/Edge: Full support (voice + audio)
- Safari: Full support (voice + audio)
- Firefox: Limited (no Web Speech API, falls back to text input)
