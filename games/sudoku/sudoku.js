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
  cfg: null,       // MODES[mode]
  spec: null,      // grid geometry for the solver
  help: false,     // helper: glow the legal numpad buttons
  clearTimers: {}, // pending auto-clears of wrong kid-mode placements
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

// ── Modes ──────────────────────────────────────────────────────────────────
// n: grid size; bh × bw: box shape (0 = no boxes, a plain Latin square);
// remove: how many cells to blank (only while the puzzle stays unique);
// kid: hides the counters a pre-reader cannot use; autoClear: a wrong
// placement flashes red, shows what it clashes with, then clears itself;
// help: start with the helper on (legal buttons glow, the rest dim).
const MODES = {
  picture:  { n: 4, bh: 2, bw: 2, remove: 6,  kid: true,  autoClear: true,  help: true,  pictures: true },
  beginner: { n: 3, bh: 0, bw: 0, remove: 4,  kid: true,  autoClear: true,  help: true },
  junior:   { n: 6, bh: 2, bw: 3, remove: 18, kid: false, autoClear: true,  help: false },
  easy:     { n: 9, bh: 3, bw: 3, remove: 30, kid: false, autoClear: false, help: false },
  medium:   { n: 9, bh: 3, bw: 3, remove: 46, kid: false, autoClear: false, help: false },
  hard:     { n: 9, bh: 3, bw: 3, remove: 58, kid: false, autoClear: false, help: false },
};

// Width-, height- and size-capped; --chrome-h is the vertical space the rest of
// the screen needs (smaller in landscape, where the controls sit to the side).
const cellSize = (max, n, sidePad) =>
  `min(${max}px, calc((100vw - ${sidePad}px) / ${n}), calc((100vh - var(--chrome-h)) / ${n}))`;
const CELL_SIZES = {
  3: cellSize(120, 3, 80),
  4: cellSize(128, 4, 64),
  6: cellSize(78, 6, 48),
  9: cellSize(60, 9, 40),
};

// Picture mode: four shapes that differ in both colour and outline.
const SHAPES = [
  { name: 'Red circle',     svg: '<circle cx="50" cy="50" r="38" fill="#ef4444"/>' },
  { name: 'Blue square',    svg: '<rect x="14" y="14" width="72" height="72" rx="10" fill="#3b82f6"/>' },
  { name: 'Green triangle', svg: '<path d="M50 10 L91 84 Q93 90 86 90 L14 90 Q7 90 9 84 Z" fill="#22c55e"/>' },
  { name: 'Yellow star',    svg: '<path d="M50 6 L62 37 L95 38 L69 58 L79 91 L50 72 L21 91 L31 58 L5 38 L38 37 Z" fill="#facc15" stroke="#eab308" stroke-width="3" stroke-linejoin="round"/>' },
];
function shapeSVG(v) {
  return `<svg class="shape" viewBox="0 0 100 100" aria-hidden="true">${SHAPES[v - 1].svg}</svg>`;
}

// ── Generic generator / solver (any n, any box shape) ─────────────────────
function makeSpec(n, bh, bw) {
  const peers = [];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n, set = new Set();
    for (let k = 0; k < n; k++) { set.add(r * n + k); set.add(k * n + c); }
    if (bh) {
      const r0 = r - r % bh, c0 = c - c % bw;
      for (let a = 0; a < bh; a++) for (let b = 0; b < bw; b++) set.add((r0 + a) * n + c0 + b);
    }
    set.delete(i);
    peers.push([...set]);
  }
  return { n, bh, bw, peers };
}

function candidatesAt(g, spec, i) {
  const used = new Set();
  for (const p of spec.peers[i]) used.add(g[p]);
  const out = [];
  for (let v = 1; v <= spec.n; v++) if (!used.has(v)) out.push(v);
  return out;
}

