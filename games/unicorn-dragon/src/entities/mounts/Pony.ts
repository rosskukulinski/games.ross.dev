import * as THREE from 'three'
import { Mount, MountConfig } from './Mount'
import { InputState } from '../../core/InputManager'
import { createHorseInstance, HorseInstance } from './HorseModel'
import { getSparkTexture } from '../../fx/textures'

/**
 * Floating pony: same Horse.glb base scaled chubby and cute (no horn, no
 * wings), riding a magic bubble with a glowing halo ring and sparkles.
 * Movement is the v1 float behaviour, unchanged.
 */
export class Pony extends Mount {
  private floatHeight = 15
  private bobPhase = 0
  private bobAmplitude = 0.5
  private bobSpeed = 2
  private sparkles: THREE.Points
  private horse: HorseInstance
  private bubble: THREE.Mesh
  private ring: THREE.Mesh

  constructor(config: MountConfig) {
    super(config)
    this.horse = createHorseInstance(config.color)
    // Chubby, stubby proportions read as "pony" rather than "horse".
    this.horse.group.scale.set(1.15, 0.92, 0.86)
    this.add(this.horse.group)
    this.buildAccessories()
    this.createSparkles()
  }

  private buildAccessories() {
    const head = this.horse.headAnchor
    const tail = this.horse.tailAnchor
    const fluffMaterial = new THREE.MeshStandardMaterial({
      color: this.config.accent,
      emissive: new THREE.Color(this.config.accent),
      emissiveIntensity: 0.4,
      roughness: 0.85,
    })

    // Big fluffy mane blobs running the neck crest.
    const withers = this.horse.withersAnchor
    for (let i = 0; i < 5; i++) {
      const t = i / 4
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19 - t * 0.03, 1), fluffMaterial)
      blob.position.lerpVectors(
        new THREE.Vector3(0, head.y - 0.06, head.z - 0.14),
        withers,
        t
      )
      blob.position.y += 0.05 * (1 - t)
      blob.scale.set(0.7, 1, 1.2)
      this.add(blob)
    }

    // Fluffy tail on the croup.
    const tailPuff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), fluffMaterial)
    tailPuff.position.set(0, tail.y - 0.05, tail.z - 0.12)
    tailPuff.scale.set(0.85, 1, 1.3)
    this.add(tailPuff)

    // Magic bubble it floats inside.
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.9, 24, 18),
      new THREE.MeshStandardMaterial({
        color: 0xffe4f4,
        transparent: true,
        opacity: 0.16,
        roughness: 0.05,
        metalness: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    )
    this.bubble.position.y = 0.1
    this.add(this.bubble)

    // Glowing halo ring under the pony (HDR emissive -> blooms).
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.055, 8, 40),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(this.config.accent).multiplyScalar(2.2),
      })
    )
    this.ring.rotation.x = Math.PI / 2
    this.ring.position.y = -1.15
    this.add(this.ring)
  }

  private createSparkles() {
    const particleCount = 34
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 3
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3

      // Pink/gold sparkles
      colors[i * 3] = 0.9 + Math.random() * 0.1
      colors[i * 3 + 1] = 0.6 + Math.random() * 0.35
      colors[i * 3 + 2] = 0.75 + Math.random() * 0.25
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.2,
      map: getSparkTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    this.sparkles = new THREE.Points(geometry, material)
    this.add(this.sparkles)
  }

  getTailWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.horse.tailAnchor)
    out.z -= 0.3
    return this.localToWorld(out)
  }

  update(delta: number, input: InputState, mouseDelta: { x: number; y: number }) {
    // Prancing animation, gentle and slow.
    if (this.horse.action) {
      this.horse.action.timeScale = 0.3 + this.getSpeedRatio() * 1.1
    }
    this.horse.mixer?.update(delta)
    this.ring.rotation.z += delta * 1.4
    this.bubble.rotation.y += delta * 0.3

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
