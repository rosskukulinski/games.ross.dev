import { TOWERS, ENEMIES, CELL, HP_SCALE_PER_WAVE } from './constants.js';
import { WAYPOINTS } from './maps.js';

let nextId = 1;

export function createTower(type, col, row) {
  const spec = TOWERS[type];
  return {
    id: nextId++,
    type,
    col,
    row,
    x: col * CELL + CELL / 2,
    y: row * CELL + CELL / 2,
    // Current stats (upgraded over time)
    damage: spec.damage,
    range: spec.range,
    fireRate: spec.fireRate,
    splash: spec.splash,
    slow: spec.slow,
    chain: spec.chain,
    // Upgrade levels: { damage: 0, range: 0, ... }
    upgradeLevels: Object.fromEntries(
      Object.keys(spec.upgrades).map(k => [k, 0])
    ),
    // Total gold invested (cost + upgrades, for sell calculation)
    totalInvested: spec.cost,
    // Firing state
    cooldown: 0,
    target: null,
    angle: 0,
    recoil: 0, // 1 → 0 after each shot, drives kick and muzzle flash
  };
}

export function createEnemy(type, waveIndex) {
  const spec = ENEMIES[type];
  const start = WAYPOINTS[0];
  const hpScale = 1 + waveIndex * HP_SCALE_PER_WAVE;
  return {
    id: nextId++,
    type,
    x: start.x,
    y: start.y,
    hp: Math.round(spec.hp * hpScale),
    maxHp: Math.round(spec.hp * hpScale),
    speed: spec.speed,
    baseSpeed: spec.speed,
    reward: spec.reward,
    color: spec.color,
    radius: spec.radius,
    // Path tracking
    waypointIndex: 1, // heading toward waypoint[1]
    // Facing, so the piece turns as it walks the board
    heading: 0,
    // Status effects
    slowTimer: 0,
    // Healer special
    healRadius: spec.healRadius || 0,
    healRate: spec.healRate || 0,
    // alive flag
    alive: true,
  };
}

export function createProjectile(tower, target) {
  const spec = TOWERS[tower.type];
  return {
    id: nextId++,
    x: tower.x,
    y: tower.y,
    targetId: target.id,
    speed: spec.projectileSpeed,
    damage: tower.damage,
    splash: tower.splash,
    slow: tower.slow,
    chain: tower.chain,
    color: spec.projectileColor,
    alive: true,
  };
}

export function resetIds() {
  nextId = 1;
}
