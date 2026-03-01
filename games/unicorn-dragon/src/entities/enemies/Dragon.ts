import * as THREE from 'three'

export interface DragonConfig {
  name: string
  maxHealth: number
  damage: number
  speed: number
  color: number
  scale: number
}

export class Dragon extends THREE.Group {
  config: DragonConfig
  health: number
  isDead = false

  private body: THREE.Mesh
  private wingLeft: THREE.Mesh
  private wingRight: THREE.Mesh
  private wingPhase = Math.random() * Math.PI * 2

  constructor(config: DragonConfig) {
    super()
    this.config = config
    this.health = config.maxHealth
    this.createPlaceholderModel()
    this.scale.setScalar(config.scale)
  }

  private createPlaceholderModel() {
    const material = new THREE.MeshStandardMaterial({
      color: this.config.color,
      metalness: 0.3,
      roughness: 0.7
    })

    // Body (elongated)
    this.body = new THREE.Mesh(
      new THREE.CapsuleGeometry(1, 3, 8, 16),
      material
    )
    this.body.rotation.x = Math.PI / 2
    this.body.castShadow = true
    this.add(this.body)

    // Head
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 1.5, 6),
      material
    )
    head.position.set(0, 0.3, 2.5)
    head.rotation.x = Math.PI / 2
    head.castShadow = true
    this.add(head)

    // Snout
    const snout = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.8, 6),
      material
    )
    snout.position.set(0, 0, 3.3)
    snout.rotation.x = Math.PI / 2
    this.add(snout)

    // Eyes (glowing)
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 })
    const eyeGeom = new THREE.SphereGeometry(0.15, 8, 8)

    const eyeLeft = new THREE.Mesh(eyeGeom, eyeMaterial)
    eyeLeft.position.set(-0.4, 0.5, 2.3)
    this.add(eyeLeft)

    const eyeRight = new THREE.Mesh(eyeGeom, eyeMaterial)
    eyeRight.position.set(0.4, 0.5, 2.3)
    this.add(eyeRight)

    // Horns
    const hornMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.5
    })
    const hornGeom = new THREE.ConeGeometry(0.15, 0.6, 6)

    const hornLeft = new THREE.Mesh(hornGeom, hornMaterial)
    hornLeft.position.set(-0.5, 0.8, 2)
    hornLeft.rotation.x = -Math.PI / 4
    hornLeft.rotation.z = -Math.PI / 6
    this.add(hornLeft)

    const hornRight = new THREE.Mesh(hornGeom, hornMaterial)
    hornRight.position.set(0.5, 0.8, 2)
    hornRight.rotation.x = -Math.PI / 4
    hornRight.rotation.z = Math.PI / 6
    this.add(hornRight)

    // Wings
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: this.config.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    })

    const wingShape = new THREE.Shape()
    wingShape.moveTo(0, 0)
    wingShape.lineTo(3, 0.5)
    wingShape.lineTo(3.5, -0.5)
    wingShape.lineTo(2, -0.3)
    wingShape.lineTo(0, 0)

    const wingGeom = new THREE.ShapeGeometry(wingShape)

    this.wingLeft = new THREE.Mesh(wingGeom, wingMaterial)
    this.wingLeft.position.set(-0.8, 0.5, 0)
    this.wingLeft.rotation.y = Math.PI / 2 + 0.3
    this.add(this.wingLeft)

    this.wingRight = new THREE.Mesh(wingGeom, wingMaterial)
    this.wingRight.position.set(0.8, 0.5, 0)
    this.wingRight.rotation.y = -Math.PI / 2 - 0.3
    this.wingRight.scale.x = -1
    this.add(this.wingRight)

    // Tail
    const tailSegments = 5
    let tailMaterial = material.clone()
    for (let i = 0; i < tailSegments; i++) {
      const size = 0.4 - i * 0.06
      const tail = new THREE.Mesh(
        new THREE.SphereGeometry(size, 8, 8),
        tailMaterial
      )
      tail.position.set(0, 0, -1.5 - i * 0.5)
      tail.scale.set(1, 0.8, 1.2)
      this.add(tail)
    }

    // Tail spike
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.5, 4),
      hornMaterial
    )
    spike.position.set(0, 0, -4)
    spike.rotation.x = -Math.PI / 2
    this.add(spike)

    // Legs
    const legGeom = new THREE.CylinderGeometry(0.15, 0.1, 0.8, 6)
    const legPositions = [
      [-0.6, -0.8, 0.8],
      [0.6, -0.8, 0.8],
      [-0.6, -0.8, -0.5],
      [0.6, -0.8, -0.5]
    ]

    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeom, material)
      leg.position.set(pos[0], pos[1], pos[2])
      this.add(leg)
    })
  }

  update(delta: number) {
    if (this.isDead) return

    // Animate wings
    this.wingPhase += delta * 4
    const wingFlap = Math.sin(this.wingPhase) * 0.4
    this.wingLeft.rotation.z = wingFlap
    this.wingRight.rotation.z = -wingFlap

    // Gentle bob
    this.position.y += Math.sin(this.wingPhase * 0.5) * 0.02
  }

  takeDamage(amount: number): boolean {
    this.health -= amount

    // Flash red on hit
    this.flashDamage()

    if (this.health <= 0) {
      this.die()
      return true
    }
    return false
  }

  private flashDamage() {
    const originalColor = this.config.color
    this.body.material = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      metalness: 0.3,
      roughness: 0.7
    })

    setTimeout(() => {
      if (!this.isDead) {
        this.body.material = new THREE.MeshStandardMaterial({
          color: originalColor,
          metalness: 0.3,
          roughness: 0.7
        })
      }
    }, 100)
  }

  private die() {
    this.isDead = true
    // Could add death animation here
  }

  getFirePosition(): THREE.Vector3 {
    // Fire from mouth
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion)
    return this.position.clone().add(forward.multiplyScalar(3.5))
  }

  getCollisionRadius(): number {
    return 2 * this.config.scale
  }
}

// Dragon presets
export const DRAGON_TYPES: Record<string, DragonConfig> = {
  'fire-drake': {
    name: 'Fire Drake',
    maxHealth: 100,
    damage: 15,
    speed: 40,
    color: 0x8b0000,
    scale: 1.0
  },
  'frost-wyrm': {
    name: 'Frost Wyrm',
    maxHealth: 150,
    damage: 20,
    speed: 30,
    color: 0x4488aa,
    scale: 1.2
  },
  'shadow-dragon': {
    name: 'Shadow Dragon',
    maxHealth: 80,
    damage: 25,
    speed: 50,
    color: 0x332244,
    scale: 0.9
  }
}
