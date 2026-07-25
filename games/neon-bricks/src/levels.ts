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

function b(color: number, hp = 1): BrickSpec {
  return { color, hp };
}

/** Level 1 — Rainbow Cascade: classic rainbow rows, all 1-hit. */
function rainbow(): LevelDef {
  const cols = 10;
  const grid: (BrickSpec | null)[][] = [];
  for (let r = 0; r < 7; r++) {
    const row: (BrickSpec | null)[] = [];
    for (let c = 0; c < cols; c++) row.push(b(NEON[r % NEON.length]));
    grid.push(row);
  }
  return { name: 'Rainbow Cascade', grid, cols, ballSpeed: 620 };
}

/** Level 2 — Neon Diamond: diamond shape, rings by color, tough core. */
function diamond(): LevelDef {
  const cols = 11;
  const rows = 11;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const grid: (BrickSpec | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: (BrickSpec | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const d = Math.abs(c - cx) + Math.abs(r - cy);
      if (d > 5) {
        row.push(null);
      } else if (d <= 1) {
        row.push(b(0xffffff, 3)); // blazing core
      } else if (d <= 2) {
        row.push(b(NEON[0], 2));
      } else {
        row.push(b(NEON[(d + 2) % NEON.length], 1));
      }
    }
    grid.push(row);
  }
  return { name: 'Neon Diamond', grid, cols, ballSpeed: 680 };
}

/** Level 3 — Big Smiley: yellow face, tough cyan eyes, pink smile. */
function smiley(): LevelDef {
  const cols = 12;
  const art = [
    '....####....',
    '..########..',
    '.##########.',
    '.###EE##EE#.',
    '####EE##EE##',
    '############',
    '####M####M##',
    '.###MM##MM#.',
    '.####MMMM##.',
    '..########..',
    '....####....',
    '............',
  ];
  const grid: (BrickSpec | null)[][] = art.map((line) =>
    line.split('').map((ch) => {
      if (ch === '#') return b(NEON[2], 1); // yellow face
      if (ch === 'E') return b(NEON[4], 2); // cyan eyes
      if (ch === 'M') return b(NEON[0], 2); // pink mouth
      return null;
    }),
  );
  return { name: 'Big Smiley', grid, cols, ballSpeed: 720 };
}

/** Level 4 — The Fortress: armored towers and a checkerboard heart. */
function fortress(): LevelDef {
  const cols = 11;
  const rows = 10;
  const grid: (BrickSpec | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: (BrickSpec | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const isTower = c < 2 || c >= cols - 2;
      if (isTower) {
        row.push(r < 6 ? b(NEON[6], r < 2 ? 3 : 2) : null);
      } else if (r >= 2 && r < 8) {
        // checkerboard center
        if ((r + c) % 2 === 0) row.push(b(NEON[(r + 3) % NEON.length], 1));
        else if (r === 4 || r === 5) row.push(b(NEON[0], 2));
        else row.push(null);
      } else if (r < 2) {
        row.push(b(NEON[4], 2));
      } else {
        row.push(null);
      }
    }
    grid.push(row);
  }
  return { name: 'The Fortress', grid, cols, ballSpeed: 760 };
}

export function getLevels(): LevelDef[] {
  return [rainbow(), diamond(), smiley(), fortress()];
}
