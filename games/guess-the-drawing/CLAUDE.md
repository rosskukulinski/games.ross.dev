# Guess the Drawing

A browser-based game where a pencil animates drawing pictures on a canvas, and players guess what's being drawn by picking a picture, speaking, or typing.

## How to Play
1. Choose how to answer: **Pick it** (default — 4 big picture buttons, no reading needed), **Say it** (voice), or **Type it**
2. Click "Start Game" and watch the pencil draw a picture
3. Answer: tap the matching picture, say it out loud, or type it (small typos are forgiven)
4. Get +1 star for each correct guess. Nothing is lost on a timeout or a wrong pick
5. Stuck? With 15s left a hint appears (pick: a wrong picture greys out; say/type: first letter + blanks); pick mode greys out another at 8s
6. Complete 10 rounds and see your final score

Wrong picks/typed guesses wobble with a "Try again!" cue. Both feedback screens show the answer as an emoji picture.
If the mic is unsupported or refused, the round falls back to picture buttons + the typing box.
`window.__game` is a read-only state view for play-test harnesses (state, mode, round, stars, answer, choices, hintShown, timeLeft).

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
    ├── pictures.js         # Emoji for every drawing (pick buttons + feedback)
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
  - Scoring (+1 correct, no penalty)
  - Pick-mode choices, hints, fuzzy matching for typed guesses
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
