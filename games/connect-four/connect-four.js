'use strict';

const ROWS = 6;
const COLS = 7;
const RED = 'R';      // player 1 / human
const YELLOW = 'Y';   // player 2 / computer
const HUMAN = RED;
const COMPUTER = YELLOW;
const NAME = { R: 'Red', Y: 'Yellow' };
const DOT = { R: '🔴', Y: '🟡' };

let board = [];        // board[row][col], row 0 = top
let current = RED;
let mode = 'two';
let busy = false;
let gameOver = false;
let scores = { R: 0, Y: 0 };
let hoverCol = -1;
let robotStreak = 0;
let roundId = 0;       // bumps on every new round so stale timers do nothing   // Easy: rounds the robot has won in a row (it gets sleepier)     // column the finger / mouse / keyboard is aiming at

const boardEl = document.getElementById('board');
const dropRowEl = document.getElementById('drop-row');
const turnBadge = document.getElementById('turn-badge');
const boardWrap = document.getElementById('board-wrap');
const highlightEl = document.getElementById('col-highlight');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function vsComputer() {
  return mode === 'easy' || mode === 'medium' || mode === 'hard';
}

function startGame(selectedMode) {
  mode = selectedMode;
  scores = { R: 0, Y: 0 };
  robotStreak = 0;
  updateScores();
  switchScreen('game-screen');
  buildBoard();
  newRound();
}

// Taps are handled for the whole board area at once (see pointer handling
// below), so the drop arrows and slots are just pictures — no listeners.
function buildBoard() {
  boardEl.querySelectorAll('.slot').forEach((s) => s.remove());
  dropRowEl.innerHTML = '';
  for (let c = 0; c < COLS; c++) {
    const cell = document.createElement('div');
    cell.className = 'drop-btn';
    cell.dataset.col = c;
    cell.innerHTML = '<span class="drop-arrow">▼</span><span class="ghost-disc"></span>';
    dropRowEl.appendChild(cell);
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.row = r;
      slot.dataset.col = c;
      boardEl.appendChild(slot);
    }
  }
}

function newRound() {
  roundId++;
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
  current = RED;
  gameOver = false;
  busy = false;
  hideWin();
  clearDiscs();
  disarmAll();
  setHover(-1);
  updateDropButtons();
  updateTurnBadge();
}

function clearDiscs() {
  for (const slot of boardEl.querySelectorAll('.slot')) {
    slot.innerHTML = '';
    slot.classList.remove('win');
  }
}

function slotEl(r, c) {
  return boardEl.querySelectorAll('.slot')[r * COLS + c];
}

function lowestEmptyRow(b, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!b[r][col]) return r;
  }
  return -1;
}

function canPlay() {
  return !busy && !gameOver && !(vsComputer() && current === COMPUTER);
}

function handleDrop(col) {
  if (col < 0 || gameOver) return;
  if (!canPlay()) { nudgeBadge(); return; }
  if (lowestEmptyRow(board, col) === -1) { refuseColumn(col); return; }
  dropDisc(col, current, () => afterMove());
}

function dropDisc(col, color, done) {
  const row = lowestEmptyRow(board, col);
  if (row === -1) return;
  board[row][col] = color;
  busy = true;
  const round = roundId;
  const finish = () => {
    if (round !== roundId || !busy) return;
    busy = false;
    done();
  };
  const disc = document.createElement('div');
  disc.className = 'disc ' + (color === RED ? 'red' : 'yellow') + ' drop';
  disc.style.setProperty('--fall-rows', row + 1);
  slotEl(row, col).appendChild(disc);
  updateGhost();
  disc.addEventListener('animationend', finish, { once: true });
  // Fallback in case animationend doesn't fire
  setTimeout(finish, 500);
}

function afterMove() {
  const line = winningLine(board);
  if (line) return endRound(current, line);
  if (isFull(board)) return endRound(null, null);

  if (vsComputer()) {
    if (current === HUMAN) {
      current = COMPUTER;
      updateTurnBadge();
      updateDropButtons();
      const round = roundId;
      setTimeout(() => { if (round === roundId) computerMove(); }, 400);
    } else {
      current = HUMAN;
      updateTurnBadge();
      updateDropButtons();
    }
  } else {
    current = current === RED ? YELLOW : RED;
    updateTurnBadge();
    updateDropButtons();
  }
}

function computerMove() {
  if (gameOver) return;
  const col = mode === 'hard' ? bestColumn(5)
    : mode === 'medium' ? easyColumn(1, 1)
    : easyColumn(...easySkill());
  dropDisc(col, COMPUTER, () => afterMove());
}

