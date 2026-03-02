import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const W = 400;
const H = 700;
const BALLS_PER_GAME = 9;
const LANE_LEFT = 60;
const LANE_RIGHT = W - 60;
const LANE_W = LANE_RIGHT - LANE_LEFT;
const SCORE_ZONE_Y = 180;
const LAUNCH_Y = 620;
const BALL_R = 14;
const MAX_DRAG = 140;
const RAMP_LIP_Y = 210;

function drawLane(ctx) {
  // Lane background — wood gradient
  const woodGrad = ctx.createLinearGradient(LANE_LEFT, RAMP_LIP_Y, LANE_LEFT, H);
  woodGrad.addColorStop(0, '#B8860B');
  woodGrad.addColorStop(0.3, '#CD9B1D');
  woodGrad.addColorStop(0.7, '#DAA520');
  woodGrad.addColorStop(1, '#B8860B');
  ctx.fillStyle = woodGrad;
  ctx.beginPath();
  ctx.roundRect(LANE_LEFT - 4, RAMP_LIP_Y, LANE_W + 8, H - RAMP_LIP_Y, [0, 0, 8, 8]);
  ctx.fill();

  // Wood grain lines
  ctx.strokeStyle = 'rgba(139,90,0,0.15)';
  ctx.lineWidth = 1;
  for (let y = RAMP_LIP_Y + 20; y < H; y += 30) {
    ctx.beginPath();
    ctx.moveTo(LANE_LEFT, y + Math.sin(y * 0.1) * 3);
    ctx.bezierCurveTo(
      LANE_LEFT + LANE_W * 0.3, y + 4,
      LANE_LEFT + LANE_W * 0.7, y - 3,
      LANE_RIGHT, y + Math.sin(y * 0.15) * 2
    );
    ctx.stroke();
  }

  // Lane gutters (side walls)
  const gutterGrad = ctx.createLinearGradient(LANE_LEFT - 12, 0, LANE_LEFT, 0);
  gutterGrad.addColorStop(0, '#5C3A0E');
  gutterGrad.addColorStop(1, '#7A4D1A');
  ctx.fillStyle = gutterGrad;
  ctx.fillRect(LANE_LEFT - 12, RAMP_LIP_Y, 12, H - RAMP_LIP_Y);

  const gutterGrad2 = ctx.createLinearGradient(LANE_RIGHT, 0, LANE_RIGHT + 12, 0);
  gutterGrad2.addColorStop(0, '#7A4D1A');
  gutterGrad2.addColorStop(1, '#5C3A0E');
  ctx.fillStyle = gutterGrad2;
  ctx.fillRect(LANE_RIGHT, RAMP_LIP_Y, 12, H - RAMP_LIP_Y);

  // Center guide line (subtle)
  ctx.strokeStyle = 'rgba(139,90,0,0.12)';
  ctx.setLineDash([8, 12]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, RAMP_LIP_Y + 20);
  ctx.lineTo(W / 2, H - 30);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawScoringZone(ctx) {
  // Dark background for scoring area
  const zoneGrad = ctx.createLinearGradient(0, 0, 0, SCORE_ZONE_Y);
  zoneGrad.addColorStop(0, '#1a1a2e');
  zoneGrad.addColorStop(1, '#2a2040');
  ctx.fillStyle = zoneGrad;
  ctx.beginPath();
  ctx.roundRect(LANE_LEFT - 16, 0, LANE_W + 32, SCORE_ZONE_Y, [12, 12, 0, 0]);
  ctx.fill();

  // Side walls for scoring zone
  ctx.fillStyle = '#3a2a50';
  ctx.fillRect(LANE_LEFT - 16, 0, 8, SCORE_ZONE_Y);
  ctx.fillRect(LANE_RIGHT + 8, 0, 8, SCORE_ZONE_Y);

  const cx = W / 2;
  const cy = SCORE_ZONE_Y - 65;

  // Concentric rings (outer to inner)
  const rings = [
    { r: 100, color: '#334422', border: '#AABB44' },
    { r: 78, color: '#224433', border: '#33CC66' },
    { r: 58, color: '#222244', border: '#3399FF' },
    { r: 38, color: '#332244', border: '#CC33FF' },
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

  // Ring point labels
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('10', cx + 88, cy);
  ctx.fillText('20', cx + 66, cy);
  ctx.fillText('30', cx + 46, cy);
  ctx.fillText('40', cx + 26, cy);

  // Target holes
  const holes = [
    { cx: W / 2, cy: 55, r: 18, color: '#FF3366', pts: 100 },
    { cx: LANE_LEFT + 40, cy: 45, r: 16, color: '#FF9900', pts: 50 },
    { cx: LANE_RIGHT - 40, cy: 45, r: 16, color: '#FF9900', pts: 50 },
  ];

  for (const h of holes) {
    // Hole shadow
    ctx.beginPath();
    ctx.arc(h.cx, h.cy, h.r + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    // Hole
    const hGrad = ctx.createRadialGradient(h.cx, h.cy, 0, h.cx, h.cy, h.r);
    hGrad.addColorStop(0, '#000');
    hGrad.addColorStop(0.6, '#111');
    hGrad.addColorStop(0.85, h.color + '88');
    hGrad.addColorStop(1, h.color);
    ctx.beginPath();
    ctx.arc(h.cx, h.cy, h.r, 0, Math.PI * 2);
    ctx.fillStyle = hGrad;
    ctx.fill();

    // Point label
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(h.pts.toString(), h.cx, h.cy);
  }
}

function drawRampLip(ctx) {
  // Raised lip between scoring zone and lane
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

  // Highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LANE_LEFT - 10, RAMP_LIP_Y - 4);
  ctx.lineTo(LANE_RIGHT + 10, RAMP_LIP_Y - 4);
  ctx.stroke();
}

function drawBall(ctx, x, y, r, shadow) {
  // Shadow
  if (shadow) {
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 4, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
  }

  // Ball body
  const ballGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  ballGrad.addColorStop(0, '#FFFFFF');
  ballGrad.addColorStop(0.3, '#DDDDEE');
  ballGrad.addColorStop(0.7, '#8888AA');
  ballGrad.addColorStop(1, '#555577');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = ballGrad;
  ctx.fill();

  // Shine highlight
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25, y - r * 0.25, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
}

function drawAimGuide(ctx, startX, startY, nx, ny, power) {
  const len = power * 2.5;
  const endX = startX + nx * len;
  const endY = startY + ny * len;

  // Dotted trajectory line
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrow head
  const arrowLen = 10;
  const arrowAngle = 0.4;
  const tipAngle = Math.atan2(-ny, nx);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
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

  // Power indicator bar at bottom
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
      // Used ball
      ctx.fillStyle = 'rgba(100,100,100,0.5)';
      ctx.fill();
    } else if (i === currentBall) {
      // Current ball
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Future ball
      ctx.fillStyle = 'rgba(200,200,200,0.3)';
      ctx.fill();
    }
  }
}

function calcScore(x, y) {
  const cx = W / 2;
  const cy = SCORE_ZONE_Y - 65;

  // Check hole targets first (100 and 50 point holes)
  const holes = [
    { cx: W / 2, cy: 55, r: 18, pts: 100 },
    { cx: LANE_LEFT + 40, cy: 45, r: 16, pts: 50 },
    { cx: LANE_RIGHT - 40, cy: 45, r: 16, pts: 50 },
  ];

  for (const h of holes) {
    if (Math.hypot(x - h.cx, y - h.cy) < h.r + 6) {
      return { pts: h.pts, hx: h.cx, hy: h.cy };
    }
  }

  // Check concentric rings
  const dist = Math.hypot(x - cx, y - cy);
  if (dist < 38) return { pts: 40, hx: cx, hy: cy };
  if (dist < 58) return { pts: 30, hx: x, hy: y };
  if (dist < 78) return { pts: 20, hx: x, hy: y };
  if (dist < 100) return { pts: 10, hx: x, hy: y };

  return { pts: 0, hx: x, hy: y };
}

export default function App() {
  const cvs = useRef(null);
  const gs = useRef(null);
  const [ui, setUi] = useState({
    phase: 'idle',
    score: 0,
    currentBall: 0,
    hs: parseInt(localStorage.getItem('sb-hs') || '0'),
    newHs: false,
    lastScore: null,
  });

  const updateUi = useCallback((patch) => setUi(u => ({ ...u, ...patch })), []);

  const startGame = useCallback(() => {
    gs.current = {
      ball: { x: W / 2, y: LAUNCH_Y, vx: 0, vy: 0, active: false },
      drag: { active: false, startX: 0, startY: 0, curX: 0, curY: 0 },
      turnPhase: 'aiming', // aiming | rolling | scoring | nextBall
      currentBall: 0,
      score: 0,
      popups: [],
      particles: [],
      sinkAnim: null,
      nextBallTimer: 0,
      lastTime: 0,
      active: true,
    };
    updateUi({ phase: 'playing', score: 0, currentBall: 0, newHs: false, lastScore: null });
  }, [updateUi]);

  // Pointer event handlers
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
    const ball = g.ball;
    const dist = Math.hypot(pos.x - ball.x, pos.y - ball.y);
    if (dist < 40) {
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

    if (dist < 15) return; // Too small — ignore

    const power = Math.min(dist, MAX_DRAG);
    const nx = dx / dist;
    const ny = dy / dist;

    const speed = (power / MAX_DRAG) * 12 + 3;
    g.ball.vx = nx * speed;
    g.ball.vy = ny * speed;
    g.ball.active = true;
    g.turnPhase = 'rolling';
  }, []);

  // Touch handlers
  useEffect(() => {
    const el = cvs.current;
    if (!el) return;
    const onTouchStart = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      handleDown(t.clientX, t.clientY);
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      handleMove(t.clientX, t.clientY);
    };
    const onTouchEnd = (e) => {
      e.preventDefault();
      handleUp();
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleDown, handleMove, handleUp]);

  // Window-level mouse move/up so dragging outside canvas still works
  useEffect(() => {
    const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const onMouseUp = () => handleUp();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleMove, handleUp]);

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

      // --- UPDATE ---

      if (g.turnPhase === 'rolling' && g.ball.active) {
        const ball = g.ball;
        const steps = 3;
        const subDt = dt / steps;

        for (let s = 0; s < steps; s++) {
          ball.x += ball.vx * (subDt / 16);
          ball.y += ball.vy * (subDt / 16);

          // Friction
          ball.vx *= 0.997;
          ball.vy *= 0.997;

          // Gravity-like uphill deceleration
          if (ball.vy < 0) {
            ball.vy += 0.02 * (subDt / 16);
          }

          // Wall bouncing
          if (ball.x < LANE_LEFT + BALL_R) {
            ball.x = LANE_LEFT + BALL_R;
            ball.vx = Math.abs(ball.vx) * 0.6;
          }
          if (ball.x > LANE_RIGHT - BALL_R) {
            ball.x = LANE_RIGHT - BALL_R;
            ball.vx = -Math.abs(ball.vx) * 0.6;
          }

          // Check if ball passed ramp lip into scoring zone
          if (ball.y < RAMP_LIP_Y && ball.vy < 0) {
            // Ball entered scoring zone — let it continue but add more decel
            ball.vy += 0.06 * (subDt / 16);
          }
        }

        const speed = Math.hypot(ball.vx, ball.vy);

        // Ball stopped or rolled back past bottom
        if (ball.y > H + 20) {
          // Gutter — missed
          g.turnPhase = 'scoring';
          g.sinkAnim = { x: ball.x, y: LAUNCH_Y, pts: 0, t: 0, maxT: 30 };
          g.popups.push({ x: ball.x, y: LAUNCH_Y - 30, txt: 'Miss!', a: 1, color: '#FF6666' });
        } else if (ball.y < SCORE_ZONE_Y && speed < 1.5) {
          // Ball in scoring zone and slowed down
          const result = calcScore(ball.x, ball.y);
          g.turnPhase = 'scoring';
          g.score += result.pts;
          g.sinkAnim = { x: result.hx, y: result.hy, pts: result.pts, t: 0, maxT: 40 };
          if (result.pts > 0) {
            g.popups.push({ x: result.hx, y: result.hy - 20, txt: `+${result.pts}`, a: 1, color: '#FFD700' });
            // Sparkle particles
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              g.particles.push({
                x: result.hx, y: result.hy,
                vx: Math.cos(a) * (2 + Math.random() * 2),
                vy: Math.sin(a) * (2 + Math.random() * 2),
                life: 1,
                color: ['#FFD700', '#FF6B6B', '#44DD66', '#66BBFF'][i % 4],
              });
            }
          } else {
            g.popups.push({ x: ball.x, y: ball.y - 20, txt: 'Miss!', a: 1, color: '#FF6666' });
          }
          ball.active = false;
          updateUi({ score: g.score, lastScore: result.pts });
        } else if (speed < 0.3 && ball.y > SCORE_ZONE_Y) {
          // Ball stopped on lane (didn't make it)
          g.turnPhase = 'scoring';
          g.sinkAnim = { x: ball.x, y: ball.y, pts: 0, t: 0, maxT: 30 };
          g.popups.push({ x: ball.x, y: ball.y - 20, txt: 'Too weak!', a: 1, color: '#FF6666' });
          ball.active = false;
        }
      }

      // Sink animation
      if (g.turnPhase === 'scoring' && g.sinkAnim) {
        g.sinkAnim.t++;
        if (g.sinkAnim.t >= g.sinkAnim.maxT) {
          g.sinkAnim = null;
          g.turnPhase = 'nextBall';
          g.nextBallTimer = ts;
        }
      }

      // Next ball transition
      if (g.turnPhase === 'nextBall') {
        if (ts - g.nextBallTimer > 600) {
          g.currentBall++;
          if (g.currentBall >= BALLS_PER_GAME) {
            // Game over
            g.active = false;
            const savedHs = parseInt(localStorage.getItem('sb-hs') || '0');
            const isNewHs = g.score > savedHs;
            if (isNewHs) localStorage.setItem('sb-hs', g.score);
            updateUi({
              phase: 'gameover',
              currentBall: BALLS_PER_GAME,
              hs: isNewHs ? g.score : savedHs,
              newHs: isNewHs,
            });
            return;
          }
          g.ball = { x: W / 2, y: LAUNCH_Y, vx: 0, vy: 0, active: false };
          g.turnPhase = 'aiming';
          updateUi({ currentBall: g.currentBall });
        }
      }

      // Particles
      g.particles = g.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life -= 0.025;
        return p.life > 0;
      });

      // --- RENDER ---
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#0f0e17';
      ctx.fillRect(0, 0, W, H);

      // Draw scoring zone
      drawScoringZone(ctx);

      // Draw ramp lip
      drawRampLip(ctx);

      // Draw lane
      drawLane(ctx);

      // Draw ball (rolling)
      if (g.turnPhase === 'rolling' && g.ball.active) {
        const ball = g.ball;
        // Perspective: ball shrinks as it goes up
        const pct = (ball.y - 0) / (LAUNCH_Y - 0);
        const scale = 0.55 + pct * 0.45;
        drawBall(ctx, ball.x, ball.y, BALL_R * scale, true);
      }

      // Draw ball (aiming — at launch position)
      if (g.turnPhase === 'aiming') {
        drawBall(ctx, g.ball.x, g.ball.y, BALL_R, true);

        // Aim guide while dragging
        if (g.drag.active) {
          const dx = g.drag.startX - g.drag.curX;
          const dy = g.drag.startY - g.drag.curY;
          const dist = Math.hypot(dx, dy);
          if (dist > 5) {
            const power = Math.min(dist, MAX_DRAG);
            const nx = dx / dist;
            const ny = dy / dist;
            drawAimGuide(ctx, g.ball.x, g.ball.y, nx, ny, power);
          }
        }
      }

      // Sink animation (ball shrinking into hole)
      if (g.sinkAnim && g.sinkAnim.pts > 0) {
        const anim = g.sinkAnim;
        const progress = anim.t / anim.maxT;
        const scale = 1 - progress;
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

      // Popups
      const keepPopups = [];
      for (const p of g.popups) {
        p.y -= 1;
        p.a -= 0.018;
        if (p.a <= 0) continue;
        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.font = 'bold 22px Arial, sans-serif';
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

      // Ball indicators
      drawBallIndicators(ctx, g.currentBall, BALLS_PER_GAME);

      // Drag instruction (first ball, not dragging)
      if (g.turnPhase === 'aiming' && g.currentBall === 0 && !g.drag.active) {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(ts * 0.004) * 0.3;
        ctx.font = '14px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('Drag ball to aim & throw', W / 2, LAUNCH_Y + 40);
        ctx.restore();
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ui.phase, updateUi]);

  const { phase, score, currentBall, hs, newHs } = ui;

  return (
    <div className="app">
      <div className="hud">
        <div className="stat">
          <div className="sl">Score</div>
          <div className="sv">{score}</div>
        </div>
        <div className="stat">
          <div className="sl">Ball</div>
          <div className="sv">{phase === 'playing' ? `${currentBall + 1}/${BALLS_PER_GAME}` : '-'}</div>
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
              <button className="btn" onClick={startGame}>Start Game</button>
            </div>
          </div>
        )}

        {phase === 'gameover' && (
          <div className="ov">
            <div className="ov-inner">
              <h1>Game Over!</h1>
              <p className="fs">Score: {score}</p>
              {newHs && <p className="nhs">New High Score!</p>}
              <p className="hsp">Best: {hs}</p>
              <button className="btn" onClick={startGame}>Play Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
