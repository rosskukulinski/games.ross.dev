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
let mode = 'two';        // 'two' | 'easy' | 'hard'
let gameOver = false;
let scores = { X: 0, O: 0, draw: 0 };

const boardEl = document.getElementById('board');
const turnBadge = document.getElementById('turn-badge');

function vsComputer() {
  return mode === 'easy' || mode === 'hard';
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
      cell.classList.add('filled');
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
  cell.classList.add('filled', 'pop');
}

function computerMove() {
  if (gameOver) return;
  const move = mode === 'hard' ? bestMove() : randomMove();
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
    scores[winner]++;
    updateScores();
    setTimeout(() => showWin(winner), 700);
    return true;
  }
  if (board.every((c) => c)) {
    gameOver = true;
    scores.draw++;
    updateScores();
    setTimeout(() => showWin(null), 400);
    return true;
  }
  return false;
}

function lockBoard(locked) {
  boardEl.style.pointerEvents = locked ? 'none' : 'auto';
}

function updateTurnBadge() {
  if (vsComputer()) {
    turnBadge.textContent = current === HUMAN ? 'Your turn ' + MARK[HUMAN] : 'Computer thinking… ' + MARK[COMPUTER];
  } else {
    turnBadge.textContent = MARK[current] + "'s turn";
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