/* ── Easy / Medium AI: win if possible, block if needed, else weighted random.
   Easy only *sometimes* spots a win or a block, so a 5-year-old can beat it;
   Medium always does (this was the old Easy). ── */
// Easy spots its own win 40% of the time and a block 15%, and otherwise
// plays any column. After it wins a round it gets sleepier, and after two in
// a row it stops looking for wins at all. Tuned by simulation against a kid
// tapping columns at random: ~33% kid wins fresh, ~50% after one loss, ~55%
// after two (the old Easy, now Medium, let that kid win 3%).
const EASY_SKILL = [[0.4, 0.15], [0.15, 0.05], [0, 0]];
function easySkill() {
  const [win, block] = EASY_SKILL[Math.min(robotStreak, EASY_SKILL.length - 1)];
  return [win, block, 0];
}

function easyColumn(winChance = 1, blockChance = 1, centerPull = 1) {
  const valid = validColumns(board);
  if (Math.random() < winChance) {
    for (const c of valid) if (wouldWin(board, c, COMPUTER)) return c;
  }
  if (Math.random() < blockChance) {
    for (const c of valid) if (wouldWin(board, c, HUMAN)) return c;
  }
  // Prefer center-ish columns (centerPull 0 = any column equally likely)
  const weights = valid.map((c) => ({ c, w: 1 + centerPull * (3 - Math.abs(c - 3)) }));
  const total = weights.reduce((s, x) => s + x.w, 0);
  let pick = Math.random() * total;
  for (const { c, w } of weights) {
    pick -= w;
    if (pick <= 0) return c;
  }
  return valid[0];
}

/* ── Hard AI: minimax with alpha-beta ── */
function bestColumn(depth) {
  const valid = validColumns(board);
  // Immediate win / block shortcuts
  for (const c of valid) if (wouldWin(board, c, COMPUTER)) return c;
  for (const c of valid) if (wouldWin(board, c, HUMAN)) return c;

  let bestScore = -Infinity;
  let bestCols = [];
  for (const c of valid) {
    const r = lowestEmptyRow(board, c);
    board[r][c] = COMPUTER;
    const score = minimax(board, depth - 1, -Infinity, Infinity, false);
    board[r][c] = '';
    if (score > bestScore) {
      bestScore = score;
      bestCols = [c];
    } else if (score === bestScore) {
      bestCols.push(c);
    }
  }
  return bestCols[Math.floor(Math.random() * bestCols.length)];
}

function minimax(b, depth, alpha, beta, maximizing) {
  const line = winningLine(b);
  if (line) {
    const winner = b[line[0][0]][line[0][1]];
    return winner === COMPUTER ? 100000 + depth : -100000 - depth;
  }
  if (isFull(b)) return 0;
  if (depth === 0) return evaluate(b);

  const valid = validColumns(b);
  if (maximizing) {
    let best = -Infinity;
    for (const c of valid) {
      const r = lowestEmptyRow(b, c);
      b[r][c] = COMPUTER;
      best = Math.max(best, minimax(b, depth - 1, alpha, beta, false));
      b[r][c] = '';
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const c of valid) {
      const r = lowestEmptyRow(b, c);
      b[r][c] = HUMAN;
      best = Math.min(best, minimax(b, depth - 1, alpha, beta, true));
      b[r][c] = '';
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }
}

function evaluate(b) {
  let score = 0;
  // Center column preference
  for (let r = 0; r < ROWS; r++) {
    if (b[r][3] === COMPUTER) score += 3;
    else if (b[r][3] === HUMAN) score -= 3;
  }
  for (const window of allWindows(b)) {
    score += scoreWindow(window);
  }
  return score;
}

function scoreWindow(w) {
  const comp = w.filter((x) => x === COMPUTER).length;
  const human = w.filter((x) => x === HUMAN).length;
  const empty = w.filter((x) => x === '').length;
  if (comp > 0 && human > 0) return 0;
  if (comp === 3 && empty === 1) return 50;
  if (comp === 2 && empty === 2) return 10;
  if (human === 3 && empty === 1) return -60;
  if (human === 2 && empty === 2) return -10;
  return 0;
}

function allWindows(b) {
  const windows = [];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of dirs) {
        const cells = [];
        for (let k = 0; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) { cells.length = 0; break; }
          cells.push(b[nr][nc]);
        }
        if (cells.length === 4) windows.push(cells);
      }
    }
  }
  return windows;
}

function validColumns(b) {
  const cols = [];
  for (let c = 0; c < COLS; c++) if (!b[0][c]) cols.push(c);
  return cols;
}

