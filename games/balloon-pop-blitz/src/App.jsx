import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const W = 400;
const H = 600;

const CONFIGS = [
  { color: '#FF4444', hi: '#FF9999', pts: 1, w: 35, r: 28 },
  { color: '#3399FF', hi: '#88CCFF', pts: 2, w: 25, r: 28 },
  { color: '#44BB44', hi: '#99EE99', pts: 2, w: 15, r: 28 },
  { color: '#FF9900', hi: '#FFCC66', pts: 3, w: 10, r: 26 },
  { color: '#BB33FF', hi: '#DD99FF', pts: 4, w:  7, r: 26 },
  { color: '#00CCFF', hi: '#88EEFF', pts: 5, w:  4, r: 32, pu: 'slow'  },
  { color: '#FFD700', hi: '#FFEE88', pts: 5, w:  4, r: 32, pu: 'multi' },
];
const TOTAL_W = CONFIGS.reduce((s, c) => s + c.w, 0);

function pickConfig() {
  let r = Math.random() * TOTAL_W;
  for (const c of CONFIGS) { r -= c.w; if (r <= 0) return c; }
  return CONFIGS[0];
}

let uid = 0;

function newBalloon(lvl) {
  const c = pickConfig();
  const spd = 0.7 + lvl * 0.08 + Math.random() * 0.3;
  return {
    id: uid++,
    x: c.r + Math.random() * (W - c.r * 2),
    y: H + c.r + 15,
    r: c.r,
    color: c.color,
    hi: c.hi,
    pts: c.pts,
    pu: c.pu || null,
    spd,
    wob: Math.random() * Math.PI * 2,
    wobF: 0.015 + Math.random() * 0.02,
    wobA: 0.4 + Math.random() * 0.6,
    str: 12 + Math.random() * 6,
    popped: false,
    popT: 0,
  };
}

