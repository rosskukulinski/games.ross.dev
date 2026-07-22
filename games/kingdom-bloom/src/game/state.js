// Kingdom Bloom — game state: reducer, save/load, order generation.

import {
  CHAINS, GENERATORS, CHAPTERS, CHARACTERS, PROLOGUE, FINALE,
  COLS, CELL_COUNT, SELL_VALUE, spotById, chapterOfSpot,
} from './data.js';

export const MAX_ENERGY = 100;
export const REGEN_MS = 5000; // 1 energy every 5 seconds
export const ENERGY_PACK = { cost: 60, amount: 40 };
const ORDER_COUNT = 3;
const SAVE_KEY = 'kingdom-bloom-v1';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mkToast = (text) => ({ text, id: Date.now() + Math.random() });
const withToast = (state, text) => ({ ...state, toast: mkToast(text) });

// --- Orders ---

function unlockedChains(restoredCount) {
  return Object.values(GENERATORS)
    .filter((g) => g.unlockAt <= restoredCount)
    .map((g) => g.chain);
}

function rollTier(restoredCount) {
  const maxTier = restoredCount >= 9 ? 5 : restoredCount >= 4 ? 4 : 3;
  const r = Math.random();
  const tier = r < 0.45 ? 2 : r < 0.85 ? 3 : r < 0.97 ? 4 : 5;
  return Math.min(tier, maxTier);
}

function makeOrder(state) {
  const chains = unlockedChains(state.restored.length);
  const twoItems = state.restored.length >= 3 && Math.random() < 0.45;
  const items = [];
  for (let i = 0; i < (twoItems ? 2 : 1); i++) {
    items.push({ chain: pick(chains), tier: rollTier(state.restored.length) });
  }
  const coins = items.reduce((sum, it) => sum + 4 * 2 ** (it.tier - 1) + 6, 0);
  const stars = 1
    + (items.some((it) => it.tier >= 4) ? 1 : 0)
    + (items.some((it) => it.tier === 5) ? 1 : 0);
  return { id: state.orderSeq, who: pick(Object.keys(CHARACTERS)), items, coins, stars };
}

// Greedy multiset match: returns board indices covering every requested item, or null.
export function findOrderItems(board, items) {
  const used = [];
  for (const req of items) {
    const idx = board.findIndex((c, i) =>
      c && c.kind === 'item' && c.chain === req.chain && c.tier === req.tier && !used.includes(i));
    if (idx < 0) return null;
    used.push(idx);
  }
  return used;
}

// Which requested items are currently on the board (for the ✓/✗ display).
export function orderProgress(board, items) {
  const used = [];
  return items.map((req) => {
    const idx = board.findIndex((c, i) =>
      c && c.kind === 'item' && c.chain === req.chain && c.tier === req.tier && !used.includes(i));
    if (idx >= 0) { used.push(idx); return true; }
    return false;
  });
}

// --- Board helpers ---

function nearestEmpty(board, fromIdx) {
  const fr = Math.floor(fromIdx / COLS);
  const fc = fromIdx % COLS;
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < board.length; i++) {
    if (board[i]) continue;
    const d = Math.abs(Math.floor(i / COLS) - fr) + Math.abs((i % COLS) - fc);
    const jitter = Math.random() * 0.5; // break ties randomly so spawns spread out
    if (d + jitter < bestDist) { bestDist = d + jitter; best = i; }
  }
  return best;
}

// Place any generators waiting for a free cell (unlocked while board was full).
function placePending(state) {
  if (!state.pendingGens.length) return state;
  const board = state.board.slice();
  const remaining = [];
  let nextId = state.nextId;
  let placedName = null;
  for (const key of state.pendingGens) {
    const empty = board.findIndex((c) => !c);
    if (empty < 0) { remaining.push(key); continue; }
    board[empty] = { id: nextId++, kind: 'gen', gen: key };
    placedName = GENERATORS[key].name;
  }
  if (nextId === state.nextId) return { ...state, pendingGens: remaining };
  return {
    ...state, board, nextId, pendingGens: remaining,
    toast: placedName ? mkToast(`${placedName} joined your Workshop! ✨`) : state.toast,
  };
}

