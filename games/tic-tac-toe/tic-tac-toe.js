'use strict';

const X = 'X';
const O = 'O';
const HUMAN = X;
const COMPUTER = O;
const MARK = { X: '❌', O: '⭕' };

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

let board = [];
let current = X;
let mode = 'two';        // 'two' | 'easy' | 'medium' | 'hard'
let gameOver = false;
let scores = { X: 0, O: 0, draw: 0 };

const boardEl = document.getElementById('board');
const turnBadge = document.getElementById('turn-badge');
const turnWho = document.getElementById('turn-who');
const turnMark = document.getElementById('turn-mark');
const turnLabel = document.getElementById('turn-label');
const winScreen = document.getElementById('win-screen');

// How long the winning line shows on the board before the overlay appears.
const WIN_LINE_MS = 1300;
const DRAW_MS = 900;
// Ignore backdrop taps right after the overlay appears so a stray tap that was
// aimed at the board does not skip the result.
const OVERLAY_GUARD_MS = 400;
let overlayShownAt = 0;
let endTimer = null;

function vsComputer() {
  return mode === 'easy' || mode === 'medium' || mode === 'hard';
}

function startGame(selectedMode) {
  mode = selectedMode;
  scores = { X: 0, O: 0, draw: 0 };
  updateScores();
  switchScreen('game-screen');
  newRound();
}

function newRound() {
  board = Array(9).fill('');
  current = X;
  gameOver = false;
  clearTimeout(endTimer);
  lockBoard(false);
  hideWin();
  renderBoard();
  updateTurnBadge();
}

function renderBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('button');
    cell.className = 'cell';
    cell.dataset.index = i;
    if (board[i]) {
      cell.textContent = MARK[board[i]];
      cell.classList.add('filled', 'mark-' + board[i].toLowerCase());
    }
    cell.addEventListener('click', () => handleMove(i));
    boardEl.appendChild(cell);
  }
}

function handleMove(i) {
  if (gameOver || board[i]) return;
  if (vsComputer() && current === COMPUTER) return;
  placeMark(i, current);

  if (checkEnd()) return;

  if (vsComputer()) {
    current = COMPUTER;
    updateTurnBadge();
    lockBoard(true);
    setTimeout(computerMove, 450);
  } else {
    current = current === X ? O : X;
    updateTurnBadge();
  }
}

function placeMark(i, mark) {
  board[i] = mark;
  const cell = boardEl.children[i];
  cell.textContent = MARK[mark];
  cell.classList.add('filled', 'pop', 'mark-' + mark.toLowerCase());
}

function computerMove() {
  if (gameOver) return;
  const move = mode === 'hard' ? bestMove() : mode === 'medium' ? mediumMove() : randomMove();
  placeMark(move, COMPUTER);
  lockBoard(false);
  if (checkEnd()) return;
  current = HUMAN;
  updateTurnBadge();
}

function randomMove() {
  const open = board.map((v, i) => (v ? null : i)).filter((v) => v !== null);
  return open[Math.floor(Math.random() * open.length)];
}

// A move that completes a line for `mark`, or null.
function finishingMove(mark) {
  for (const [a, b, c] of WIN_LINES) {
    const line = [board[a], board[b], board[c]];
    if (line.filter((v) => v === mark).length === 2 && line.includes('')) {
      return [a, b, c][line.indexOf('')];
    }
  }
  return null;
}

// Medium: usually takes a win, often blocks one, otherwise plays loosely.
// Beatable by a kid who sets up two threats, but punishes careless play.
function mediumMove() {
  const win = finishingMove(COMPUTER);
  if (win !== null && Math.random() < 0.85) return win;
  const block = finishingMove(HUMAN);
  if (block !== null && Math.random() < 0.6) return block;
  if (!board[4] && Math.random() < 0.5) return 4;
  return randomMove();
}

function bestMove() {
  let best = -Infinity;
  let move = null;
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = COMPUTER;
    const score = minimax(board, 0, false);
    board[i] = '';
    if (score > best) {
      best = score;
      move = i;
    }
  }
  return move;
}

