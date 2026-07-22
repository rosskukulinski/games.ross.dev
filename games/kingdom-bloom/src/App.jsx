import { useEffect, useMemo, useRef, useState } from 'react';
import { TOTAL_BUILDS } from './game/data.js';
import { Game, clearSave } from './game/engine.js';
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
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [hud, setHud] = useState({ money: 0, built: 0, total: TOTAL_BUILDS });
  const [queue, setQueue] = useState([]);
  const [toast, setToast] = useState(null);
  const [finale, setFinale] = useState(false);

  useEffect(() => {
    const game = new Game(canvasRef.current, {
      hud: setHud,
      dialogue: (lines) => setQueue((q) => [...q, ...lines]),
      toast: (text) => setToast({ text, id: Date.now() }),
      finale: () => setFinale(true),
    });
    gameRef.current = game;
    setFinale(game.finaleDone);
    return () => game.destroy();
  }, []);

  useEffect(() => {
    if (gameRef.current) gameRef.current.paused = queue.length > 0;
  }, [queue]);

  const handleReset = () => {
    if (window.confirm('Start the whole kingdom over? Your progress will be erased!')) {
      gameRef.current.disableSaving = true; // stop the final autosave from resurrecting progress
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
          <span className="chip money">🪙 {hud.money}</span>
          <span className="chip">🏗️ {hud.built}/{hud.total}</span>
          <button className="chip reset" onClick={handleReset} title="Restart game">↺</button>
        </div>
      </header>

      <div className="game-area">
        <canvas ref={canvasRef} className="game-canvas" />
      </div>

      <p className="hint">
        Move: drag anywhere (or WASD / arrows) · walk over 🪙 to collect · stand on a glowing circle to build
      </p>

      {queue.length > 0 && (
        <Dialogue line={queue[0]} onNext={() => setQueue((q) => q.slice(1))} />
      )}

      {toast && <div key={toast.id} className="toast">{toast.text}</div>}

      {finale && <Confetti />}
    </div>
  );
}
