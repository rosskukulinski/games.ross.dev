/** Handcrafted level layouts, built by tiny generator functions. */

export interface BrickSpec {
  color: number;
  hp: number;
}

export interface LevelDef {
  name: string;
  /** grid[row][col] — null means empty cell */
  grid: (BrickSpec | null)[][];
  cols: number;
  ballSpeed: number;
}

export const NEON = [
  0xff2d95, // pink
  0xff9f1c, // orange
  0xffee32, // yellow
  0x39ff14, // green
  0x00f5ff, // cyan
  0x4d6cff, // blue
  0xb537f2, // purple
];

const WHITE = 0xffffff;

function b(color: number, hp = 1): BrickSpec {
  return { color, hp };
}

/** Neon palette index (wraps) → brick. */
function n(i: number, hp = 1): BrickSpec {
  return { color: NEON[((i % NEON.length) + NEON.length) % NEON.length], hp };
}

/**
 * A level before its ball speed is filled in. Speed ramps with level number
 * unless a level opts out with an explicit value.
 */
interface LevelSeed {
  name: string;
  grid: (BrickSpec | null)[][];
  cols: number;
  ballSpeed?: number;
}

/**
 * ASCII legend for `art()` levels.
 *   lowercase letter = 1 hit, uppercase = 2 hits
 *   p/o/y/g/c/b/u    = pink orange yellow green cyan blue pUrple
 *   w/W              = white, X = white 3 hits, Z = white 4 hits
 *   . or space       = empty
 */
const ART: Record<string, BrickSpec> = {
  p: n(0), o: n(1), y: n(2), g: n(3), c: n(4), b: n(5), u: n(6), w: b(WHITE),
  P: n(0, 2), O: n(1, 2), Y: n(2, 2), G: n(3, 2), C: n(4, 2), B: n(5, 2), U: n(6, 2), W: b(WHITE, 2),
  X: b(WHITE, 3), Z: b(WHITE, 4),
};

/** Build a level from ASCII art. Short rows are padded with empty cells. */
function art(name: string, rows: string[], ballSpeed?: number): LevelSeed {
  const cols = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((line) => {
    const cells: (BrickSpec | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const spec = ART[line[c] ?? '.'];
      cells.push(spec ? { ...spec } : null);
    }
    return cells;
  });
  return { name, grid, cols, ballSpeed };
}

/** Build a level from a per-cell function — for patterns math draws better than ASCII. */
function shape(
  name: string,
  cols: number,
  rows: number,
  fn: (r: number, c: number) => BrickSpec | null,
  ballSpeed?: number,
): LevelSeed {
  const grid: (BrickSpec | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: (BrickSpec | null)[] = [];
    for (let c = 0; c < cols; c++) row.push(fn(r, c));
    grid.push(row);
  }
  return { name, grid, cols, ballSpeed };
}

// ---------------------------------------------------------------- chapter 1

/** Level 1 — Rainbow Cascade: classic rainbow rows, all 1-hit. */
const rainbow = (): LevelSeed =>
  shape('Rainbow Cascade', 10, 7, (r) => n(r));

/** Level 2 — Neon Diamond: diamond shape, rings by color, tough core. */
const diamond = (): LevelSeed =>
  shape('Neon Diamond', 11, 11, (r, c) => {
    const d = Math.abs(c - 5) + Math.abs(r - 5);
    if (d > 5) return null;
    if (d <= 1) return b(WHITE, 3); // blazing core
    if (d <= 2) return n(0, 2);
    return n(d + 2);
  });

/** Level 3 — Big Smiley: yellow face, tough cyan eyes, pink smile. */
const smiley = (): LevelSeed =>
  art('Big Smiley', [
    '....yyyy....',
    '..yyyyyyyy..',
    '.yyyyyyyyyy.',
    '.yyyCCyyCCy.',
    'yyyyCCyyCCyy',
    'yyyyyyyyyyyy',
    'yyyyPyyyyPyy',
    '.yyyPPyyPPy.',
    '.yyyyPPPPyy.',
    '..yyyyyyyy..',
    '....yyyy....',
  ]);

