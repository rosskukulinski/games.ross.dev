'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const S = {
  mode: null,
  gridSize: 9,
  solved: null,   // 2-D array: complete solution
  given: null,    // 2-D array of booleans
  board: null,    // 2-D array: current player state (0 = empty)
  notes: null,    // 2-D array of Set
  selected: null, // { r, c }
  mistakes: 0,
  time: 0,
  timerInterval: null,
  history: [],
  notesMode: false,
  won: false,
};

// ── Utilities ──────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clone2D(arr) { return arr.map(r => [...r]); }

// ── 9×9 Generator ──────────────────────────────────────────────────────────
function generate9x9Solved() {
  const b = Array.from({ length: 9 }, () => Array(9).fill(0));
  // Fill three diagonal 3×3 boxes independently (they don't share row/col)
  for (let k = 0; k < 3; k++) {
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let i = 0;
    for (let r = k * 3; r < k * 3 + 3; r++)
      for (let c = k * 3; c < k * 3 + 3; c++)
        b[r][c] = nums[i++];
  }
  solveBoard(b);
  return b;
}

function canPlace(b, r, c, n) {
  for (let j = 0; j < 9; j++) if (b[r][j] === n) return false;
  for (let i = 0; i < 9; i++) if (b[i][c] === n) return false;
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (b[br + i][bc + j] === n) return false;
  return true;
}

function solveBoard(b) {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (b[i][j] === 0) {
        for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
          if (canPlace(b, i, j, n)) {
            b[i][j] = n;
            if (solveBoard(b)) return true;
            b[i][j] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

/**
 * Difficulty controls:
 *  easy:   remove 30  → ~51 given clues  (no advanced strategy needed)
 *  medium: remove 46  → ~35 given clues  (naked singles + hidden singles)
 *  hard:   remove 58  → ~23 given clues  (naked pairs, pointing pairs, etc.)
 */
function create9x9Puzzle(solved, mode) {
  const toRemove = { easy: 30, medium: 46, hard: 58 }[mode];
  const puzzle = clone2D(solved);
  for (const pos of shuffle(Array.from({ length: 81 }, (_, i) => i)).slice(0, toRemove)) {
    puzzle[Math.floor(pos / 9)][pos % 9] = 0;
  }
  return puzzle;
}

// ── 3×3 Latin-Square Generator (Beginner) ─────────────────────────────────
function generate3x3() {
  // Enumerate all valid 3×3 latin squares then pick one
  const candidates = [];
  const perms = [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]];
  for (const r0 of perms) {
    for (const r1 of perms) {
      if (r1[0] === r0[0] || r1[1] === r0[1] || r1[2] === r0[2]) continue;
      const r2 = [0, 1, 2].map(j => [1, 2, 3].find(n => n !== r0[j] && n !== r1[j]));
      if (new Set(r2).size === 3) candidates.push([r0, r1, r2]);
    }
  }
  const solved = candidates[Math.floor(Math.random() * candidates.length)];

  // Show 5 of 9 cells (remove 4)
  const puzzle = clone2D(solved);
  for (const pos of shuffle([0,1,2,3,4,5,6,7,8]).slice(0, 4))
    puzzle[Math.floor(pos / 3)][pos % 3] = 0;

  return { solved, puzzle };
}

// ── Game Lifecycle ─────────────────────────────────────────────────────────
function startGame(mode) {
  S.mode = mode;
  S.won = false;
  S.mistakes = 0;
  S.time = 0;
  S.history = [];
  S.notesMode = false;
  S.selected = null;

  clearInterval(S.timerInterval);
  S.timerInterval = null;

  if (mode === 'beginner') {
    S.gridSize = 3;
    const { solved, puzzle } = generate3x3();
    S.solved = solved;
    S.given  = puzzle.map(row => row.map(v => v !== 0));
    S.board  = clone2D(puzzle);
    S.notes  = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => new Set()));
    // Set larger cell size for the 3×3 grid
    document.documentElement.style.setProperty('--cell-size', 'min(90px, calc((100vw - 80px) / 3))');
  } else {
    S.gridSize = 9;
    const solved = generate9x9Solved();
    const puzzle = create9x9Puzzle(solved, mode);
    S.solved = solved;
    S.given  = puzzle.map(row => row.map(v => v !== 0));
    S.board  = clone2D(puzzle);
    S.notes  = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    document.documentElement.style.setProperty('--cell-size', 'min(52px, calc((100vw - 40px) / 9))');
    // Start timer for non-beginner modes
    S.timerInterval = setInterval(() => {
      S.time++;
      document.getElementById('timer-display').textContent = fmtTime(S.time);
    }, 1000);
  }

  const labels = { beginner: '🌱 Beginner', easy: '⭐ Easy', medium: '⭐⭐ Medium', hard: '⭐⭐⭐ Hard' };
  document.getElementById('mode-badge').textContent = labels[mode];

  // Notes button only visible for 9×9 modes
  document.getElementById('notes-btn').style.display = mode === 'beginner' ? 'none' : '';

  showScreen('game-screen');
  renderBoard();
  renderNumpad();
  updateStats();

  document.addEventListener('keydown', onKey);
}

