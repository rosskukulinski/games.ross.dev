import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { songs } from './songs.js';
import { generateBeatmap } from './beatmap.js';
import { AudioEngine } from './audio.js';

const W = 400;
const H = 700;
const LANE_W = W / 4;
const HIT_Y = 580;
const SCROLL_DURATION = 2.0;
const NOTE_R = 20;
const LANE_COLORS = ['#FF69B4', '#00D4FF', '#39FF14', '#BF40FF'];
const LANE_LABELS = ['←', '↓', '↑', '→'];

const PERFECT_WINDOW = 0.050;
const GREAT_WINDOW = 0.100;
const GOOD_WINDOW = 0.150;
const MISS_WINDOW = 0.200;

function getHighScore(songId) {
  try {
    return JSON.parse(localStorage.getItem(`krt-hs-${songId}`)) || null;
  } catch {
    return null;
  }
}

function saveHighScore(songId, data) {
  localStorage.setItem(`krt-hs-${songId}`, JSON.stringify(data));
}

function gradeFor(accuracy) {
  if (accuracy >= 0.95) return 'S';
  if (accuracy >= 0.90) return 'A';
  if (accuracy >= 0.80) return 'B';
  if (accuracy >= 0.70) return 'C';
  return 'D';
}

export default function App() {
  const cvs = useRef(null);
  const gs = useRef(null);
  const audioRef = useRef(null);

  const [ui, setUi] = useState({
    phase: 'select',
    score: 0,
    combo: 0,
    multiplier: 1,
    progress: 0,
    songTitle: '',
    results: null,
    loading: false,
    selectedSong: null,
    difficulty: 'medium',
  });

  const updateUi = useCallback((patch) => setUi((u) => ({ ...u, ...patch })), []);

  // Lazily create AudioEngine
  const getAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new AudioEngine();
    return audioRef.current;
  }, []);

  const finishSong = useCallback(() => {
    const g = gs.current;
    if (!g || !g.active) return;
    g.active = false;
    getAudio().stop();

    const { judgments, score, maxCombo, totalNotes } = g;
    const hitNotes = judgments.perfect + judgments.great + judgments.good;
    const accuracy = totalNotes > 0 ? hitNotes / totalNotes : 0;
    const grade = gradeFor(accuracy);

    const results = {
      score,
      accuracy,
      grade,
      maxCombo,
      ...judgments,
      totalNotes,
    };

    const prev = getHighScore(g.song.id);
    const isNewHs = !prev || score > prev.score;
    if (isNewHs) saveHighScore(g.song.id, { score, grade, accuracy });
    results.isNewHs = isNewHs;

    updateUi({ phase: 'results', results });
  }, [updateUi, getAudio]);

  const selectSong = useCallback(
    async (song, difficulty = 'medium') => {
      updateUi({ phase: 'loading', songTitle: song.title, loading: true });

      try {
        const audio = getAudio();
        const actualDuration = await audio.load(song.file);
        const beatmap = generateBeatmap(song, difficulty);

        gs.current = {
          song,
          beatmap,
          duration: actualDuration,
          score: 0,
          combo: 0,
          maxCombo: 0,
          multiplier: 1,
          judgments: { perfect: 0, great: 0, good: 0, miss: 0 },
          totalNotes: beatmap.length,
          nextNote: 0,
          activeNotes: [],
          effects: [],
          particles: [],
          bgStars: Array.from({ length: 30 }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            speed: 0.2 + Math.random() * 0.5,
            size: 1 + Math.random() * 2,
            alpha: 0.3 + Math.random() * 0.5,
          })),
          laneFlash: [0, 0, 0, 0],
          lastTime: 0,
          active: true,
          paused: false,
        };

        audio.onEnded = () => {
          if (gs.current && gs.current.active) finishSong();
        };

        audio.play();
        updateUi({
          phase: 'playing',
          score: 0,
          combo: 0,
          multiplier: 1,
          progress: 0,
          loading: false,
        });
      } catch (err) {
        console.error('Failed to load song:', err);
        updateUi({ phase: 'select', loading: false });
      }
    },
    [updateUi, finishSong, getAudio],
  );

  const pauseGame = useCallback(() => {
    const g = gs.current;
    if (!g || !g.active) return;
    g.paused = true;
    getAudio().pause();
    updateUi({ phase: 'paused' });
  }, [updateUi, getAudio]);

  const resumeGame = useCallback(() => {
    if (!gs.current) return;
    gs.current.paused = false;
    gs.current.lastTime = 0;
    getAudio().resume();
    updateUi({ phase: 'playing' });
  }, [updateUi, getAudio]);

  const quitToSelect = useCallback(() => {
    if (gs.current) gs.current.active = false;
    getAudio().stop();
    updateUi({ phase: 'select', selectedSong: null });
  }, [updateUi, getAudio]);

  // Handle lane tap
  const handleTap = useCallback(
    (lane) => {
      const g = gs.current;
      if (!g || !g.active || g.paused) return;

      const currentTime = getAudio().getCurrentTime();
      g.laneFlash[lane] = 1.0;

      // Find closest unhit note in this lane within GOOD window
      let closest = null;
      let closestDiff = Infinity;

      for (const note of g.activeNotes) {
        if (note.judged || note.lane !== lane) continue;
        const diff = Math.abs(note.time - currentTime);
        if (diff < closestDiff && diff <= GOOD_WINDOW) {
          closest = note;
          closestDiff = diff;
        }
      }

      if (!closest) return;

      closest.judged = true;
      closest.hit = true;

      let judgment, points, color;
      if (closestDiff <= PERFECT_WINDOW) {
        judgment = 'PERFECT';
        points = 100;
        color = '#FFD700';
      } else if (closestDiff <= GREAT_WINDOW) {
        judgment = 'GREAT';
        points = 75;
        color = '#FFFFFF';
      } else {
        judgment = 'GOOD';
        points = 50;
        color = '#AAAAAA';
      }

      g.combo++;
      if (g.combo > g.maxCombo) g.maxCombo = g.combo;
      g.multiplier = Math.min(5, Math.floor(g.combo / 10) + 1);
      g.score += points * g.multiplier;
      g.judgments[judgment.toLowerCase()]++;

      const noteX = (closest.lane + 0.5) * LANE_W;
      g.effects.push({
        text: judgment,
        color,
        x: noteX,
        y: HIT_Y - 40,
        age: 0,
      });

      // Particles for Perfect/Great
      const particleCount = judgment === 'PERFECT' ? 12 : judgment === 'GREAT' ? 6 : 0;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 2 + Math.random() * 3;
        g.particles.push({
          x: noteX,
          y: HIT_Y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          color: LANE_COLORS[closest.lane],
          size: 3 + Math.random() * 3,
          age: 0,
        });
      }

      updateUi({ score: g.score, combo: g.combo, multiplier: g.multiplier });
    },
    [updateUi, getAudio],
  );

  // Keyboard input
  useEffect(() => {
    const keyMap = {
      ArrowLeft: 0, d: 0, D: 0,
      ArrowDown: 1, f: 1, F: 1,
      ArrowUp: 2, j: 2, J: 2,
      ArrowRight: 3, k: 3, K: 3,
    };

    const onKey = (e) => {
      if (ui.phase === 'playing') {
        if (e.key === 'Escape') {
          e.preventDefault();
          pauseGame();
        } else if (keyMap[e.key] !== undefined) {
          e.preventDefault();
          handleTap(keyMap[e.key]);
        }
      } else if (ui.phase === 'paused' && e.key === 'Escape') {
        e.preventDefault();
        resumeGame();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.phase, handleTap, pauseGame, resumeGame]);

  // Touch input on canvas
  useEffect(() => {
    const el = cvs.current;
    if (!el) return;

    const onTouch = (e) => {
      if (ui.phase !== 'playing') return;
      e.preventDefault();
      for (const touch of e.changedTouches) {
        const rect = el.getBoundingClientRect();
        const x = (touch.clientX - rect.left) * (W / rect.width);
        const lane = Math.min(3, Math.floor(x / LANE_W));
        handleTap(lane);
      }
    };

    el.addEventListener('touchstart', onTouch, { passive: false });
    return () => el.removeEventListener('touchstart', onTouch);
  }, [ui.phase, handleTap]);

  // Main game loop
  useEffect(() => {
    if (ui.phase !== 'playing' || !gs.current || !gs.current.active) return;
    const g = gs.current;
    let raf;
    const ctx = cvs.current.getContext('2d');

    const loop = (ts) => {
      if (!g.active || g.paused) return;
      const dt = g.lastTime ? Math.min(ts - g.lastTime, 50) : 16;
      g.lastTime = ts;

      const currentTime = getAudio().getCurrentTime();
      const duration = getAudio().getDuration();

      if (duration > 0) {
        updateUi({ progress: currentTime / duration });
      }

      // --- Spawn notes ---
      while (g.nextNote < g.beatmap.length) {
        const note = g.beatmap[g.nextNote];
        if (note.time - currentTime > SCROLL_DURATION + 0.5) break;
        g.activeNotes.push({ ...note });
        g.nextNote++;
      }

      // --- Auto-miss old notes ---
      for (const note of g.activeNotes) {
        if (!note.judged && currentTime - note.time > MISS_WINDOW) {
          note.judged = true;
          note.hit = false;
          g.judgments.miss++;
          g.combo = 0;
          g.multiplier = 1;

          const noteX = (note.lane + 0.5) * LANE_W;
          g.effects.push({
            text: 'MISS',
            color: '#FF4444',
            x: noteX,
            y: HIT_Y - 40,
            age: 0,
          });

          updateUi({ combo: 0, multiplier: 1 });
        }
      }

      // Remove old judged notes
      g.activeNotes = g.activeNotes.filter(
        (n) => !n.judged || currentTime - n.time < 0.5,
      );

      // === DRAW ===
      ctx.clearRect(0, 0, W, H);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0a0015');
      bg.addColorStop(0.5, '#1a0030');
      bg.addColorStop(1, '#0d001a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Background stars
      for (const star of g.bgStars) {
        star.y -= star.speed * (dt / 16);
        if (star.y < 0) {
          star.y = H;
          star.x = Math.random() * W;
        }
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
        ctx.fill();
      }

      // Combo glow
      if (g.combo >= 50) {
        const glowI = Math.min(0.15, (g.combo - 50) / 200);
        ctx.fillStyle = `rgba(180,0,255,${glowI + Math.sin(ts / 300) * 0.03})`;
        ctx.fillRect(0, 0, W, H);
      }

      // Lane dividers
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * LANE_W, 0);
        ctx.lineTo(i * LANE_W, H);
        ctx.stroke();
      }

      // Lane flashes
      for (let i = 0; i < 4; i++) {
        const flash = g.laneFlash[i];
        if (flash > 0) {
          ctx.fillStyle = LANE_COLORS[i] + Math.floor(flash * 40).toString(16).padStart(2, '0');
          ctx.fillRect(i * LANE_W, 0, LANE_W, H);
          g.laneFlash[i] = Math.max(0, flash - dt * 0.003);
        }
      }

      // Hit zone line
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, HIT_Y);
      ctx.lineTo(W, HIT_Y);
      ctx.stroke();

      // Hit zone targets
      for (let i = 0; i < 4; i++) {
        const x = (i + 0.5) * LANE_W;
        const flash = g.laneFlash[i];
        ctx.beginPath();
        ctx.arc(x, HIT_Y, NOTE_R + 2, 0, Math.PI * 2);
        ctx.strokeStyle = LANE_COLORS[i] + (flash > 0 ? 'FF' : '55');
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.font = 'bold 13px Arial,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = LANE_COLORS[i] + '77';
        ctx.fillText(LANE_LABELS[i], x, HIT_Y + NOTE_R + 18);
      }

      // Draw notes
      for (const note of g.activeNotes) {
        if (note.judged) continue;
        const timeDiff = note.time - currentTime;
        if (timeDiff > SCROLL_DURATION) continue;

        const y = HIT_Y * (1 - timeDiff / SCROLL_DURATION);
        if (y < -NOTE_R || y > H + NOTE_R) continue;

        const x = (note.lane + 0.5) * LANE_W;
        const color = LANE_COLORS[note.lane];

        // Note glow
        const grd = ctx.createRadialGradient(x, y, NOTE_R * 0.2, x, y, NOTE_R * 1.5);
        grd.addColorStop(0, color + '44');
        grd.addColorStop(1, color + '00');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, NOTE_R * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Note body (diamond)
        ctx.beginPath();
        ctx.moveTo(x, y - NOTE_R);
        ctx.lineTo(x + NOTE_R, y);
        ctx.lineTo(x, y + NOTE_R);
        ctx.lineTo(x - NOTE_R, y);
        ctx.closePath();

        const noteGrad = ctx.createLinearGradient(x, y - NOTE_R, x, y + NOTE_R);
        noteGrad.addColorStop(0, color);
        noteGrad.addColorStop(1, color + 'AA');
        ctx.fillStyle = noteGrad;
        ctx.fill();

        // Inner highlight
        ctx.beginPath();
        ctx.moveTo(x, y - NOTE_R * 0.55);
        ctx.lineTo(x + NOTE_R * 0.35, y);
        ctx.lineTo(x, y - NOTE_R * 0.15);
        ctx.lineTo(x - NOTE_R * 0.35, y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();
      }

      // Judgment effects
      const keepFx = [];
      for (const eff of g.effects) {
        eff.age += dt / 1000;
        if (eff.age > 0.5) continue;
        const p = eff.age / 0.5;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.font = `bold ${Math.floor(18 * (1 + p * 0.3))}px Arial,sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        const fy = eff.y - p * 20;
        ctx.strokeText(eff.text, eff.x, fy);
        ctx.fillStyle = eff.color;
        ctx.fillText(eff.text, eff.x, fy);
        ctx.restore();
        keepFx.push(eff);
      }
      g.effects = keepFx;

      // Particles
      const keepP = [];
      for (const p of g.particles) {
        p.age += dt / 1000;
        if (p.age > 0.6) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        const alpha = 1 - p.age / 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - p.age / 0.6), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
        keepP.push(p);
      }
      g.particles = keepP;

      // Song ended fallback
      if (currentTime >= duration - 0.1 && duration > 0) {
        finishSong();
        return;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ui.phase, updateUi, finishSong, getAudio]);

  const { phase, score, combo, multiplier, progress, songTitle, results, loading } = ui;

  const { selectedSong, difficulty } = ui;

  // --- SONG SELECT ---
  if (phase === 'select' && !selectedSong) {
    return (
      <div className="app">
        <h1 className="title">K-Pop Rhythm Tap</h1>
        <p className="subtitle">Tap to the beat!</p>
        <div className="song-list">
          {songs.map((song) => {
            const hs = getHighScore(song.id);
            return (
              <button
                key={song.id}
                className="song-card"
                onClick={() => updateUi({ selectedSong: song })}
              >
                <div className="song-info">
                  <div className="song-title">{song.title}</div>
                  <div className="song-diff">
                    {'★'.repeat(song.stars)}
                    {'☆'.repeat(5 - song.stars)}
                  </div>
                </div>
                <div className="song-score">
                  {hs ? (
                    <>
                      <span className={`grade grade-${hs.grade}`}>{hs.grade}</span>
                      <span className="hs-val">{hs.score.toLocaleString()}</span>
                    </>
                  ) : (
                    <span className="no-score">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="controls-hint">
          <p>Desktop: ← ↓ ↑ → or D F J K</p>
          <p>Mobile: Tap the 4 lanes</p>
        </div>
      </div>
    );
  }

  // --- DIFFICULTY SELECT ---
  if (phase === 'select' && selectedSong) {
    return (
      <div className="app">
        <h1 className="title">{selectedSong.title}</h1>
        <p className="subtitle">Choose difficulty</p>
        <div className="difficulty-picker">
          {['easy', 'medium', 'hard'].map((d) => (
            <button
              key={d}
              className={`diff-btn diff-${d}${difficulty === d ? ' diff-active' : ''}`}
              onClick={() => updateUi({ difficulty: d })}
            >
              <span className="diff-label">{d.charAt(0).toUpperCase() + d.slice(1)}</span>
              <span className="diff-desc">
                {d === 'easy' && 'Drums only — relaxed pace'}
                {d === 'medium' && 'Drums + melody — balanced'}
                {d === 'hard' && 'All events — intense'}
              </span>
            </button>
          ))}
        </div>
        <div className="difficulty-actions">
          <button className="btn" onClick={() => selectSong(selectedSong, difficulty)}>
            Play
          </button>
          <button className="btn btn-secondary" onClick={() => updateUi({ selectedSong: null })}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // --- LOADING ---
  if (phase === 'loading') {
    return (
      <div className="app">
        <div className="loading">
          <div className="loading-spinner" />
          <p>Loading {songTitle}...</p>
        </div>
      </div>
    );
  }

  // --- RESULTS ---
  if (phase === 'results' && results) {
    return (
      <div className="app">
        <div className="results">
          <h1 className="results-title">Song Complete!</h1>
          <div className={`results-grade grade-${results.grade}`}>{results.grade}</div>
          <div className="results-score">{results.score.toLocaleString()}</div>
          {results.isNewHs && <div className="new-hs">New High Score!</div>}
          <div className="results-accuracy">
            {(results.accuracy * 100).toFixed(1)}% Accuracy
          </div>
          <div className="results-combo">Max Combo: {results.maxCombo}x</div>
          <div className="results-breakdown">
            <div className="bd-row">
              <span className="bd-label" style={{ color: '#FFD700' }}>PERFECT</span>
              <span className="bd-val">{results.perfect}</span>
            </div>
            <div className="bd-row">
              <span className="bd-label" style={{ color: '#FFFFFF' }}>GREAT</span>
              <span className="bd-val">{results.great}</span>
            </div>
            <div className="bd-row">
              <span className="bd-label" style={{ color: '#AAAAAA' }}>GOOD</span>
              <span className="bd-val">{results.good}</span>
            </div>
            <div className="bd-row">
              <span className="bd-label" style={{ color: '#FF4444' }}>MISS</span>
              <span className="bd-val">{results.miss}</span>
            </div>
          </div>
          <div className="results-actions">
            <button className="btn" onClick={() => selectSong(gs.current.song, ui.difficulty)}>
              Play Again
            </button>
            <button className="btn btn-secondary" onClick={quitToSelect}>
              Song Select
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- PLAYING / PAUSED ---
  return (
    <div className="app">
      <div className="hud">
        <div className="stat">
          <div className="sl">Score</div>
          <div className="sv">{score.toLocaleString()}</div>
        </div>
        <div className="stat combo-stat">
          <div className="sl">Combo</div>
          <div className="sv">{combo > 0 ? `${combo}x` : '—'}</div>
        </div>
        <div className="stat">
          <div className="sl">Multi</div>
          <div className="sv">{multiplier > 1 ? `${multiplier}x` : '—'}</div>
        </div>
        <button className="pause-btn" onClick={pauseGame}>⏸</button>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="wrap">
        <canvas ref={cvs} width={W} height={H} className="cvs" />

        {phase === 'paused' && (
          <div className="ov">
            <div className="ov-inner">
              <h1>Paused</h1>
              <p className="pause-song">{songTitle}</p>
              <button className="btn" onClick={resumeGame}>Resume</button>
              <button className="btn btn-secondary" onClick={quitToSelect}>
                Quit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
