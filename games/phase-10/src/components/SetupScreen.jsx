import { useState } from 'react';
import './SetupScreen.css';

const MODE_KEY = 'phase10-easy';

function savedEasy(fallback) {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

// Picture-only cards (not Card, which reads as a tap target).
const DemoCard = ({ value, color }) => <div className={`demo-card card-${color}`}>{value}</div>;

export default function SetupScreen({ onStartGame, initial = { numBots: 2, easy: true } }) {
  const [numBots, setNumBots] = useState(initial.numBots);
  const [easy, setEasy] = useState(() => savedEasy(initial.easy));
  const [showRules, setShowRules] = useState(false);

  const chooseMode = (value) => {
    setEasy(value);
    try { localStorage.setItem(MODE_KEY, value ? '1' : '0'); } catch { /* private mode */ }
  };

  return (
    <div className="setup-screen">
      <h1 className="setup-title">Phase 10</h1>

      {/* The first goal as a picture: two groups of three matching cards */}
      <div className="setup-demo" aria-label="Make groups of matching cards">
        <div className="demo-group">
          {['red', 'blue', 'green'].map((c) => <DemoCard key={c} value={7} color={c} />)}
        </div>
        <span className="demo-plus">+</span>
        <div className="demo-group">
          {['yellow', 'red', 'blue'].map((c) => <DemoCard key={c} value={3} color={c} />)}
        </div>
      </div>

      <div className="setup-card">
        <div className="setup-row" role="group" aria-label="Bots">
          <span className="setup-icon" aria-hidden="true">🤖</span>
          <div className="bot-selector">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                className={`bot-option ${numBots === num ? 'selected' : ''}`}
                onClick={() => setNumBots(num)}
                aria-label={`${num} bot${num > 1 ? 's' : ''}`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div className="mode-selector" role="group" aria-label="Mode">
          <button className={`mode-option ${easy ? 'selected' : ''}`} onClick={() => chooseMode(true)}>
            ⭐ Easy
          </button>
          <button className={`mode-option ${!easy ? 'selected' : ''}`} onClick={() => chooseMode(false)}>
            Classic
          </button>
        </div>

        <button className="start-button" onClick={() => onStartGame(numBots, easy)}>
          ▶ Play
        </button>
      </div>

      <button className="rules-toggle" onClick={() => setShowRules((v) => !v)} aria-expanded={showRules}>
        ? How to play
      </button>
      {showRules && (
        <div className="rules-summary">
          <ul>
            <li>Take a card, then throw one away.</li>
            <li>Make the goal to finish a phase. Do all 10 to win.</li>
            <li><strong>Set</strong>: cards with the same number (7 7 7)</li>
            <li><strong>Run</strong>: numbers in a row (3 4 5 6)</li>
            <li><strong>W</strong> (wild) can be any card. <strong>S</strong> skips a player.</li>
            <li>Easy mode: ⭐ cards help your goal, and 💡 Help me plays a step for you.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