function wouldWin(b, col, color) {
  const r = lowestEmptyRow(b, col);
  if (r === -1) return false;
  b[r][col] = color;
  const win = winningLine(b) !== null;
  b[r][col] = '';
  return win;
}

function isFull(b) {
  return b[0].every((c) => c);
}

function winningLine(b) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const color = b[r][c];
      if (!color) continue;
      for (const [dr, dc] of dirs) {
        const cells = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[nr][nc] !== color) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return null;
}

function endRound(winner, line) {
  gameOver = true;
  updateDropButtons();
  if (line) line.forEach(([r, c]) => slotEl(r, c).classList.add('win'));
  if (winner) {
    scores[winner]++;
    updateScores();
  }
  if (vsComputer()) robotStreak = winner === COMPUTER ? robotStreak + 1 : 0;
  setTimeout(() => showWin(winner), line ? 650 : 300);
}

function updateDropButtons() {
  const interactive = !gameOver && !(vsComputer() && current === COMPUTER);
  for (let c = 0; c < COLS; c++) {
    const btn = dropRowEl.children[c];
    const playable = interactive && lowestEmptyRow(board, c) !== -1;
    btn.classList.toggle('show', playable);
  }
  dropRowEl.dataset.color = current === RED ? 'red' : 'yellow';
  updateGhost();
}

function updateTurnBadge() {
  turnBadge.classList.toggle('red-turn', current === RED);
  turnBadge.classList.toggle('yellow-turn', current === YELLOW);
  if (vsComputer()) {
    turnBadge.textContent = current === HUMAN
      ? DOT[HUMAN] + ' Your turn'
      : '🤖 ' + DOT[COMPUTER] + ' thinking…';
  } else {
    turnBadge.textContent = DOT[current] + ' ' + NAME[current] + "'s turn";
  }
}

/* ── Aiming: ghost disc over the column + landing-spot preview ── */
function setHover(col) {
  hoverCol = col;
  updateGhost();
}

function updateGhost() {
  const active = hoverCol >= 0 && canPlay();
  const row = active ? lowestEmptyRow(board, hoverCol) : -1;
  for (let c = 0; c < COLS; c++) {
    dropRowEl.children[c]?.classList.toggle('aim', active && c === hoverCol && row !== -1);
  }
  boardEl.querySelectorAll('.slot.preview').forEach((s) => s.classList.remove('preview', 'red', 'yellow'));
  if (active) {
    highlightEl.style.setProperty('--col', hoverCol);
    highlightEl.classList.add('show');
    if (row !== -1) slotEl(row, hoverCol).classList.add('preview', current === RED ? 'red' : 'yellow');
  } else {
    highlightEl.classList.remove('show');
  }
}

function refuseColumn(col) {
  highlightEl.style.setProperty('--col', col);
  highlightEl.classList.remove('nope');
  void highlightEl.offsetWidth; // restart the shake animation
  highlightEl.classList.add('show', 'nope');
  setTimeout(() => highlightEl.classList.remove('nope'), 400);
}

function nudgeBadge() {
  turnBadge.classList.remove('nudge');
  void turnBadge.offsetWidth;
  turnBadge.classList.add('nudge');
}

/* Which column is page-x nearest to? Every x maps to a column, so the gaps
   between holes and the board edges all count — no dead zones. */
function colFromX(x) {
  const top = boardEl.querySelectorAll('.slot');
  let best = -1;
  let bestDist = Infinity;
  for (let c = 0; c < COLS; c++) {
    const r = top[c].getBoundingClientRect();
    const d = Math.abs(x - (r.left + r.width / 2));
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

/* Touch-down aims, sliding re-aims, lifting drops. A finger released well
   outside the board cancels, so an older kid can change their mind. */
let activePointer = null;
const CANCEL_MARGIN = 60;

boardWrap.addEventListener('pointerdown', (e) => {
  if (activePointer !== null) return; // ignore a second finger / palm
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  activePointer = e.pointerId;
  try { boardWrap.setPointerCapture(e.pointerId); } catch {}
  if (!canPlay()) { if (!gameOver) nudgeBadge(); return; }
  setHover(colFromX(e.clientX));
});

boardWrap.addEventListener('pointermove', (e) => {
  if (activePointer !== null && e.pointerId !== activePointer) return;
  if (activePointer === null && e.pointerType !== 'mouse') return;
  if (!canPlay()) return;
  setHover(colFromX(e.clientX));
});

boardWrap.addEventListener('pointerup', (e) => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  const r = boardWrap.getBoundingClientRect();
  const outside = e.clientX < r.left - CANCEL_MARGIN || e.clientX > r.right + CANCEL_MARGIN
    || e.clientY < r.top - CANCEL_MARGIN || e.clientY > r.bottom + CANCEL_MARGIN;
  if (outside) { setHover(-1); return; }
  const col = canPlay() ? colFromX(e.clientX) : -1;
  if (col >= 0) handleDrop(col);
  if (e.pointerType !== 'mouse') setHover(-1);
  else updateGhost();
});

boardWrap.addEventListener('pointercancel', (e) => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  setHover(-1);
});

