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

const boardEl = document.getElementById('board');
const dropRowEl = document.getElementById('drop-row');
const turnBadge = document.getElementById('turn-badge');

function vsComputer() {
  return mode === 'easy' || mode === 'hard';
}

function startGame(selectedMode) {
  mode = selectedMode;
  scores = { R: 0, Y: 0 };
  updateScores();
  switchScreen('game-screen');
  buildBoard();
  newRound();
}

function buildBoard() {
  boardEl.innerHTML = '';
  dropRowEl.innerHTML = '';
  for (let c = 0; c < COLS; c++) {
    const btn = document.createElement('button');
    btn.className = 'drop-btn';
    btn.textContent = '⬇️';
    btn.addEventListener('click', () => handleDrop(c));
    dropRowEl.appendChild(btn);
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.row = r;
      slot.dataset.col = c;
      slot.addEventListener('click', () => handleDrop(c));
      boardEl.appendChild(slot);
    }
  }
}

function newRound() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
  current = RED;
  gameOver = false;
  busy = false;
  hideWin();
  clearDiscs();
  updateDropButtons();
  updateTurnBadge();
}

function clearDiscs() {
  for (const slot of boardEl.children) {
    slot.innerHTML = '';
    slot.classList.remove('win');
  }
}

function slotEl(r, c) {
  return boardEl.children[r * COLS + c];
}

function lowestEmptyRow(b, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!b[r][col]) return r;
  }
  return -1;
}

function handleDrop(col) {
  if (busy || gameOver) return;
  if (vsComputer() && current === COMPUTER) return;
  if (lowestEmptyRow(board, col) === -1) return;
  dropDisc(col, current, () => afterMove());
}

function dropDisc(col, color, done) {
  const row = lowestEmptyRow(board, col);
  if (row === -1) return;
  board[row][col] = color;
  busy = true;
  const disc = document.createElement('div');
  disc.className = 'disc ' + (color === RED ? 'red' : 'yellow') + ' drop';
  slotEl(row, col).appendChild(disc);
  disc.addEventListener('animationend', function handler() {
    disc.removeEventListener('animationend', handler);
    busy = false;
    done();
  }, { once: true });
  // Fallback in case animationend doesn't fire
  setTimeout(() => { if (busy) { busy = false; done(); } }, 500);
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
      setTimeout(computerMove, 400);
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
  const col = mode === 'hard' ? bestColumn(5) : easyColumn();
  dropDisc(col, COMPUTER, () => afterMove());
}

/* ── Easy AI: win if possible, block if needed, else weighted random ── */
function easyColumn() {
  const valid = validColumns(board);
  for (const c of valid) {
    if (wouldWin(board, c, COMPUTER)) return c;
  }
  for (const c of valid) {
    if (wouldWin(board, c, HUMAN)) return c;
  }
  // Prefer center-ish columns
  const weights = valid.map((c) => ({ c, w: 4 - Math.abs(c - 3) }));
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
  setTimeout(() => showWin(winner), line ? 650 : 300);
}

function updateDropButtons() {
  const interactive = !gameOver && !(vsComputer() && current === COMPUTER);
  for (let c = 0; c < COLS; c++) {
    const btn = dropRowEl.children[c];
    const playable = interactive && lowestEmptyRow(board, c) !== -1;
    btn.classList.toggle('show', playable);
  }
}

function updateTurnBadge() {
  if (vsComputer()) {
    turnBadge.textContent = current === HUMAN
      ? 'Your turn ' + DOT[HUMAN]
      : 'Computer thinking… ' + DOT[COMPUTER];
  } else {
    turnBadge.textContent = DOT[current] + " " + NAME[current] + "'s turn";
  }
}

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

window.startGame = startGame;
window.newRound = newRound;
window.showModeSelect = showModeSelect;
