// Each level is a binary tree of nodes.
// Types: 'fork' (choice point), 'home' (win), 'dead' (funny dead end)
// The correct path is randomized at runtime by swapping left/right children.

const DEAD_ENDS = [
  { label: "A Cat's Bed", emoji: '🐱' },
  { label: 'Inside a Shoe', emoji: '👟' },
  { label: 'A Puddle', emoji: '💧' },
  { label: 'A Bookshelf', emoji: '📚' },
  { label: 'A Flower Pot', emoji: '🌷' },
  { label: "A Bird's Nest", emoji: '🐦' },
  { label: 'A Teacup', emoji: '🍵' },
  { label: 'A Dog Bowl', emoji: '🐶' },
  { label: 'A Washing Machine', emoji: '🫧' },
  { label: 'A Toy Box', emoji: '🧸' },
  { label: 'A Frying Pan', emoji: '🍳' },
  { label: 'A Fish Tank', emoji: '🐠' },
  { label: 'A Piano', emoji: '🎹' },
  { label: 'A Mailbox', emoji: '📬' },
  { label: 'A Bathtub', emoji: '🛁' },
]

let deadEndIdx = 0
function nextDead() {
  const d = DEAD_ENDS[deadEndIdx % DEAD_ENDS.length]
  deadEndIdx++
  return { type: 'dead', label: d.label, emoji: d.emoji }
}

function home() {
  return { type: 'home' }
}

function fork(left, right) {
  return { type: 'fork', left, right }
}

function resetDeadIdx() {
  deadEndIdx = 0
}

// Build level trees. Convention: home() is always the "correct" answer
// before randomization. randomizePath() will shuffle it.
function buildLevels() {
  resetDeadIdx()

  return [
    // Level 1: 1 fork, 2 endpoints
    fork(home(), nextDead()),

    // Level 2: 2 forks, 3 endpoints
    fork(
      fork(home(), nextDead()),
      nextDead()
    ),

    // Level 3: 2 forks, 3 endpoints
    fork(
      nextDead(),
      fork(nextDead(), home())
    ),

    // Level 4: 3 forks, 4 endpoints
    fork(
      fork(home(), nextDead()),
      fork(nextDead(), nextDead())
    ),

    // Level 5: 3 forks, 4 endpoints
    fork(
      fork(nextDead(), nextDead()),
      fork(home(), nextDead())
    ),

    // Level 6: 3 forks, 4 endpoints
    fork(
      fork(nextDead(), fork(home(), nextDead())),
      nextDead()
    ),

    // Level 7: 4 forks, 5 endpoints
    fork(
      fork(nextDead(), fork(home(), nextDead())),
      fork(nextDead(), nextDead())
    ),

    // Level 8: 4 forks, 5 endpoints
    fork(
      fork(fork(nextDead(), nextDead()), nextDead()),
      fork(nextDead(), home())
    ),

    // Level 9: 5 forks, 6 endpoints
    fork(
      fork(fork(home(), nextDead()), fork(nextDead(), nextDead())),
      fork(nextDead(), nextDead())
    ),

    // Level 10: 5 forks, 6 endpoints
    fork(
      fork(nextDead(), fork(nextDead(), nextDead())),
      fork(fork(nextDead(), home()), nextDead())
    ),
  ]
}

// Deep clone a tree node
function cloneTree(node) {
  if (!node) return null
  const n = { ...node }
  if (n.left) n.left = cloneTree(n.left)
  if (n.right) n.right = cloneTree(n.right)
  return n
}

// Randomize which child is left vs right at every fork
function randomizePath(node) {
  if (!node || node.type !== 'fork') return node
  if (Math.random() < 0.5) {
    const tmp = node.left
    node.left = node.right
    node.right = tmp
  }
  randomizePath(node.left)
  randomizePath(node.right)
  return node
}

export const LEVELS = buildLevels()

export function getLevelTree(index) {
  const tree = cloneTree(LEVELS[index])
  return randomizePath(tree)
}

export function getLevelForkCount(index) {
  function countForks(node) {
    if (!node || node.type !== 'fork') return 0
    return 1 + countForks(node.left) + countForks(node.right)
  }
  return countForks(LEVELS[index])
}