function newGame() {
  startGame(S.mode);
}

function showModeSelect() {
  clearInterval(S.timerInterval);
  document.removeEventListener('keydown', onKey);
  hideWin();
  showScreen('mode-select');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Board Rendering ────────────────────────────────────────────────────────
function renderBoard() {
  const n = S.gridSize;
  const board = document.getElementById('board');
  board.innerHTML = '';
  board.className = `board-${n}x${n}`;
  board.style.gridTemplateColumns = `repeat(${n}, var(--cell-size))`;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      board.appendChild(buildCell(r, c));
    }
  }
}

function buildCell(r, c) {
  const n = S.gridSize;
  const val = S.board[r][c];
  const isGiven = S.given[r][c];

  const el = document.createElement('div');
  el.className = 'cell';
  el.dataset.r = r;
  el.dataset.c = c;

  // Inter-cell borders: hairline right/bottom except at box edges
  if (c < n - 1) {
    el.classList.add(n === 9 && (c + 1) % 3 === 0 ? 'br' : 'thin-r');
  }
  if (r < n - 1) {
    el.classList.add(n === 9 && (r + 1) % 3 === 0 ? 'bb' : 'thin-b');
  }

  setCell(el, val, isGiven, r, c);
  el.addEventListener('click', () => selectCell(r, c));
  return el;
}

function setCell(el, val, isGiven, r, c) {
  // Clear content & value classes
  el.innerHTML = '';
  el.classList.remove('given', 'user-correct', 'user-wrong');
  delete el.dataset.num;

  if (val !== 0) {
    el.dataset.num = val;
    if (isGiven) {
      el.classList.add('given');
    } else {
      el.classList.add(val === S.solved[r][c] ? 'user-correct' : 'user-wrong');
    }
    el.textContent = val;
  } else {
    // Notes
    const noteSet = S.notes[r][c];
    if (noteSet.size > 0) {
      const grid = document.createElement('div');
      grid.className = 'notes-grid';
      for (let k = 1; k <= 9; k++) {
        const span = document.createElement('span');
        span.className = 'note-num';
        span.textContent = noteSet.has(k) ? k : '';
        grid.appendChild(span);
      }
      el.appendChild(grid);
    }
  }
}

function refreshCell(r, c) {
  const el = cellEl(r, c);
  if (!el) return;
  setCell(el, S.board[r][c], S.given[r][c], r, c);
  applyHighlights();
}