// Most-constrained-cell backtracking. Fills `g` (flat) in place with a random
// solution when fill=true; otherwise counts solutions up to `limit`.
function search(g, spec, { fill = false, limit = 2 } = {}) {
  let best = -1, bestCands = null;
  for (let i = 0; i < g.length; i++) {
    if (g[i]) continue;
    const cands = candidatesAt(g, spec, i);
    if (cands.length === 0) return 0;
    if (!bestCands || cands.length < bestCands.length) { best = i; bestCands = cands; if (cands.length === 1) break; }
  }
  if (best === -1) return 1;
  let count = 0;
  for (const v of fill ? shuffle(bestCands) : bestCands) {
    g[best] = v;
    count += search(g, spec, { fill, limit: limit - count });
    if (fill && count) return count;
    if (count >= limit) break;
  }
  g[best] = 0;
  return count;
}

function generatePuzzle(mode) {
  const m = MODES[mode];
  const spec = makeSpec(m.n, m.bh, m.bw);
  const g = Array(m.n * m.n).fill(0);
  search(g, spec, { fill: true });
  const solved = [...g];
  // Blank cells one at a time, keeping each removal only if the puzzle still
  // has exactly one solution — so logic alone always finishes it.
  let removed = 0;
  for (const i of shuffle(Array.from({ length: g.length }, (_, k) => k))) {
    if (removed >= m.remove) break;
    const v = g[i];
    g[i] = 0;
    if (search([...g], spec, { limit: 2 }) === 1) removed++;
    else g[i] = v;
  }
  const to2D = (flat) => Array.from({ length: m.n }, (_, r) => flat.slice(r * m.n, r * m.n + m.n));
  return { spec, solved: to2D(solved), puzzle: to2D(g) };
}

// ── Game Lifecycle ─────────────────────────────────────────────────────────
function startGame(mode) {
  const m = MODES[mode];
  S.mode = mode;
  S.cfg = m;
  S.won = false;
  S.mistakes = 0;
  S.time = 0;
  S.history = [];
  S.notesMode = false;
  S.selected = null;
  S.help = m.help;
  S.clearTimers = {};

  clearInterval(S.timerInterval);
  S.timerInterval = null;

  const { spec, solved, puzzle } = generatePuzzle(mode);
  S.spec = spec;
  S.gridSize = m.n;
  S.solved = solved;
  S.given  = puzzle.map(row => row.map(v => v !== 0));
  S.board  = clone2D(puzzle);
  S.notes  = Array.from({ length: m.n }, () => Array.from({ length: m.n }, () => new Set()));
  document.documentElement.style.setProperty('--cell-size', CELL_SIZES[m.n]);

  document.getElementById('timer-display').textContent = '0:00';
  if (!m.kid) {
    S.timerInterval = setInterval(() => {
      S.time++;
      document.getElementById('timer-display').textContent = fmtTime(S.time);
    }, 1000);
  }

  const labels = { picture: '🐣 Pictures', beginner: '🌱 Beginner', junior: '🚀 Junior', easy: '⭐ Easy', medium: '⭐⭐ Medium', hard: '⭐⭐⭐ Hard' };
  document.getElementById('mode-badge').textContent = labels[mode];

  // Counters mean nothing to a pre-reader; notes only make sense on 9×9.
  document.querySelector('.game-stats').style.visibility = m.kid ? 'hidden' : '';
  document.getElementById('notes-btn').style.display = m.n === 9 ? '' : 'none';
  document.getElementById('help-btn').classList.toggle('active', S.help);
  document.getElementById('notes-btn').classList.remove('active');
  document.getElementById('game-screen').classList.toggle('kid-mode', m.kid);
  hideWin();

  showScreen('game-screen');
  renderBoard();
  renderNumpad();
  updateStats();

  document.removeEventListener('keydown', onKey);
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
  board.className = `board-${n}x${n}${S.cfg.pictures ? ' board-pictures' : ''}`;
  board.style.gridTemplateColumns = `repeat(${n}, var(--cell-size))`;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      board.appendChild(buildCell(r, c));
    }
  }
}