function drawBalloon(ctx, b) {
  // String
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + b.r);
  ctx.quadraticCurveTo(b.x + 4, b.y + b.r + b.str * 0.5, b.x, b.y + b.r + b.str);
  ctx.strokeStyle = 'rgba(100,100,100,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.ellipse(b.x, b.y, b.r, b.r * 1.1, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(
    b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.05,
    b.x, b.y, b.r * 1.2
  );
  g.addColorStop(0, b.hi);
  g.addColorStop(0.5, b.color);
  g.addColorStop(1, b.color + '99');
  ctx.fillStyle = g;
  ctx.fill();

  // Highlight
  ctx.beginPath();
  ctx.ellipse(b.x - b.r * 0.28, b.y - b.r * 0.3, b.r * 0.18, b.r * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fill();

  // Knot
  ctx.beginPath();
  ctx.arc(b.x, b.y + b.r * 0.95, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = b.color;
  ctx.fill();

  // Power-up icon
  if (b.pu) {
    ctx.font = `${Math.round(b.r * 0.75)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.pu === 'slow' ? '⏱' : '💥', b.x, b.y);
  }
}

function drawCloud(ctx, x, y, s) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, s, 0, Math.PI * 2);
  ctx.arc(x + s * 0.65, y - s * 0.2, s * 0.75, 0, Math.PI * 2);
  ctx.arc(x + s * 1.25, y, s * 0.85, 0, Math.PI * 2);
  ctx.arc(x + s * 0.65, y + s * 0.25, s * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export default function App() {
  const cvs = useRef(null);
  const gs = useRef(null);
  const [ui, setUi] = useState({
    phase: 'idle',
    score: 0,
    lives: 3,
    lvl: 1,
    hs: parseInt(localStorage.getItem('bpb-hs') || '0'),
    pu: null,
    puPct: 0,
    newHs: false,
  });

  const updateUi = useCallback((patch) => setUi(u => ({ ...u, ...patch })), []);

  const startGame = useCallback(() => {
    uid = 0;
    gs.current = {
      balloons: [],
      score: 0,
      lives: 3,
      lvl: 1,
      pu: null,
      puEnd: 0,
      lastSpawn: 0,
      lastTime: 0,
      popups: [],
      active: true,
    };
    updateUi({ phase: 'playing', score: 0, lives: 3, lvl: 1, pu: null, puPct: 0, newHs: false });
  }, [updateUi]);

  const handlePop = useCallback((clientX, clientY) => {
    const g = gs.current;
    if (!g || !g.active) return;
    const rect = cvs.current.getBoundingClientRect();
    const x = (clientX - rect.left) * (W / rect.width);
    const y = (clientY - rect.top) * (H / rect.height);

    let hit = null;
    for (let i = g.balloons.length - 1; i >= 0; i--) {
      const b = g.balloons[i];
      if (b.popped) continue;
      if (Math.hypot(b.x - x, b.y - y) <= b.r * 1.15) { hit = b; break; }
    }
    if (!hit) return;

    const toPopSet = new Set([hit.id]);
    if (hit.pu === 'multi' || g.pu === 'multi') {
      for (const b of g.balloons) {
        if (!b.popped && b.id !== hit.id && Math.hypot(b.x - hit.x, b.y - hit.y) < 90)
          toPopSet.add(b.id);
      }
    }

    let pts = 0;
    for (const b of g.balloons) {
      if (toPopSet.has(b.id)) { b.popped = true; b.popT = 0; pts += b.pts; }
    }

    if (hit.pu) {
      g.pu = hit.pu;
      g.puEnd = performance.now() + 5000;
    }

    g.score += pts;
    g.popups.push({ x: hit.x, y: hit.y - hit.r, txt: `+${pts}`, a: 1 });

    const newLvl = Math.floor(g.score / 30) + 1;
    if (newLvl !== g.lvl) g.lvl = newLvl;
    updateUi({ score: g.score, lvl: g.lvl });
  }, [updateUi]);

  // Touch handler (avoids 300ms delay)
  useEffect(() => {
    const el = cvs.current;
    if (!el) return;
    const onTouch = (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      handlePop(t.clientX, t.clientY);
    };
    el.addEventListener('touchstart', onTouch, { passive: false });
    return () => el.removeEventListener('touchstart', onTouch);
  }, [handlePop]);

  // Main game loop
  useEffect(() => {
    if (ui.phase !== 'playing' || !gs.current || !gs.current.active) return;
    const g = gs.current;
    let raf;
    const ctx = cvs.current.getContext('2d');

    const loop = (ts) => {
      if (!g.active) return;
      const dt = g.lastTime ? Math.min(ts - g.lastTime, 50) : 16;
      g.lastTime = ts;

      // Background
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#74B9FF');
      bg.addColorStop(1, '#DFF6FF');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Clouds
      drawCloud(ctx, 50, 70, 38);
      drawCloud(ctx, 260, 130, 32);
      drawCloud(ctx, 140, 210, 28);
      drawCloud(ctx, 330, 280, 25);

      // Power-up expiry
      if (g.pu && ts > g.puEnd) {
        g.pu = null;
        updateUi({ pu: null, puPct: 0 });
      } else if (g.pu) {
        updateUi({ pu: g.pu, puPct: (g.puEnd - ts) / 5000 });
      }

      const sm = g.pu === 'slow' ? 0.3 : 1;
      const spawnInt = Math.max(400, 1800 - (g.lvl - 1) * 120);

      // Spawn
      if (ts - g.lastSpawn > spawnInt) {
        g.balloons.push(newBalloon(g.lvl));
        if (g.lvl > 3 && Math.random() < 0.3) g.balloons.push(newBalloon(g.lvl));
        g.lastSpawn = ts;
      }

      // Update & draw balloons
      let esc = 0;
      const keep = [];
      for (const b of g.balloons) {
        if (b.popped) {
          b.popT += 0.1;
          if (b.popT < 1) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - b.popT);
            ctx.strokeStyle = b.color;
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              const d0 = b.r * 0.3;
              const d1 = b.r * (0.5 + b.popT * 1.5);
              ctx.beginPath();
              ctx.moveTo(b.x + Math.cos(a) * d0, b.y + Math.sin(a) * d0);
              ctx.lineTo(b.x + Math.cos(a) * d1, b.y + Math.sin(a) * d1);
              ctx.stroke();
            }
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2 + b.popT * 2;
              const d = b.r * (0.4 + b.popT * 1.2);
              ctx.beginPath();
              ctx.arc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 4 * (1 - b.popT), 0, Math.PI * 2);
              ctx.fillStyle = b.color;
              ctx.fill();
            }
            ctx.restore();
            keep.push(b);
          }
          continue;
        }

        b.y -= b.spd * sm * (dt / 16);
        b.wob += b.wobF;
        b.x = Math.max(b.r, Math.min(W - b.r, b.x + Math.sin(b.wob) * b.wobA));

        if (b.y < -(b.r + b.str + 10)) { esc++; continue; }
        drawBalloon(ctx, b);
        keep.push(b);
      }
      g.balloons = keep;

      if (esc > 0) {
        g.lives -= esc;
        if (g.lives <= 0) {
          g.active = false;
          const savedHs = parseInt(localStorage.getItem('bpb-hs') || '0');
          const isNewHs = g.score > savedHs;
          if (isNewHs) localStorage.setItem('bpb-hs', g.score);
          updateUi({
            phase: 'gameover',
            lives: 0,
            hs: isNewHs ? g.score : savedHs,
            newHs: isNewHs,
          });
          return;
        }
        updateUi({ lives: g.lives });
      }

      // Score popups
      const kp = [];
      for (const p of g.popups) {
        p.y -= 1.2;
        p.a -= 0.022;
        if (p.a <= 0) continue;
        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(p.txt, p.x, p.y);
        ctx.fillStyle = '#FFD700';
        ctx.fillText(p.txt, p.x, p.y);
        ctx.restore();
        kp.push(p);
      }
      g.popups = kp;

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ui.phase, updateUi]);

  const { phase, score, lives, lvl, hs, pu, puPct, newHs } = ui;

  return (
    <div className="app">
      <div className="hud">
        <div className="stat">
          <div className="sl">Score</div>
          <div className="sv">{score}</div>
        </div>
        <div className="stat">
          <div className="sl">Lives</div>
          <div className="sv">{Array.from({ length: Math.max(0, lives) }, () => '❤️').join('')}</div>
        </div>
        <div className="stat">
          <div className="sl">Level</div>
          <div className="sv">{lvl}</div>
        </div>
        <div className="stat">
          <div className="sl">Best</div>
          <div className="sv">{hs}</div>
        </div>
      </div>

      {pu && (
        <div className="pu-wrap">
          <span className="pu-label">{pu === 'slow' ? '⏱️ SLOW MOTION' : '💥 MULTI-POP'}</span>
          <div className="pu-track">
            <div className="pu-fill" style={{ width: `${puPct * 100}%` }} />
          </div>
        </div>
      )}

      <div className="wrap">
        <canvas
          ref={cvs}
          width={W}
          height={H}
          className="cvs"
          onClick={e => handlePop(e.clientX, e.clientY)}
        />

        {phase === 'idle' && (
          <div className="ov">
            <div className="ov-inner">
              <h1>🎈 Balloon Pop Blitz</h1>
              <p className="sub">Pop balloons before they fly away!</p>
              <div className="leg">
                {[
                  ['#FF4444', 'Red — 1 pt'],
                  ['#3399FF', 'Blue — 2 pts'],
                  ['#44BB44', 'Green — 2 pts'],
                  ['#FF9900', 'Orange — 3 pts'],
                  ['#BB33FF', 'Purple — 4 pts'],
                  ['#00CCFF', '⏱️ Cyan — Slow Motion!'],
                  ['#FFD700', '💥 Gold — Multi-Pop!'],
                ].map(([c, l]) => (
                  <div key={c} className="lr">
                    <span className="ld" style={{ background: c }} />
                    <span>{l}</span>
                  </div>
                ))}
              </div>
              <p className="miss-note">Miss a balloon = lose a life. 3 lives total.</p>
              {hs > 0 && <p className="hsp">Best: {hs}</p>}
              <button className="btn" onClick={startGame}>Start Game</button>
            </div>
          </div>
        )}

        {phase === 'gameover' && (
          <div className="ov">
            <div className="ov-inner">
              <h1>💥 Game Over!</h1>
              <p className="fs">Score: {score}</p>
              {newHs && <p className="nhs">🏆 New High Score!</p>}
              <p className="hsp">Best: {hs}</p>
              <button className="btn" onClick={startGame}>Play Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
