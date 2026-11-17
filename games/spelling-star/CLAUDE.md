# Spelling Star

Weekly spelling-test practice. Every word on the list is a star in a
constellation; spelling it lights the star (1–3 stars by how cleanly it was
spelled). TypeScript + Vite, DOM UI over a Canvas 2D night sky. No engine —
this is a UI-driven game, polished with CSS animation plus a canvas particle
layer.

## Updating the word list each week

- **On the device (no deploy):** title screen → *Grown-ups: change words*.
  Saved per device in `localStorage` (`spelling-star-list-v1`).
- **In code:** edit `DEFAULT_LIST` in `src/words.ts` and deploy. A device that
  has never saved its own list (or hit *Reset to built-in list*) uses it.

Format: one word per line, optional ` | sentence` read aloud after the word,
like a teacher does on the test. Words are lowercased and stripped to a–z.
Best scores are keyed by a hash of the word list, so a new week starts fresh.

## Modes

| Mode | Board | Notes |
|------|-------|-------|
| Listen & Spell | On-screen QWERTY + physical keyboard | Word is only spoken, closest to the real test |
| Unscramble | The word's own letters as tiles | |
| Fill the Gaps | ~45% of letters blank, missing letters + 3 decoys | |

A wrong letter is never placed — the tile shakes and the slot flashes; after 3
misses on one slot the correct tile pulses. Hint places the next letter; Peek
flashes the whole word. Stars = 3 − (mistakes + hints) bucketed: 0 → 3,
≤2 → 2, else 1. A 1-star word is re-queued once at the end ("One more try!").
Results list words that weren't perfect first time, with *Practice tricky
words* to replay only those.

## Files

- `src/main.ts` — screens (title, play, results, editor), turn logic, `window.__game` debug hook
- `src/sky.ts` — background canvas: stars, nebula, shooting stars, pooled additive particles, flying stars, screen shake; `energy` follows the perfect streak
- `src/audio.ts` — synthesized Web Audio SFX, mute persisted in `spelling-star-muted`
- `src/speech.ts` — `speechSynthesis` wrapper (on-device voices, works offline)
- `src/words.ts` — default list, parsing, persistence

The arcade's home button keeps its default top-left corner; the game's own
menu/mute buttons sit top-right.
