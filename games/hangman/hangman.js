'use strict';

const MAX_WRONG = 6;
const MOODS = ['😄', '🙂', '😐', '😟', '😨', '😢', '😵'];

const WORDS = {
  Animals: ['CAT', 'DOG', 'LION', 'TIGER', 'BEAR', 'ZEBRA', 'MONKEY', 'RABBIT', 'HORSE', 'PANDA', 'FROG', 'SNAKE', 'WHALE', 'SHARK', 'PENGUIN', 'GIRAFFE', 'ELEPHANT', 'DOLPHIN', 'TURTLE', 'KOALA'],
  Food: ['APPLE', 'BANANA', 'PIZZA', 'BREAD', 'CHEESE', 'GRAPES', 'CARROT', 'COOKIE', 'ORANGE', 'CANDY', 'BURGER', 'NOODLES', 'MANGO', 'POTATO', 'CHERRY', 'WAFFLE', 'PRETZEL', 'PANCAKE'],
  Colors: ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE', 'PINK', 'BROWN', 'BLACK', 'WHITE', 'SILVER', 'GOLD'],
  Things: ['BALL', 'BLOCKS', 'TEDDY', 'PUZZLE', 'CRAYON', 'WAGON', 'KITE', 'ROBOT', 'PUPPET', 'BUBBLE', 'ROCKET', 'TRAIN', 'BALLOON', 'SCOOTER', 'MARBLE', 'DRUM'],
};

let category = 'Animals';
let word = '';
let guessed = new Set();
let wrong = 0;
let gameOver = false;

const wordEl = document.getElementById('word');
const keyboardEl = document.getElementById('keyboard');
const moodFace = document.getElementById('mood-face');
const heartsEl = document.getElementById('hearts');

function startGame(cat) {
  category = cat;
  document.getElementById('category-badge').textContent = cat === 'Mixed' ? 'Surprise!' : cat;
  switchScreen('game-screen');
  newRound();
}

function pickWord() {
  let pool;
  if (category === 'Mixed') {
    pool = Object.values(WORDS).flat();
  } else {
    pool = WORDS[category];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function newRound() {
  word = pickWord();
  guessed = new Set();
  wrong = 0;
  gameOver = false;
  hideWin();
  renderWord();
  renderKeyboard();
  updateMood();
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
    renderWord();
    if (isSolved()) return endRound(true);
  } else {
    wrong++;
    moodFace.classList.remove('shake');
    void moodFace.offsetWidth;
    moodFace.classList.add('shake');
    updateMood();
    if (wrong >= MAX_WRONG) return endRound(false);
  }
  renderKeyboard();
}

function isSolved() {
  return [...word].every((ch) => ch === ' ' || guessed.has(ch));
}

function updateMood() {
  moodFace.textContent = MOODS[Math.min(wrong, MOODS.length - 1)];
  const lives = MAX_WRONG - wrong;
  let html = '';
  for (let i = 0; i < MAX_WRONG; i++) {
    html += i < lives ? '❤️' : '<span class="heart-lost">🤍</span>';
  }
  heartsEl.innerHTML = html;
}

function endRound(won) {
  gameOver = true;
  // Reveal full word
  guessed = new Set(word.replace(/ /g, '').split(''));
  renderWord();
  renderKeyboard();
  const emoji = document.getElementById('win-emoji');
  const title = document.getElementById('win-title');
  const reveal = document.getElementById('reveal');
  if (won) {
    emoji.textContent = '🎉';
    title.textContent = 'You got it!';
    reveal.innerHTML = 'The word was <strong>' + word + '</strong>';
  } else {
    emoji.textContent = '🙈';
    title.textContent = 'So close!';
    reveal.innerHTML = 'The word was <strong>' + word + '</strong>';
  }
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
  if (gameOver) return;
  const ch = e.key.toUpperCase();
  if (ch.length === 1 && ch >= 'A' && ch <= 'Z') guess(ch);
});

window.startGame = startGame;
window.newRound = newRound;
window.showModeSelect = showModeSelect;
