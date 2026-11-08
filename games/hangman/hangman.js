'use strict';

// Two levels. Easy is the default so a pre-reader can pick a topic and play:
// a picture of the word, 3-4 letter words, the first letter already shown,
// unlimited hints and no way to lose. Tricky is the classic game with every
// word, 7 hearts and one hint per word.
const LEVELS = {
  easy: { maxLen: 4, lives: Infinity, hints: Infinity, freeFirst: true },
  tricky: { maxLen: Infinity, lives: 7, hints: 1, freeFirst: false },
};
const MOODS = ['😄', '🙂', '😊', '😐', '😟', '😨', '😢', '😵'];
const LEVEL_KEY = 'word-guess-level';

// [word, picture]. Colours draw a paint swatch instead of an emoji.
const WORDS = {
  Animals: [
    ['CAT', '🐱'], ['DOG', '🐶'], ['PIG', '🐷'], ['COW', '🐮'], ['FOX', '🦊'],
    ['OWL', '🦉'], ['BEE', '🐝'], ['ANT', '🐜'], ['BAT', '🦇'], ['HEN', '🐔'],
    ['LION', '🦁'], ['BEAR', '🐻'], ['FROG', '🐸'], ['DUCK', '🦆'], ['FISH', '🐟'],
    ['CRAB', '🦀'], ['GOAT', '🐐'], ['DEER', '🦌'],
    ['TIGER', '🐯'], ['ZEBRA', '🦓'], ['MONKEY', '🐵'], ['RABBIT', '🐰'],
    ['HORSE', '🐴'], ['PANDA', '🐼'], ['SNAKE', '🐍'], ['WHALE', '🐳'],
    ['SHARK', '🦈'], ['PENGUIN', '🐧'], ['GIRAFFE', '🦒'], ['ELEPHANT', '🐘'],
    ['DOLPHIN', '🐬'], ['TURTLE', '🐢'], ['KOALA', '🐨'],
  ],
  Food: [
    ['EGG', '🥚'], ['PIE', '🥧'], ['NUT', '🥜'], ['CAKE', '🍰'], ['CORN', '🌽'],
    ['PEAR', '🍐'], ['MILK', '🥛'], ['RICE', '🍚'], ['TACO', '🌮'], ['KIWI', '🥝'],
    ['APPLE', '🍎'], ['BANANA', '🍌'], ['PIZZA', '🍕'], ['BREAD', '🍞'],
    ['CHEESE', '🧀'], ['GRAPES', '🍇'], ['CARROT', '🥕'], ['COOKIE', '🍪'],
    ['ORANGE', '🍊'], ['CANDY', '🍬'], ['BURGER', '🍔'], ['NOODLES', '🍜'],
    ['MANGO', '🥭'], ['POTATO', '🥔'], ['CHERRY', '🍒'], ['WAFFLE', '🧇'],
    ['PRETZEL', '🥨'], ['PANCAKE', '🥞'],
  ],
  Colors: [
    ['RED', '#ef4444'], ['BLUE', '#3b82f6'], ['PINK', '#f472b6'],
    ['GOLD', 'linear-gradient(135deg,#fde68a,#d97706)'], ['GRAY', '#9ca3af'],
    ['GREEN', '#22c55e'], ['YELLOW', '#facc15'], ['PURPLE', '#a855f7'],
    ['ORANGE', '#f97316'], ['BROWN', '#92400e'], ['BLACK', '#1f2937'],
    ['WHITE', '#ffffff'], ['SILVER', 'linear-gradient(135deg,#f3f4f6,#9ca3af)'],
  ],
  Things: [
    ['CAR', '🚗'], ['BUS', '🚌'], ['HAT', '🎩'], ['SUN', '☀️'], ['KEY', '🔑'],
    ['BED', '🛏️'], ['BALL', '⚽'], ['KITE', '🪁'], ['DRUM', '🥁'], ['STAR', '⭐'],
    ['BOOK', '📖'], ['BOAT', '⛵'], ['SOCK', '🧦'], ['BIKE', '🚲'],
    ['BLOCKS', '🧱'], ['TEDDY', '🧸'], ['PUZZLE', '🧩'], ['CRAYON', '🖍️'],
    ['ROBOT', '🤖'], ['BUBBLE', '🫧'], ['ROCKET', '🚀'], ['TRAIN', '🚂'],
    ['BALLOON', '🎈'], ['SCOOTER', '🛴'], ['GUITAR', '🎸'], ['PENCIL', '✏️'],
  ],
};

