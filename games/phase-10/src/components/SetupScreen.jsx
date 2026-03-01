import { useState } from 'react';
import './SetupScreen.css';

export default function SetupScreen({ onStartGame }) {
  const [numBots, setNumBots] = useState(3);

  return (
    <div className="setup-screen">
      <h1 className="setup-title">Phase 10</h1>

      <div className="setup-card">
        <h2>How many opponents?</h2>

        <div className="bot-selector">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              className={`bot-option ${numBots === num ? 'selected' : ''}`}
              onClick={() => setNumBots(num)}
            >
              {num}
            </button>
          ))}
        </div>

        <p className="bot-label">
          {numBots} bot{numBots > 1 ? 's' : ''} ({numBots + 1} players total)
        </p>

        <button className="start-button" onClick={() => onStartGame(numBots)}>
          Start Game
        </button>
      </div>

      <div className="rules-summary">
        <h3>Quick Rules</h3>
        <ul>
          <li>Complete all 10 phases in order to win</li>
          <li>Each turn: Draw a card, optionally lay down your phase, discard</li>
          <li><strong>Sets</strong>: Cards with the same number</li>
          <li><strong>Runs</strong>: Consecutive numbers (e.g., 3-4-5-6)</li>
          <li><strong>Wild (W)</strong>: Can be any number</li>
          <li><strong>Skip (S)</strong>: Skips the next player</li>
        </ul>
      </div>
    </div>
  );
}
