/**
 * Headless check of the shared simulation: four bots must complete a race on
 * every track without a renderer, and the track geometry must be sane.
 *
 *   node --experimental-strip-types test/sim.test.ts
 */
import { Race, COUNTDOWN_TIME } from '../src/shared/race.ts';
import { TRACKS } from '../src/shared/tracks.ts';
import { buildTrack } from '../src/shared/track.ts';
import { TICK_DT } from '../src/shared/kart.ts';
import { encodeSnapshot, decodeSnapshot } from '../src/shared/protocol.ts';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let failures = 0;
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error('✗ ' + msg);
    failures++;
  }
}

// --- Geometry sanity ---------------------------------------------------------
for (const def of TRACKS) {
  const g = buildTrack(def);
  assert(g.length > 300 && g.length < 2000, `${def.id}: lap length ${g.length.toFixed(0)} out of range`);
  // No two samples closer than a road width unless they are neighbours: that
  // would mean the loop crosses or nearly touches itself.
  let minGap = Infinity;
  const n = g.samples.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 40; j < n; j++) {
      if (n - (j - i) < 40) continue;
      const a = g.samples[i];
      const b = g.samples[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < minGap) minGap = d;
    }
  }
  assert(minGap > def.width + def.shoulder * 2 + 2, `${def.id}: loop comes within ${minGap.toFixed(1)} of itself`);
  const maxCurv = Math.max(...g.samples.map((s) => Math.abs(s.curvature)));
  const tight = g.samples.find((s) => Math.abs(s.curvature) === maxCurv)!;
  // The barrier sits width/2 + shoulder from the centreline; a bend tighter
  // than that folds the inner ribbon over itself.
  const minRadius = 1 / maxCurv;
  assert(minRadius > def.width / 2 + def.shoulder + 1, `${def.id}: tightest bend radius ${minRadius.toFixed(1)} is too sharp for the barrier offset (at ${tight.x.toFixed(0)}, ${tight.z.toFixed(0)})`);
  console.log(`✓ ${def.id}: lap ${g.length.toFixed(0)}u, ${n} samples, min self-gap ${minGap.toFixed(1)}, max curvature ${maxCurv.toFixed(3)}, ${g.boxes.length} boxes, ${g.pads.length} pads`);
}

// --- A full bot race on each track ------------------------------------------
for (const def of TRACKS) {
  const race = new Race(def.id, 'normal', seeded(7));
  race.beginCountdown();
  assert(race.phase === 'countdown', 'countdown starts');
  let ticks = 0;
  let laps = 0;
  let hits = 0;
  let items = 0;
  let boosts = 0;
  const MAX = Math.round((COUNTDOWN_TIME + 240) / TICK_DT);
  while (race.phase !== 'finished' && ticks < MAX) {
    race.step(TICK_DT);
    for (const e of race.takeEvents()) {
      if (e.k === 'lap') laps++;
      if (e.k === 'hit') hits++;
      if (e.k === 'item') items++;
      if (e.k === 'boost') boosts++;
    }
    ticks++;
  }
  assert(race.phase === 'finished', `${def.id}: race never finished (${(ticks * TICK_DT).toFixed(0)}s)`);
  const places = race.karts.map((k) => k.place).sort();
  assert(places.join() === '1,2,3,4', `${def.id}: places ${places.join()}`);
  const times = race.karts.map((k) => k.finishTime);
  assert(times.every((t) => t > 20), `${def.id}: someone finished suspiciously fast: ${times.join(', ')}`);
  const snap = decodeSnapshot(JSON.parse(JSON.stringify(encodeSnapshot(race))));
  assert(snap.phase === 'finished' && snap.karts.length === 4, 'snapshot round-trips');
  console.log(
    `✓ ${def.id}: finished in ${race.time.toFixed(1)}s — winner ${race.slots[race.standings()[0]].name}, laps ${laps}, items ${items}, hits ${hits}, drift boosts ${boosts}, times ${times.map((t) => t.toFixed(1)).join('/')}`
  );
}

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('all good');
