import * as THREE from 'three'

export interface ProjectileConfig {
  speed: number
  damage: number
  lifetime: number
  color: number
  size: number
}

export class Projectile extends THREE.Group {
  config: ProjectileConfig
  velocity: THREE.Vector3
  lifetime: number
  owner: 'player' | 'enemy'
  private light: THREE.PointLight
  private trail: THREE.Points

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

  private createVisual() {
    // Glowing core
    const coreGeometry = new THREE.SphereGeometry(this.config.size, 16, 16)
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: this.config.color,
      transparent: true,
      opacity: 0.9
    })
    const core = new THREE.Mesh(coreGeometry, coreMaterial)
    this.add(core)

    // Outer glow
    const glowGeometry = new THREE.SphereGeometry(this.config.size * 1.5, 16, 16)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: this.config.color,
      transparent: true,
      opacity: 0.4
    })
    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
    this.add(glow)

    // Point light for dynamic lighting
    this.light = new THREE.PointLight(this.config.color, 2, 15)
    this.add(this.light)

    // Simple trail using points
    this.createTrail()
  }

  private createTrail() {
    const trailLength = 10
    const positions = new Float32Array(trailLength * 3)
    const colors = new Float32Array(trailLength * 3)
    const sizes = new Float32Array(trailLength)

    const color = new THREE.Color(this.config.color)

    for (let i = 0; i < trailLength; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = -i * 0.3

      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b

      sizes[i] = this.config.size * (1 - i / trailLength)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.PointsMaterial({
      size: this.config.size,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true
    })

    this.trail = new THREE.Points(geometry, material)
    this.add(this.trail)
  }

  update(delta: number): boolean {
    // Move projectile
    this.position.add(this.velocity.clone().multiplyScalar(delta))

    // Orient trail along velocity
    if (this.velocity.length() > 0) {
      this.lookAt(this.position.clone().add(this.velocity))
    }

    // Decrease lifetime
    this.lifetime -= delta

    // Fade out near end of life
    if (this.lifetime < 0.5) {
      const opacity = this.lifetime / 0.5
      this.light.intensity = 2 * opacity
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
    color: 0x00ffff,
    size: 0.3
  },
  fireball: {
    speed: 60,
    damage: 35,
    lifetime: 4,
    color: 0xff4400,
    size: 0.5
  },
  shadowBolt: {
    speed: 100,
    damage: 20,
    lifetime: 2.5,
    color: 0x8844ff,
    size: 0.25
  }
}