/** Level 4 — The Fortress: armored towers and a checkerboard heart. */
const fortress = (): LevelSeed =>
  shape('The Fortress', 11, 10, (r, c) => {
    const isTower = c < 2 || c >= 9;
    if (isTower) return r < 6 ? n(6, r < 2 ? 3 : 2) : null;
    if (r < 2) return n(4, 2);
    if (r >= 2 && r < 8) {
      if ((r + c) % 2 === 0) return n(r + 3);
      if (r === 4 || r === 5) return n(0, 2);
    }
    return null;
  });

const waves = (): LevelSeed =>
  shape('Neon Waves', 12, 9, (r, c) => {
    const crest = 4 + Math.round(2.6 * Math.sin((c / 11) * Math.PI * 2));
    const d = Math.abs(r - crest);
    return d <= 2 ? n(c, d === 0 ? 2 : 1) : null;
  });

const invader = (): LevelSeed =>
  art('Space Invader', [
    '..g.....g..',
    '...g...g...',
    '..ggggggg..',
    '.gg.ggg.gg.',
    'ggggggggggg',
    'g.gcgggcg.g',
    'g.g.....g.g',
    '...gg.gg...',
  ]);

const towers = (): LevelSeed =>
  art('Twin Towers', [
    '.uu......uu.',
    '.uu......uu.',
    '.UU......UU.',
    '.UUccccccUU.',
    '.UUccccccUU.',
    '.UU......UU.',
    '.UU......UU.',
    '.WW......WW.',
    'oooooooooooo',
  ]);

const checkers = (): LevelSeed =>
  shape('Checkerboard', 12, 10, (r, c) => ((r + c) % 2 === 0 ? n(r, r >= 6 ? 2 : 1) : null));

const arrow = (): LevelSeed =>
  shape('Neon Arrow', 13, 11, (r, c) => {
    const d = Math.abs(c - 6);
    if (r < 6) return d <= r ? n(r + d, d === 0 ? 2 : 1) : null;
    return d <= 1 ? n(4, 2) : null;
  });

const pyramid = (): LevelSeed =>
  shape('Pyramid Power', 13, 8, (r, c) => {
    const d = Math.abs(c - 6);
    if (d > r) return null;
    return n(6 - r, r === 7 ? 3 : r >= 5 ? 2 : 1);
  });

// ---------------------------------------------------------------- chapter 2

const heart = (): LevelSeed =>
  art('Heartbeat', [
    '..ppp...ppp..',
    '.ppppp.ppppp.',
    'ppppppppppppp',
    'pppppPPPppppp',
    '.pppPPPPPppp.',
    '..pppPPPppp..',
    '...ppppppp...',
    '....ppppp....',
    '.....ppp.....',
    '......p......',
  ]);

const starburst = (): LevelSeed =>
  art('Starburst', [
    '......y......',
    '.....yyy.....',
    '.....yyy.....',
    'yyyyyyyyyyyyy',
    '.yyyyOOOyyyy.',
    '..yyyOOOyyy..',
    '...yyyyyyy...',
    '...yyy.yyy...',
    '..yy.....yy..',
    '.yy.......yy.',
  ]);

const ladder = (): LevelSeed =>
  shape('Zigzag Ladder', 12, 11, (r, c) => {
    if (c === 0 || c === 11) return n(6, 2); // rails
    if (r % 2 === 1) return null;
    const rung = r % 4 === 0 ? c < 7 : c > 4;
    return rung ? n(r / 2) : null;
  });

const wall = (): LevelSeed =>
  shape('Brick Wall', 14, 10, (r, c) => {
    const mortar = (c + (r % 2)) % 4 === 3;
    if (mortar) return null;
    return n(r + Math.floor(c / 4), r >= 6 ? 2 : 1);
  });

