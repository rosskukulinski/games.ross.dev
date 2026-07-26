import * as THREE from 'three'
import { Projectile, ProjectileConfig, PROJECTILE_TYPES } from '../entities/projectiles/Projectile'
import { Mount } from '../entities/mounts/Mount'
import { Dragon } from '../entities/enemies/Dragon'

export interface HitEffect {
  position: THREE.Vector3
  color: number
  scale: number
}

export class CombatSystem {
  private scene: THREE.Scene
  private projectiles: Projectile[] = []
  private fireCooldown = 0
  private readonly FIRE_RATE = 0.15 // seconds between shots

  // Callbacks
  onEnemyHit?: (enemy: Dragon, damage: number) => void
  onPlayerHit?: (damage: number) => void
  onHitEffect?: (effect: HitEffect) => void

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  playerFire(mount: Mount, isFiring: boolean): boolean {
    if (!isFiring || this.fireCooldown > 0) return false

    // Get fire position (front of mount)
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(mount.quaternion)
    const spawnPosition = mount.position.clone().add(forward.multiplyScalar(2))
    spawnPosition.y += 0.5 // Slightly above center

    // Get aim direction (same as mount facing)
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(mount.quaternion)

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

  private checkCollision(projectile: Projectile, target: THREE.Object3D): boolean {
    const distance = projectile.position.distanceTo(target.position)
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