let level = readLevel();
let category = 'Animals';
let word = '';
let clue = '';
let clueIsColor = false;
let guessed = new Set();
let wrong = 0;
let hintsUsed = 0;
let wrongStreak = 0;
let gameOver = false;
let lastWon = false;
let lastWord = '';

const wordEl = document.getElementById('word');
const keyboardEl = document.getElementById('keyboard');
const moodFace = document.getElementById('mood-face');
const heartsEl = document.getElementById('hearts');
const clueEl = document.getElementById('clue');
const hintBtn = document.getElementById('hint-btn');

function readLevel() {
  try {
    return localStorage.getItem(LEVEL_KEY) === 'tricky' ? 'tricky' : 'easy';
  } catch {
    return 'easy';
  }
}

function setLevel(v) {
  level = v === 'tricky' ? 'tricky' : 'easy';
  try { localStorage.setItem(LEVEL_KEY, level); } catch {}
  document.querySelectorAll('.level-btn').forEach((b) => {
    const on = b.dataset.level === level;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function startGame(cat) {
  category = cat;
  document.getElementById('category-badge').textContent = cat === 'Mixed' ? 'Surprise!' : cat;
  switchScreen('game-screen');
  newRound();
}

function pickWord() {
  const entries = category === 'Mixed'
    ? Object.entries(WORDS).flatMap(([cat, list]) => list.map((e) => [...e, cat]))
    : WORDS[category].map((e) => [...e, category]);
  let pool = entries.filter(([w]) => w.length <= LEVELS[level].maxLen);
  if (pool.length > 1) pool = pool.filter(([w]) => w !== lastWord);
  return pool[Math.floor(Math.random() * pool.length)];
}

function newRound() {
  const [w, picture, cat] = pickWord();
  word = w;
  lastWord = w;
  guessed = new Set();
  wrong = 0;
  hintsUsed = 0;
  wrongStreak = 0;
  gameOver = false;
  lastWon = false;
  if (LEVELS[level].freeFirst) guessed.add(word[0]);
  hideWin();
  renderClue(picture, cat === 'Colors');
  renderWord();
  renderKeyboard();
  updateMood();
  updateHint();
}

function drawClue(el) {
  el.innerHTML = '';
  if (clueIsColor) {
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.style.background = clue;
    el.appendChild(swatch);
  } else {
    el.textContent = clue;
  }
}

function renderClue(picture, isColor) {
  clue = picture;
  clueIsColor = isColor;
  drawClue(clueEl);
  clueEl.classList.remove('pop');
  void clueEl.offsetWidth;
  clueEl.classList.add('pop');
}

function renderWord() {
  wordEl.innerHTML = '';
  for (const ch of word) {
    const slot = document.createElement('div');
    slot.className = 'letter-slot';
    if (ch === ' ') {
      slot.classList.add('space');
    } else if (guessed.has(ch)) {
      const span = document.createElement('span');
      span.className = 'pop-in';
      span.textContent = ch;
      slot.appendChild(span);
    }
    wordEl.appendChild(slot);
  }
}

function renderKeyboard() {
  keyboardEl.innerHTML = '';
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const key = document.createElement('button');
    key.className = 'key';
    key.textContent = ch;
    if (guessed.has(ch)) {
      key.disabled = true;
      key.classList.add(word.includes(ch) ? 'correct' : 'wrong');
    }
    key.addEventListener('click', () => guess(ch));
    keyboardEl.appendChild(key);
  }
}

function guess(ch) {
  if (gameOver || guessed.has(ch)) return;
  guessed.add(ch);

  if (word.includes(ch)) {
    wrongStreak = 0;
    renderWord();
    if (isSolved()) return endRound(true);
  } else {
    wrong++;
    wrongStreak++;
    moodFace.classList.remove('shake');
    void moodFace.offsetWidth;
    moodFace.classList.add('shake');
    updateMood();
    if (wrong >= LEVELS[level].lives) return endRound(false);
  }
  renderKeyboard();
  updateHint();
}

function hintsLeft() {
  return LEVELS[level].hints - hintsUsed;
}

function hint() {
  if (gameOver || hintsLeft() <= 0) return;
  const missing = [...new Set(word.replace(/ /g, ''))].filter((ch) => !guessed.has(ch));
  if (!missing.length) return;
  hintsUsed++;
  wrongStreak = 0;
  updateMood();
  guess(missing[Math.floor(Math.random() * missing.length)]);
  updateHint();
}

function updateHint() {
  const left = hintsLeft();
  hintBtn.disabled = gameOver || left <= 0;
  // In Easy the bulb starts glowing after two misses in a row, as a nudge.
  hintBtn.classList.toggle('glow', !hintBtn.disabled && level === 'easy' && wrongStreak >= 2);
  const badge = hintBtn.querySelector('.hint-count');
  badge.hidden = !Number.isFinite(left);
  badge.textContent = Number.isFinite(left) ? String(Math.max(left, 0)) : '';
}

function isSolved() {
  return [...word].every((ch) => ch === ' ' || guessed.has(ch));
}

function updateMood() {
  const lives = LEVELS[level].lives;
  if (!Number.isFinite(lives)) {
    // Easy: no hearts to lose. The face just ponders a miss.
    moodFace.textContent = wrongStreak ? '🤔' : '😄';
    heartsEl.innerHTML = '';
    return;
  }
  moodFace.textContent = MOODS[Math.min(wrong, MOODS.length - 1)];
  let html = '';
  for (let i = 0; i < lives; i++) {
    html += i < lives - wrong ? '❤️' : '<span class="heart-lost">🤍</span>';
  }
  heartsEl.innerHTML = html;
}

function say(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85;
    speechSynthesis.speak(u);
  } catch {}
}

function endRound(won) {
  gameOver = true;
  lastWon = won;
  // Reveal full word
  guessed = new Set(word.replace(/ /g, '').split(''));
  renderWord();
  renderKeyboard();
  updateHint();
  drawClue(document.getElementById('win-emoji'));
  document.getElementById('win-stars').hidden = !won;
  document.getElementById('win-title').textContent = won ? 'You got it!' : 'So close!';
  document.getElementById('reveal').innerHTML = 'The word was <strong>' + word + '</strong>';
  if (won) say(word.toLowerCase());
  setTimeout(() => document.getElementById('win-screen').classList.add('show'), 600);
}

function hideWin() {
  document.getElementById('win-screen').classList.remove('show');
}

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showModeSelect() {
  hideWin();
  switchScreen('mode-select');
}

document.addEventListener('keydown', (e) => {
  if (gameOver) {
    // Enter / Space on the end card plays the next word.
    if ((e.key === 'Enter' || e.key === ' ') && document.getElementById('win-screen').classList.contains('show')) {
      e.preventDefault();
      newRound();
    }
    return;
  }
  const ch = e.key.toUpperCase();
  if (ch.length === 1 && ch >= 'A' && ch <= 'Z') guess(ch);
});

setLevel(level);

window.startGame = startGame;
window.newRound = newRound;
window.showModeSelect = showModeSelect;
window.setLevel = setLevel;
window.hint = hint;
// Read-only state for play-testing.
Object.defineProperty(window, '__game', {
  get: () => ({
    level, category, word, clue, wrong, gameOver, hintsUsed, won: lastWon,
    guessed: [...guessed],
    lives: Number.isFinite(LEVELS[level].lives) ? LEVELS[level].lives : null,
    hintsLeft: Number.isFinite(hintsLeft()) ? hintsLeft() : null,
  }),
});
