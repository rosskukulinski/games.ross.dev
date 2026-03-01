// Game-wide constants

export const COLORS = {
  PRIMARY: 0x4ade80,
  SECONDARY: 0x3498db,
  ACCENT: 0xffd700,
  BACKGROUND: 0x87CEEB,
  TEXT_LIGHT: '#ffffff',
  TEXT_DARK: '#333333',
  PANEL_BG: 0xffffff,
  SHADOW: 0x000000
};

export const FONTS = {
  TITLE: {
    fontSize: '28px',
    fontFamily: 'Arial, sans-serif',
    color: '#ffffff',
    fontStyle: 'bold'
  },
  HEADING: {
    fontSize: '20px',
    fontFamily: 'Arial, sans-serif',
    color: '#ffffff'
  },
  BODY: {
    fontSize: '16px',
    fontFamily: 'Arial, sans-serif',
    color: '#ffffff'
  },
  BUTTON: {
    fontSize: '24px',
    fontFamily: 'Arial, sans-serif',
    color: '#ffffff',
    fontStyle: 'bold'
  }
};

export const ANIMATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500
};

export const STORAGE_KEYS = {
  AVATAR: 'hanyverse_avatar',
  SETTINGS: 'hanyverse_settings',
  GAME_STATE: 'hanyverse_state',
  PLAYER_STATE: 'hanyverse_player',
  HOUSE_FURNITURE: 'hanyverse_house_furniture'
};

// Town grid configuration
export const TOWN_GRID = {
  COLS: 3,
  ROWS: 3,
  CELL_WIDTH: 120,
  CELL_HEIGHT: 120,
  ROAD_WIDTH: 40
};

// Player starting values
export const PLAYER_DEFAULTS = {
  STARTING_COINS: 100
};