function buildCell(r, c) {
  const n = S.gridSize;
  const { bh, bw } = S.spec;
  const val = S.board[r][c];
  const isGiven = S.given[r][c];

  const el = document.createElement('div');
  el.className = 'cell';
  el.dataset.r = r;
  el.dataset.c = c;

  // Inter-cell borders: hairline right/bottom except at box edges
  if (c < n - 1) el.classList.add(bw && (c + 1) % bw === 0 ? 'br' : 'thin-r');
  if (r < n - 1) el.classList.add(bh && (r + 1) % bh === 0 ? 'bb' : 'thin-b');

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
    if (S.cfg.pictures) el.innerHTML = shapeSVG(val);
    else el.textContent = val;
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

function sameBox(r1, c1, r2, c2) {
  const { bh, bw } = S.spec;
  return !!bh && Math.floor(r1 / bh) === Math.floor(r2 / bh) && Math.floor(c1 / bw) === Math.floor(c2 / bw);
}

// ── Highlights ─────────────────────────────────────────────────────────────
function applyHighlights() {
  document.querySelectorAll('.cell').forEach(el => {
    el.classList.remove('selected', 'same-num', 'related');
  });
  if (!S.selected) return;

  const { r, c } = S.selected;
  const selVal = S.board[r][c];

  document.querySelectorAll('.cell').forEach(el => {
    const er = +el.dataset.r;
    const ec = +el.dataset.c;

    if (er === r && ec === c) { el.classList.add('selected'); return; }

    if (er === r || ec === c || sameBox(r, c, er, ec)) el.classList.add('related');

    if (selVal !== 0 && +el.dataset.num === selVal) el.classList.add('same-num');
  });
}

// ── Cell Selection ─────────────────────────────────────────────────────────
function selectCell(r, c) {
  S.selected = { r, c };
  applyHighlights();
  renderNumpad();
}

// ── Rules ─────────────────────────────────────────────────────────────────
// Cells that already hold `v` in the same row, column or box as (r, c).
function clashesFor(r, c, v) {
  const out = [];
  const n = S.gridSize;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === r && j === c) continue;
    if (S.board[i][j] === v && (i === r || j === c || sameBox(r, c, i, j))) out.push({ r: i, c: j });
  }
  return out;
}

function legalAt(r, c) {
  const out = [];
  for (let v = 1; v <= S.gridSize; v++) if (!clashesFor(r, c, v).length) out.push(v);
  return out;
}

// Light up the clashing cells and the line (row / column / box) they share.
function flashClashes(r, c, clashes) {
  const n = S.gridSize;
  const line = new Set();
  for (const k of clashes) {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const inLine = (k.r === r && i === r) || (k.c === c && j === c) ||
        (k.r !== r && k.c !== c && sameBox(r, c, i, j));
      if (inLine) line.add(`${i},${j}`);
    }
  }
  const els = [];
  for (const key of line) {
    const [i, j] = key.split(',').map(Number);
    const el = cellEl(i, j); if (el) { el.classList.add('clash-line'); els.push(el); }
  }
  for (const k of clashes) {
    const el = cellEl(k.r, k.c); if (el) { el.classList.add('clash'); els.push(el); }
  }
  setTimeout(() => els.forEach(el => el.classList.remove('clash', 'clash-line')), 1100);
}

function animate(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

// ── Input ──────────────────────────────────────────────────────────────────
function inputNumber(num) {
  if (!S.selected || S.won) return;
  const { r, c } = S.selected;
  if (S.given[r][c]) return;
  if (num < 1 || num > S.gridSize) return;

  if (S.notesMode) {
    const ns = S.notes[r][c];
    ns.has(num) ? ns.delete(num) : ns.add(num);
    if (ns.size) S.board[r][c] = 0; // clear value when writing notes
    refreshCell(r, c);
    return;
  }

  // A repeat tap of the same button (a 5-year-old's double tap) is a no-op.
  if (S.board[r][c] === num) return;

  const correct = num === S.solved[r][c];
  const key = `${r},${c}`;
  clearTimeout(S.clearTimers[key]);

  // Kid modes never leave a wrong piece behind, so there is nothing to undo.
  if (correct || !S.cfg.autoClear) {
    S.history.push({ r, c, val: S.board[r][c], notes: new Set(S.notes[r][c]) });
  }

  S.notes[r][c].clear();
  S.board[r][c] = num;
  refreshCell(r, c);
  renderNumpad();

  const el = cellEl(r, c);
  if (!correct) {
    S.mistakes++;
    updateStats();
    animate(el, 'anim-shake');
    const clashes = clashesFor(r, c, num);
    if (clashes.length) flashClashes(r, c, clashes);
    if (S.cfg.autoClear) {
      S.clearTimers[key] = setTimeout(() => {
        if (S.board[r][c] !== num || S.won) return;
        S.board[r][c] = 0;
        refreshCell(r, c);
        renderNumpad();
      }, 1000);
    }
  } else {
    animate(el, 'anim-pop');
  }
  checkWin();
}

function eraseCell() {
  if (!S.selected || S.won) return;
  const { r, c } = S.selected;
  if (S.given[r][c]) return;
  if (S.board[r][c] === 0 && S.notes[r][c].size === 0) return;
  clearTimeout(S.clearTimers[`${r},${c}`]);
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
  if (S.gridSize !== 9) return;
  S.notesMode = !S.notesMode;
  document.getElementById('notes-btn').classList.toggle('active', S.notesMode);
}

function toggleHelp() {
  S.help = !S.help;
  document.getElementById('help-btn').classList.toggle('active', S.help);
  renderNumpad();
}

// ── Win Detection ──────────────────────────────────────────────────────────
// Any full board that obeys the rules wins (puzzles are generated unique, so
// in practice this is also the stored solution).
function checkWin() {
  const n = S.gridSize;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const v = S.board[r][c];
      if (!v || clashesFor(r, c, v).length) return;
    }

  S.won = true;
  clearInterval(S.timerInterval);
  Object.values(S.clearTimers).forEach(clearTimeout);
  setTimeout(showWin, 400);
}