boardWrap.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse' && activePointer === null) setHover(-1);
});

/* ── Keyboard: ←/→ aim, ↓ / Space / Enter drop ── */
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('game-screen').classList.contains('active')) return;
  const winShown = document.getElementById('win-screen').classList.contains('show');
  if (winShown) {
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.tagName !== 'BUTTON') {
      e.preventDefault();
      newRound();
    }
    return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd') {
    e.preventDefault();
    const dir = (e.key === 'ArrowLeft' || e.key === 'a') ? -1 : 1;
    const start = hoverCol < 0 ? 3 : Math.max(0, Math.min(COLS - 1, hoverCol + dir));
    setHover(start);
  } else if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter' || e.key === 's') {
    e.preventDefault();
    handleDrop(hoverCol < 0 ? 3 : hoverCol);
  }
});

/* ── Back / New Round: mid-game they need a second tap, so a stray tap from
   a small hand can't wipe the board. The armed button turns orange and
   wiggles; the second tap within 3 s goes through. ── */
const ARM_MS = 3000;
function gameInProgress() {
  return !gameOver && board.some((row) => row.some(Boolean));
}

function disarmAll() {
  document.querySelectorAll('.icon-btn.armed').forEach((b) => {
    b.classList.remove('armed');
    clearTimeout(b._armTimer);
  });
}

function guarded(btn, action) {
  btn.addEventListener('click', () => {
    if (!gameInProgress() || btn.classList.contains('armed')) {
      disarmAll();
      action();
      return;
    }
    disarmAll();
    btn.classList.add('armed');
    btn._armTimer = setTimeout(() => btn.classList.remove('armed'), ARM_MS);
  });
}
guarded(document.getElementById('back-btn'), () => showModeSelect());
guarded(document.getElementById('restart-btn'), () => newRound());

function updateScores() {
  document.getElementById('score-red').textContent = scores.R;
  document.getElementById('score-yellow').textContent = scores.Y;
}

function showWin(winner) {
  const emoji = document.getElementById('win-emoji');
  const title = document.getElementById('win-title');
  if (winner === null) {
    emoji.textContent = '🤝';
    title.textContent = "It's a draw!";
  } else if (vsComputer()) {
    if (winner === HUMAN) {
      emoji.textContent = '🎉';
      title.textContent = 'You win!';
    } else {
      emoji.textContent = '🤖';
      title.textContent = 'Computer wins!';
    }
  } else {
    emoji.textContent = '🎉';
    title.textContent = DOT[winner] + ' ' + NAME[winner] + ' wins!';
  }
  document.getElementById('win-screen').classList.add('show');
  const celebrate = winner !== null && (!vsComputer() || winner === HUMAN);
  if (celebrate) confetti(winner);
}

function confetti(winner) {
  const box = document.getElementById('confetti');
  box.innerHTML = '';
  if (reduceMotion) return;
  const colors = winner === RED ? ['red', 'red', 'yellow'] : ['yellow', 'yellow', 'red'];
  for (let i = 0; i < 36; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-disc ' + colors[i % colors.length];
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = (Math.random() * 0.8).toFixed(2) + 's';
    p.style.animationDuration = (1.8 + Math.random() * 1.4).toFixed(2) + 's';
    p.style.setProperty('--size', (14 + Math.random() * 18).toFixed(0) + 'px');
    p.style.setProperty('--drift', ((Math.random() - 0.5) * 160).toFixed(0) + 'px');
    box.appendChild(p);
  }
}

function hideWin() {
  document.getElementById('win-screen').classList.remove('show');
  document.getElementById('confetti').innerHTML = '';
}

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showModeSelect() {
  hideWin();
  disarmAll();
  switchScreen('mode-select');
}

window.startGame = startGame;
window.newRound = newRound;
window.showModeSelect = showModeSelect;

// Read-only debug hook for play-test scripts.
window.__c4 = {
  get state() {
    return {
      mode, current, busy, gameOver, hoverCol, scores: { ...scores },
      board: board.map((r) => r.slice()),
      canPlay: canPlay(),
      robotStreak,
      easySkill: easySkill(),
    };
  },
  colFromX,
};
