export const TILE = 32;
export const COLS = 20;
export const ROWS = 18;
export const W = COLS * TILE; // 640
export const H = ROWS * TILE; // 576

export const PLAYER_SPEED = 2.5;
export const PLAYER_SIZE = 12; // half-width of hitbox
export const INTERACT_RANGE = 40;

export const CRAB_SPEED = 0.8;
export const STUN_DURATION = 500; // ms
export const KNOCKBACK = 24;

// Tile types
export const T = {
  W: 'W', // Water
  S: 'S', // Sand
  G: 'G', // Grass
  T: 'T', // Trees
  R: 'R', // Rock
  B: 'B', // Bridge
  P: 'P', // Path
};

export const WALKABLE = new Set([T.S, T.G, T.B, T.P]);

// Tile colors
export const TILE_COLORS = {
  [T.W]: '#2389da',
  [T.S]: '#f2d16b',
  [T.G]: '#5cb85c',
  [T.T]: '#2d7a2d',
  [T.R]: '#888888',
  [T.B]: '#c4956a',
  [T.P]: '#d4a76a',
};

// Water animation colors
export const WATER_COLORS = ['#2389da', '#1e7bc4', '#2994e8'];
