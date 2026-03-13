import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const W = 400;
const H = 700;
const BALLS_PER_GAME = 9;
const LANE_LEFT = 60;
const LANE_RIGHT = W - 60;
const LANE_W = LANE_RIGHT - LANE_LEFT;
const SCORE_ZONE_Y = 180;
const LAUNCH_Y = 540;
const BALL_R = 14;
const MAX_DRAG = 140;
const RAMP_LIP_Y = 210;
const TARGET_SCORES = [200, 250, 300, 350, 400, 450];

// ─── Audio ────────────────────────────────────────────────────────────────────
function createAudio() {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };

  const playTone = (freq, type, duration, gainStart, gainEnd, delay = 0) => {
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
      gain.gain.setValueAtTime(gainStart, ac.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(gainEnd, 0.001),
        ac.currentTime + delay + duration
      );
      osc.start(ac.currentTime + delay);
      osc.stop(ac.currentTime + delay + duration);
    } catch (_) {}
  };

  return {
    score(pts) {
      const freq = 220 + pts * 4;
      playTone(freq, 'sine', 0.15, 0.3, 0.01);
      if (pts >= 30) playTone(freq * 1.5, 'sine', 0.1, 0.2, 0.01, 0.1);
    },
    jackpot() {
      [523, 659, 784, 1047].forEach((f, i) => playTone(f, 'sine', 0.25, 0.35, 0.01, i * 0.1));
    },
    miss() {
      try {
        const ac = getCtx();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ac.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
        osc.start();
        osc.stop(ac.currentTime + 0.3);
      } catch (_) {}
    },
    fanfare() {
      [523, 659, 784, 1047, 784, 1047, 1175].forEach((f, i) =>
        playTone(f, 'sine', 0.2, 0.4, 0.01, i * 0.12)
      );
    },
  };
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────
function drawLane(ctx, ballRolling, laneOffset) {
  const woodGrad = ctx.createLinearGradient(LANE_LEFT, RAMP_LIP_Y, LANE_LEFT, H);
  woodGrad.addColorStop(0, '#B8860B');
  woodGrad.addColorStop(0.3, '#CD9B1D');
  woodGrad.addColorStop(0.7, '#DAA520');
  woodGrad.addColorStop(1, '#B8860B');
  ctx.fillStyle = woodGrad;
  ctx.beginPath();
  ctx.roundRect(LANE_LEFT - 4, RAMP_LIP_Y, LANE_W + 8, H - RAMP_LIP_Y, [0, 0, 8, 8]);
  ctx.fill();

  // Wood grain lines (shift when rolling for motion effect)
  ctx.strokeStyle = 'rgba(139,90,0,0.15)';
  ctx.lineWidth = 1;
  for (let y = RAMP_LIP_Y + 20; y < H; y += 30) {
    const yOff = ballRolling
      ? RAMP_LIP_Y + ((y - RAMP_LIP_Y + laneOffset) % (H - RAMP_LIP_Y))
      : y;
    ctx.beginPath();
    ctx.moveTo(LANE_LEFT, yOff + Math.sin(yOff * 0.1) * 3);
    ctx.bezierCurveTo(
      LANE_LEFT + LANE_W * 0.3, yOff + 4,
      LANE_LEFT + LANE_W * 0.7, yOff - 3,
      LANE_RIGHT, yOff + Math.sin(yOff * 0.15) * 2
    );
    ctx.stroke();
  }

  // Motion speed-lines while rolling
  if (ballRolling) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const lineX = LANE_LEFT + 20 + i * ((LANE_W - 40) / 4);
      const lineY = RAMP_LIP_Y + ((laneOffset * 2 + i * 80) % (H - RAMP_LIP_Y));
      ctx.beginPath();
      ctx.moveTo(lineX, lineY);
      ctx.lineTo(lineX, lineY + 30);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Gutters
  const gg1 = ctx.createLinearGradient(LANE_LEFT - 12, 0, LANE_LEFT, 0);
  gg1.addColorStop(0, '#5C3A0E');
  gg1.addColorStop(1, '#7A4D1A');
  ctx.fillStyle = gg1;
  ctx.fillRect(LANE_LEFT - 12, RAMP_LIP_Y, 12, H - RAMP_LIP_Y);

  const gg2 = ctx.createLinearGradient(LANE_RIGHT, 0, LANE_RIGHT + 12, 0);
  gg2.addColorStop(0, '#7A4D1A');
  gg2.addColorStop(1, '#5C3A0E');
  ctx.fillStyle = gg2;
  ctx.fillRect(LANE_RIGHT, RAMP_LIP_Y, 12, H - RAMP_LIP_Y);

  // Center guide
  ctx.strokeStyle = 'rgba(139,90,0,0.12)';
  ctx.setLineDash([8, 12]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, RAMP_LIP_Y + 20);
  ctx.lineTo(W / 2, H - 30);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawScoringZone(ctx, holeFlash) {
  const zoneGrad = ctx.createLinearGradient(0, 0, 0, SCORE_ZONE_Y);
  zoneGrad.addColorStop(0, '#1a1a2e');
  zoneGrad.addColorStop(1, '#2a2040');
  ctx.fillStyle = zoneGrad;
  ctx.beginPath();
  ctx.roundRect(LANE_LEFT - 16, 0, LANE_W + 32, SCORE_ZONE_Y, [12, 12, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#3a2a50';
  ctx.fillRect(LANE_LEFT - 16, 0, 8, SCORE_ZONE_Y);
  ctx.fillRect(LANE_RIGHT + 8, 0, 8, SCORE_ZONE_Y);

  const cx = W / 2;
  const cy = SCORE_ZONE_Y - 65;

  const rings = [
    { r: 100, color: '#334422', border: '#AABB44' },
    { r: 78,  color: '#224433', border: '#33CC66' },
    { r: 58,  color: '#222244', border: '#3399FF' },
    { r: 38,  color: '#332244', border: '#CC33FF' },
  ];
  for (const ring of rings) {
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.fillStyle = ring.color;
    ctx.fill();
    ctx.strokeStyle = ring.border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('10', cx + 88, cy);
  ctx.fillText('20', cx + 66, cy);
  ctx.fillText('30', cx + 46, cy);
  ctx.fillText('40', cx + 26, cy);

  const holes = [
    { cx: W / 2,            cy: 55, r: 18, color: '#FF3366', pts: 100 },
    { cx: LANE_LEFT + 40,   cy: 45, r: 16, color: '#FF9900', pts: 50  },
    { cx: LANE_RIGHT - 40,  cy: 45, r: 16, color: '#FF9900', pts: 50  },
  ];

  for (const h of holes) {
    const isFlashing = holeFlash && Math.hypot(h.cx - holeFlash.cx, h.cy - holeFlash.cy) < 5;
    const flashProg = isFlashing ? 1 - holeFlash.t / holeFlash.maxT : 0;

    // Hole shadow
    ctx.beginPath();
    ctx.arc(h.cx, h.cy, h.r + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    // Flash glow
    if (flashProg > 0) {
      ctx.save();
      ctx.globalAlpha = flashProg * 0.85;
      const pulseR = h.r * (1.6 + Math.sin(holeFlash.t * 0.6) * 0.3);
      ctx.beginPath();
      ctx.arc(h.cx, h.cy, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = h.color;
      ctx.fill();
      ctx.restore();
    }

    // Hole body
    const hGrad = ctx.createRadialGradient(h.cx, h.cy, 0, h.cx, h.cy, h.r);
    hGrad.addColorStop(0, '#000');
    hGrad.addColorStop(0.6, '#111');
    hGrad.addColorStop(0.85, h.color + '88');
    hGrad.addColorStop(1, h.color);
    ctx.beginPath();
    ctx.arc(h.cx, h.cy, h.r, 0, Math.PI * 2);
    ctx.fillStyle = hGrad;
    ctx.fill();

    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(h.pts.toString(), h.cx, h.cy);
  }
}

function drawRampLip(ctx) {
  const lipGrad = ctx.createLinearGradient(0, RAMP_LIP_Y - 15, 0, RAMP_LIP_Y + 15);
  lipGrad.addColorStop(0, '#8B6914');
  lipGrad.addColorStop(0.3, '#DAA520');
  lipGrad.addColorStop(0.5, '#F5DEB3');
  lipGrad.addColorStop(0.7, '#DAA520');
  lipGrad.addColorStop(1, '#8B6914');
  ctx.fillStyle = lipGrad;
  ctx.beginPath();
  ctx.roundRect(LANE_LEFT - 16, RAMP_LIP_Y - 8, LANE_W + 32, 22, 4);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LANE_LEFT - 10, RAMP_LIP_Y - 4);
  ctx.lineTo(LANE_RIGHT + 10, RAMP_LIP_Y - 4);
  ctx.stroke();
}

function drawBall(ctx, x, y, r, shadow, rotation = 0) {
  if (shadow) {
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 4, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
  }

  const ballGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  ballGrad.addColorStop(0, '#FFFFFF');
  ballGrad.addColorStop(0.3, '#DDDDEE');
  ballGrad.addColorStop(0.7, '#8888AA');
  ballGrad.addColorStop(1, '#555577');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = ballGrad;
  ctx.fill();

  // Rotation stripe (clip to ball)
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(80, 60, 120, 0.45)';
  ctx.lineWidth = r * 0.45;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(rotation) * r * 1.3, y + Math.sin(rotation) * r * 1.3);
  ctx.lineTo(x - Math.cos(rotation) * r * 1.3, y - Math.sin(rotation) * r * 1.3);
  ctx.stroke();
  ctx.restore();

  // Shine
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25, y - r * 0.25, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
}

function drawAimGuide(ctx, startX, startY, nx, ny, power) {
  const len = power * 2.5;
  const endX = startX + nx * len;
  const endY = startY + ny * len;

  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  const arrowLen = 10;
  const arrowAngle = 0.4;
  const tipAngle = Math.atan2(-ny, nx);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - Math.cos(tipAngle - arrowAngle) * arrowLen,
    endY + Math.sin(tipAngle - arrowAngle) * arrowLen
  );
  ctx.lineTo(
    endX - Math.cos(tipAngle + arrowAngle) * arrowLen,
    endY + Math.sin(tipAngle + arrowAngle) * arrowLen
  );
  ctx.closePath();
  ctx.fill();

  const barW = 80;
  const barH = 6;
  const barX = startX - barW / 2;
  const barY = startY + 25;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 3);
  ctx.fill();

  const pct = power / MAX_DRAG;
  const fillColor = pct < 0.5 ? '#44DD66' : pct < 0.8 ? '#FFAA00' : '#FF4444';
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * pct, barH, 3);
  ctx.fill();
}

function drawBallIndicators(ctx, currentBall, totalBalls) {
  const spacing = 20;
  const r = 6;
  const totalW = (totalBalls - 1) * spacing;
  const startX = W / 2 - totalW / 2;
  const y = H - 18;

  for (let i = 0; i < totalBalls; i++) {
    const x = startX + i * spacing;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (i < currentBall) {
      ctx.fillStyle = 'rgba(100,100,100,0.5)';
      ctx.fill();
    } else if (i === currentBall) {
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(200,200,200,0.3)';
      ctx.fill();
    }
  }
}

function calcScore(x, y) {
  const cx = W / 2;
  const cy = SCORE_ZONE_Y - 65;

  const holes = [
    { cx: W / 2,           cy: 55, r: 18, pts: 100 },
    { cx: LANE_LEFT + 40,  cy: 45, r: 16, pts: 50  },
    { cx: LANE_RIGHT - 40, cy: 45, r: 16, pts: 50  },
  ];

  for (const h of holes) {
    if (Math.hypot(x - h.cx, y - h.cy) < h.r + 6) {
      return { pts: h.pts, hx: h.cx, hy: h.cy };
    }
  }

  const dist = Math.hypot(x - cx, y - cy);
  if (dist < 38)  return { pts: 40, hx: cx, hy: cy };
  if (dist < 58)  return { pts: 30, hx: x,  hy: y  };
  if (dist < 78)  return { pts: 20, hx: x,  hy: y  };
  if (dist < 100) return { pts: 10, hx: x,  hy: y  };
  return { pts: 0, hx: x, hy: y };
}

function getGrade(avgScore) {
  if (avgScore >= 80) return { letter: 'S', color: '#FFD700', label: 'Perfect!' };
  if (avgScore >= 60) return { letter: 'A', color: '#44DD66', label: 'Excellent!' };
  if (avgScore >= 40) return { letter: 'B', color: '#3399FF', label: 'Great!' };
  if (avgScore >= 20) return { letter: 'C', color: '#FF9900', label: 'Good' };
  return { letter: 'D', color: '#FF6666', label: 'Keep practicing!' };
}

function shotColor(pts) {
  if (pts >= 100) return '#FF3366';
  if (pts >= 50)  return '#FF9900';
  if (pts >= 30)  return '#3399FF';
  if (pts >= 10)  return '#33CC66';
  return '#555';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function App() {
  const cvs = useRef(null);
  const gs = useRef(null);
  const audioRef = useRef(null);
  const [ui, setUi] = useState({
    phase: 'idle',
    score: 0,
    displayScore: 0,
    currentBall: 0,
    hs: parseInt(localStorage.getItem('sb-hs') || '0'),
    newHs: false,
    lastScore: null,
    streak: 0,
    shotHistory: [],
    mode: 'normal',
    timedLeft: 45,
    targetScore: null,
  });

  const updateUi = useCallback((patch) => setUi(u => ({ ...u, ...patch })), []);

  // Animate display score toward real score
  useEffect(() => {
    if (ui.displayScore === ui.score) return;
    const diff = ui.score - ui.displayScore;
    const step = Math.max(1, Math.ceil(Math.abs(diff) / 8));
    const t = setTimeout(() => {
      setUi(u => ({
        ...u,
        displayScore: diff > 0
          ? Math.min(u.displayScore + step, u.score)
          : Math.max(u.displayScore - step, u.score),
      }));
    }, 30);
    return () => clearTimeout(t);
  }, [ui.displayScore, ui.score]);

  const getAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = createAudio();
    return audioRef.current;
  }, []);

  const startGame = useCallback((mode, targetScore = null) => {
    gs.current = {
      ball: { x: W / 2, y: LAUNCH_Y, vx: 0, vy: 0, active: false, angle: 0 },
      trail: [],
      drag: { active: false, startX: 0, startY: 0, curX: 0, curY: 0 },
      turnPhase: 'aiming',
      currentBall: 0,
      score: 0,
      streak: 0,
      shotHistory: [],
      popups: [],
      particles: [],
      confetti: [],
      sinkAnim: null,
      holeFlash: null,
      cameraShake: null,
      nextBallTimer: 0,
      lastTime: 0,
      active: true,
      mode,
      timedLeft: mode === 'timed' ? 45 : null,
      timedFrac: mode === 'timed' ? 45 : null,
      timedLastTs: null,
      targetScore,
      laneOffset: 0,
    };
    updateUi({
      phase: 'playing',
      score: 0,
      displayScore: 0,
      currentBall: 0,
      newHs: false,
      lastScore: null,
      streak: 0,
      shotHistory: [],
      mode,
      timedLeft: mode === 'timed' ? 45 : null,
      targetScore,
    });
  }, [updateUi]);

  const getCanvasPos = useCallback((clientX, clientY) => {
    const rect = cvs.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (W / rect.width),
      y: (clientY - rect.top) * (H / rect.height),
    };
  }, []);

  const handleDown = useCallback((clientX, clientY) => {
    const g = gs.current;
    if (!g || !g.active || g.turnPhase !== 'aiming') return;
    const pos = getCanvasPos(clientX, clientY);
    const dist = Math.hypot(pos.x - g.ball.x, pos.y - g.ball.y);
    if (dist < 60) {
      g.drag = { active: true, startX: pos.x, startY: pos.y, curX: pos.x, curY: pos.y };
    }
  }, [getCanvasPos]);

  const handleMove = useCallback((clientX, clientY) => {
    const g = gs.current;
    if (!g || !g.drag.active) return;
    const pos = getCanvasPos(clientX, clientY);
    g.drag.curX = pos.x;
    g.drag.curY = pos.y;
  }, [getCanvasPos]);

  const handleUp = useCallback(() => {
    const g = gs.current;
    if (!g || !g.drag.active) return;
    g.drag.active = false;

    const dx = g.drag.startX - g.drag.curX;
    const dy = g.drag.startY - g.drag.curY;
    const dist = Math.hypot(dx, dy);
    if (dist < 15) return;

    const power = Math.min(dist, MAX_DRAG);
    const nx = dx / dist;
    const ny = dy / dist;
    const speed = (power / MAX_DRAG) * 12 + 3;

    let vx = nx * speed;
    let vy = ny * speed;
    // Constrain sideways throw to 40% of forward velocity
    const maxVx = Math.abs(vy) * 0.4;
    if (Math.abs(vx) > maxVx) vx = Math.sign(vx) * maxVx;

    g.ball.vx = vx;
    g.ball.vy = vy;
    g.ball.active = true;
    g.turnPhase = 'rolling';
  }, []);

  // Touch handlers
  useEffect(() => {
    const el = cvs.current;
    if (!el) return;
    const onTouchStart = (e) => { e.preventDefault(); const t = e.touches[0]; handleDown(t.clientX, t.clientY); };
    const onTouchMove  = (e) => { e.preventDefault(); const t = e.touches[0]; handleMove(t.clientX, t.clientY); };
    const onTouchEnd   = (e) => { e.preventDefault(); handleUp(); };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, [handleDown, handleMove, handleUp]);

  useEffect(() => {
    const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const onMouseUp   = () => handleUp();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [handleMove, handleUp]);

  // Main game loop
  useEffect(() => {
    if (ui.phase !== 'playing' || !gs.current || !gs.current.active) return;
    const g = gs.current;
    let raf;
    const ctx = cvs.current.getContext('2d');

    const endTurn = (pts, hx, hy, label) => {
      const audio = getAudio();
      if (pts > 0) {
        g.streak++;
        if (pts === 100) {
          audio.jackpot();
          g.cameraShake = { t: 0, maxT: 20, magnitude: 5 };
          g.holeFlash = { cx: hx, cy: hy, t: 0, maxT: 30 };
        } else if (pts >= 50) {
          audio.score(pts);
          g.holeFlash = { cx: hx, cy: hy, t: 0, maxT: 25 };
        } else {
          audio.score(pts);
        }
        // Sparkle particles
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          g.particles.push({
            x: hx, y: hy,
            vx: Math.cos(a) * (2 + Math.random() * 3),
            vy: Math.sin(a) * (2 + Math.random() * 3),
            life: 1,
            color: ['#FFD700','#FF6B6B','#44DD66','#66BBFF','#FF9900'][i % 5],
          });
        }
      } else {
        g.streak = 0;
        audio.miss();
      }

      g.score += pts;
      g.shotHistory.push(pts);
      g.sinkAnim = { x: hx, y: hy, pts, t: 0, maxT: pts > 0 ? 40 : 30 };

      let popupTxt = label;
      if (pts > 0) {
        if (g.streak >= 3) popupTxt = `+${pts} ${g.streak}× Streak!`;
        else if (g.streak === 2) popupTxt = `+${pts} Double!`;
        else popupTxt = `+${pts}`;
      }
      g.popups.push({ x: hx, y: hy - 20, txt: popupTxt, a: 1, color: pts > 0 ? '#FFD700' : '#FF6666' });

      g.ball.active = false;
      g.turnPhase = 'scoring';
      updateUi({ score: g.score, lastScore: pts, streak: g.streak, shotHistory: [...g.shotHistory] });
    };

    const finishGame = () => {
      g.active = false;
      const savedHs = parseInt(localStorage.getItem('sb-hs') || '0');
      const isNewHs = g.mode !== 'practice' && g.score > savedHs;
      if (isNewHs) {
        localStorage.setItem('sb-hs', g.score);
        getAudio().fanfare();
        // Confetti burst
        for (let i = 0; i < 60; i++) {
          g.confetti.push({
            x: Math.random() * W, y: -10,
            vx: (Math.random() - 0.5) * 3,
            vy: 2 + Math.random() * 3,
            color: ['#FFD700','#FF6B6B','#44DD66','#66BBFF','#FF9900','#CC33FF'][i % 6],
            r: 3 + Math.random() * 4,
            rot: Math.random() * Math.PI * 2,
            rotV: (Math.random() - 0.5) * 0.2,
            life: 1,
          });
        }
      }
      updateUi({
        phase: 'gameover',
        currentBall: BALLS_PER_GAME,
        hs: isNewHs ? g.score : savedHs,
        newHs: isNewHs,
        shotHistory: [...g.shotHistory],
      });
    };

    const loop = (ts) => {
      if (!g.active) return;
      const dt = g.lastTime ? Math.min(ts - g.lastTime, 50) : 16;
      g.lastTime = ts;

      // --- UPDATE ---

      // Timed mode: count down only while aiming
      if (g.mode === 'timed') {
        if (g.turnPhase === 'aiming') {
          if (g.timedLastTs !== null) {
            g.timedFrac -= (ts - g.timedLastTs) / 1000;
          }
          g.timedLastTs = ts;
          if (g.timedFrac <= 0) {
            g.timedFrac = 0;
            updateUi({ timedLeft: 0 });
            finishGame();
            return;
          }
          const newLeft = Math.ceil(g.timedFrac);
          if (newLeft !== g.timedLeft) {
            g.timedLeft = newLeft;
            updateUi({ timedLeft: newLeft });
          }
        } else {
          g.timedLastTs = ts; // pause timer while rolling
        }
      }

      if (g.turnPhase === 'rolling' && g.ball.active) {
        const ball = g.ball;
        const steps = 3;
        const subDt = dt / steps;
        let guttered = false;

        for (let s = 0; s < steps; s++) {
          ball.x += ball.vx * (subDt / 16);
          ball.y += ball.vy * (subDt / 16);

          // Update rotation based on velocity
          ball.angle += ball.vx * 0.05 + (ball.vy < 0 ? 0.08 : -0.03);

          ball.vx *= 0.997;
          ball.vy *= 0.997;

          if (ball.vy < 0) ball.vy += 0.02 * (subDt / 16);

          // GUTTER: hitting side wall = miss (no bounce)
          if (ball.x < LANE_LEFT + BALL_R || ball.x > LANE_RIGHT - BALL_R) {
            endTurn(0, ball.x, ball.y, 'Gutter!');
            guttered = true;
            break;
          }

          if (ball.y < RAMP_LIP_Y && ball.vy < 0) {
            ball.vy += 0.06 * (subDt / 16);
          }
        }

        // Lane animation
        g.laneOffset = (g.laneOffset + Math.abs(g.ball.vy) * 0.5) % (H - RAMP_LIP_Y);

        // Trail
        g.trail.push({ x: ball.x, y: ball.y });
        if (g.trail.length > 8) g.trail.shift();

        if (!guttered) {
          const speed = Math.hypot(ball.vx, ball.vy);

          if (ball.y > H + 20) {
            endTurn(0, ball.x, LAUNCH_Y, 'Miss!');
          } else if (ball.y < SCORE_ZONE_Y && speed < 1.5) {
            const result = calcScore(ball.x, ball.y);
            endTurn(result.pts, result.hx, result.hy, result.pts > 0 ? `+${result.pts}` : 'Miss!');
          } else if (speed < 0.3 && ball.y > RAMP_LIP_Y + 20) {
            // Only trigger "too weak" if clearly below the ramp lip (not in scoring zone)
            endTurn(0, ball.x, ball.y, 'Too weak!');
          }
        }
      }

      // Sink animation
      if (g.turnPhase === 'scoring' && g.sinkAnim) {
        g.sinkAnim.t++;
        if (g.sinkAnim.t >= g.sinkAnim.maxT) {
          g.sinkAnim = null;
          g.turnPhase = 'nextBall';
          g.nextBallTimer = ts;
          g.trail = [];
        }
      }

      if (g.holeFlash) {
        g.holeFlash.t++;
        if (g.holeFlash.t >= g.holeFlash.maxT) g.holeFlash = null;
      }

      if (g.cameraShake) {
        g.cameraShake.t++;
        if (g.cameraShake.t >= g.cameraShake.maxT) g.cameraShake = null;
      }

      // Next ball
      if (g.turnPhase === 'nextBall') {
        const delay = g.mode === 'timed' ? 200 : 600;
        if (ts - g.nextBallTimer > delay) {
          g.currentBall++;
          const maxBalls = g.mode === 'practice' ? Infinity : BALLS_PER_GAME;
          if (g.currentBall >= maxBalls) {
            finishGame();
            return;
          }
          g.ball = { x: W / 2, y: LAUNCH_Y, vx: 0, vy: 0, active: false, angle: 0 };
          g.turnPhase = 'aiming';
          updateUi({ currentBall: g.currentBall });
        }
      }

      // Particles
      g.particles = g.particles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 0.025;
        return p.life > 0;
      });

      // Confetti
      g.confetti = g.confetti.filter(c => {
        c.x += c.vx; c.y += c.vy; c.rot += c.rotV; c.life -= 0.005;
        return c.life > 0 && c.y < H + 20;
      });

      // --- RENDER ---

      let shakeX = 0, shakeY = 0;
      if (g.cameraShake) {
        const prog = 1 - g.cameraShake.t / g.cameraShake.maxT;
        shakeX = (Math.random() - 0.5) * g.cameraShake.magnitude * prog;
        shakeY = (Math.random() - 0.5) * g.cameraShake.magnitude * prog;
      }

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (shakeX || shakeY) ctx.translate(shakeX, shakeY);

      ctx.fillStyle = '#0f0e17';
      ctx.fillRect(-10, -10, W + 20, H + 20);

      drawScoringZone(ctx, g.holeFlash);
      drawRampLip(ctx);
      drawLane(ctx, g.turnPhase === 'rolling' && g.ball.active, g.laneOffset);

      // Trail
      for (let i = 0; i < g.trail.length; i++) {
        const t = g.trail[i];
        const alpha = (i / g.trail.length) * 0.3;
        const scale = 0.3 + (i / g.trail.length) * 0.5;
        const pct = (t.y) / LAUNCH_Y;
        const r = BALL_R * (0.55 + pct * 0.45) * scale;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#AAAACC';
        ctx.fill();
        ctx.restore();
      }

      // Ball (rolling)
      if (g.turnPhase === 'rolling' && g.ball.active) {
        const ball = g.ball;
        const pct = ball.y / LAUNCH_Y;
        const scale = 0.55 + pct * 0.45;
        drawBall(ctx, ball.x, ball.y, BALL_R * scale, true, ball.angle);
      }

      // Ball (aiming)
      if (g.turnPhase === 'aiming') {
        drawBall(ctx, g.ball.x, g.ball.y, BALL_R, true, g.ball.angle);
        if (g.drag.active) {
          const dx = g.drag.startX - g.drag.curX;
          const dy = g.drag.startY - g.drag.curY;
          const dist = Math.hypot(dx, dy);
          if (dist > 5) {
            const power = Math.min(dist, MAX_DRAG);
            drawAimGuide(ctx, g.ball.x, g.ball.y, dx / dist, dy / dist, power);
          }
        }
      }

      // Sink animation
      if (g.sinkAnim && g.sinkAnim.pts > 0) {
        const anim = g.sinkAnim;
        const scale = 1 - anim.t / anim.maxT;
        if (scale > 0) {
          ctx.save();
          ctx.globalAlpha = scale;
          drawBall(ctx, anim.x, anim.y, BALL_R * scale * 0.6, false);
          ctx.restore();
        }
      }

      // Particles
      for (const p of g.particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
      }

      // Confetti
      for (const c of g.confetti) {
        ctx.save();
        ctx.globalAlpha = c.life;
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.r / 2, -c.r / 2, c.r, c.r * 0.5);
        ctx.restore();
      }

      // Popups
      const keepPopups = [];
      for (const p of g.popups) {
        p.y -= 1;
        p.a -= 0.018;
        if (p.a <= 0) continue;
        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(p.txt, p.x, p.y);
        ctx.fillStyle = p.color || '#FFD700';
        ctx.fillText(p.txt, p.x, p.y);
        ctx.restore();
        keepPopups.push(p);
      }
      g.popups = keepPopups;

      // Ball indicators (not practice)
      if (g.mode !== 'practice') {
        drawBallIndicators(ctx, g.currentBall, BALLS_PER_GAME);
      }

      // Streak badge
      if (g.streak >= 2) {
        ctx.save();
        ctx.font = 'bold 13px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = g.streak >= 3 ? '#FF9900' : '#FFD700';
        ctx.fillText(`${g.streak}× Streak!`, W - 8, 12);
        ctx.restore();
      }

      // Timed mode countdown
      if (g.mode === 'timed' && g.timedFrac !== null) {
        const left = Math.ceil(g.timedFrac);
        ctx.save();
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = left <= 10 ? '#FF4444' : '#FFD700';
        ctx.fillText(`${left}s`, W / 2, H - 40);
        ctx.restore();
      }

      // Target indicator
      if (g.mode === 'target' && g.targetScore) {
        ctx.save();
        ctx.font = '12px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = g.score >= g.targetScore ? '#44DD66' : 'rgba(255,255,255,0.55)';
        ctx.fillText(`Target: ${g.targetScore}`, W / 2, H - 40);
        ctx.restore();
      }

      // Practice label
      if (g.mode === 'practice') {
        ctx.save();
        ctx.font = '11px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillText('Practice — no score saved', W / 2, H - 10);
        ctx.restore();
      }

      // First-ball instruction
      if (g.turnPhase === 'aiming' && g.currentBall === 0 && !g.drag.active) {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(ts * 0.004) * 0.3;
        ctx.font = '14px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('Drag ball to aim & throw', W / 2, LAUNCH_Y + 40);
        ctx.restore();
      }

      ctx.restore(); // camera shake
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ui.phase, updateUi, getAudio]);

  const { phase, score, displayScore, currentBall, hs, newHs, shotHistory, mode, timedLeft, targetScore } = ui;
  const avgScore = shotHistory.length > 0 ? score / shotHistory.length : 0;
  const grade = getGrade(avgScore);

  const launchChallenge = () => {
    const t = TARGET_SCORES[Math.floor(Math.random() * TARGET_SCORES.length)];
    startGame('target', t);
  };

  return (
    <div className="app">
      <div className="hud">
        <div className="stat">
          <div className="sl">Score</div>
          <div className="sv">{displayScore}</div>
        </div>
        <div className="stat">
          <div className="sl">{mode === 'timed' ? 'Time' : 'Ball'}</div>
          <div className="sv">
            {phase === 'playing'
              ? mode === 'timed'    ? `${timedLeft}s`
              : mode === 'practice' ? `${currentBall + 1}`
              : `${currentBall + 1}/${BALLS_PER_GAME}`
              : '-'}
          </div>
        </div>
        <div className="stat">
          <div className="sl">Best</div>
          <div className="sv">{hs}</div>
        </div>
      </div>

      <div className="wrap">
        <canvas
          ref={cvs}
          width={W}
          height={H}
          className="cvs"
          onMouseDown={e => handleDown(e.clientX, e.clientY)}
        />

        {phase === 'idle' && (
          <div className="ov">
            <div className="ov-inner">
              <h1>Skee-Ball</h1>
              <p className="sub">Drag and release to roll the ball up the lane!</p>
              <div className="leg">
                <div className="lr"><span className="ld" style={{ background: '#FF3366' }} /><span>100 pts — Center hole</span></div>
                <div className="lr"><span className="ld" style={{ background: '#FF9900' }} /><span>50 pts — Corner holes</span></div>
                <div className="lr"><span className="ld" style={{ background: '#CC33FF' }} /><span>40 pts — Inner ring</span></div>
                <div className="lr"><span className="ld" style={{ background: '#3399FF' }} /><span>30 pts — Middle ring</span></div>
                <div className="lr"><span className="ld" style={{ background: '#33CC66' }} /><span>20 pts — Outer ring</span></div>
                <div className="lr"><span className="ld" style={{ background: '#AABB44' }} /><span>10 pts — Outermost ring</span></div>
              </div>
              <p className="balls-note">9 balls per game. Aim for the high score!</p>
              {hs > 0 && <p className="hsp">Best: {hs}</p>}
              <div className="mode-btns">
                <button className="btn" onClick={() => startGame('normal')}>Classic (9 balls)</button>
                <button className="btn btn-sec" onClick={() => startGame('timed')}>Timed (45s)</button>
                <button className="btn btn-sec" onClick={launchChallenge}>Challenge</button>
                <button className="btn btn-sec" onClick={() => startGame('practice')}>Practice</button>
              </div>
            </div>
          </div>
        )}

        {phase === 'gameover' && (
          <div className="ov">
            <div className="ov-inner">
              <h1>Game Over!</h1>
              <p className="fs">Score: {score}</p>
              {mode !== 'practice' && (
                <div className="grade" style={{ color: grade.color }}>
                  <span className="grade-letter">{grade.letter}</span>
                  <span className="grade-label">{grade.label}</span>
                </div>
              )}
              {newHs && <p className="nhs">New High Score!</p>}
              {mode === 'target' && targetScore && (
                <p className={score >= targetScore ? 'target-win' : 'target-lose'}>
                  {score >= targetScore
                    ? `Challenge Complete! (target: ${targetScore})`
                    : `Target was ${targetScore} — so close!`}
                </p>
              )}
              <p className="hsp">Best: {hs}</p>
              {shotHistory.length > 0 && (
                <div className="shot-history">
                  {shotHistory.map((pts, i) => (
                    <div
                      key={i}
                      className="shot-dot"
                      style={{ background: shotColor(pts) }}
                      title={`Ball ${i + 1}: ${pts} pts`}
                    >
                      {pts || '–'}
                    </div>
                  ))}
                </div>
              )}
              <div className="mode-btns">
                <button className="btn" onClick={() => startGame('normal')}>Classic</button>
                <button className="btn btn-sec" onClick={() => startGame('timed')}>Timed</button>
                <button className="btn btn-sec" onClick={launchChallenge}>Challenge</button>
                <button className="btn btn-sec" onClick={() => startGame('practice')}>Practice</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
