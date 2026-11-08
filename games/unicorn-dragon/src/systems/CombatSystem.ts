import * as THREE from 'three'
import { Projectile, ProjectileConfig, PROJECTILE_TYPES } from '../entities/projectiles/Projectile'
import { Mount } from '../entities/mounts/Mount'
import { Dragon } from '../entities/enemies/Dragon'

/** Half-angle (radians) of the auto-aim cone in front of the mount. */
const AUTO_AIM_CONE = 0.9
/** Bolts travel 80 u/s for 3s; only lock on to dragons well inside that. */
const AUTO_AIM_RANGE = 170

export interface HitEffect {
  position: THREE.Vector3
  color: number
  scale: number
}

export class CombatSystem {
  private scene: THREE.Scene
  private projectiles: Projectile[] = []
  private fireCooldown = 0
  private prevPos = new THREE.Vector3()
  private segment = new THREE.Line3()
  private closest = new THREE.Vector3()
  private readonly FIRE_RATE = 0.15 // seconds between shots

  // Callbacks
  onEnemyHit?: (enemy: Dragon, damage: number) => void
  onPlayerHit?: (damage: number) => void
  onHitEffect?: (effect: HitEffect) => void

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  playerFire(mount: Mount, isFiring: boolean, targets: Dragon[] = []): boolean {
    if (!isFiring || this.fireCooldown > 0) return false

    // Get fire position (front of mount)
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(mount.quaternion)
    const spawnPosition = mount.position.clone().add(forward.multiplyScalar(2))
    spawnPosition.y += 0.5 // Slightly above center

    // Aim along the mount's facing, or at a dragon roughly ahead (auto-aim).
    const target = this.findAutoAimTarget(mount, targets)
    const direction = target
      ? target.position.clone().sub(spawnPosition)
      : new THREE.Vector3(0, 0, 1).applyQuaternion(mount.quaternion)

    const projectile = new Projectile(
      PROJECTILE_TYPES.magicBolt,
      spawnPosition,
      direction,
      'player'
    )

    this.spawn(projectile)
    this.fireCooldown = this.FIRE_RATE

    return true
  }

  /**
   * Auto-aim for young players: the closest living dragon within a generous
   * horizontal cone ahead of the mount (height is ignored, so a dragon above
   * or below still counts). Returns null when nothing is ahead.
   */
  findAutoAimTarget(mount: Mount, targets: Dragon[]): Dragon | null {
    const yaw = mount.rotation.y
    let best: Dragon | null = null
    let bestDist = Infinity
    for (const d of targets) {
      if (d.isDead) continue
      const dx = d.position.x - mount.position.x
      const dz = d.position.z - mount.position.z
      const dist = Math.hypot(dx, dz, d.position.y - mount.position.y)
      if (dist > AUTO_AIM_RANGE) continue
      let err = Math.atan2(dx, dz) - yaw
      while (err > Math.PI) err -= Math.PI * 2
      while (err < -Math.PI) err += Math.PI * 2
      if (Math.abs(err) > AUTO_AIM_CONE) continue
      if (dist < bestDist) {
        bestDist = dist
        best = d
      }
    }
    return best
  }

  /** Add a projectile plus its world-space trail to the scene. */
  private spawn(projectile: Projectile) {
    this.projectiles.push(projectile)
    this.scene.add(projectile)
    this.scene.add(projectile.getTrailObject())
  }

  /** Remove a projectile and its trail. */
  private despawn(projectile: Projectile) {
    this.scene.remove(projectile)
    this.scene.remove(projectile.getTrailObject())
  }

  enemyFire(position: THREE.Vector3, direction: THREE.Vector3, config?: ProjectileConfig) {
    const projectile = new Projectile(
      config || PROJECTILE_TYPES.fireball,
      position,
      direction,
      'enemy'
    )

    this.spawn(projectile)
  }

  update(delta: number, enemies: Dragon[], playerMount: Mount) {
    // Update cooldown
    this.fireCooldown = Math.max(0, this.fireCooldown - delta)

    // Update and check collisions for all projectiles
    this.projectiles = this.projectiles.filter(projectile => {
      this.prevPos.copy(projectile.position)
      const alive = projectile.update(delta)

      if (!alive) {
        this.despawn(projectile)
        return false
      }

      // Check collisions based on owner
      if (projectile.owner === 'player') {
        // Check against enemies
        for (const enemy of enemies) {
          if (enemy.isDead) continue
          if (this.checkCollision(projectile, enemy)) {
            this.handleHit(projectile, enemy)
            return false
          }
        }
      } else {
        // Enemy projectile - check against player
        if (this.checkCollision(projectile, playerMount)) {
          this.handlePlayerHit(projectile)
          return false
        }
      }

      return true
    })
  }

  /**
   * Swept test: distance from the target to the segment the projectile
   * covered this frame, so fast bolts can't tunnel through on slow frames.
   */
  private checkCollision(projectile: Projectile, target: THREE.Object3D): boolean {
    this.segment.set(this.prevPos, projectile.position)
    this.segment.closestPointToPoint(target.position, true, this.closest)
    const distance = this.closest.distanceTo(target.position)
    const targetRadius =
      target instanceof Dragon ? target.getCollisionRadius() : 2
    const collisionRadius = projectile.getCollisionRadius() + targetRadius
    return distance < collisionRadius
  }

  private handleHit(projectile: Projectile, enemy: Dragon) {
    // Remove projectile
    this.despawn(projectile)

    // Spawn hit effect
    if (this.onHitEffect) {
      this.onHitEffect({
        position: projectile.position.clone(),
        color: projectile.config.color,
        scale: 1
      })
    }

    // Apply damage
    if (this.onEnemyHit) {
      this.onEnemyHit(enemy, projectile.config.damage)
    }
  }

  private handlePlayerHit(projectile: Projectile) {
    // Remove projectile
    this.despawn(projectile)

    // Spawn hit effect
    if (this.onHitEffect) {
      this.onHitEffect({
        position: projectile.position.clone(),
        color: 0xff0000,
        scale: 1.5
      })
    }

    // Apply damage to player
    if (this.onPlayerHit) {
      this.onPlayerHit(projectile.config.damage)
    }
  }

  getProjectileCount(): number {
    return this.projectiles.length
  }

  clearAllProjectiles() {
    this.projectiles.forEach(p => this.despawn(p))
    this.projectiles = []
  }
}