function cellEl(r, c) {
  return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

// ── Highlights ─────────────────────────────────────────────────────────────
function applyHighlights() {
  document.querySelectorAll('.cell').forEach(el => {
    el.classList.remove('selected', 'same-num', 'related');
  });
  if (!S.selected) return;

  const { r, c } = S.selected;
  const selVal = S.board[r][c];
  const n = S.gridSize;
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;

  document.querySelectorAll('.cell').forEach(el => {
    const er = +el.dataset.r;
    const ec = +el.dataset.c;

    if (er === r && ec === c) { el.classList.add('selected'); return; }

    const inBox = n === 9 && er >= br && er < br + 3 && ec >= bc && ec < bc + 3;
    if (er === r || ec === c || inBox) el.classList.add('related');

    if (selVal !== 0 && +el.dataset.num === selVal) el.classList.add('same-num');
  });
}

// ── Cell Selection ─────────────────────────────────────────────────────────
function selectCell(r, c) {
  S.selected = { r, c };
  applyHighlights();
}

// ── Input ──────────────────────────────────────────────────────────────────
function inputNumber(num) {
  if (!S.selected || S.won) return;
  const { r, c } = S.selected;
  if (S.given[r][c]) return;

  if (S.notesMode) {
    const ns = S.notes[r][c];
    ns.has(num) ? ns.delete(num) : ns.add(num);
    if (ns.size) S.board[r][c] = 0; // clear value when writing notes
    refreshCell(r, c);
    return;
  }

  // Save undo snapshot
  S.history.push({ r, c, val: S.board[r][c], notes: new Set(S.notes[r][c]) });

  S.notes[r][c].clear();
  S.board[r][c] = num;
  refreshCell(r, c);
  renderNumpad();

  const correct = num === S.solved[r][c];
  if (!correct) {
    S.mistakes++;
    updateStats();
    const el = cellEl(r, c);
    if (el) { el.classList.add('anim-shake'); el.addEventListener('animationend', () => el.classList.remove('anim-shake'), { once: true }); }
  } else {
    const el = cellEl(r, c);
    if (el) { el.classList.add('anim-pop'); el.addEventListener('animationend', () => el.classList.remove('anim-pop'), { once: true }); }
    checkWin();
  }
}

function eraseCell() {
  if (!S.selected || S.won) return;
  const { r, c } = S.selected;
  if (S.given[r][c]) return;
  S.history.push({ r, c, val: S.board[r][c], notes: new Set(S.notes[r][c]) });
  S.board[r][c] = 0;
  S.notes[r][c].clear();
  refreshCell(r, c);
  renderNumpad();
}

function undoMove() {
  if (!S.history.length || S.won) return;
  const { r, c, val, notes } = S.history.pop();
  S.board[r][c] = val;
  S.notes[r][c] = notes;
  refreshCell(r, c);
  renderNumpad();
}

function toggleNotes() {
  if (S.gridSize === 3) return;
  S.notesMode = !S.notesMode;
  document.getElementById('notes-btn').classList.toggle('active', S.notesMode);
}

// ── Win Detection ──────────────────────────────────────────────────────────
function checkWin() {
  const n = S.gridSize;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (S.board[r][c] !== S.solved[r][c]) return;

  S.won = true;
  clearInterval(S.timerInterval);
  setTimeout(showWin, 400);
}

function showWin() {
  const emojis  = { beginner: '🌟', easy: '🎉', medium: '🏆', hard: '👑' };
  const titles  = { beginner: 'Amazing Job!', easy: 'Puzzle Solved!', medium: 'Well Done!', hard: 'Expert Solver!' };
  document.getElementById('win-emoji').textContent = emojis[S.mode];
  document.getElementById('win-title').textContent = titles[S.mode];
  document.getElementById('win-time').textContent  = fmtTime(S.time);
  document.getElementById('win-mistakes').textContent = S.mistakes;
  document.getElementById('win-screen').classList.add('show');
  launchConfetti();
}

function hideWin() {
  document.getElementById('win-screen').classList.remove('show');
}

// ── Numpad ────────────────────────────────────────────────────────────────
function renderNumpad() {
  const numpad = document.getElementById('numpad');
  const n = S.gridSize;
  numpad.innerHTML = '';
  numpad.className = `numpad-${n}`;

  for (let num = 1; num <= n; num++) {
    const btn = document.createElement('button');
    btn.className = 'num-btn';
    btn.textContent = num;
    if (isComplete(num)) btn.classList.add('used');
    btn.addEventListener('click', () => inputNumber(num));
    numpad.appendChild(btn);
  }
}

function isComplete(num) {
  const n = S.gridSize;
  let cnt = 0;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (S.board[r][c] === num && S.board[r][c] === S.solved[r][c]) cnt++;
  return cnt === n;
}

// ── Stats ─────────────────────────────────────────────────────────────────
function updateStats() {
  document.getElementById('mistakes-display').textContent = S.mistakes;
}

function fmtTime(t) {
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

// ── Keyboard ──────────────────────────────────────────────────────────────
function onKey(e) {
  const n = S.gridSize;

  if (e.key >= '1' && e.key <= String(n)) { inputNumber(+e.key); return; }
  if (e.key === 'Backspace' || e.key === 'Delete') { eraseCell(); return; }
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undoMove(); return; }

  if (!S.selected) { selectCell(0, 0); return; }
  let { r, c } = S.selected;
  if      (e.key === 'ArrowUp')    r = Math.max(0, r - 1);
  else if (e.key === 'ArrowDown')  r = Math.min(n - 1, r + 1);
  else if (e.key === 'ArrowLeft')  c = Math.max(0, c - 1);
  else if (e.key === 'ArrowRight') c = Math.min(n - 1, c + 1);
  else return;
  e.preventDefault();
  selectCell(r, c);
}

// ── Confetti ──────────────────────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#ff6b6b', '#ffd93d', '#6bcf7f', '#4d96ff', '#c77dff', '#ff6b9d'];
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.5,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 4 + 2,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.15,
    w: Math.random() * 12 + 6,
    h: Math.random() * 6 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    opacity: 1,
  }));

  let frame = 0;
  (function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.07;
      p.rot += p.vrot;
      if (frame > 120) p.opacity = Math.max(0, p.opacity - 0.015);
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (frame < 200) requestAnimationFrame(loop);
    else canvas.remove();
  })();
}

// ── Init ──────────────────────────────────────────────────────────────────
showScreen('mode-select');
