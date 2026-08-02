// Grid
export const CANVAS_W = 800;
export const CANVAS_H = 600;
export const CELL = 40;
export const COLS = CANVAS_W / CELL; // 20
export const ROWS = CANVAS_H / CELL; // 15

// Colors
export const COLOR_GRASS_A = '#4a7c3f';
export const COLOR_GRASS_B = '#3d6b34';
export const COLOR_PATH = '#8b6f47';
export const COLOR_PATH_BORDER = '#6b5535';
export const COLOR_GRID_LINE = 'rgba(255,255,255,0.06)';

// Tower definitions
export const TOWERS = {
  archer: {
    name: 'Archer',
    cost: 100,
    color: '#3ddc97',
    range: 120,
    damage: 15,
    fireRate: 1.0,       // shots per second
    projectileSpeed: 300,
    projectileColor: '#86efac',
    splash: 0,
    slow: 0,
    chain: 0,
    upgrades: {
      damage:   [{ cost: 50, val: 22 }, { cost: 120, val: 30 }, { cost: 250, val: 42 }],
      range:    [{ cost: 60, val: 150 }, { cost: 140, val: 180 }, { cost: 300, val: 220 }],
      fireRate: [{ cost: 70, val: 1.4 }, { cost: 160, val: 1.9 }, { cost: 350, val: 2.5 }],
    },
  },
  cannon: {
    name: 'Cannon',
    cost: 200,
    color: '#ff6b5d',
    range: 100,
    damage: 40,
    fireRate: 0.5,
    projectileSpeed: 200,
    projectileColor: '#fca5a5',
    splash: 40,
    slow: 0,
    chain: 0,
    upgrades: {
      damage: [{ cost: 80, val: 60 }, { cost: 180, val: 85 }, { cost: 400, val: 120 }],
      range:  [{ cost: 70, val: 130 }, { cost: 160, val: 160 }, { cost: 350, val: 200 }],
      splash: [{ cost: 90, val: 55 }, { cost: 200, val: 70 }, { cost: 450, val: 90 }],
    },
  },
  ice: {
    name: 'Ice',
    cost: 150,
    color: '#5bc8ff',
    range: 110,
    damage: 8,
    fireRate: 0.8,
    projectileSpeed: 250,
    projectileColor: '#bae6fd',
    splash: 0,
    slow: 2.0,           // seconds of slow
    chain: 0,
    upgrades: {
      damage: [{ cost: 50, val: 14 }, { cost: 120, val: 22 }, { cost: 260, val: 32 }],
      range:  [{ cost: 60, val: 140 }, { cost: 140, val: 170 }, { cost: 300, val: 210 }],
      slow:   [{ cost: 80, val: 2.8 }, { cost: 180, val: 3.6 }, { cost: 380, val: 5.0 }],
    },
  },
  lightning: {
    name: 'Lightning',
    cost: 250,
    color: '#ffd23f',
    range: 130,
    damage: 20,
    fireRate: 0.6,
    projectileSpeed: 500,
    projectileColor: '#fef08a',
    splash: 0,
    slow: 0,
    chain: 2,             // chains to N additional enemies
    upgrades: {
      damage: [{ cost: 80, val: 32 }, { cost: 180, val: 48 }, { cost: 400, val: 70 }],
      range:  [{ cost: 70, val: 160 }, { cost: 160, val: 190 }, { cost: 350, val: 230 }],
      chain:  [{ cost: 100, val: 3 }, { cost: 220, val: 4 }, { cost: 450, val: 6 }],
    },
  },
  sniper: {
    name: 'Sniper',
    cost: 300,
    color: '#c084fc',
    range: 220,
    damage: 80,
    fireRate: 0.3,
    projectileSpeed: 600,
    projectileColor: '#d8b4fe',
    splash: 0,
    slow: 0,
    chain: 0,
    upgrades: {
      damage:   [{ cost: 100, val: 120 }, { cost: 220, val: 170 }, { cost: 450, val: 240 }],
      range:    [{ cost: 80, val: 260 }, { cost: 180, val: 300 }, { cost: 380, val: 360 }],
      fireRate: [{ cost: 90, val: 0.42 }, { cost: 200, val: 0.56 }, { cost: 420, val: 0.75 }],
    },
  },
};