function minimax(b, depth, isMax) {
  const winner = getWinner(b);
  if (winner === COMPUTER) return 10 - depth;
  if (winner === HUMAN) return depth - 10;
  if (b.every((c) => c)) return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = COMPUTER;
      best = Math.max(best, minimax(b, depth + 1, false));
      b[i] = '';
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = HUMAN;
      best = Math.min(best, minimax(b, depth + 1, true));
      b[i] = '';
    }
    return best;
  }
}

function getWinner(b) {
  for (const [a, c, d] of WIN_LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

function winningLine(b) {
  for (const line of WIN_LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return line;
  }
  return null;
}

function checkEnd() {
  const line = winningLine(board);
  if (line) {
    gameOver = true;
    const winner = board[line[0]];
    line.forEach((i) => boardEl.children[i].classList.add('win'));
    boardEl.classList.add('done');
    scores[winner]++;
    updateScores();
    showResultBadge(winner);
    lockBoard(true);
    endTimer = setTimeout(() => showWin(winner), WIN_LINE_MS);
    return true;
  }
  if (board.every((c) => c)) {
    gameOver = true;
    boardEl.classList.add('done');
    scores.draw++;
    updateScores();
    showResultBadge(null);
    lockBoard(true);
    endTimer = setTimeout(() => showWin(null), DRAW_MS);
    return true;
  }
  return false;
}

function lockBoard(locked) {
  boardEl.style.pointerEvents = locked ? 'none' : 'auto';
}

function setBadge(cls, who, mark, label) {
  turnBadge.className = 'turn-badge ' + cls;
  turnWho.textContent = who;
  turnMark.textContent = mark;
  turnLabel.textContent = label;
}

// Whose turn it is is shown by a big glowing X or O (plus a glow on that
// player's score box and the board edge), so a pre-reader does not need the
// words underneath.
function updateTurnBadge() {
  const cls = current === X ? 'turn-x' : 'turn-o';
  if (vsComputer()) {
    if (current === HUMAN) setBadge(cls, '👉', MARK[HUMAN], 'Your turn');
    else setBadge(cls + ' thinking', '🤖', MARK[COMPUTER], 'Computer thinking…');
  } else {
    setBadge(cls, '👉', MARK[current], MARK[current] + "'s turn");
  }
  document.getElementById('score-box-x').classList.toggle('active', current === X);
  document.getElementById('score-box-o').classList.toggle('active', current === O);
  boardEl.classList.remove('done');
  boardEl.dataset.turn = current;
}

function showResultBadge(winner) {
  document.getElementById('score-box-x').classList.toggle('active', winner === X);
  document.getElementById('score-box-o').classList.toggle('active', winner === O);
  if (winner === null) {
    setBadge('turn-draw', '🤝', '', 'Draw');
  } else if (vsComputer() && winner === COMPUTER) {
    setBadge('turn-o result', '🤖', MARK[winner], 'Computer wins');
  } else {
    setBadge((winner === X ? 'turn-x' : 'turn-o') + ' result', '🎉', MARK[winner],
      vsComputer() ? 'You win' : MARK[winner] + ' wins');
  }
}

function updateScores() {
  document.getElementById('score-x').textContent = scores.X;
  document.getElementById('score-o').textContent = scores.O;
  document.getElementById('score-draw').textContent = scores.draw;
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
    title.textContent = MARK[winner] + ' wins!';
  }
  overlayShownAt = performance.now();
  winScreen.classList.add('show');
}

function hideWin() {
  winScreen.classList.remove('show');
}

// A tap anywhere on the dim backdrop (not just the button) plays again.
winScreen.addEventListener('click', (e) => {
  if (e.target !== winScreen) return;
  if (performance.now() - overlayShownAt < OVERLAY_GUARD_MS) return;
  newRound();
});

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showModeSelect() {
  clearTimeout(endTimer);
  hideWin();
  switchScreen('mode-select');
}

window.startGame = startGame;
window.newRound = newRound;
window.showModeSelect = showModeSelect;

// Read-only state for play-test harnesses.
window.__ttt = {
  get state() {
    return { mode, current, gameOver, board: board.slice(), scores: { ...scores },
      overlay: winScreen.classList.contains('show') };
  },
};
