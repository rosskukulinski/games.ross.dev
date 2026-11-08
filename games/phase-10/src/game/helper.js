// Kid-friendly helpers: how close a hand is to the current phase, which cards
// help, and a plain-words description of what is still missing.
import { PHASES } from './phases.js';

const byValue = (a, b) => (a.value ?? 0) - (b.value ?? 0);

// Sort a hand for display: numbers low to high (by colour within a number),
// then wilds, then skips.
const COLOR_ORDER = { red: 0, blue: 1, green: 2, yellow: 3 };
export function sortHand(hand) {
  const rank = (c) => (c.type === 'number' ? 0 : c.type === 'wild' ? 1 : 2);
  return [...hand].sort((a, b) =>
    rank(a) - rank(b) ||
    byValue(a, b) ||
    (COLOR_ORDER[a.color] ?? 0) - (COLOR_ORDER[b.color] ?? 0) ||
    a.id - b.id
  );
}

// Greedy plan of the best partial phase in `cards`. Returns one entry per
// requirement: { type, count, cards, missing }. Not an exact solver (that is
// findPhaseCards) — it only has to show progress and point at useful cards.
export function planPhase(cards, phaseNumber) {
  const phase = PHASES[phaseNumber - 1];
  if (!phase) return [];
  let pool = cards.filter((c) => c.type === 'number');
  const wilds = cards.filter((c) => c.type === 'wild');

  const groups = phase.requirements.map((req) => {
    let picked = [];
    if (req.type === 'set' || req.type === 'color') {
      const key = req.type === 'set' ? 'value' : 'color';
      const buckets = {};
      pool.forEach((c) => (buckets[c[key]] ||= []).push(c));
      const best = Object.values(buckets).sort(
        (a, b) => b.length - a.length || (b[0].value ?? 0) - (a[0].value ?? 0)
      )[0] || [];
      picked = best.slice(0, req.count);
    } else if (req.type === 'run') {
      for (let start = 1; start <= 13 - req.count; start++) {
        const window = [];
        for (let v = start; v < start + req.count; v++) {
          const c = pool.find((p) => p.value === v);
          if (c) window.push(c);
        }
        if (window.length > picked.length) picked = window;
      }
    }
    const ids = new Set(picked.map((c) => c.id));
    pool = pool.filter((c) => !ids.has(c.id));
    return { type: req.type, count: req.count, cards: [...picked].sort(byValue) };
  });

  // Wilds go to the group closest to finished first.
  const order = [...groups].sort((a, b) => (a.count - a.cards.length) - (b.count - b.cards.length));
  for (const g of order) {
    while (g.cards.length < g.count && wilds.length) g.cards.push(wilds.shift());
  }
  return groups.map((g) => ({ ...g, missing: g.count - g.cards.length }));
}

// Ids of cards in the hand that are worth keeping for the phase: a group
// only counts once it has at least two real cards (a lone 7 is not a set).
export function helpfulCardIds(hand, phaseNumber) {
  const ids = new Set();
  for (const g of planPhase(hand, phaseNumber)) {
    const real = g.cards.filter((c) => c.type === 'number');
    const enough = g.type === 'color' ? real.length >= 3 : real.length >= 2;
    if (enough) g.cards.forEach((c) => ids.add(c.id));
  }
  hand.forEach((c) => c.type === 'wild' && ids.add(c.id));
  return ids;
}

export const GROUP_WORDS = { set: 'same number', run: 'in a row', color: 'same color' };

// "Not yet! Same number: 2 of 3 · Same number: 1 of 3" plus extras that don't fit.
export function describeMissing(selected, phaseNumber) {
  const plan = planPhase(selected, phaseNumber);
  const parts = plan.map((g) => `${g.cards.length} of ${g.count} ${GROUP_WORDS[g.type]}`);
  const used = plan.reduce((n, g) => n + g.cards.length, 0);
  const extra = selected.length - used;
  let msg = `Not yet! You have ${parts.join(' + ')}.`;
  if (extra > 0) msg += ` ${extra} card${extra > 1 ? 's' : ''} don't fit.`;
  return msg;
}
