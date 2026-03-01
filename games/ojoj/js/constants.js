// Game States
const GameState = {
    MENU: 'menu',
    CAR_SELECT: 'car_select',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameover',
    RACE_END: 'race_end'
};

// Car Types
const CAR_TYPES = {
    SPEED: {
        id: 'speed',
        name: 'Speed Demon',
        color: '#E53935',
        description: 'Goes super fast!',
        maxSpeedMultiplier: 1.5,
        accelerationMultiplier: 1.3,
        ability: 'speed'
    },
    SHIELD: {
        id: 'shield',
        name: 'Shield Car',
        color: '#1E88E5',
        description: 'Auto-saves from hits!',
        maxSpeedMultiplier: 1.0,
        accelerationMultiplier: 1.0,
        ability: 'autoShield',
        shieldCooldown: 3000 // ms between auto-shields
    },
    CHOMPER: {
        id: 'chomper',
        name: 'Chomper',
        color: '#43A047',
        description: 'Eat other cars!',
        maxSpeedMultiplier: 1.0,
        accelerationMultiplier: 1.0,
        ability: 'eatCars'
    }
};

// AI Settings
const AI_COUNT = 4;
const AI_COLORS = ['#FF9800', '#9C27B0', '#00BCD4', '#795548'];
const AI_SPEED_VARIANCE = 0.15; // +/- 15% speed variation

// Canvas dimensions
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;

// Track settings
const TRACK_LENGTH = 6000; // Longer track for ~60 second gameplay
const LANE_COUNT = 3;
const LANE_HEIGHT = CANVAS_HEIGHT / 4;

// Player settings
const PLAYER_WIDTH = 80;
const PLAYER_HEIGHT = 40;
const PLAYER_START_X = 100;
const PLAYER_START_LIVES = 100;
const PLAYER_BASE_SPEED = 5;
const PLAYER_MAX_SPEED = 12;
const PLAYER_ACCELERATION = 0.4;
const PLAYER_FRICTION = 0.06;
const PLAYER_LANE_SWITCH_SPEED = 10;
const PLAYER_KNOCKBACK = 120;
const PLAYER_INVULNERABLE_TIME = 1500; // ms

// Speed boost settings
const BOOST_MULTIPLIER = 1.5;
const BOOST_DURATION = 2000; // ms

// Obstacle settings
const FIREBALL_RADIUS = 25;
const FIREBALL_VERTICAL_SPEED = 2;
const LAVABALL_RADIUS = 30;
const LAVABALL_HORIZONTAL_SPEED = 1.5;
const FAN_WIDTH = 60;
const FAN_HEIGHT = 80;
const FAN_WIND_STRENGTH = 4;
const FAN_WIND_RANGE = 180;

// Ramp settings
const RAMP_WIDTH = 100;
const RAMP_HEIGHT = 40;
const JUMP_VELOCITY = -12;

// Colors
const COLORS = {
    grass: '#90EE90',
    road: '#555',
    roadLine: '#FFF',
    car: '#4A90D9',
    carWindow: '#87CEEB',
    driver: '#FFD93D',
    wheel: '#333',
    fireball: '#FF6B35',
    fireballInner: '#FFD700',
    lavaball: '#FF4500',
    lavaBubble: '#FFD700',
    lavaDark: '#8B0000',
    fan: '#888',
    fanBlade: '#4A90D9',
    ramp: '#8B4513',
    rampStripe: '#FFD700'
};