const eye = (): LevelSeed =>
  art('The Eye', [
    '....ccccc....',
    '..ccccccccc..',
    '.ccccUUUcccc.',
    'cccccUXUccccc',
    'cccccUUUccccc',
    '.ccccUUUcccc.',
    '..ccccccccc..',
    '....ccccc....',
  ]);

const rocket = (): LevelSeed =>
  art('Rocket Launch', [
    '.....p.....',
    '....ppp....',
    '...ppppp...',
    '...pPCPp...',
    '...pPCPp...',
    '...ppppp...',
    '..ppppppp..',
    '.pp.ppp.pp.',
    '.p...o...p.',
    '....ooo....',
    '...ooooo...',
    '....ooo....',
  ]);

const honeycomb = (): LevelSeed =>
  shape('Honeycomb', 13, 11, (r, c) => {
    const cell = (c + (r % 2)) % 3;
    if (cell === 0) return null;
    return n(cell === 1 ? 2 : 1, r % 3 === 0 ? 2 : 1);
  });

const skull = (): LevelSeed =>
  art('Neon Skull', [
    '..wwwwwwww..',
    '.wwwwwwwwww.',
    'wwwwwwwwwwww',
    'ww.PP..PP.ww',
    'ww.PP..PP.ww',
    'wwwwwwwwwwww',
    'wwww.OO.wwww',
    '.wwwwwwwwww.',
    '...w.w.w.w..',
  ]);

const snake = (): LevelSeed =>
  shape('Neon Snake', 13, 11, (r, c) => {
    if (r % 2 === 1) {
      const side = ((r - 1) / 2) % 2 === 0 ? 12 : 0;
      return c === side ? n(3, 2) : null;
    }
    return n(3 + ((r / 2) % 3), r === 0 ? 2 : 1);
  });

const gauntlet = (): LevelSeed =>
  shape('The Gauntlet', 12, 12, (r, c) => {
    if (c % 3 === 1) return null; // corridors
    if (r < 3) return b(WHITE, 2);
    return n(c, r >= 9 ? 2 : 1);
  });

// ---------------------------------------------------------------- chapter 3

const ghost = (): LevelSeed =>
  art('Ghost Chase', [
    'y.y.y.y.y.y.y',
    '...uuuuuuu...',
    '..uuuuuuuuu..',
    '.uuwwuuuwwuu.',
    '.uuCwuuuCwuu.',
    'uuuuuuuuuuuuu',
    'uuuuuuuuuuuuu',
    'uuuuuuuuuuuuu',
    'uu.uu.u.uu.uu',
  ]);

const mushroom = (): LevelSeed =>
  art('Mushroom', [
    '...pppppp...',
    '.pppppppppp.',
    'pppwwppwwppp',
    'pppwwppwwppp',
    'pppppppppppp',
    '.wwwwwwwwww.',
    '...wwwwww...',
    '...wwwwww...',
    '...wwwwww...',
  ]);

const soundwave = (): LevelSeed =>
  shape('Sound Wave', 14, 12, (r, c) => {
    const heights = [3, 6, 9, 5, 11, 7, 12, 12, 7, 11, 5, 9, 6, 3];
    return r >= 12 - heights[c] ? n(c, r >= 10 ? 2 : 1) : null;
  });

const crossfire = (): LevelSeed =>
  shape('Crossfire', 13, 13, (r, c) => {
    const onX = Math.abs(r - c) <= 1 || Math.abs(r - (12 - c)) <= 1;
    return onX ? n(Math.abs(r - 6), r === 6 ? 3 : 2) : null;
  });

const cathedral = (): LevelSeed =>
  shape('Cathedral', 13, 11, (r, c) => {
    const bay = c % 4;
    if (bay === 0) return n(6, 2); // pillars
    if (r < 3 && bay !== 2) return null; // arch openings
    return n(r + c);
  });

