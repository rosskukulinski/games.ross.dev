import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';
import { W, H, INTERACT_RANGE, STUN_DURATION, KNOCKBACK, TILE } from './game/constants.js';
import { render } from './game/renderer.js';
import { updatePlayer } from './game/player.js';
import { updateCrabs } from './game/crabs.js';
import { distance } from './game/collision.js';
import { canMove } from './game/collision.js';
import { PLAYER_SIZE } from './game/constants.js';
import { newGame } from './game/setup.js';
import { useGameLoop } from './hooks/useGameLoop.js';
import { useInput } from './hooks/useInput.js';
import { getTile } from './game/island.js';
import { T, WALKABLE } from './game/constants.js';

export default function App() {
  const cvs = useRef(null);
  const gs = useRef(null);
  const keys = useInput();

  const [ui, setUi] = useState({
    phase: 'title', // title | playing | victory
    inventory: { shovel: false, map: false, compass: false },
    message: null,
    dialogue: null,
    timer: 0,
    bestTime: parseInt(localStorage.getItem('thi-best-time') || '0'),
    finalTime: 0,
    newBest: false,
  });

  const updateUi = useCallback((patch) => setUi(u => ({ ...u, ...patch })), []);

  const startGame = useCallback(() => {
    gs.current = newGame();
    updateUi({
      phase: 'playing',
      inventory: { shovel: false, map: false, compass: false },
      message: null,
      dialogue: null,
      timer: 0,
      finalTime: 0,
      newBest: false,
    });
  }, [updateUi]);

  // Mobile D-pad input
  const dpadDown = useCallback((dir) => {
    keys.current[dir] = true;
  }, [keys]);

  const dpadUp = useCallback((dir) => {
    keys.current[dir] = false;
  }, [keys]);

  const mobileInteract = useCallback(() => {
    keys.current.interact = true;
  }, [keys]);

  // Handle interaction (talk/pickup/dig)
  const handleInteract = useCallback((g) => {
    const { player, npcs, items, treasure, inventory, clues } = g;

    // Check NPCs first
    for (const npc of npcs) {
      if (distance(player.x, player.y, npc.x, npc.y) < INTERACT_RANGE) {
        let text;
        if (npc.id === 'parrot') {
          const hasAll = inventory.shovel && inventory.map && inventory.compass;
          text = clues.parrot(hasAll);
        } else if (npc.dialogueQueue.length > 0) {
          text = npc.dialogueQueue[0];
          npc.talked = true;
        } else {
          text = npc.defaultText;
        }
        updateUi({ dialogue: { name: npc.name, text } });
        return;
      }
    }

    // Check items
    for (const item of items) {
      if (item.collected) continue;
      if (distance(player.x, player.y, item.x, item.y) < INTERACT_RANGE) {
        item.collected = true;
        inventory[item.id] = true;
        updateUi({
          inventory: { ...inventory },
          message: `Found: ${item.name}!`,
        });
        g.messageUntil = performance.now() + 2000;
        return;
      }
    }

    // Try to dig (need shovel)
    if (inventory.shovel) {
      const col = Math.floor(player.x / TILE);
      const row = Math.floor(player.y / TILE);
      const tile = getTile(col, row);
      if (tile === T.S || tile === T.G) {
        const isCorrect = col === treasure.col && row === treasure.row;
        g.digAnim = {
          x: player.x,
          y: player.y,
          startTime: performance.now(),
          success: isCorrect,
        };

        if (isCorrect) {
          treasure.found = true;
          const elapsed = performance.now() - g.startTime;
          const savedBest = parseInt(localStorage.getItem('thi-best-time') || '0');
          const isNewBest = savedBest === 0 || elapsed < savedBest;
          if (isNewBest) localStorage.setItem('thi-best-time', Math.floor(elapsed));

          setTimeout(() => {
            updateUi({
              phase: 'victory',
              finalTime: elapsed,
              bestTime: isNewBest ? Math.floor(elapsed) : savedBest,
              newBest: isNewBest,
            });
          }, 800);
        } else {
          updateUi({ message: 'Nothing here...' });
          g.messageUntil = performance.now() + 1500;
        }
        return;
      }
    }
  }, [updateUi]);

  // Close dialogue
  const closeDialogue = useCallback(() => {
    updateUi({ dialogue: null });
  }, [updateUi]);

  // Game loop
  useGameLoop(ui.phase === 'playing', (dt, time) => {
    const g = gs.current;
    if (!g) return;
    const ctx = cvs.current?.getContext('2d');
    if (!ctx) return;

    // Don't update if dialogue is open
    if (ui.dialogue) {
      render(ctx, g, time);
      return;
    }

    // Player input
    const input = keys.current;

    // Handle interact (consume the flag)
    if (input.interact) {
      input.interact = false;
      handleInteract(g);
    }

    // Update player
    updatePlayer(g.player, input, dt);

    // Update crabs
    updateCrabs(g.crabs, dt);

    // Check crab collision
    const now = performance.now();
    if (now > g.player.stunUntil) {
      for (const crab of g.crabs) {
        if (distance(g.player.x, g.player.y, crab.x, crab.y) < 20) {
          g.player.stunUntil = now + STUN_DURATION;
          // Knockback away from crab
          const angle = Math.atan2(g.player.y - crab.y, g.player.x - crab.x);
          const kx = g.player.x + Math.cos(angle) * KNOCKBACK;
          const ky = g.player.y + Math.sin(angle) * KNOCKBACK;
          if (canMove(kx, ky, PLAYER_SIZE, PLAYER_SIZE)) {
            g.player.x = kx;
            g.player.y = ky;
          }
          updateUi({ message: 'Ouch! Crab pinch!' });
          g.messageUntil = now + 1000;
          break;
        }
      }
    }

    // Clear timed messages
    if (g.messageUntil && now > g.messageUntil) {
      g.messageUntil = 0;
      updateUi({ message: null });
    }

    // Clear dig animation
    if (g.digAnim && now - g.digAnim.startTime > 800) {
      if (!g.digAnim.success) g.digAnim = null;
    }

    // Update timer
    updateUi({ timer: now - g.startTime });

    // Render
    render(ctx, g, time);
  });

  // Handle dialogue close on key
  useEffect(() => {
    if (!ui.dialogue) return;
    const onKey = (e) => {
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Escape') {
        e.preventDefault();
        closeDialogue();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.dialogue, closeDialogue]);

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const secs = s % 60;
    return `${m}:${secs.toString().padStart(2, '0')}`;
  };

  const { phase, inventory, message, dialogue, timer, bestTime, finalTime, newBest } = ui;

  return (
    <div className="app">
      <div className="wrap">
        <canvas ref={cvs} width={W} height={H} className="cvs" />

        {/* HUD */}
        {phase === 'playing' && (
          <div className="hud">
            <div className="hud-left">
              <div className="inv-slots">
                <div className={`inv-slot ${inventory.shovel ? 'has' : ''}`} title="Shovel">
                  {inventory.shovel ? <span className="inv-icon">⛏</span> : <span className="inv-empty">?</span>}
                </div>
                <div className={`inv-slot ${inventory.map ? 'has' : ''}`} title="Map">
                  {inventory.map ? <span className="inv-icon">🗺</span> : <span className="inv-empty">?</span>}
                </div>
                <div className={`inv-slot ${inventory.compass ? 'has' : ''}`} title="Compass">
                  {inventory.compass ? <span className="inv-icon">🧭</span> : <span className="inv-empty">?</span>}
                </div>
              </div>
            </div>
            <div className="hud-right">
              <div className="timer">{formatTime(timer)}</div>
            </div>
          </div>
        )}

        {/* Message banner */}
        {message && phase === 'playing' && (
          <div className="msg-banner">{message}</div>
        )}

        {/* Dialogue box */}
        {dialogue && (
          <div className="dialogue-box" onClick={closeDialogue}>
            <div className="dialogue-name">{dialogue.name}</div>
            <div className="dialogue-text">{dialogue.text}</div>
            <div className="dialogue-hint">Press [E] or tap to close</div>
          </div>
        )}

        {/* Title screen */}
        {phase === 'title' && (
          <div className="ov">
            <div className="ov-inner title-screen">
              <h1>Treasure Hunt Island</h1>
              <p className="sub">Explore the island, find tools, follow clues, and dig up the buried treasure!</p>
              <div className="how-to-play">
                <div className="how-row"><span className="how-key">WASD / Arrows</span> Move</div>
                <div className="how-row"><span className="how-key">E / Space</span> Interact / Dig</div>
                <div className="how-row"><span className="how-key">Talk to NPCs</span> Get clues</div>
                <div className="how-row"><span className="how-key">Collect tools</span> Shovel, Map, Compass</div>
                <div className="how-row"><span className="how-key">Watch out</span> Crabs will stun you!</div>
              </div>
              {bestTime > 0 && <p className="best-time">Best Time: {formatTime(bestTime)}</p>}
              <button className="btn" onClick={startGame}>Start Adventure</button>
            </div>
          </div>
        )}

        {/* Victory screen */}
        {phase === 'victory' && (
          <div className="ov">
            <div className="ov-inner victory-screen">
              <h1>Treasure Found!</h1>
              <p className="final-time">Time: {formatTime(finalTime)}</p>
              {newBest && <p className="new-best">New Best Time!</p>}
              <p className="best-time">Best: {formatTime(bestTime)}</p>
              <button className="btn" onClick={startGame}>Play Again</button>
            </div>
          </div>
        )}

        {/* Mobile controls */}
        <div className="mobile-controls">
          <div className="dpad">
            <button
              className="dpad-btn dpad-up"
              onTouchStart={(e) => { e.preventDefault(); dpadDown('up'); }}
              onTouchEnd={(e) => { e.preventDefault(); dpadUp('up'); }}
            >&#9650;</button>
            <button
              className="dpad-btn dpad-left"
              onTouchStart={(e) => { e.preventDefault(); dpadDown('left'); }}
              onTouchEnd={(e) => { e.preventDefault(); dpadUp('left'); }}
            >&#9664;</button>
            <button
              className="dpad-btn dpad-right"
              onTouchStart={(e) => { e.preventDefault(); dpadDown('right'); }}
              onTouchEnd={(e) => { e.preventDefault(); dpadUp('right'); }}
            >&#9654;</button>
            <button
              className="dpad-btn dpad-down"
              onTouchStart={(e) => { e.preventDefault(); dpadDown('down'); }}
              onTouchEnd={(e) => { e.preventDefault(); dpadUp('down'); }}
            >&#9660;</button>
          </div>
          <button
            className="action-btn"
            onTouchStart={(e) => { e.preventDefault(); mobileInteract(); }}
          >Action</button>
        </div>
      </div>
    </div>
  );
}
