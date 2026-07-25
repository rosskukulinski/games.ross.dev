import * as THREE from 'three'
import { getSparkTexture } from '../../fx/textures'

export interface ProjectileConfig {
  speed: number
  damage: number
  lifetime: number
  color: number
  size: number
}

/**
 * Glowing magic bolt: HDR emissive core (blooms), soft additive sprite
 * halo, a stretched comet tail and a live trail of fading spark points
 * left behind in world space.
 */
export class Projectile extends THREE.Group {
  config: ProjectileConfig
  velocity: THREE.Vector3
  lifetime: number
  owner: 'player' | 'enemy'
  private light: THREE.PointLight
  private core: THREE.Mesh
  private halo: THREE.Sprite
  private trail: THREE.Points
  private trailPositions: Float32Array
  private trailOpacity: Float32Array
  private trailHead = 0
  private static glowTexture: THREE.Texture | null = null

  constructor(
    config: ProjectileConfig,
    position: THREE.Vector3,
    direction: THREE.Vector3,
    owner: 'player' | 'enemy'
  ) {
    super()
    this.config = config
    this.position.copy(position)
    this.velocity = direction.normalize().multiplyScalar(config.speed)
    this.lifetime = config.lifetime
    this.owner = owner

    this.createVisual()
  }

  private static getGlowTexture(): THREE.Texture {
    if (!Projectile.glowTexture) {
      const size = 64
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, size, size)
      Projectile.glowTexture = new THREE.CanvasTexture(canvas)
    }
    return Projectile.glowTexture
  }

  private createVisual() {
    const hdr = new THREE.Color(this.config.color).multiplyScalar(3.4)

    // Glowing core, stretched along travel direction into a comet shape.
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(this.config.size, 14, 12),
      new THREE.MeshBasicMaterial({ color: hdr })
    )
    this.core.scale.z = 2.4
    this.add(this.core)

    // Soft additive halo sprite.
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: Projectile.getGlowTexture(),
        color: this.config.color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    this.halo.scale.setScalar(this.config.size * 7)
    this.add(this.halo)

    // Comet tail cone behind the core.
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(this.config.size * 0.9, this.config.size * 6, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: this.config.color,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    tail.rotation.x = Math.PI / 2
    tail.position.z = -this.config.size * 3
    this.add(tail)

    // Point light so the bolt lights the world as it flies.
    this.light = new THREE.PointLight(this.config.color, 6, 22)
    this.add(this.light)

    this.createTrail()
  }

  /** World-space spark trail (a Points cloud parented to the scene root). */
  private createTrail() {
    const trailLength = 18
    this.trailPositions = new Float32Array(trailLength * 3)
    this.trailOpacity = new Float32Array(trailLength)
    const colors = new Float32Array(trailLength * 3)
    const color = new THREE.Color(this.config.color)
    for (let i = 0; i < trailLength; i++) {
      this.trailPositions[i * 3] = this.position.x
      this.trailPositions[i * 3 + 1] = this.position.y
      this.trailPositions[i * 3 + 2] = this.position.z
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    this.trail = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: this.config.size * 2.6,
        map: getSparkTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
    )
    // Trail lives in world space: keep it un-parented to this group's transform.
    this.trail.frustumCulled = false
  }

  /** The scene-space trail object; Game adds/removes it alongside the bolt. */
  getTrailObject(): THREE.Points {
    return this.trail
  }

  update(delta: number): boolean {
    // Move projectile
    this.position.add(this.velocity.clone().multiplyScalar(delta))

    // Orient along velocity so the comet tail points backwards.
    if (this.velocity.lengthSq() > 0) {
      this.lookAt(this.position.clone().add(this.velocity))
    }

    // Drop a spark at the head each frame (ring buffer).
    this.trailPositions[this.trailHead * 3] = this.position.x
    this.trailPositions[this.trailHead * 3 + 1] = this.position.y
    this.trailPositions[this.trailHead * 3 + 2] = this.position.z
    this.trailOpacity[this.trailHead] = 1
    this.trailHead = (this.trailHead + 1) % this.trailOpacity.length
    this.trail.geometry.attributes.position.needsUpdate = true

    // Pulse the core a little for life.
    const pulse = 1 + Math.sin(this.lifetime * 40) * 0.12
    this.core.scale.set(pulse, pulse, 2.4 * pulse)

    // Decrease lifetime
    this.lifetime -= delta

    // Fade out near end of life
    if (this.lifetime < 0.5) {
      const opacity = Math.max(this.lifetime / 0.5, 0)
      this.light.intensity = 6 * opacity
      ;(this.halo.material as THREE.SpriteMaterial).opacity = 0.9 * opacity
      ;(this.trail.material as THREE.PointsMaterial).opacity = 0.6 * opacity
    }

    return this.lifetime > 0
  }

  getCollisionRadius(): number {
    return this.config.size * 2
  }
}

// Preset projectile configurations
export const PROJECTILE_TYPES = {
  magicBolt: {
    speed: 80,
    damage: 25,
    lifetime: 3,
    color: 0x66f5ff,
    size: 0.3
  },
  fireball: {
    speed: 60,
    damage: 35,
    lifetime: 4,
    color: 0xff5a1e,
    size: 0.5
  },
  shadowBolt: {
    speed: 100,
    damage: 20,
    lifetime: 2.5,
    color: 0xb464ff,
    size: 0.25
  }
}