const fleet = (): LevelSeed =>
  art('Alien Fleet', [
    '.cc...cc...cc.',
    'cccc.cccc.cccc',
    'c..c.c..c.c..c',
    '..............',
    '.gg...gg...gg.',
    'gggg.gggg.gggg',
    'g..g.g..g.g..g',
    '..............',
    '.pp...pp...pp.',
    'pppp.pppp.pppp',
    'p..p.p..p.p..p',
  ]);

const vortex = (): LevelSeed =>
  shape('Vortex', 13, 13, (r, c) => {
    const dx = c - 6;
    const dy = r - 6;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 6.5) return null;
    const swirl = (Math.atan2(dy, dx) / Math.PI + dist / 2.2 + 4) % 2;
    return swirl < 1 ? n(Math.round(dist), dist < 2 ? 3 : 1) : null;
  });

const blocks = (): LevelSeed =>
  shape('Block Party', 12, 12, (r, c) => {
    const br = Math.floor(r / 2);
    const bc = Math.floor(c / 2);
    const on = (br * 7 + bc * 5 + br * bc) % 3 !== 0;
    return on ? n(br + bc, br >= 4 ? 2 : 1) : null;
  });

const butterfly = (): LevelSeed =>
  art('Butterfly', [
    '.uuu..u..uuu.',
    'uuuuu.u.uuuuu',
    'uuuuu.u.uuuuu',
    '.uuu..u..uuu.',
    '..u...W...u..',
    '.ppp..W..ppp.',
    'ppppp.W.ppppp',
    '.ppp..W..ppp.',
    '..p...W...p..',
  ]);

const vault = (): LevelSeed =>
  shape('The Vault', 12, 11, (r, c) => {
    if (r === 0 || r === 10 || c === 0 || c === 11) return b(WHITE, 2);
    const dx = Math.abs(c - 5.5);
    const dy = Math.abs(r - 5);
    if (dx <= 2 && dy <= 2) return n(0, 2);
    return (r + c) % 2 === 0 ? n(r + c) : null;
  });

// ---------------------------------------------------------------- chapter 4

const circuit = (): LevelSeed =>
  shape('Circuit Board', 14, 11, (r, c) => {
    if (r % 2 === 0) return n(3, r === 0 || r === 10 ? 2 : 1); // traces
    return c % 3 === 1 ? n(4, 2) : null; // vias
  });

const egg = (): LevelSeed =>
  art('Dragon Egg', [
    '...ggggg...',
    '..ggggggg..',
    '.ggggggggg.',
    '.gggGGGggg.',
    'ggggGGGgggg',
    'gggGGXGGggg',
    'ggggGGGgggg',
    '.gggGGGggg.',
    '.ggggggggg.',
    '..ggggggg..',
    '...ggggg...',
  ]);

const crystal = (): LevelSeed =>
  art('Ice Crystal', [
    '......c......',
    '.c....c....c.',
    '..c...c...c..',
    '...ccccccc...',
    '..cccCCCccc..',
    'CCcccCWCcccCC',
    '..cccCCCccc..',
    '...ccccccc...',
    '..c...c...c..',
    '.c....c....c.',
    '......c......',
  ]);

const robot = (): LevelSeed =>
  art('Robot Face', [
    '..b......b..',
    '..b......b..',
    '.wwwwwwwwww.',
    'wwCCwwwwCCww',
    'wwCCwwwwCCww',
    'wwwwwwwwwwww',
    'ww.OOOOOO.ww',
    'ww.O.OO.O.ww',
    'wwwwwwwwwwww',
    '.wwwwwwwwww.',
  ]);

const helix = (): LevelSeed =>
  shape('Double Helix', 12, 13, (r, c) => {
    const a = (r / 12) * Math.PI * 2.5;
    const s1 = 5.5 + 5 * Math.sin(a);
    const s2 = 5.5 - 5 * Math.sin(a);
    if (Math.abs(c - s1) < 0.75) return n(4, 2);
    if (Math.abs(c - s2) < 0.75) return n(0, 2);
    const inner = c > Math.min(s1, s2) && c < Math.max(s1, s2);
    return r % 3 === 0 && inner ? n(2) : null;
  });

