import Card from './Card';
import { planPhase, GROUP_WORDS } from '../game/helper';
import { PHASES } from '../game/phases';
import './GoalStrip.css';

// Example faces for the empty slots, so the goal reads as a picture:
// a set shows the same number, a run counts up, a colour group is all one colour.
function exampleCard(type, i, base) {
  if (type === 'set') return { id: `ex${i}`, type: 'number', value: base, color: 'blue' };
  if (type === 'run') return { id: `ex${i}`, type: 'number', value: base + i, color: 'blue' };
  return { id: `ex${i}`, type: 'number', value: [2, 5, 9, 4, 11, 7, 1][i % 7], color: 'green' };
}

// Faded cards for the empty slots. With real cards in the group they show
// exactly what is still needed (the matching number, the missing run steps,
// the same colour); with none they show an example.
function neededCards(g, gi) {
  const real = g.cards.filter((c) => c.type === 'number');
  const n = g.missing;
  if (n <= 0) return [];
  if (!real.length) {
    const base = g.type === 'run' ? 1 : [7, 3][gi] ?? 5;
    return Array.from({ length: n }, (_, i) => exampleCard(g.type, i + g.cards.length, base));
  }
  if (g.type === 'set') return Array.from({ length: n }, (_, i) => ({ id: `n${i}`, type: 'number', value: real[0].value, color: 'blue' }));
  if (g.type === 'color') return Array.from({ length: n }, (_, i) => ({ ...exampleCard('color', i, 0), color: real[0].color }));
  const have = new Set(real.map((c) => c.value));
  const start = Math.max(1, Math.min(Math.min(...have), 13 - g.count));
  const gaps = [];
  for (let v = start; v < start + g.count; v++) if (!have.has(v)) gaps.push(v);
  return gaps.slice(-n).map((v, i) => ({ id: `n${i}`, type: 'number', value: v, color: 'blue' }));
}

// The current phase as pictures. In Easy mode the slots fill with the
// player's own matching cards, so they can see how close they are.
export default function GoalStrip({ hand, phase, easy, laid }) {
  if (laid) {
    return (
      <div className="goal-strip goal-done">
        <div className="goal-title">⭐ Phase {phase} done!</div>
        <div className="goal-sub">Throw away cards until you have none</div>
      </div>
    );
  }
  const plan = easy
    ? planPhase(hand, phase)
    : PHASES[phase - 1].requirements.map((r) => ({ ...r, cards: [], missing: r.count }));
  return (
    <div className="goal-strip" aria-label={`Goal: phase ${phase}`}>
      <div className="goal-title">Goal · Phase {phase}</div>
      <div className="goal-groups">
        {plan.map((g, gi) => {
          const filler = neededCards(g, gi);
          return (
          <div key={gi} className={`goal-group ${g.missing === 0 ? 'goal-complete' : ''}`}>
            <div className="goal-slots">
              {g.cards.map((c) => <Card key={c.id} card={c} small />)}
              {filler.map((c, i) => (
                <div key={i} className="goal-slot">
                  <Card card={c} small />
                </div>
              ))}
            </div>
            <div className="goal-label">
              {g.missing === 0 ? '✓ ' : ''}{g.count} {GROUP_WORDS[g.type]}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
