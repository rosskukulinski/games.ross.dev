import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { songs } from './songs.js';
import { generateBeatmap } from './beatmap.js';
import { AudioEngine } from './audio.js';

const W = 400;
const H = 700;
const HIT_Y = 580;
const LANE_COLORS_4 = ['#FF69B4', '#00D4FF', '#39FF14', '#BF40FF'];
const LANE_LABELS_4 = ['←', '↓', '↑', '→'];
const LANE_COLORS_2 = ['#FF69B4', '#00D4FF'];
const LANE_LABELS_2 = ['◀', '▶'];

// Seconds of countdown before the first note reaches the line. Songs with a
// long intro skip ahead; songs whose first note is right at the start get a
// silent pre-roll instead, so there is never a long blank wait.
const LEAD_IN = 3.5;

// Hit windows are seconds either side of the note. Starter ("kid") is the
// default: two wide lanes, slower notes, double-width windows and a short song.
const MODES = {
  kid: {
    label: 'Starter', icon: '🐣', desc: '2 big lanes · slow · short song',
    lanes: 2, noteR: 34, scroll: 2.6,
    perfect: 0.12, great: 0.2, good: 0.3, miss: 0.35,
    maxSongSec: 60, laneSlop: 0.25,
  },
  easy: {
    label: 'Easy', icon: '🙂', desc: 'Drums only — relaxed pace',
    lanes: 4, noteR: 20, scroll: 2.0,
    perfect: 0.05, great: 0.1, good: 0.15, miss: 0.2,
  },
  medium: {
    label: 'Medium', icon: '😎', desc: 'Drums + melody — balanced',
    lanes: 4, noteR: 20, scroll: 2.0,
    perfect: 0.05, great: 0.1, good: 0.15, miss: 0.2,
  },
  hard: {
    label: 'Hard', icon: '🔥', desc: 'All events — intense',
    lanes: 4, noteR: 20, scroll: 2.0,
    perfect: 0.05, great: 0.1, good: 0.15, miss: 0.2,
  },
};
const MODE_ORDER = ['kid', 'easy', 'medium', 'hard'];

const COMBO_CHEERS = { 5: 'Nice!', 10: 'Great!', 20: 'Super!', 30: 'Amazing!', 50: 'Superstar!' };