const rain = (): LevelSeed =>
  shape('Rain Curtain', 14, 12, (r, c) => {
    const len = 4 + ((c * 5) % 8);
    const start = (c * 3) % 4;
    if (r < start || r >= start + len) return null;
    return n(5 + (c % 2), r === start ? 2 : 1);
  });

const castle = (): LevelSeed =>
  shape('Castle Siege', 13, 12, (r, c) => {
    if (r === 0) return c % 2 === 0 ? b(WHITE, 2) : null; // crenellations
    if (r <= 2) return b(WHITE, 2);
    if (c === 0 || c === 12 || c === 6) return n(6, 2); // towers
    if (r >= 10) return n(r + c, 2);
    return (r + c) % 3 !== 0 ? n(c) : null;
  });

const cat = (): LevelSeed =>
  art('Neon Cat', [
    '.o........o.',
    '.oo......oo.',
    '.oooooooooo.',
    'oooooooooooo',
    'ooGGooooGGoo',
    'ooGGooooGGoo',
    'oooooPPooooo',
    'oo.oooooo.oo',
    '.oooooooooo.',
    '..oooooooo..',
  ]);

const meteors = (): LevelSeed =>
  shape('Meteor Shower', 14, 12, (r, c) => {
    const streak = (r + c) % 4;
    return streak <= 1 ? n(r + c, r >= 8 ? 2 : 1) : null;
  });

const labyrinth = (): LevelSeed =>
  shape('The Labyrinth', 13, 12, (r, c) => {
    if (r % 2 === 0) {
      const gap = (r * 5 + 3) % 13;
      return c === gap ? null : n(6, r % 4 === 0 ? 2 : 1);
    }
    return (c + r) % 4 === 0 ? n(4) : null;
  });

// ---------------------------------------------------------------- chapter 5

const jellyfish = (): LevelSeed =>
  art('Cosmic Jellyfish', [
    '...uuuuuuu...',
    '.uuuuuuuuuuu.',
    'uuuuuuuuuuuuu',
    'uuuCCuuuCCuuu',
    'uuuuuuuuuuuuu',
    '.uuuuuuuuuuu.',
    'p.p.p.p.p.p.p',
    '.p.p.p.p.p.p.',
    'p.p.p.p.p.p.p',
    '.p.p.p.p.p.p.',
  ]);

const bolt = (): LevelSeed =>
  art('Power Chord', [
    '......YYYY..',
    '.....YYYY...',
    '....YYYY....',
    '...YYYY.....',
    '..YYYYYYY...',
    '.....YYYY...',
    '....YYYY....',
    '...YYYY.....',
    '..YYYY......',
    '.YYY........',
    'oooooooooooo',
    '.oooooooooo.',
  ]);

const bomb = (): LevelSeed =>
  art('Time Bomb', [
    '.......oo..',
    '......oo...',
    '.....oo....',
    '...wwwww...',
    '..wwwwwww..',
    '.wwwwwwwww.',
    'wwwwXXXwwww',
    'wwwwXXXwwww',
    '.wwwwwwwww.',
    '..wwwwwww..',
    '...wwwww...',
  ]);

const web = (): LevelSeed =>
  shape('Spider Web', 13, 12, (r, c) => {
    const dx = c - 6;
    const dist = Math.sqrt(dx * dx + r * r);
    if (dist > 12) return null;
    const ring = Math.abs(dist - Math.round(dist / 2.5) * 2.5) < 0.6;
    const spoke = Math.abs(dx) < 0.6 || Math.abs(Math.abs(dx) - r) < 0.6;
    return ring || spoke ? n(4, dist < 4 ? 2 : 1) : null;
  });

