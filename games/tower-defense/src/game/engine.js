import { WAVES, WAVE_BONUS_BASE, WAVE_BONUS_PER_WAVE } from './constants.js';
import { WAYPOINTS } from './maps.js';
import { createEnemy, createProjectile } from './entities.js';

export function updateGame(gs, dt, updateUi) {
  if (gs.phase !== 'playing') return;

  updateSpawning(gs, dt);
  updateEnemies(gs, dt, updateUi);
  updateTowers(gs, dt);
  updateProjectiles(gs, dt, updateUi);
  updateEffects(gs, dt);
  checkWaveComplete(gs, updateUi);
}

// --- Spawning ---

function updateSpawning(gs, dt) {
  if (!gs.spawning) return;

  gs.spawnTimer -= dt;
  if (gs.spawnTimer > 0) return;

  const waveDef = WAVES[gs.waveIndex];
  const group = waveDef[gs.spawnGroupIndex];

  // Spawn one enemy
  const enemy = createEnemy(group.type, gs.waveIndex);
  gs.enemies.push(enemy);
  gs.spawnCount++;

  if (gs.spawnCount >= group.count) {
    // Move to next group
    gs.spawnGroupIndex++;
    gs.spawnCount = 0;
    if (gs.spawnGroupIndex >= waveDef.length) {
      gs.spawning = false;
      return;
    }
    gs.spawnTimer = waveDef[gs.spawnGroupIndex].interval;
  } else {
    gs.spawnTimer = group.interval;
  }
}

// --- Enemy movement ---

function updateEnemies(gs, dt, updateUi) {
  for (const e of gs.enemies) {
    if (!e.alive) continue;

    // Slow effect
    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      e.speed = e.baseSpeed * 0.4;
    } else {
      e.speed = e.baseSpeed;
    }

    // Healer ability
    if (e.healRadius > 0 && e.healRate > 0) {
      for (const other of gs.enemies) {
        if (!other.alive || other.id === e.id) continue;
        const dx = other.x - e.x;
        const dy = other.y - e.y;
        if (dx * dx + dy * dy < e.healRadius * e.healRadius) {
          other.hp = Math.min(other.maxHp, other.hp + e.healRate * dt);
        }
      }
    }

    // Move toward next waypoint
    const target = WAYPOINTS[e.waypointIndex];
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const move = e.speed * dt;

    if (dist > 0.001) e.heading = Math.atan2(dy, dx);

    if (dist <= move) {
      e.x = target.x;
      e.y = target.y;
      e.waypointIndex++;
      if (e.waypointIndex >= WAYPOINTS.length) {
        // Reached end — lose a life
        e.alive = false;
        gs.effects.push({ type: 'leak', x: e.x, y: e.y, life: 0.5, maxLife: 0.5 });
        gs.lives--;
        updateUi({ lives: gs.lives });
        if (gs.lives <= 0) {
          gs.phase = 'gameover';
          gs.won = false;
          updateUi({ phase: 'gameover', won: false });
        }
      }
    } else {
      e.x += (dx / dist) * move;
      e.y += (dy / dist) * move;
    }
  }

  // Remove dead
  gs.enemies = gs.enemies.filter(e => e.alive);
}

// --- Tower targeting & firing ---

function updateTowers(gs, dt) {
  for (const t of gs.towers) {
    t.cooldown -= dt;
    if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 6);

    // Find target — closest to exit (highest waypointIndex, then closest to next waypoint)
    let best = null;
    let bestProgress = -1;

    for (const e of gs.enemies) {
      if (!e.alive) continue;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > t.range * t.range) continue;

      // Progress = waypointIndex (higher = closer to exit)
      const progress = e.waypointIndex * 10000 - distToWaypoint(e);
      if (progress > bestProgress) {
        bestProgress = progress;
        best = e;
      }
    }

    t.target = best;
    if (best) {
      t.angle = Math.atan2(best.y - t.y, best.x - t.x);
    }

    if (best && t.cooldown <= 0) {
      t.cooldown = 1 / t.fireRate;
      t.recoil = 1;
      const proj = createProjectile(t, best);
      gs.projectiles.push(proj);
    }
  }
}

