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
import { findPath } from './game/pathfind.js';
import { useGameLoop } from './hooks/useGameLoop.js';
import { useInput } from './hooks/useInput.js';
import { getTile } from './game/island.js';
import { T } from './game/constants.js';

const TOOL_ICONS = { shovel: '\u26CF\uFE0F', map: '\u{1F5FA}\uFE0F', compass: '\u{1F9ED}' };
const TOOL_ORDER = ['shovel', 'map', 'compass'];
// After this long without finding anything, the helper arrow points the way.
const GUIDE_IDLE_MS = 5000;
// Ignore interact presses this long after a dialogue closes, so the key or
// tap that closed it can't open it again.
const INTERACT_COOLDOWN_MS = 300;
const PICKUP_RANGE = INTERACT_RANGE;

const isTouchDevice = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

// Picture row shown above each NPC's words, for players who can't read yet.
function dialogueIcons(npcId, inventory) {
  if (npcId === 'sailor') return [{ e: TOOL_ICONS.map }, { e: '\u{1F50E}' }];
  if (npcId === 'kid') return [{ e: TOOL_ICONS.compass }, { e: '\u{1F50E}' }, { e: '\u{1F980}', warn: true }];
  if (npcId === 'parrot') {
    const hasAll = TOOL_ORDER.every(t => inventory[t]);
    if (hasAll) return [{ e: TOOL_ICONS.shovel }, { e: '\u2728' }, { e: '\u{1F4B0}' }];
    return TOOL_ORDER.map(t => ({ e: TOOL_ICONS[t], done: inventory[t], todo: !inventory[t] }));
  }
  return [];
}