// --- Energy ---

function applyEnergyRegen(state) {
  const now = Date.now();
  if (state.energy >= MAX_ENERGY) {
    return now - state.lastEnergyTs > REGEN_MS ? { ...state, lastEnergyTs: now } : state;
  }
  const gained = Math.floor((now - state.lastEnergyTs) / REGEN_MS);
  if (gained <= 0) return state;
  const energy = Math.min(MAX_ENERGY, state.energy + gained);
  const lastEnergyTs = energy >= MAX_ENERGY ? now : state.lastEnergyTs + gained * REGEN_MS;
  return { ...state, energy, lastEnergyTs };
}

// --- Init / persistence ---

export function initialState() {
  const board = Array(CELL_COUNT).fill(null);
  let id = 1;
  const put = (idx, cell) => { board[idx] = { id: id++, ...cell }; };
  put(3 * COLS + 2, { kind: 'gen', gen: 'sapling' });
  put(3 * COLS + 4, { kind: 'gen', gen: 'sunwell' });
  put(4 * COLS + 1, { kind: 'item', chain: 'flora', tier: 1 });
  put(4 * COLS + 5, { kind: 'item', chain: 'flora', tier: 1 });
  put(5 * COLS + 2, { kind: 'item', chain: 'light', tier: 1 });
  put(5 * COLS + 4, { kind: 'item', chain: 'light', tier: 1 });

  const base = {
    version: 1,
    board,
    nextId: id,
    energy: MAX_ENERGY,
    lastEnergyTs: Date.now(),
    coins: 30,
    stars: 0,
    orders: [],
    orderSeq: 1,
    restored: [],
    pendingGens: [],
    dialogueQueue: [...PROLOGUE, ...CHAPTERS[0].intro],
    selected: null,
    toast: null,
    fx: null,
  };
  for (let i = 0; i < ORDER_COUNT; i++) {
    base.orders.push(makeOrder(base));
    base.orderSeq++;
  }
  return base;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.version === 1 && Array.isArray(saved.board)) {
        return applyEnergyRegen({ ...saved, selected: null, toast: null, fx: null });
      }
    }
  } catch { /* corrupted save — start fresh */ }
  return initialState();
}

export function saveState(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* storage full/blocked */ }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

// --- Reducer ---

