import { beatmaps } from './beatmaps.js';

// Seeded PRNG (mulberry32)
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// Compute percentile value from an array of numbers
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// Generate a playable BPM-based beatmap when no analyzed data is available.
// Notes are placed on the beat grid with lane assignments via seeded RNG.
function generateProceduralBeatmap(song, difficulty) {
  const bpm = song.bpm || 120;
  const offset = song.offset || 0.5;
  const rng = mulberry32(hashString(song.id + difficulty));
  const beat = 60.0 / bpm;
  const maxDuration = 240; // generate up to 4 min; game stops at actual audio end

  // Subdivision: easy = quarter notes, medium = 8th notes, hard = 8th + 16th
  const subdivisions = difficulty === 'easy' ? [0] : difficulty === 'hard' ? [0, 0.5, 0.75] : [0, 0.5];

  const notes = [];
  let lastLane = -1;
  let sameLaneCount = 0;

  for (let t = offset; t < maxDuration; t = Math.round((t + beat) * 10000) / 10000) {
    for (const sub of subdivisions) {
      const noteTime = Math.round((t + sub * beat) * 10000) / 10000;
      if (noteTime >= maxDuration) break;
      // On easy, only place notes on beat (sub=0)
      // On medium/hard, occasionally skip off-beats
      if (sub !== 0 && rng() < 0.35) continue;

      let lane = Math.floor(rng() * 4);
      if (lane === lastLane && sameLaneCount >= 2) {
        let attempts = 0;
        while (lane === lastLane && attempts < 10) {
          lane = Math.floor(rng() * 4);
          attempts++;
        }
      }
      if (lane === lastLane) sameLaneCount++;
      else sameLaneCount = 1;
      lastLane = lane;

      notes.push({ time: noteTime, lane, hit: false, judged: false });
    }
  }

  return notes;
}

export function generateBeatmap(song, difficulty = 'medium') {
  const { id } = song;
  const data = beatmaps[id];

  if (!data) {
    // Fallback: generate procedural BPM-based notes until analyze-songs.py is run
    return generateProceduralBeatmap(song, difficulty);
  }

  const events = data.events;
  const rng = mulberry32(hashString(id + difficulty));

  // Separate drum and melody strengths for percentile calculation
  const drumStrengths = events.filter((e) => e.type === 'd').map((e) => e.s);
  const melodyStrengths = events.filter((e) => e.type === 'm').map((e) => e.s);

  // Difficulty filtering thresholds
  let drumThreshold, melodyThreshold, maxNotesPerSec;
  if (difficulty === 'easy') {
    drumThreshold = percentile(drumStrengths, 70);
    melodyThreshold = Infinity; // no melody notes on easy
    maxNotesPerSec = 2;
  } else if (difficulty === 'medium') {
    drumThreshold = percentile(drumStrengths, 40);
    melodyThreshold = percentile(melodyStrengths, 60);
    maxNotesPerSec = 3;
  } else {
    // hard
    drumThreshold = percentile(drumStrengths, 10);
    melodyThreshold = percentile(melodyStrengths, 20);
    maxNotesPerSec = 6;
  }

  // Filter events by difficulty
  let filtered = events.filter((ev) => {
    if (ev.type === 'd') return ev.s >= drumThreshold;
    if (ev.type === 'm') return ev.s >= melodyThreshold;
    return false;
  });

  // Enforce max notes/sec by removing weaker events in dense windows
  if (filtered.length > 0) {
    const minGap = 1.0 / maxNotesPerSec;
    const spaced = [filtered[0]];
    for (let i = 1; i < filtered.length; i++) {
      if (filtered[i].t - spaced[spaced.length - 1].t >= minGap) {
        spaced.push(filtered[i]);
      }
    }
    filtered = spaced;
  }

  // Assign lanes
  // Pitch bands for melody: divide pitch range into 4 lanes
  const melodyPitches = events.filter((e) => e.type === 'm' && e.p > 0).map((e) => e.p);
  const pitchMin = melodyPitches.length > 0 ? Math.min(...melodyPitches) : 80;
  const pitchMax = melodyPitches.length > 0 ? Math.max(...melodyPitches) : 1000;
  const pitchRange = pitchMax - pitchMin || 1;

  let lastLane = -1;
  let sameLaneCount = 0;

  const notes = filtered.map((ev) => {
    let lane;

    if (ev.type === 'd') {
      // Drums: lanes 0-1 (left/down) based on strength median
      const medianDrum = percentile(drumStrengths, 50);
      lane = ev.s >= medianDrum ? 0 : 1;
    } else {
      // Melody: lanes 0-3 based on pitch bands
      const pitchNorm = (ev.p - pitchMin) / pitchRange;
      lane = Math.min(3, Math.floor(pitchNorm * 4));
    }

    // Add some randomness to avoid monotony
    if (rng() < 0.3) {
      lane = Math.floor(rng() * 4);
    }

    // Anti-repetition: no 3+ consecutive same lane
    if (lane === lastLane && sameLaneCount >= 2) {
      let attempts = 0;
      while (lane === lastLane && attempts < 10) {
        lane = Math.floor(rng() * 4);
        attempts++;
      }
    }

    // Prefer adjacent lanes sometimes for flow
    if (rng() < 0.25 && lastLane >= 0) {
      const adj = lastLane + (rng() < 0.5 ? -1 : 1);
      if (adj >= 0 && adj < 4) lane = adj;
    }

    if (lane === lastLane) sameLaneCount++;
    else sameLaneCount = 1;
    lastLane = lane;

    return { time: ev.t, lane, hit: false, judged: false };
  });

  return notes;
}