export default function App() {
  const cvs = useRef(null);
  const gs = useRef(null);
  const keys = useInput();
  const touch = useRef(isTouchDevice()).current;
  const uiRef = useRef(null);

  const [ui, setUi] = useState({
    phase: 'title', // title | playing | victory
    inventory: { shovel: false, map: false, compass: false },
    message: null,
    dialogue: null,
    timer: 0,
    bestTime: parseInt(localStorage.getItem('thi-best-time') || '0'),
    finalTime: 0,
    newBest: false,
    actionIcon: '\u270B',
  });
  uiRef.current = ui;

  const updateUi = useCallback((patch) => setUi(u => ({ ...u, ...patch })), []);

  const startGame = useCallback(() => {
    // the arcade score card from the last hunt shouldn't sit over the new one
    window.Arcade?.dismiss?.();
    gs.current = newGame();
    gs.current.touch = touch;
    gs.current.lastProgressAt = performance.now();
    gs.current.guidePref = null;
    updateUi({
      phase: 'playing',
      inventory: { shovel: false, map: false, compass: false },
      message: null,
      dialogue: null,
      timer: 0,
      finalTime: 0,
      newBest: false,
    });
  }, [updateUi, touch]);

  // Close dialogue
  const closeDialogue = useCallback(() => {
    // The E/Space keydown that closes the dialogue also set the interact flag;
    // drop it so the next frame doesn't reopen the same dialogue.
    keys.current.interact = false;
    if (gs.current) gs.current.interactBlockUntil = performance.now() + INTERACT_COOLDOWN_MS;
    updateUi({ dialogue: null });
  }, [updateUi, keys]);

  const mobileInteract = useCallback(() => {
    if (uiRef.current?.dialogue) { closeDialogue(); return; }
    keys.current.interact = true;
  }, [keys, closeDialogue]);

  // One-finger d-pad: the whole pad is a single target and the direction comes
  // from where the finger is relative to its centre, so there are no gaps to
  // miss and sliding the finger round changes direction.
  const padPointer = useRef(null);
  const [padDir, setPadDir] = useState('');
  const showPad = useCallback(() => {
    const k = keys.current;
    setPadDir(['up', 'down', 'left', 'right'].filter(d => k[d]).join(' '));
  }, [keys]);
  const setPadDirs = useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const k = keys.current;
    const dead = r.width * 0.08;
    if (Math.hypot(dx, dy) < dead) { k.up = k.down = k.left = k.right = false; showPad(); return; }
    // 8 directions: a diagonal only when the finger is clearly in a corner
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const diag = Math.min(ax, ay) > Math.max(ax, ay) * 0.55;
    k.left = dx < 0 && (diag || ax >= ay);
    k.right = dx > 0 && (diag || ax >= ay);
    k.up = dy < 0 && (diag || ay > ax);
    k.down = dy > 0 && (diag || ay > ax);
    showPad();
  }, [keys, showPad]);
  const padDown = useCallback((e) => {
    e.preventDefault();
    if (uiRef.current?.dialogue) closeDialogue();
    padPointer.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (gs.current) gs.current.walkTarget = null;
    setPadDirs(e);
  }, [setPadDirs, closeDialogue]);
  const padMove = useCallback((e) => {
    if (padPointer.current !== e.pointerId) return;
    setPadDirs(e);
  }, [setPadDirs]);
  const padUp = useCallback((e) => {
    if (padPointer.current !== e.pointerId) return;
    padPointer.current = null;
    const k = keys.current;
    k.up = k.down = k.left = k.right = false;
    showPad();
  }, [keys, showPad]);

  // Tap or hold anywhere on the island to walk there. Tapping a person walks
  // over and talks to them; tapping yourself (with the shovel) digs.
  const islandPointer = useRef(null);
  const toCanvas = (e) => {
    const r = cvs.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  };
  const setWalkTarget = (g, p, fresh) => {
    const intent = { kind: 'walk' };
    if (fresh) {
      for (const npc of g.npcs) {
        if (distance(p.x, p.y, npc.x, npc.y) < 26) { intent.kind = 'talk'; p = { x: npc.x, y: npc.y }; break; }
      }
      if (intent.kind === 'walk' && g.inventory.shovel && distance(p.x, p.y, g.player.x, g.player.y) < 26) {
        keys.current.interact = true;
        g.walkTarget = null;
        return;
      }
      if (intent.kind === 'walk' && g.inventory.shovel &&
          Math.floor(p.x / TILE) === g.treasure.col && Math.floor(p.y / TILE) === g.treasure.row && g.inventory.map) {
        intent.kind = 'dig';
        p = { x: g.treasure.x, y: g.treasure.y };
      }
    }
    const path = findPath(g.player.x, g.player.y, p.x, p.y);
    g.walkTarget = { x: p.x, y: p.y, path, intent: fresh ? intent.kind : 'walk', stuck: 0 };
  };
  const islandDown = useCallback((e) => {
    const g = gs.current;
    if (!g || uiRef.current?.phase !== 'playing') return;
    e.preventDefault();
    if (uiRef.current?.dialogue) { closeDialogue(); return; }
    islandPointer.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setWalkTarget(g, toCanvas(e), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeDialogue]);
  const islandMove = useCallback((e) => {
    const g = gs.current;
    if (!g || islandPointer.current !== e.pointerId || !g.walkTarget) return;
    const p = toCanvas(e);
    // Dragging a held finger steers; small wobble keeps the original intent
    if (distance(p.x, p.y, g.walkTarget.x, g.walkTarget.y) > 20) setWalkTarget(g, p, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const islandUp = useCallback((e) => {
    if (islandPointer.current === e.pointerId) islandPointer.current = null;
  }, []);

  const pickUp = useCallback((g, item) => {
    item.collected = true;
    g.inventory[item.id] = true;
    g.lastProgressAt = performance.now();
    if (g.guidePref === item.id) g.guidePref = null;
    g.pickupFx = { x: item.x, y: item.y, start: performance.now() };
    updateUi({
      inventory: { ...g.inventory },
      message: `${TOOL_ICONS[item.id]} ${item.name}!`,
    });
    g.messageUntil = performance.now() + 2000;
  }, [updateUi]);

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
        // Talking to someone about a tool points the helper arrow at it
        if (npc.id === 'sailor' && !inventory.map) g.guidePref = 'map';
        if (npc.id === 'kid' && !inventory.compass) g.guidePref = 'compass';
        updateUi({ dialogue: { id: npc.id, name: npc.name, text, icons: dialogueIcons(npc.id, inventory) } });
        return;
      }
    }

    // Check items
    for (const item of items) {
      if (item.collected) continue;
      if (distance(player.x, player.y, item.x, item.y) < INTERACT_RANGE) {
        pickUp(g, item);
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
            // The arcade leaderboard ranks this game in seconds, not ms.
            window.Arcade?.submit({
              game: 'treasure-hunt-island',
              value: Number((elapsed / 1000).toFixed(2)),
            });
          }, 800);
        } else {
          updateUi({ message: '\u{1F573}\uFE0F Nothing here...' });
          g.messageUntil = performance.now() + 1500;
        }
        return;
      }
    }
  }, [updateUi, pickUp]);

  // Game loop
  useGameLoop(ui.phase === 'playing', (dt, time) => {
    const g = gs.current;
    if (!g) return;
    const ctx = cvs.current?.getContext('2d');
    if (!ctx) return;

    const input = keys.current;
    const now = performance.now();

    // Don't update if dialogue is open (and swallow any interact press made
    // while it was open, so it can't reopen the dialogue once it closes)
    if (ui.dialogue) {
      input.interact = false;
      g.guide = null;
      render(ctx, g, time);
      return;
    }

    // Handle interact (consume the flag)
    if (input.interact) {
      input.interact = false;
      if (!(g.interactBlockUntil && now < g.interactBlockUntil)) handleInteract(g);
    }

    // Tap-to-walk: steer toward the target unless a direction key is held
    const keyHeld = input.up || input.down || input.left || input.right;
    if (keyHeld) g.walkTarget = null;
    input.vx = 0; input.vy = 0;
    const wt = g.walkTarget;
    if (wt) {
      const pl = g.player;
      const arrived =
        wt.intent === 'talk' ? distance(pl.x, pl.y, wt.x, wt.y) < INTERACT_RANGE - 8
        : wt.intent === 'dig' ? Math.floor(pl.x / TILE) === g.treasure.col && Math.floor(pl.y / TILE) === g.treasure.row
          && distance(pl.x, pl.y, wt.x, wt.y) < 8
        : false;
      while (wt.path.length && distance(pl.x, pl.y, wt.path[0].x, wt.path[0].y) < 3) wt.path.shift();
      if (arrived || !wt.path.length) {
        g.walkTarget = null;
        if (arrived) handleInteract(g);
      } else {
        const dx = wt.path[0].x - pl.x, dy = wt.path[0].y - pl.y;
        const d = Math.hypot(dx, dy);
        // Slow down on the last few pixels so we don't overshoot a waypoint
        const k = Math.min(1, d / 3);
        input.vx = (dx / d) * k; input.vy = (dy / d) * k;
      }
    }

    // Update player
    const px = g.player.x, py = g.player.y;
    updatePlayer(g.player, input, dt);
    if (g.walkTarget && now > g.player.stunUntil) {
      // Give up on a target we can't reach (a tree or the sea in the way)
      if (Math.hypot(g.player.x - px, g.player.y - py) < 0.3) {
        if (++g.walkTarget.stuck > 20) g.walkTarget = null;
      } else g.walkTarget.stuck = 0;
    }

    // Walking onto a tool picks it up; no button needed
    for (const item of g.items) {
      if (!item.collected && distance(g.player.x, g.player.y, item.x, item.y) < PICKUP_RANGE) {
        pickUp(g, item);
      }
    }

    // Update crabs
    updateCrabs(g.crabs, dt);

    // Check crab collision
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
          // Knockback shoves us off the path; plan a fresh one to the same spot
          if (g.walkTarget) g.walkTarget.path = findPath(g.player.x, g.player.y, g.walkTarget.x, g.walkTarget.y);
          updateUi({ message: '\u{1F980} Ouch! Crab pinch!' });
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

    // Helper arrow: the tool someone told us about, else the nearest tool,
    // else the treasure. Shown once the player has gone a while without
    // finding anything.
    let goal = null;
    if (!g.treasure.found) {
      const left = g.items.filter(i => !i.collected);
      const pref = left.find(i => i.id === g.guidePref);
      if (pref) goal = pref;
      else if (left.length) {
        goal = left.reduce((a, b) =>
          distance(g.player.x, g.player.y, a.x, a.y) <= distance(g.player.x, g.player.y, b.x, b.y) ? a : b);
      } else goal = g.treasure;
    }
    const showGuide = goal && (goal.id === g.guidePref || now - g.lastProgressAt > GUIDE_IDLE_MS);
    g.guide = showGuide ? { x: goal.x, y: goal.y, id: goal.id || 'treasure' } : null;

    // Picture on the Action button for what it would do right now
    let actionIcon = '\u270B';
    if (g.npcs.some(n => distance(g.player.x, g.player.y, n.x, n.y) < INTERACT_RANGE)) actionIcon = '\u{1F4AC}';
    else if (g.inventory.shovel) {
      const t = getTile(Math.floor(g.player.x / TILE), Math.floor(g.player.y / TILE));
      if (t === T.S || t === T.G) actionIcon = TOOL_ICONS.shovel;
    }
    const patch = { timer: now - g.startTime };
    if (actionIcon !== ui.actionIcon) patch.actionIcon = actionIcon;
    updateUi(patch);

    // Render
    render(ctx, g, time);
  });

  // Handle dialogue close on key (any action or movement key closes it)
  useEffect(() => {
    if (!ui.dialogue) return;
    const onKey = (e) => {
      if (['KeyE', 'Space', 'Escape', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        closeDialogue();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.dialogue, closeDialogue]);

  // Read-only state for play-test validators: window.__game
  useEffect(() => {
    const hook = {};
    const def = (k, fn) => Object.defineProperty(hook, k, { get: fn, enumerable: true });
    def('phase', () => uiRef.current?.phase);
    def('inventory', () => ({ ...(gs.current?.inventory || uiRef.current?.inventory) }));
    def('toolsFound', () => Object.values(gs.current?.inventory || {}).filter(Boolean).length);
    def('player', () => gs.current && { x: gs.current.player.x, y: gs.current.player.y,
      col: Math.floor(gs.current.player.x / TILE), row: Math.floor(gs.current.player.y / TILE) });
    def('dialogueOpen', () => !!uiRef.current?.dialogue);
    def('dialogue', () => uiRef.current?.dialogue ? { id: uiRef.current.dialogue.id, name: uiRef.current.dialogue.name } : null);
    def('message', () => uiRef.current?.message);
    def('timerMs', () => uiRef.current?.timer);
    def('won', () => uiRef.current?.phase === 'victory' || !!gs.current?.treasure.found);
    def('items', () => gs.current?.items.map(i => ({ id: i.id, x: i.x, y: i.y, collected: i.collected })) || []);
    def('treasure', () => gs.current && { col: gs.current.treasure.col, row: gs.current.treasure.row,
      x: gs.current.treasure.x, y: gs.current.treasure.y, found: gs.current.treasure.found });
    def('npcs', () => gs.current?.npcs.map(n => ({ id: n.id, x: n.x, y: n.y })) || []);
    def('guide', () => gs.current?.guide ? { ...gs.current.guide } : null);
    def('walkTarget', () => gs.current?.walkTarget ? { ...gs.current.walkTarget } : null);
    def('canvasSize', () => ({ w: W, h: H }));
    window.__game = Object.freeze(hook);
    return () => { if (window.__game === hook) delete window.__game; };
  }, []);

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const secs = s % 60;
    return `${m}:${secs.toString().padStart(2, '0')}`;
  };

  const { phase, inventory, message, dialogue, timer, bestTime, finalTime, newBest, actionIcon } = ui;

  const playing = phase === 'playing';

  return (
    <div className="app">
      {/* Left gutter: d-pad (touch devices only) */}
      <div className={`side side-left ${playing ? '' : 'idle'}`}>
        <div
          className="dpad"
          onPointerDown={padDown}
          onPointerMove={padMove}
          onPointerUp={padUp}
          onPointerCancel={padUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className={`dpad-btn dpad-up ${padDir.includes('up') ? 'on' : ''}`} aria-label="Up">&#9650;</div>
          <div className={`dpad-btn dpad-left ${padDir.includes('left') ? 'on' : ''}`} aria-label="Left">&#9664;</div>
          <div className="dpad-hub" />
          <div className={`dpad-btn dpad-right ${padDir.includes('right') ? 'on' : ''}`} aria-label="Right">&#9654;</div>
          <div className={`dpad-btn dpad-down ${padDir.includes('down') ? 'on' : ''}`} aria-label="Down">&#9660;</div>
        </div>
      </div>

      <div className="wrap">
        <canvas
          ref={cvs}
          width={W}
          height={H}
          className="cvs"
          onPointerDown={islandDown}
          onPointerMove={islandMove}
          onPointerUp={islandUp}
          onPointerCancel={islandUp}
        />

        {/* HUD */}
        {playing && (
          <div className="hud">
            <div className="hud-left">
              <div className="inv-slots">
                {TOOL_ORDER.map(t => (
                  <div key={t} className={`inv-slot ${inventory[t] ? 'has' : ''}`} title={t}>
                    <span className={inventory[t] ? 'inv-icon' : 'inv-icon inv-ghost'}>{TOOL_ICONS[t]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hud-right">
              <div className="timer">{formatTime(timer)}</div>
            </div>
          </div>
        )}

        {/* Message banner */}
        {message && playing && (
          <div className="msg-banner">{message}</div>
        )}

        {/* Dialogue box: tap anywhere on it to close */}
        {dialogue && (
          <div className="dialogue-box" onClick={closeDialogue}>
            <div className="dialogue-name">{dialogue.name}</div>
            {dialogue.icons?.length > 0 && (
              <div className="dialogue-icons">
                {dialogue.icons.map((ic, i) => (
                  <span key={i} className={`dlg-icon ${ic.done ? 'done' : ''} ${ic.todo ? 'todo' : ''} ${ic.warn ? 'warn' : ''}`}>
                    {ic.e}
                  </span>
                ))}
              </div>
            )}
            <div className="dialogue-text">{dialogue.text}</div>
            <div className="dialogue-hint">{touch ? '\u{1F446} OK' : 'Press [E] to close'}</div>
          </div>
        )}

        {/* Title screen */}
        {phase === 'title' && (
          <div className="ov">
            <div className="ov-inner title-screen">
              <h1>Treasure Hunt Island</h1>
              <div className="title-pics" aria-label="Find the shovel, map and compass, then dig up the treasure">
                <span>{TOOL_ICONS.shovel}</span>
                <span>{TOOL_ICONS.map}</span>
                <span>{TOOL_ICONS.compass}</span>
                <span className="title-arrow">&#10140;</span>
                <span className="title-chest">{'\u{1F4B0}'}</span>
              </div>
              <p className="sub">Find the tools, then dig up the treasure!</p>
              {!touch && (
                <div className="how-to-play">
                  <div className="how-row"><span className="how-key">Arrows / click</span> Walk</div>
                  <div className="how-row"><span className="how-key">E / Space</span> Talk / Dig</div>
                  <div className="how-row"><span className="how-key">{'\u{1F980}'}</span> Crabs pinch!</div>
                </div>
              )}
              {bestTime > 0 && <p className="best-time">Best Time: {formatTime(bestTime)}</p>}
              <button className="btn btn-play" onClick={startGame}>&#9654; Play</button>
            </div>
          </div>
        )}

        {/* Victory screen */}
        {phase === 'victory' && (
          <div className="ov">
            <div className="ov-inner victory-screen">
              <div className="victory-chest">{'\u{1F4B0}'}</div>
              <h1>Treasure Found!</h1>
              <p className="final-time">Time: {formatTime(finalTime)}</p>
              {newBest && <p className="new-best">New Best Time!</p>}
              <p className="best-time">Best: {formatTime(bestTime)}</p>
              <button className="btn btn-play" onClick={startGame}>&#8635; Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Right gutter: action button (touch devices only) */}
      <div className={`side side-right ${playing ? '' : 'idle'}`}>
        <button
          className="action-btn"
          aria-label="Action"
          onPointerDown={(e) => { e.preventDefault(); mobileInteract(); }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="action-icon">{dialogue ? '\u{1F44D}' : actionIcon}</span>
        </button>
      </div>
    </div>
  );
}