// Enemy definitions
export const ENEMIES = {
  grunt: {
    name: 'Grunt',
    shape: 'pawn',
    hp: 80,
    speed: 60,       // pixels per second
    reward: 10,
    color: '#dc2626',
    radius: 11,
  },
  runner: {
    name: 'Runner',
    shape: 'arrow',
    hp: 50,
    speed: 110,
    reward: 15,
    color: '#f97316',
    radius: 9,
  },
  tank: {
    name: 'Tank',
    shape: 'hex',
    hp: 300,
    speed: 40,
    reward: 25,
    color: '#7c3aed',
    radius: 15,
  },
  healer: {
    name: 'Healer',
    shape: 'cross',
    hp: 100,
    speed: 55,
    reward: 20,
    color: '#10b981',
    radius: 11,
    healRadius: 60,
    healRate: 8,       // hp per second to nearby enemies
  },
  boss: {
    name: 'Boss',
    shape: 'crown',
    hp: 1000,
    speed: 30,
    reward: 100,
    color: '#be123c',
    radius: 20,
  },
};

// Wave definitions — 20 waves
// Each wave: array of { type, count, interval (seconds between spawns) }
export const WAVES = [
  // 1-5: easy
  [{ type: 'grunt', count: 8, interval: 1.0 }],
  [{ type: 'grunt', count: 10, interval: 0.9 }],
  [{ type: 'grunt', count: 8, interval: 0.8 }, { type: 'runner', count: 4, interval: 0.6 }],
  [{ type: 'runner', count: 10, interval: 0.5 }],
  [{ type: 'grunt', count: 10, interval: 0.7 }, { type: 'tank', count: 2, interval: 2.0 }],
  // 6-10: medium
  [{ type: 'grunt', count: 12, interval: 0.6 }, { type: 'healer', count: 2, interval: 1.5 }],
  [{ type: 'runner', count: 15, interval: 0.4 }],
  [{ type: 'tank', count: 5, interval: 1.5 }, { type: 'healer', count: 3, interval: 1.2 }],
  [{ type: 'grunt', count: 15, interval: 0.5 }, { type: 'runner', count: 8, interval: 0.4 }],
  [{ type: 'tank', count: 4, interval: 1.2 }, { type: 'grunt', count: 10, interval: 0.6 }, { type: 'boss', count: 1, interval: 0 }],
  // 11-15: hard
  [{ type: 'runner', count: 20, interval: 0.3 }, { type: 'healer', count: 4, interval: 1.0 }],
  [{ type: 'tank', count: 8, interval: 1.0 }, { type: 'grunt', count: 15, interval: 0.5 }],
  [{ type: 'grunt', count: 20, interval: 0.4 }, { type: 'runner', count: 10, interval: 0.3 }, { type: 'healer', count: 3, interval: 1.0 }],
  [{ type: 'tank', count: 6, interval: 1.0 }, { type: 'boss', count: 2, interval: 3.0 }],
  [{ type: 'runner', count: 25, interval: 0.25 }, { type: 'tank', count: 5, interval: 1.2 }],
  // 16-20: brutal
  [{ type: 'grunt', count: 25, interval: 0.3 }, { type: 'healer', count: 6, interval: 0.8 }, { type: 'tank', count: 6, interval: 1.0 }],
  [{ type: 'runner', count: 30, interval: 0.2 }, { type: 'boss', count: 2, interval: 2.5 }],
  [{ type: 'tank', count: 10, interval: 0.8 }, { type: 'healer', count: 5, interval: 0.7 }, { type: 'runner', count: 15, interval: 0.3 }],
  [{ type: 'grunt', count: 30, interval: 0.25 }, { type: 'tank', count: 8, interval: 0.9 }, { type: 'boss', count: 3, interval: 2.0 }],
  [{ type: 'boss', count: 5, interval: 2.0 }, { type: 'tank', count: 12, interval: 0.7 }, { type: 'runner', count: 20, interval: 0.2 }, { type: 'healer', count: 8, interval: 0.6 }],
];

// Wave completion bonus: base + wave * increment
export const WAVE_BONUS_BASE = 25;
export const WAVE_BONUS_PER_WAVE = 5;

// Starting resources
export const START_GOLD = 200;
export const START_LIVES = 20;

// Tower sell refund ratio
export const SELL_REFUND = 0.6;

// Enemy scaling per wave (multiplied by hp)
export const HP_SCALE_PER_WAVE = 0.08; // +8% per wave