const phoenix = (): LevelSeed =>
  art('Phoenix Rising', [
    '..O.......O..',
    '.OO.......OO.',
    '.ooo.....ooo.',
    '.oooo...oooo.',
    '.ooooo.ooooo.',
    '..ooo.O.ooo..',
    '...oo.O.oo...',
    '....YYOYY....',
    '...YYYOYYY...',
    '..yyy.O.yyy..',
    '.yy.......yy.',
  ]);

const fractal = (): LevelSeed =>
  shape('Fractal Bloom', 13, 13, (r, c) => {
    const on = (r & c) === 0 || ((12 - r) & c) === 0;
    return on ? n(r + c, r >= 8 ? 2 : 1) : null;
  });

const colosseum = (): LevelSeed =>
  shape('The Colosseum', 13, 11, (r, c) => {
    const dx = c - 6;
    const dy = (r - 5) * 1.15;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 6.6) return null;
    const ring = Math.floor(d);
    if (ring % 2 === 0) return n(ring, ring <= 1 ? 3 : 2); // tiers
    // radial spokes spanning the gaps between tiers
    return Math.abs(Math.cos(Math.atan2(dy, dx) * 6)) > 0.8 ? n(1) : null;
  });

const galaxy = (): LevelSeed =>
  shape('Galaxy Spiral', 14, 13, (r, c) => {
    const dx = c - 6.5;
    const dy = (r - 6) * 1.3;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 7.5) return null;
    if (d < 1.6) return b(WHITE, 3);
    const arm = Math.abs(Math.sin(Math.atan2(dy, dx) + d * 0.55));
    return arm > 0.72 ? n(Math.round(d), d < 4 ? 2 : 1) : null;
  });

const finalFortress = (): LevelSeed =>
  shape('Final Fortress', 13, 12, (r, c) => {
    if (r === 0 || r === 11 || c === 0 || c === 12) return b(WHITE, 2);
    if (r === 1 || r === 10 || c === 1 || c === 11) return n(6);
    const dx = Math.abs(c - 6);
    const dy = Math.abs(r - 5.5);
    if (dx + dy * 1.2 <= 3) return n(0, 3);
    return (r + c) % 2 === 0 ? n(r + c) : null;
  });

const supernova = (): LevelSeed =>
  shape('Supernova', 13, 13, (r, c) => {
    const dx = c - 6;
    const dy = r - 6;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 6.6) return null;
    if (d < 1.2) return b(WHITE, 4);
    const spike = Math.abs(Math.cos(Math.atan2(dy, dx) * 4));
    if (d >= 2.6 && spike <= 0.55) return null;
    return n(6 - Math.round(d), d < 3 ? 3 : d < 5 ? 2 : 1);
  });

// ----------------------------------------------------------------- assembly

const BUILDERS: (() => LevelSeed)[] = [
  // chapter 1 — warm-up
  rainbow, diamond, smiley, fortress, waves,
  invader, towers, checkers, arrow, pyramid,
  // chapter 2 — shapes with teeth
  heart, starburst, ladder, wall, eye,
  rocket, honeycomb, skull, snake, gauntlet,
  // chapter 3 — arcade icons
  ghost, mushroom, soundwave, crossfire, cathedral,
  fleet, vortex, blocks, butterfly, vault,
  // chapter 4 — machinery
  circuit, egg, crystal, robot, helix,
  rain, castle, cat, meteors, labyrinth,
  // chapter 5 — the long haul
  jellyfish, bolt, bomb, web, phoenix,
  fractal, colosseum, galaxy, finalFortress, supernova,
];

export const LEVEL_COUNT = BUILDERS.length;

/** Ball speed ramps steadily from level 1 to the last, staying under the 980 cap. */
function speedFor(idx: number): number {
  return Math.round(620 + (idx / (BUILDERS.length - 1)) * 310);
}

export function getLevels(): LevelDef[] {
  return BUILDERS.map((build, i) => {
    const seed = build();
    return {
      name: seed.name,
      grid: seed.grid,
      cols: seed.cols,
      ballSpeed: seed.ballSpeed ?? speedFor(i),
    };
  });
}