function showWin() {
  const emojis  = { picture: '🌈', beginner: '🌟', junior: '🚀', easy: '🎉', medium: '🏆', hard: '👑' };
  const titles  = { picture: 'You did it!', beginner: 'Amazing Job!', junior: 'Great Solving!', easy: 'Puzzle Solved!', medium: 'Well Done!', hard: 'Expert Solver!' };
  document.getElementById('win-emoji').textContent = emojis[S.mode];
  document.getElementById('win-title').textContent = titles[S.mode];
  document.getElementById('win-time').textContent  = fmtTime(S.time);
  document.getElementById('win-mistakes').textContent = S.mistakes;
  document.querySelector('.win-stats-row').style.display = S.cfg.kid ? 'none' : '';
  document.getElementById('win-screen').classList.toggle('kid', S.cfg.kid);
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

  // Helper: for an empty, editable selected cell, glow the legal choices.
  let legal = null;
  if (S.help && S.selected && !S.notesMode) {
    const { r, c } = S.selected;
    if (!S.given[r][c] && S.board[r][c] === 0) legal = new Set(legalAt(r, c));
  }

  for (let num = 1; num <= n; num++) {
    const btn = document.createElement('button');
    btn.className = 'num-btn';
    if (S.cfg.pictures) {
      btn.innerHTML = shapeSVG(num);
      btn.setAttribute('aria-label', SHAPES[num - 1].name);
    } else {
      btn.textContent = num;
    }
    if (isComplete(num)) btn.classList.add('used');
    if (legal) btn.classList.add(legal.has(num) ? 'legal' : 'not-legal');
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

// In kid modes a tap anywhere on the win screen (bar "Change Mode") plays
// again, so a wobbly tap that misses the button still gets the next puzzle.
document.getElementById('win-screen').addEventListener('click', (e) => {
  if (!S.cfg || !S.cfg.kid || !S.won) return;
  if (e.target.closest('button')) return;
  newGame();
});

// ── Debug hooks (read-only, for play-testing) ─────────────────────────────
window.__sudoku = {
  state: () => ({
    mode: S.mode, gridSize: S.gridSize, won: S.won, mistakes: S.mistakes,
    filled: S.board ? S.board.flat().filter(Boolean).length : 0,
    total: S.gridSize ** 2, help: S.help, selected: S.selected && { ...S.selected },
  }),
  // Legal (rule-respecting) choices for every empty cell, using the real boxes.
  candidates: () => {
    const out = [];
    for (let r = 0; r < S.gridSize; r++) for (let c = 0; c < S.gridSize; c++)
      if (!S.board[r][c]) out.push({ r, c, cand: legalAt(r, c) });
    return out;
  },
  solution: () => clone2D(S.solved),
};

// ── Init ──────────────────────────────────────────────────────────────────
showScreen('mode-select');
