import { useEffect, useMemo, useReducer, useState } from 'react';
import { CHAINS, SELL_VALUE, TOTAL_SPOTS } from './game/data.js';
import {
  reducer, loadState, saveState, clearSave,
  MAX_ENERGY, ENERGY_PACK,
} from './game/state.js';
import Board from './components/Board.jsx';
import Orders from './components/Orders.jsx';
import Kingdom from './components/Kingdom.jsx';
import Dialogue from './components/Dialogue.jsx';

function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      left: (i * 37 + 13) % 100,
      delay: ((i * 53) % 30) / 10,
      dur: 3 + ((i * 29) % 20) / 10,
      color: ['#ff6b6b', '#ffd166', '#4ecdc4', '#c77dff', '#63c3f0'][i % 5],
    })), []);
  return (
    <div className="confetti">
      {pieces.map((p, i) => (
        <span key={i} style={{
          left: `${p.left}%`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`,
          background: p.color,
        }} />
      ))}
    </div>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, loadState);
  const [tab, setTab] = useState('workshop');

  useEffect(() => { saveState(state); }, [state]);

  useEffect(() => {
    const t = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(t);
  }, []);

  const selectedCell = state.selected != null ? state.board[state.selected] : null;
  const selectedItem = selectedCell?.kind === 'item' ? selectedCell : null;
  const line = state.dialogueQueue[0];
  const allDone = state.restored.length === TOTAL_SPOTS;

  const handleReset = () => {
    if (window.confirm('Start the whole kingdom over? Your progress will be erased!')) {
      clearSave();
      window.location.reload();
    }
  };

  return (
    <div className="app">
      <header className="hud">
        <a className="home-link" href="../" title="Back to arcade">🏠</a>
        <h1>Kingdom Bloom</h1>
        <div className="hud-stats">
          <button className="chip energy" onClick={() => dispatch({ type: 'BUY_ENERGY' })}
            title={`Buy +${ENERGY_PACK.amount} energy for ${ENERGY_PACK.cost} coins`}>
            ⚡ {state.energy}
            <span className="energy-bar"><i style={{ width: `${(state.energy / MAX_ENERGY) * 100}%` }} /></span>
            <span className="chip-plus">+</span>
          </button>
          <span className="chip">🪙 {state.coins}</span>
          <span className="chip">⭐ {state.stars}</span>
          <button className="chip reset" onClick={handleReset} title="Restart game">↺</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'workshop' ? 'active' : ''} onClick={() => setTab('workshop')}>
          🔮 Workshop
        </button>
        <button className={tab === 'kingdom' ? 'active' : ''} onClick={() => setTab('kingdom')}>
          🏰 Kingdom
          <span className="tab-stars">⭐ {state.stars}</span>
        </button>
      </nav>

      {tab === 'workshop' ? (
        <main className="workshop">
          <Orders orders={state.orders} board={state.board} dispatch={dispatch} />
          <Board board={state.board} selected={state.selected} fx={state.fx} dispatch={dispatch} />
          {selectedItem && (
            <div className="sell-bar">
              <span className="sell-info">
                <span className="emoji">{CHAINS[selectedItem.chain].tiers[selectedItem.tier - 1].e}</span>
                {CHAINS[selectedItem.chain].tiers[selectedItem.tier - 1].n}
                <small> · {CHAINS[selectedItem.chain].name} tier {selectedItem.tier}</small>
              </span>
              <button className="btn sell" onClick={() => dispatch({ type: 'SELL', idx: state.selected })}>
                Sell +{SELL_VALUE[selectedItem.tier - 1]} 🪙
              </button>
              <button className="btn ghost" onClick={() => dispatch({ type: 'SELECT', idx: state.selected })}>✕</button>
            </div>
          )}
          <p className="hint">Tap 🪴⛲ to make items · drag matching items together to merge · fill orders to earn ⭐</p>
        </main>
      ) : (
        <main>
          <Kingdom restored={state.restored} stars={state.stars} dispatch={dispatch} />
        </main>
      )}

      {line && <Dialogue line={line} onNext={() => dispatch({ type: 'DIALOGUE_NEXT' })} />}

      {state.toast && (
        <div key={state.toast.id} className="toast">{state.toast.text}</div>
      )}

      {allDone && <Confetti />}
    </div>
  );
}