export function reducer(state, action) {
  switch (action.type) {
    case 'TICK':
      return applyEnergyRegen(state);

    case 'TAP_GEN': {
      const cell = state.board[action.idx];
      if (!cell || cell.kind !== 'gen') return state;
      const s = applyEnergyRegen(state);
      if (s.energy <= 0) return withToast(s, 'Out of energy! ⚡ refills over time.');
      const target = nearestEmpty(s.board, action.idx);
      if (target < 0) return withToast(s, 'The board is full! Merge or sell something first.');
      const gen = GENERATORS[cell.gen];
      const r = Math.random();
      const tier = r < 0.74 ? 1 : r < 0.95 ? 2 : 3;
      const board = s.board.slice();
      board[target] = { id: s.nextId, kind: 'item', chain: gen.chain, tier };
      return {
        ...s, board, nextId: s.nextId + 1, energy: s.energy - 1,
        fx: { type: 'spawn', idx: target, ts: Date.now() },
      };
    }

    case 'MOVE': {
      const { from, to } = action;
      if (from === to || to < 0 || to >= CELL_COUNT) return state;
      const a = state.board[from];
      const b = state.board[to];
      if (!a) return state;
      const board = state.board.slice();
      if (!b) {
        board[to] = a;
        board[from] = null;
        return { ...state, board, selected: null };
      }
      const maxTier = a.kind === 'item' ? CHAINS[a.chain].tiers.length : 0;
      if (a.kind === 'item' && b.kind === 'item' && a.chain === b.chain && a.tier === b.tier && a.tier < maxTier) {
        board[to] = { id: state.nextId, kind: 'item', chain: a.chain, tier: a.tier + 1 };
        board[from] = null;
        const next = { ...state, board, nextId: state.nextId + 1, selected: null, fx: { type: 'merge', idx: to, ts: Date.now() } };
        if (a.tier + 1 === maxTier) {
          next.toast = mkToast(`${CHAINS[a.chain].tiers[a.tier].n}! Top of the chain! 🎉`);
        }
        return placePending(next);
      }
      board[to] = a;
      board[from] = b;
      return { ...state, board, selected: null };
    }

    case 'SELECT':
      return { ...state, selected: state.selected === action.idx ? null : action.idx };

    case 'SELL': {
      const cell = state.board[action.idx];
      if (!cell || cell.kind !== 'item') return state;
      const board = state.board.slice();
      board[action.idx] = null;
      const value = SELL_VALUE[cell.tier - 1];
      return placePending({
        ...state, board, coins: state.coins + value, selected: null,
        toast: mkToast(`Sold for ${value} 🪙`),
      });
    }

    case 'DELIVER': {
      const order = state.orders.find((o) => o.id === action.orderId);
      if (!order) return state;
      const used = findOrderItems(state.board, order.items);
      if (!used) return withToast(state, 'Missing items — keep merging!');
      const board = state.board.slice();
      used.forEach((i) => { board[i] = null; });
      const s = {
        ...state, board,
        coins: state.coins + order.coins,
        stars: state.stars + order.stars,
        orders: state.orders.filter((o) => o.id !== order.id),
        selected: null,
        toast: mkToast(`Delivered! +${order.coins} 🪙  +${order.stars} ⭐`),
      };
      s.orders = [...s.orders, makeOrder(s)];
      s.orderSeq += 1;
      return placePending(s);
    }

    case 'RESTORE': {
      const spot = spotById(action.spotId);
      if (!spot || state.restored.includes(action.spotId)) return state;
      if (state.stars < spot.cost) return withToast(state, 'Not enough stars yet — complete more orders!');
      const restored = [...state.restored, action.spotId];
      const queue = [...state.dialogueQueue, spot.line];
      const pendingGens = state.pendingGens.slice();
      for (const [key, gen] of Object.entries(GENERATORS)) {
        if (gen.unlockAt === restored.length && gen.unlockAt > 0) {
          pendingGens.push(key);
          if (gen.announce) queue.push(gen.announce);
        }
      }
      const chapter = chapterOfSpot(action.spotId);
      if (chapter.spots.every((sp) => restored.includes(sp.id))) {
        queue.push(...chapter.done);
        const chIdx = CHAPTERS.indexOf(chapter);
        if (CHAPTERS[chIdx + 1]) queue.push(...CHAPTERS[chIdx + 1].intro);
        else queue.push(...FINALE);
      }
      return placePending({
        ...state,
        stars: state.stars - spot.cost,
        restored,
        dialogueQueue: queue,
        pendingGens,
        fx: { type: 'restore', spot: action.spotId, ts: Date.now() },
      });
    }

    case 'DIALOGUE_NEXT':
      return { ...state, dialogueQueue: state.dialogueQueue.slice(1) };

    case 'BUY_ENERGY': {
      const s = applyEnergyRegen(state);
      if (s.energy >= MAX_ENERGY) return withToast(s, 'Energy is already full! ⚡');
      if (s.coins < ENERGY_PACK.cost) return withToast(s, `Need ${ENERGY_PACK.cost} 🪙 for an energy snack!`);
      return {
        ...s,
        coins: s.coins - ENERGY_PACK.cost,
        energy: Math.min(MAX_ENERGY, s.energy + ENERGY_PACK.amount),
        toast: mkToast(`+${ENERGY_PACK.amount} ⚡ Munch munch!`),
      };
    }

    default:
      return state;
  }
}