function distToWaypoint(e) {
  if (e.waypointIndex >= WAYPOINTS.length) return 0;
  const wp = WAYPOINTS[e.waypointIndex];
  const dx = wp.x - e.x;
  const dy = wp.y - e.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// --- Projectile movement & collision ---

function updateProjectiles(gs, dt, updateUi) {
  for (const p of gs.projectiles) {
    if (!p.alive) continue;

    // Find target
    const target = gs.enemies.find(e => e.id === p.targetId && e.alive);
    if (!target) {
      // Target died — find nearest enemy
      let nearest = null;
      let nearDist = Infinity;
      for (const e of gs.enemies) {
        if (!e.alive) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = dx * dx + dy * dy;
        if (d < nearDist) { nearDist = d; nearest = e; }
      }
      if (!nearest) { p.alive = false; continue; }
      p.targetId = nearest.id;
    }

    const t = gs.enemies.find(e => e.id === p.targetId);
    if (!t || !t.alive) { p.alive = false; continue; }

    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const move = p.speed * dt;

    if (dist <= move + t.radius) {
      // Hit!
      p.alive = false;
      applyDamage(gs, p, t, updateUi);
    } else {
      p.x += (dx / dist) * move;
      p.y += (dy / dist) * move;
    }
  }

  gs.projectiles = gs.projectiles.filter(p => p.alive);
}

function applyDamage(gs, proj, target, updateUi) {
  // Direct damage
  damageEnemy(gs, target, proj.damage, updateUi);

  // Hit effect
  gs.effects.push({ type: 'hit', x: target.x, y: target.y, life: 0.15, maxLife: 0.15 });

  // Slow
  if (proj.slow > 0) {
    target.slowTimer = Math.max(target.slowTimer, proj.slow);
  }

  // Splash damage
  if (proj.splash > 0) {
    gs.effects.push({
      type: 'explosion', x: target.x, y: target.y,
      radius: proj.splash, life: 0.3, maxLife: 0.3,
    });
    for (const e of gs.enemies) {
      if (!e.alive || e.id === target.id) continue;
      const dx = e.x - target.x;
      const dy = e.y - target.y;
      if (dx * dx + dy * dy < proj.splash * proj.splash) {
        damageEnemy(gs, e, proj.damage * 0.5, updateUi);
        if (proj.slow > 0) e.slowTimer = Math.max(e.slowTimer, proj.slow * 0.5);
      }
    }
  }

  // Chain lightning
  if (proj.chain > 0) {
    let chainSource = target;
    const hit = new Set([target.id]);
    for (let i = 0; i < proj.chain; i++) {
      let nearest = null;
      let nearDist = Infinity;
      for (const e of gs.enemies) {
        if (!e.alive || hit.has(e.id)) continue;
        const dx = e.x - chainSource.x;
        const dy = e.y - chainSource.y;
        const d = dx * dx + dy * dy;
        if (d < 100 * 100 && d < nearDist) { nearDist = d; nearest = e; }
      }
      if (!nearest) break;
      hit.add(nearest.id);
      damageEnemy(gs, nearest, proj.damage * 0.6, updateUi);
      gs.effects.push({
        type: 'chain',
        x1: chainSource.x, y1: chainSource.y,
        x2: nearest.x, y2: nearest.y,
        life: 0.2, maxLife: 0.2,
      });
      chainSource = nearest;
    }
  }
}

function damageEnemy(gs, enemy, amount, updateUi) {
  enemy.hp -= amount;
  if (enemy.hp <= 0) {
    enemy.alive = false;
    // The piece is gone from play immediately; these two effects carry its
    // last known pose so the renderer can topple it and float the reward.
    gs.effects.push({
      type: 'topple',
      x: enemy.x, y: enemy.y,
      enemyType: enemy.type,
      radius: enemy.radius,
      heading: enemy.heading,
      life: 0.45, maxLife: 0.45,
    });
    gs.effects.push({
      type: 'coin', x: enemy.x, y: enemy.y,
      amount: enemy.reward, life: 0.8, maxLife: 0.8,
    });
    gs.gold += enemy.reward;
    gs.stats.kills++;
    gs.stats.goldEarned += enemy.reward;
    updateUi({ gold: gs.gold });
  }
}

// --- Effects ---

function updateEffects(gs, dt) {
  for (const e of gs.effects) {
    e.life -= dt;
  }
  gs.effects = gs.effects.filter(e => e.life > 0);
}

// --- Wave completion ---

function checkWaveComplete(gs, updateUi) {
  // Before the first wave is sent the board is legitimately empty, which would
  // otherwise read as "wave cleared" on frame one and pay out a free bonus.
  if (!gs.waveStarted) return;
  if (gs.spawning) return;
  if (gs.enemies.length > 0) return;
  if (gs.waveComplete) return;

  gs.waveComplete = true;
  const bonus = WAVE_BONUS_BASE + gs.waveIndex * WAVE_BONUS_PER_WAVE;
  gs.gold += bonus;
  gs.stats.goldEarned += bonus;
  updateUi({ gold: gs.gold });

  if (gs.waveIndex >= WAVES.length - 1) {
    gs.phase = 'gameover';
    gs.won = true;
    updateUi({ phase: 'gameover', won: true });
  } else {
    updateUi({ waveComplete: true });
  }
}

// --- Start a wave ---

export function startWave(gs, updateUi) {
  if (gs.spawning || (gs.enemies.length > 0)) return;
  if (gs.waveIndex > 0 && !gs.waveComplete) return;

  if (gs.waveComplete && gs.waveIndex < WAVES.length - 1) {
    gs.waveIndex++;
  }

  gs.waveStarted = true;
  gs.spawning = true;
  gs.spawnTimer = 0;
  gs.spawnGroupIndex = 0;
  gs.spawnCount = 0;
  gs.waveComplete = false;
  updateUi({ waveIndex: gs.waveIndex, waveComplete: false });
}

// --- Initialize game state ---

export function createGameState(startGold, startLives) {
  return {
    phase: 'playing',
    towers: [],
    enemies: [],
    projectiles: [],
    effects: [],
    gold: startGold,
    lives: startLives,
    waveIndex: 0,
    waveStarted: false,
    spawning: false,
    spawnTimer: 0,
    spawnGroupIndex: 0,
    spawnCount: 0,
    waveComplete: false,
    won: false,
    stats: {
      kills: 0,
      goldEarned: 0,
      towersPlaced: 0,
    },
  };
}