function starsFor(accuracy) {
  if (accuracy >= 0.8) return 3;
  if (accuracy >= 0.5) return 2;
  return 1;
}

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
    difficulty: 'kid',
  });

  const updateUi = useCallback((patch) => setUi((u) => ({ ...u, ...patch })), []);

  // Read-only hook for automated play-tests.
  const uiRef = useRef(ui);
  uiRef.current = ui;
  useEffect(() => {
    const hook = {};
    const def = (k, fn) => Object.defineProperty(hook, k, { get: fn, enumerable: true });
    const g = () => gs.current;
    def('phase', () => uiRef.current.phase);
    def('mode', () => g()?.mode ?? uiRef.current.difficulty);
    def('lanes', () => g()?.cfg.lanes ?? MODES[uiRef.current.difficulty].lanes);
    def('score', () => g()?.score ?? 0);
    def('combo', () => g()?.combo ?? 0);
    def('maxCombo', () => g()?.maxCombo ?? 0);
    def('hits', () => {
      const j = g()?.judgments;
      return j ? j.perfect + j.great + j.good : 0;
    });
    def('misses', () => g()?.judgments.miss ?? 0);
    def('emptyTaps', () => g()?.emptyTaps ?? 0);
    def('judgments', () => ({ ...(g()?.judgments ?? {}) }));
    def('totalNotes', () => g()?.totalNotes ?? 0);
    def('songTime', () => (g()?.active ? getAudio().getCurrentTime() : null));
    def('firstNoteTime', () => g()?.beatmap[0]?.time ?? null);
    // song time playback started at (negative = silent pre-roll)
    def('startAt', () => g()?.startAt ?? null);
    def('paused', () => !!g()?.paused);
    def('endTime', () => g()?.endTime ?? null);
    def('notes', () => (g()?.beatmap ?? []).map((n) => ({ time: n.time, lane: n.lane })));
    def('windows', () => {
      const c = MODES[g()?.mode ?? uiRef.current.difficulty];
      return { perfect: c.perfect, great: c.great, good: c.good, miss: c.miss };
    });
    window.__game = Object.freeze(hook);
    return () => {
      if (window.__game === hook) delete window.__game;
    };
  }, []);

  // Lazily create AudioEngine
  const getAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new AudioEngine();
    return audioRef.current;
  }, []);

  const finishSong = useCallback((fade = false) => {
    const g = gs.current;
    if (!g || !g.active) return;
    g.active = false;
    if (fade) getAudio().fadeOutAndStop(1.5);
    else getAudio().stop();

    const { judgments, score, maxCombo, totalNotes } = g;
    const hitNotes = judgments.perfect + judgments.great + judgments.good;
    const accuracy = totalNotes > 0 ? hitNotes / totalNotes : 0;
    const grade = gradeFor(accuracy);

    const results = {
      score,
      accuracy,
      grade,
      stars: starsFor(accuracy),
      mode: g.mode,
      maxCombo,
      ...judgments,
      totalNotes,
    };

    const prev = getHighScore(g.song.id);
    const isNewHs = !prev || score > prev.score;
    if (isNewHs) saveHighScore(g.song.id, { score, grade, accuracy });
    results.isNewHs = isNewHs;

    updateUi({ phase: 'results', results });

    // The arcade board ranks a player's best run on any track; the song is
    // recorded as the variant so the activity feed can still name it.
    window.Arcade?.submit({
      game: 'kpop-rythm-tap',
      value: score,
      variant: g.song.id,
      meta: { song: g.song.title, grade, accuracy: Number(accuracy.toFixed(3)), mode: g.mode },
    });
  }, [updateUi, getAudio]);

  const selectSong = useCallback(
    async (song, difficulty = 'kid') => {
      // the arcade score card from the last song shouldn't sit over the new one
      window.Arcade?.dismiss?.();
      updateUi({ phase: 'loading', songTitle: song.title, loading: true });

      try {
        const audio = getAudio();
        const actualDuration = await audio.load(song.file);
        const cfg = MODES[difficulty] ?? MODES.kid;
        let beatmap = generateBeatmap(song, difficulty);
        const firstNote = beatmap.length ? beatmap[0].time : 0;
        const startAt = Math.min(firstNote - LEAD_IN, Math.max(0, actualDuration - 5));
        // Starter plays a short version of the song so little kids reach the end
        const endTime = cfg.maxSongSec
          ? Math.min(actualDuration, firstNote + cfg.maxSongSec)
          : actualDuration;
        if (endTime < actualDuration) beatmap = beatmap.filter((n) => n.time < endTime - 1);

        gs.current = {
          song,
          mode: difficulty,
          cfg,
          beatmap,
          duration: actualDuration,
          endTime,
          startAt,
          emptyTaps: 0,
          laneFlash: Array(cfg.lanes).fill(0),
          missFlash: Array(cfg.lanes).fill(0),
          targetPop: Array(cfg.lanes).fill(0),
          shake: 0,
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
          lastTime: 0,
          active: true,
          paused: false,
        };

        audio.onEnded = () => {
          if (gs.current && gs.current.active) finishSong();
        };

        audio.play(startAt);
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
    if (!g || !g.active || g.paused) return;
    g.paused = true;
    getAudio().pause();
    updateUi({ phase: 'paused' });
  }, [updateUi, getAudio]);

  const resumeGame = useCallback(() => {
    const g = gs.current;
    // idempotent: a double-tap on Resume (or Resume + Escape) must not
    // restart the audio twice
    if (!g || !g.active || !g.paused) return;
    g.paused = false;
    g.lastTime = 0;
    getAudio().resume();
    updateUi({ phase: 'playing' });
  }, [updateUi, getAudio]);

  // Pause when the tab / app goes to the background, so the song doesn't run
  // on (or freeze with a suspended AudioContext) while nobody is looking.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) pauseGame();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [pauseGame]);

  const quitToSelect = useCallback(() => {
    if (gs.current) gs.current.active = false;
    getAudio().stop();
    updateUi({ phase: 'select', selectedSong: null });
  }, [updateUi, getAudio]);

  // Handle lane tap. `x` is the canvas x of a touch/click (undefined for keys).
  const handleTap = useCallback(
    (lane, x) => {
      const g = gs.current;
      if (!g || !g.active || g.paused) return;
      const { cfg } = g;
      const laneW = W / cfg.lanes;
      const colors = cfg.lanes === 2 ? LANE_COLORS_2 : LANE_COLORS_4;

      const currentTime = getAudio().getCurrentTime();
      g.laneFlash[lane] = 1.0;

      const closestIn = (l) => {
        let best = null;
        let bestDiff = Infinity;
        for (const note of g.activeNotes) {
          if (note.judged || note.lane !== l) continue;
          const diff = Math.abs(note.time - currentTime);
          if (diff < bestDiff && diff <= cfg.good) {
            best = note;
            bestDiff = diff;
          }
        }
        return best ? { note: best, diff: bestDiff } : null;
      };

      let found = closestIn(lane);
      // Fat-finger tolerance: a touch near the lane edge also counts for the
      // neighbouring lane when this one has nothing to hit.
      if (!found && cfg.laneSlop && x !== undefined) {
        const within = x / laneW - lane;
        const slop = cfg.laneSlop;
        if (within < slop && lane > 0) found = closestIn(lane - 1);
        else if (within > 1 - slop && lane < cfg.lanes - 1) found = closestIn(lane + 1);
      }

      if (!found) {
        // Nothing to hit: still answer the tap with a ripple on the target.
        g.emptyTaps++;
        g.effects.push({
          kind: 'ring',
          x: (lane + 0.5) * laneW,
          y: HIT_Y,
          color: colors[lane],
          r0: cfg.noteR * 0.6,
          r1: cfg.noteR * 1.8,
          width: 3,
          age: 0,
          life: 0.35,
        });
        return;
      }

      const closest = found.note;
      const closestDiff = found.diff;
      closest.judged = true;
      closest.hit = true;

      let judgment, points, color;
      if (closestDiff <= cfg.perfect) {
        judgment = 'PERFECT';
        points = 100;
        color = '#FFD700';
      } else if (closestDiff <= cfg.great) {
        judgment = 'GREAT';
        points = 75;
        color = '#FFFFFF';
      } else {
        judgment = 'GOOD';
        points = 50;
        color = '#9CFFB0';
      }

      g.combo++;
      if (g.combo > g.maxCombo) g.maxCombo = g.combo;
      g.multiplier = Math.min(5, Math.floor(g.combo / 10) + 1);
      g.score += points * g.multiplier;
      g.judgments[judgment.toLowerCase()]++;

      const noteLane = closest.lane;
      const noteX = (noteLane + 0.5) * laneW;
      const big = cfg.lanes === 2;
      g.targetPop[noteLane] = 1;
      g.effects.push({
        kind: 'text',
        text: judgment,
        color,
        x: noteX,
        y: HIT_Y - cfg.noteR - 30,
        size: big ? 30 : 20,
        age: 0,
        life: 0.6,
      });
      g.effects.push({
        kind: 'ring',
        x: noteX,
        y: HIT_Y,
        color: colors[noteLane],
        r0: cfg.noteR,
        r1: cfg.noteR * (judgment === 'PERFECT' ? 3.2 : 2.5),
        width: 6,
        age: 0,
        life: 0.4,
      });

      const cheer = COMBO_CHEERS[g.combo] || (g.combo > 50 && g.combo % 25 === 0 ? 'Superstar!' : null);
      if (cheer) {
        g.effects.push({ kind: 'banner', text: cheer, sub: `${g.combo} in a row`, age: 0, life: 1.2 });
      }

      const particleCount = judgment === 'PERFECT' ? 14 : judgment === 'GREAT' ? 9 : 6;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 2 + Math.random() * 3;
        g.particles.push({
          x: noteX,
          y: HIT_Y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          color: i % 3 === 0 ? '#FFD700' : colors[noteLane],
          size: (big ? 4 : 3) + Math.random() * 3,
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
    // Two-lane Starter: left-hand keys hit the left lane, right-hand the right
    const keyMap2 = {
      ArrowLeft: 0, ArrowDown: 0, d: 0, D: 0, f: 0, F: 0,
      ArrowUp: 1, ArrowRight: 1, j: 1, J: 1, k: 1, K: 1,
    };

    const onKey = (e) => {
      if (ui.phase === 'playing') {
        if (e.key === 'Escape') {
          e.preventDefault();
          pauseGame();
        } else {
          const map = gs.current?.cfg.lanes === 2 ? keyMap2 : keyMap;
          if (map[e.key] === undefined) return;
          e.preventDefault();
          if (e.repeat) return;
          handleTap(map[e.key]);
        }
      } else if (ui.phase === 'paused' && e.key === 'Escape') {
        e.preventDefault();
        resumeGame();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.phase, handleTap, pauseGame, resumeGame]);

  // Touch / mouse / pen input on canvas. Pointer events fire once per finger,
  // so two-finger chords still work.
  useEffect(() => {
    const el = cvs.current;
    if (!el) return;

    const onPointer = (e) => {
      if (ui.phase !== 'playing') return;
      e.preventDefault();
      const lanes = gs.current?.cfg.lanes ?? 4;
      const rect = el.getBoundingClientRect();
      const x = Math.min(W - 0.01, Math.max(0, (e.clientX - rect.left) * (W / rect.width)));
      handleTap(Math.floor(x / (W / lanes)), x);
    };
    // stop iOS from turning taps into scrolls / zooms
    const block = (e) => e.preventDefault();

    el.addEventListener('pointerdown', onPointer);
    el.addEventListener('touchstart', block, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onPointer);
      el.removeEventListener('touchstart', block);
    };
  }, [ui.phase, handleTap]);

  // Main game loop
  useEffect(() => {
    if (ui.phase !== 'playing' || !gs.current || !gs.current.active) return;
    const g = gs.current;
    const { cfg } = g;
    const LANES = cfg.lanes;
    const LANE_W = W / LANES;
    const NOTE_R = cfg.noteR;
    const SCROLL_DURATION = cfg.scroll;
    const LANE_COLORS = LANES === 2 ? LANE_COLORS_2 : LANE_COLORS_4;
    const LANE_LABELS = LANES === 2 ? LANE_LABELS_2 : LANE_LABELS_4;
    const firstNote = g.beatmap.length ? g.beatmap[0].time : null;
    let raf;
    const ctx = cvs.current.getContext('2d');

    const loop = (ts) => {
      if (!g.active || g.paused) return;
      const dt = g.lastTime ? Math.min(ts - g.lastTime, 50) : 16;
      g.lastTime = ts;

      const currentTime = getAudio().getCurrentTime();
      const duration = g.endTime;
      const dts = dt / 1000;

      if (duration > 0) {
        const span = duration - Math.max(0, g.startAt);
        updateUi({ progress: Math.max(0, Math.min(1, (currentTime - Math.max(0, g.startAt)) / span)) });
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
        if (!note.judged && currentTime - note.time > cfg.miss) {
          note.judged = true;
          note.hit = false;
          g.judgments.miss++;
          g.combo = 0;
          g.multiplier = 1;

          const noteX = (note.lane + 0.5) * LANE_W;
          g.missFlash[note.lane] = 1;
          g.shake = 0.18;
          g.effects.push({
            kind: 'text',
            text: 'MISS',
            color: '#FF5A5A',
            x: noteX,
            y: HIT_Y - NOTE_R - 30,
            size: LANES === 2 ? 30 : 22,
            age: 0,
            life: 0.7,
          });
          // the missed note drops away in grey bits so it's clear what happened
          for (let i = 0; i < 6; i++) {
            g.particles.push({
              x: noteX + (Math.random() - 0.5) * NOTE_R,
              y: HIT_Y + 10,
              vx: (Math.random() - 0.5) * 2,
              vy: 1 + Math.random() * 2,
              color: '#777788',
              size: 3 + Math.random() * 3,
              age: 0,
            });
          }

          updateUi({ combo: 0, multiplier: 1 });
        }
      }

      // Remove old judged notes
      g.activeNotes = g.activeNotes.filter(
        (n) => !n.judged || currentTime - n.time < 0.5,
      );

      // === DRAW ===
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (g.shake > 0) {
        const k = (g.shake / 0.18) * 5;
        ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
        g.shake = Math.max(0, g.shake - dts);
      }

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
      for (let i = 1; i < LANES; i++) {
        ctx.beginPath();
        ctx.moveTo(i * LANE_W, 0);
        ctx.lineTo(i * LANE_W, H);
        ctx.stroke();
      }

      // Lane flashes (every tap) and red miss flashes
      for (let i = 0; i < LANES; i++) {
        const flash = g.laneFlash[i];
        if (flash > 0) {
          const lg = ctx.createLinearGradient(0, 0, 0, H);
          const a = Math.floor(flash * 90).toString(16).padStart(2, '0');
          lg.addColorStop(0, LANE_COLORS[i] + '00');
          lg.addColorStop(0.8, LANE_COLORS[i] + a);
          lg.addColorStop(1, LANE_COLORS[i] + '00');
          ctx.fillStyle = lg;
          ctx.fillRect(i * LANE_W, 0, LANE_W, H);
          g.laneFlash[i] = Math.max(0, flash - dt * 0.004);
        }
        const mf = g.missFlash[i];
        if (mf > 0) {
          ctx.fillStyle = `rgba(255,50,50,${mf * 0.35})`;
          ctx.fillRect(i * LANE_W, HIT_Y - 120, LANE_W, H - HIT_Y + 120);
          g.missFlash[i] = Math.max(0, mf - dts * 2.5);
        }
        g.targetPop[i] = Math.max(0, g.targetPop[i] - dts * 4);
      }

      // Hit zone line
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, HIT_Y);
      ctx.lineTo(W, HIT_Y);
      ctx.stroke();

      // Hit zone targets
      for (let i = 0; i < LANES; i++) {
        const x = (i + 0.5) * LANE_W;
        const flash = g.laneFlash[i];
        const pop = g.targetPop[i];
        ctx.beginPath();
        ctx.arc(x, HIT_Y, (NOTE_R + 2) * (1 + pop * 0.25), 0, Math.PI * 2);
        if (pop > 0) {
          ctx.fillStyle = LANE_COLORS[i] + Math.floor(pop * 120).toString(16).padStart(2, '0');
          ctx.fill();
        }
        ctx.strokeStyle = LANE_COLORS[i] + (flash > 0 ? 'FF' : '66');
        ctx.lineWidth = LANES === 2 ? 4 : 3;
        ctx.stroke();

        ctx.font = `bold ${LANES === 2 ? 22 : 13}px Arial,sans-serif`;
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

      // Effects: judgment text, tap / hit rings, combo cheers
      const keepFx = [];
      for (const eff of g.effects) {
        eff.age += dts;
        if (eff.age > eff.life) continue;
        const p = eff.age / eff.life;
        ctx.save();
        if (eff.kind === 'ring') {
          ctx.globalAlpha = 1 - p;
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, eff.r0 + (eff.r1 - eff.r0) * p, 0, Math.PI * 2);
          ctx.strokeStyle = eff.color;
          ctx.lineWidth = eff.width * (1 - p * 0.6);
          ctx.stroke();
        } else if (eff.kind === 'banner') {
          const pop = p < 0.15 ? p / 0.15 : 1;
          ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `900 ${Math.floor(46 * (0.6 + 0.4 * pop))}px Arial,sans-serif`;
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#2a0040';
          ctx.strokeText(eff.text, W / 2, H * 0.36);
          const tg = ctx.createLinearGradient(0, H * 0.33, 0, H * 0.39);
          tg.addColorStop(0, '#FFE066');
          tg.addColorStop(1, '#FF69B4');
          ctx.fillStyle = tg;
          ctx.fillText(eff.text, W / 2, H * 0.36);
          ctx.font = 'bold 18px Arial,sans-serif';
          ctx.lineWidth = 4;
          ctx.strokeText(eff.sub, W / 2, H * 0.36 + 40);
          ctx.fillStyle = '#fff';
          ctx.fillText(eff.sub, W / 2, H * 0.36 + 40);
        } else {
          const pop = p < 0.12 ? 0.7 + (p / 0.12) * 0.5 : 1.2 - Math.min(0.2, (p - 0.12));
          ctx.globalAlpha = p > 0.6 ? (1 - p) / 0.4 : 1;
          ctx.font = `900 ${Math.floor(eff.size * pop)}px Arial,sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 4;
          const fy = eff.y - p * 24;
          ctx.strokeText(eff.text, eff.x, fy);
          ctx.fillStyle = eff.color;
          ctx.fillText(eff.text, eff.x, fy);
        }
        ctx.restore();
        keepFx.push(eff);
      }
      g.effects = keepFx;

      // Countdown to the first note: 3, 2, 1, GO!
      if (firstNote !== null) {
        const t = firstNote - currentTime;
        if (t > -0.3 && t <= LEAD_IN) {
          const n = Math.ceil(t - 0.5);
          const label = n >= 1 ? String(Math.min(3, n)) : 'GO!';
          const frac = n >= 1 ? 1 - ((t - 0.5) - (n - 1)) : (0.5 - t) / 0.8;
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - frac * 0.8);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `900 ${Math.floor((label === 'GO!' ? 80 : 110) * (1.15 - frac * 0.3))}px Arial,sans-serif`;
          ctx.lineWidth = 8;
          ctx.strokeStyle = '#2a0040';
          ctx.strokeText(label, W / 2, H * 0.4);
          ctx.fillStyle = label === 'GO!' ? '#39FF14' : '#FFFFFF';
          ctx.fillText(label, W / 2, H * 0.4);
          ctx.restore();
        }
        if (t > 1.5 && t <= LEAD_IN) {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.font = 'bold 20px Arial,sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillText('Tap when a gem hits its circle!', W / 2, H * 0.4 + 90);
          ctx.restore();
        }
      }

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

      // Song ended (Starter stops early and fades the music out)
      if (duration > 0 && currentTime >= duration - 0.1) {
        finishSong(duration < g.duration - 0.5);
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
      <div className="app app-wide">
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
          <p>Keys: ← ↓ ↑ → or D F J K · Touch or click: tap the lanes</p>
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
          {MODE_ORDER.map((d) => {
            const m = MODES[d];
            return (
              <button
                key={d}
                className={`diff-btn diff-${d}${difficulty === d ? ' diff-active' : ''}`}
                onClick={() => updateUi({ difficulty: d })}
              >
                <span className="diff-icon" aria-hidden="true">{m.icon}</span>
                <span className="diff-text">
                  <span className="diff-label">{m.label}</span>
                  <span className="diff-desc">{m.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="difficulty-actions">
          <button className="btn btn-play" onClick={() => selectSong(selectedSong, difficulty)}>
            ▶ Play <span className="play-mode" aria-label={MODES[difficulty].label}>{MODES[difficulty].icon}</span>
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
          <div className="results-stars" aria-label={`${results.stars} of 3 stars`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`rstar${i < results.stars ? ' rstar-on' : ''}`}
                style={{ animationDelay: `${0.2 + i * 0.25}s` }}
              >
                ★
              </span>
            ))}
          </div>
          {results.mode !== 'kid' && (
            <div className={`results-grade grade-${results.grade}`}>{results.grade}</div>
          )}
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
            <button className="btn btn-play" onClick={() => selectSong(gs.current.song, results.mode)}>
              ↻ Play Again
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
        <button className="pause-btn" onClick={pauseGame} aria-label="Pause">⏸</button>
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
              <button className="btn btn-play" onClick={resumeGame}>▶ Resume</button>
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
