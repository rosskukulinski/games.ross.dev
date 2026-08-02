import { useRef, useState, useEffect, useCallback } from 'react';
import {
  CANVAS_W, CANVAS_H, CELL, TOWERS, ENEMIES, WAVES, START_GOLD, START_LIVES, SELL_REFUND,
} from './game/constants.js';
import { isValidPlacement } from './game/maps.js';
import { createTower, resetIds } from './game/entities.js';
import { updateGame, startWave, createGameState } from './game/engine.js';
import { renderGame } from './game/renderer.js';
import { PIECE } from './game/theme.js';

const TOWER_KEYS = Object.keys(TOWERS);
const ENEMY_KEYS = Object.keys(ENEMIES);

export default function App() {
  const canvasRef = useRef(null);
  const gs = useRef(null);
  const animRef = useRef(null);
  const lastTime = useRef(0);

  // UI state (React-managed for re-renders)
  const [phase, setPhase] = useState('title'); // title | playing | gameover
  const [gold, setGold] = useState(START_GOLD);
  const [lives, setLives] = useState(START_LIVES);
  const [waveIndex, setWaveIndex] = useState(0);
  const [waveComplete, setWaveComplete] = useState(false);
  const [waveLive, setWaveLive] = useState(false);
  const [won, setWon] = useState(false);
  const [selectedTower, setSelectedTower] = useState(null);
  const [placingType, setPlacingType] = useState(null);
  const [stats, setStats] = useState({ kills: 0, goldEarned: 0, towersPlaced: 0 });

  // Hover state (not triggering re-renders, read by renderer)
  const hover = useRef({ col: -1, row: -1, canPlace: false });

  const getUiState = useCallback(() => ({
    selectedTower,
    placingType,
    hoverCol: hover.current.col,
    hoverRow: hover.current.row,
    canPlace: hover.current.canPlace,
  }), [selectedTower, placingType]);

  // Sync game state changes to React
  const updateUi = useCallback((patch) => {
    if (patch.gold !== undefined) setGold(patch.gold);
    if (patch.lives !== undefined) setLives(patch.lives);
    if (patch.waveIndex !== undefined) setWaveIndex(patch.waveIndex);
    if (patch.waveComplete !== undefined) setWaveComplete(patch.waveComplete);
    if (patch.phase === 'gameover') {
      setPhase('gameover');
      setWon(patch.won);
    }
  }, []);

  const initGame = useCallback(() => {
    resetIds();
    gs.current = createGameState(START_GOLD, START_LIVES);
    setGold(START_GOLD);
    setLives(START_LIVES);
    setWaveIndex(0);
    setWaveComplete(false);
    setWaveLive(false);
    setSelectedTower(null);
    setPlacingType(null);
    setWon(false);
    setStats({ kills: 0, goldEarned: 0, towersPlaced: 0 });
    setPhase('playing');
    // Handle for smoke tests / debugging, same idea as neon-bricks' __NEON.
    window.__TD = gs;
  }, []);

  // Game loop
  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    lastTime.current = performance.now();

    const loop = (now) => {
      const dt = Math.min((now - lastTime.current) / 1000, 0.05);
      lastTime.current = now;

      if (gs.current && gs.current.phase === 'playing') {
        updateGame(gs.current, dt, updateUi);
        // Drives the wave button: a wave is live while anything is still
        // spawning or still standing on the board.
        const live = gs.current.spawning || gs.current.enemies.length > 0;
        setWaveLive((prev) => (prev === live ? prev : live));
      }

      renderGame(ctx, gs.current, getUiState());
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, updateUi, getUiState]);

  // --- Pointer input -------------------------------------------------------
  // Pointer events cover mouse, touch and pencil in one path, so the game
  // plays the same on an iPad as it does with a mouse.

  const toCell = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    return { col: Math.floor(mx / CELL), row: Math.floor(my / CELL) };
  };

  const canPlaceAt = useCallback((col, row) => (
    !!placingType
    && isValidPlacement(col, row)
    && (!gs.current || !gs.current.towers.some(t => t.col === col && t.row === row))
  ), [placingType]);

  const handlePointerDown = useCallback((e) => {
    if (!gs.current || gs.current.phase !== 'playing') return;
    const { col, row } = toCell(e);

    // Touch has no hover, so the preview lands on contact instead.
    hover.current = { col, row, canPlace: canPlaceAt(col, row) };

    if (placingType) {
      if (!canPlaceAt(col, row)) return;
      const spec = TOWERS[placingType];
      if (gs.current.gold < spec.cost) return;
      const tower = createTower(placingType, col, row);
      gs.current.towers.push(tower);
      gs.current.gold -= spec.cost;
      gs.current.stats.towersPlaced++;
      setGold(gs.current.gold);
      setPlacingType(null);
      setSelectedTower(tower);
      hover.current = { col: -1, row: -1, canPlace: false };
    } else {
      setSelectedTower(gs.current.towers.find(t => t.col === col && t.row === row) || null);
    }
  }, [placingType, canPlaceAt]);

  const handlePointerMove = useCallback((e) => {
    // Only devices that actually hover get a live preview; a finger dragging
    // across the board shouldn't leave a trail of ghost towers.
    if (e.pointerType === 'touch') return;
    const { col, row } = toCell(e);
    hover.current = { col, row, canPlace: canPlaceAt(col, row) };
  }, [canPlaceAt]);

  const handlePointerLeave = useCallback(() => {
    hover.current = { col: -1, row: -1, canPlace: false };
  }, []);

  // --- Tower actions -------------------------------------------------------

  const selectTowerType = useCallback((type) => {
    setSelectedTower(null);
    setPlacingType(type);
  }, []);

  const cancelPlacing = useCallback(() => {
    setPlacingType(null);
    hover.current = { col: -1, row: -1, canPlace: false };
  }, []);

  const upgradeTower = useCallback((stat) => {
    if (!selectedTower || !gs.current) return;
    const tower = gs.current.towers.find(t => t.id === selectedTower.id);
    if (!tower) return;
    const spec = TOWERS[tower.type];
    const level = tower.upgradeLevels[stat];
    const upgDef = spec.upgrades[stat];
    if (level >= upgDef.length) return;
    const upg = upgDef[level];
    if (gs.current.gold < upg.cost) return;

    gs.current.gold -= upg.cost;
    tower.totalInvested += upg.cost;
    tower[stat] = upg.val;
    tower.upgradeLevels[stat] = level + 1;
    setGold(gs.current.gold);
    setSelectedTower({ ...tower });
  }, [selectedTower]);

  const sellTower = useCallback(() => {
    if (!selectedTower || !gs.current) return;
    const idx = gs.current.towers.findIndex(t => t.id === selectedTower.id);
    if (idx < 0) return;
    const refund = Math.floor(gs.current.towers[idx].totalInvested * SELL_REFUND);
    gs.current.gold += refund;
    gs.current.towers.splice(idx, 1);
    setGold(gs.current.gold);
    setSelectedTower(null);
  }, [selectedTower]);

  const handleStartWave = useCallback(() => {
    if (gs.current) startWave(gs.current, updateUi);
  }, [updateUi]);

  useEffect(() => {
    if (phase !== 'gameover' || !gs.current) return;
    const final = { ...gs.current.stats };
    setStats(final);
    // Global from /arcade/arcade.js — absent when this game runs standalone.
    // Gold earned is the run's natural score: it rises with every kill and
    // every wave bonus, so a deeper run always outranks a shallower one.
    window.Arcade?.submit({ game: 'tower-defense', value: final.goldEarned });
  }, [phase]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPlacingType(null);
        setSelectedTower(null);
        hover.current = { col: -1, row: -1, canPlace: false };
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // --- Title ---------------------------------------------------------------

  if (phase === 'title') {
    return (
      <div className="screen">
        <div className="title-card">
          <p className="eyebrow">Board game · 20 waves</p>
          <h1>Toy Kingdom<span>Tower Defense</span></h1>
          <p className="tagline">Set your pieces on the felt. Nothing gets to the other side.</p>

          <div className="piece-row">
            {TOWER_KEYS.map(k => (
              <div key={k} className="piece-chip">
                <Piece color={TOWERS[k].color} />
                <span>{TOWERS[k].name}</span>
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={initGame}>Play</button>
          <p className="hint">Tap a tower, then tap the board to place it</p>
        </div>
      </div>
    );
  }

  // --- Game over -----------------------------------------------------------

  if (phase === 'gameover') {
    return (
      <div className="screen">
        <div className={`title-card ${won ? 'is-win' : 'is-loss'}`}>
          <p className="eyebrow">{won ? 'All 20 waves held' : `Fell on wave ${waveIndex + 1}`}</p>
          <h1>{won ? 'Kingdom holds' : 'They got through'}</h1>
          <p className="tagline">
            {won
              ? 'Not one piece reached the far edge. The board is yours.'
              : 'Your last life ran out. Reset the pieces and try a different layout.'}
          </p>
          <div className="stats-grid">
            <Stat value={waveIndex + 1} label="Waves" />
            <Stat value={stats.kills} label="Knocked down" />
            <Stat value={stats.towersPlaced} label="Towers set" />
            <Stat value={stats.goldEarned} label="Gold earned" />
          </div>
          <button className="btn-primary" onClick={initGame}>Play again</button>
        </div>
      </div>
    );
  }

  // --- Playing -------------------------------------------------------------

  const towerSpec = selectedTower ? TOWERS[selectedTower.type] : null;
  const waveLabel = waveLive
    ? `Wave ${waveIndex + 1} incoming`
    : waveIndex === 0 && !waveComplete
      ? 'Start wave 1'
      : `Send wave ${waveIndex + 2}`;

  return (
    <div className="game-layout">
      <header className="hud">
        <div className="hud-item">
          <span className="chip chip-gold">◎</span>
          <span className="hud-val">{gold}</span>
          <span className="hud-label">gold</span>
        </div>
        <div className={`hud-item ${lives <= 5 ? 'is-low' : ''}`}>
          <span className="chip chip-life">♥</span>
          <span className="hud-val">{lives}</span>
          <span className="hud-label">lives</span>
        </div>
        <div className="hud-item hud-wave">
          <span className="hud-val">{waveIndex + 1}<i>/{WAVES.length}</i></span>
          <span className="hud-label">wave</span>
        </div>
      </header>

      <div className="game-area">
        <div className="board-wrap">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="game-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          />
        </div>

        <aside className="side-panel">
          <button
            className={`btn-wave ${waveLive ? 'is-live' : ''}`}
            onClick={handleStartWave}
            disabled={waveLive}
          >
            {waveLabel}
          </button>

          <section className="panel-section">
            <h2 className="panel-title">Towers</h2>
            <div className="tower-shop">
              {TOWER_KEYS.map(k => {
                const spec = TOWERS[k];
                const affordable = gold >= spec.cost;
                const active = placingType === k;
                return (
                  <button
                    key={k}
                    className={`tower-btn ${active ? 'active' : ''}`}
                    disabled={!affordable && !active}
                    onClick={() => (active ? cancelPlacing() : selectTowerType(k))}
                  >
                    <Piece color={spec.color} />
                    <span className="tower-btn-name">{spec.name}</span>
                    <span className="tower-btn-cost">{spec.cost}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {placingType && (
            <section className="panel-section placing-hint">
              <p>Tap an open felt square to set it down.</p>
              <button className="btn-quiet" onClick={cancelPlacing}>Cancel</button>
            </section>
          )}

          {selectedTower && towerSpec && (
            <section className="panel-section tower-info">
              <h2 className="panel-title" style={{ color: towerSpec.color }}>{towerSpec.name}</h2>
              <div className="tower-stats">
                {Object.keys(towerSpec.upgrades).map(stat => {
                  const level = selectedTower.upgradeLevels[stat];
                  const upgDef = towerSpec.upgrades[stat];
                  const maxed = level >= upgDef.length;
                  const upg = maxed ? null : upgDef[level];
                  const affordable = upg && gold >= upg.cost;
                  return (
                    <div key={stat} className="upgrade-row">
                      <span className="upgrade-stat">{STAT_NAMES[stat] || stat}</span>
                      <span className="upgrade-val">{formatVal(stat, selectedTower[stat])}</span>
                      <span className="pips">
                        {upgDef.map((_, i) => <i key={i} className={i < level ? 'on' : ''} />)}
                      </span>
                      {maxed ? (
                        <span className="upgrade-max">Max</span>
                      ) : (
                        <button
                          className="btn-upgrade"
                          disabled={!affordable}
                          onClick={() => upgradeTower(stat)}
                        >
                          {upg.cost}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button className="btn-quiet" onClick={sellTower}>
                Sell for {Math.floor(selectedTower.totalInvested * SELL_REFUND)} gold
              </button>
            </section>
          )}

          {!selectedTower && !placingType && (
            <section className="panel-section legend">
              <h2 className="panel-title">Who's coming</h2>
              <ul>
                {ENEMY_KEYS.map(k => (
                  <li key={k}>
                    <EnemyGlyph type={k} />
                    <span>{ENEMIES[k].name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

const STAT_NAMES = {
  damage: 'Damage', range: 'Range', fireRate: 'Speed',
  splash: 'Blast', slow: 'Freeze', chain: 'Chain',
};

function formatVal(stat, val) {
  if (stat === 'fireRate') return `${val.toFixed(1)}/s`;
  if (stat === 'slow') return `${val.toFixed(1)}s`;
  return Math.round(val);
}

function Stat({ value, label }) {
  return (
    <div className="stat">
      <span className="stat-val">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/** A tower piece in CSS, matching the moulded look of the pieces on the board. */
function Piece({ color }) {
  return <span className="piece" style={{ '--piece': color }} />;
}

/** Enemy silhouettes for the legend, matching the shapes drawn on the board. */
function EnemyGlyph({ type }) {
  const paths = {
    grunt: <circle cx="12" cy="12" r="8" />,
    runner: <polygon points="21,12 6,5 9,12 6,19" />,
    tank: <polygon points="21,12 16.5,19.8 7.5,19.8 3,12 7.5,4.2 16.5,4.2" />,
    healer: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />,
    boss: <g><circle cx="12" cy="14" r="7" /><polygon points="5,8 5,3 8.5,5.5 12,1.5 15.5,5.5 19,3 19,8" /></g>,
  };
  return (
    <svg className="glyph" viewBox="0 0 24 24" fill={PIECE[type]} aria-hidden="true">
      {paths[type]}
    </svg>
  );
}
