import * as THREE from 'three'
import { Mount, MountConfig } from './Mount'
import { InputState } from '../../core/InputManager'

export class Pony extends Mount {
  private floatHeight = 15
  private bobPhase = 0
  private bobAmplitude = 0.5
  private bobSpeed = 2
  private sparkles: THREE.Points

  constructor(config: MountConfig) {
    super(config)
    this.createPlaceholderModel()
  }

  private createPlaceholderModel() {
    const material = new THREE.MeshStandardMaterial({
      color: this.config.color,
      metalness: 0.2,
      roughness: 0.8
    })

    // Body (rounder, cuter)
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 16, 16),
      material
    )
    body.scale.set(1, 0.8, 1.3)
    body.castShadow = true
    this.add(body)

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 16),
      material
    )
    head.position.set(0, 0.4, 1)
    head.castShadow = true
    this.add(head)

    // Snout
    const snout = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      material
    )
    snout.position.set(0, 0.2, 1.4)
    snout.scale.set(1, 0.8, 1.2)
    this.add(snout)

    // Big cute eyes
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.9,
      roughness: 0.1
    })
    const eyeGeom = new THREE.SphereGeometry(0.12, 8, 8)

    const eyeLeft = new THREE.Mesh(eyeGeom, eyeMaterial)
    eyeLeft.position.set(-0.2, 0.55, 1.3)
    this.add(eyeLeft)

    const eyeRight = new THREE.Mesh(eyeGeom, eyeMaterial)
    eyeRight.position.set(0.2, 0.55, 1.3)
    this.add(eyeRight)

    // Ears (floppy)
    const earMaterial = material.clone()
    const earGeom = new THREE.SphereGeometry(0.15, 8, 8)

    const earLeft = new THREE.Mesh(earGeom, earMaterial)
    earLeft.position.set(-0.35, 0.7, 0.85)
    earLeft.scale.set(0.6, 1.2, 0.8)
    this.add(earLeft)

    const earRight = new THREE.Mesh(earGeom, earMaterial)
    earRight.position.set(0.35, 0.7, 0.85)
    earRight.scale.set(0.6, 1.2, 0.8)
    this.add(earRight)

    // Stubby legs
    const legMaterial = material.clone()
    const legGeom = new THREE.CylinderGeometry(0.12, 0.1, 0.4, 8)
    const legPositions = [
      [-0.35, -0.6, 0.4],
      [0.35, -0.6, 0.4],
      [-0.35, -0.6, -0.4],
      [0.35, -0.6, -0.4]
    ]
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeom, legMaterial)
      leg.position.set(pos[0], pos[1], pos[2])
      leg.castShadow = true
      this.add(leg)
    })

    // Fluffy tail
    const tailMaterial = new THREE.MeshStandardMaterial({
      color: 0xffccdd,
      metalness: 0.1,
      roughness: 0.9
    })
    const tail = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      tailMaterial
    )
    tail.position.set(0, 0, -1)
    this.add(tail)

    // Fluffy mane
    const mane = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      tailMaterial
    )
    mane.position.set(0, 0.65, 0.6)
    mane.scale.set(1.2, 1, 1.5)
    this.add(mane)

    // Magic sparkles around the pony
    this.createSparkles()
  }

  private createSparkles() {
    const particleCount = 30
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 3
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3

      // Pink/purple sparkles
      colors[i * 3] = 0.8 + Math.random() * 0.2
      colors[i * 3 + 1] = 0.5 + Math.random() * 0.3
      colors[i * 3 + 2] = 0.8 + Math.random() * 0.2
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    })

    this.sparkles = new THREE.Points(geometry, material)
    this.add(this.sparkles)
  }

  update(delta: number, input: InputState, mouseDelta: { x: number; y: number }) {
    // Handle trick animation
    if (this.isPerformingTrick) {
      this.animateTrick(delta)
      this.position.add(this.velocity.clone().multiplyScalar(delta))
      this.updateSparkles(delta)
      return
    }

    // Bobbing motion
    this.bobPhase += delta * this.bobSpeed

    // Horizontal movement only
    const moveDirection = new THREE.Vector3()

    if (input.turnLeft) moveDirection.x -= 1
    if (input.turnRight) moveDirection.x += 1
    if (input.accelerate) moveDirection.z += 1
    if (input.brake) moveDirection.z -= 1

    // Mouse influences direction slightly
    moveDirection.x -= mouseDelta.x * 0.01
    moveDirection.z -= mouseDelta.y * 0.01

    if (moveDirection.length() > 0) {
      moveDirection.normalize()

      // Accelerate toward direction
      this.velocity.x += moveDirection.x * this.config.acceleration * delta
      this.velocity.z += moveDirection.z * this.config.acceleration * delta
    }

    // Clamp horizontal speed
    const horizontalVelocity = new THREE.Vector2(this.velocity.x, this.velocity.z)
    if (horizontalVelocity.length() > this.config.maxSpeed) {
      horizontalVelocity.setLength(this.config.maxSpeed)
      this.velocity.x = horizontalVelocity.x
      this.velocity.z = horizontalVelocity.y
    }

    // Apply drag
    this.velocity.x *= 0.95
    this.velocity.z *= 0.95

    // Apply to position
    this.position.x += this.velocity.x * delta
    this.position.z += this.velocity.z * delta

    // Floating bob effect
    this.position.y = this.floatHeight + Math.sin(this.bobPhase) * this.bobAmplitude

    // Face movement direction (smoothly)
    if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
      const targetRotation = Math.atan2(this.velocity.x, this.velocity.z)
      const currentRotation = this.rotation.y
      const diff = targetRotation - currentRotation

      // Normalize angle difference
      let normalizedDiff = diff
      while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2
      while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2

      this.rotation.y += normalizedDiff * this.config.turnSpeed * delta
    }

    // Gentle tilt based on movement
    this.rotation.z = -this.velocity.x * 0.02
    this.rotation.x = this.velocity.z * 0.01

    // Update sparkles
    this.updateSparkles(delta)
  }

  private updateSparkles(delta: number) {
    const positions = this.sparkles.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += delta * 0.5
      if (positions[i + 1] > 1.5) {
        positions[i + 1] = -1
        positions[i] = (Math.random() - 0.5) * 3
        positions[i + 2] = (Math.random() - 0.5) * 3
      }
    }
    this.sparkles.geometry.attributes.position.needsUpdate = true
    this.sparkles.rotation.y += delta * 0.5
  }

  private animateTrick(delta: number) {
    const completed = this.updateTrick(delta)

    // Pony does a spin instead of flip
    const rotation = this.trickProgress * Math.PI * 2

    if (this.trickType === 'flip' || this.trickType === 'somersault') {
      // Cute spin
      this.rotation.y = rotation
    } else if (this.trickType === 'barrelRoll') {
      this.rotation.z = rotation
    }

    if (completed) {
      this.rotation.z = 0
    }
  }
}
