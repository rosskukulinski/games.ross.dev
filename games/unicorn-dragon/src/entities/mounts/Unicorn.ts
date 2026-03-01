import * as THREE from 'three'
import { Mount, MountConfig } from './Mount'
import { InputState } from '../../core/InputManager'

export class Unicorn extends Mount {
  private bank = 0
  private wingLeft: THREE.Mesh
  private wingRight: THREE.Mesh
  private wingPhase = 0

  constructor(config: MountConfig) {
    super(config)
    this.createPlaceholderModel()
  }

  private createPlaceholderModel() {
    const material = new THREE.MeshStandardMaterial({
      color: this.config.color,
      metalness: 0.3,
      roughness: 0.7
    })

    // Body
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.6, 2, 8, 16),
      material
    )
    body.rotation.x = Math.PI / 2
    body.castShadow = true
    this.add(body)

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 16),
      material
    )
    head.position.set(0, 0.3, 1.3)
    head.castShadow = true
    this.add(head)

    // Snout
    const snout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.25, 0.5, 8),
      material
    )
    snout.position.set(0, 0.15, 1.7)
    snout.rotation.x = Math.PI / 2
    this.add(snout)

    // Horn (golden)
    const hornMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.8,
      roughness: 0.2
    })
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.7, 8),
      hornMaterial
    )
    horn.position.set(0, 0.75, 1.4)
    horn.rotation.x = -Math.PI / 6
    horn.castShadow = true
    this.add(horn)

    // Ears
    const earMaterial = material.clone()
    const earGeom = new THREE.ConeGeometry(0.1, 0.25, 4)

    const earLeft = new THREE.Mesh(earGeom, earMaterial)
    earLeft.position.set(-0.2, 0.65, 1.2)
    earLeft.rotation.x = -Math.PI / 6
    earLeft.rotation.z = -Math.PI / 8
    this.add(earLeft)

    const earRight = new THREE.Mesh(earGeom, earMaterial)
    earRight.position.set(0.2, 0.65, 1.2)
    earRight.rotation.x = -Math.PI / 6
    earRight.rotation.z = Math.PI / 8
    this.add(earRight)

    // Legs
    const legMaterial = material.clone()
    const legGeom = new THREE.CylinderGeometry(0.1, 0.08, 0.8, 8)
    const legPositions = [
      [-0.3, -0.6, 0.6],
      [0.3, -0.6, 0.6],
      [-0.3, -0.6, -0.6],
      [0.3, -0.6, -0.6]
    ]
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeom, legMaterial)
      leg.position.set(pos[0], pos[1], pos[2])
      leg.castShadow = true
      this.add(leg)
    })

    // Wings (translucent, magical)
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      metalness: 0.1,
      roughness: 0.3
    })

    const wingShape = new THREE.Shape()
    wingShape.moveTo(0, 0)
    wingShape.quadraticCurveTo(1.5, 0.5, 2, 0)
    wingShape.quadraticCurveTo(1.5, -0.3, 0, 0)

    const wingGeom = new THREE.ShapeGeometry(wingShape)

    this.wingLeft = new THREE.Mesh(wingGeom, wingMaterial)
    this.wingLeft.position.set(-0.5, 0.4, 0)
    this.wingLeft.rotation.y = Math.PI / 2
    this.wingLeft.rotation.x = Math.PI / 6
    this.add(this.wingLeft)

    this.wingRight = new THREE.Mesh(wingGeom, wingMaterial)
    this.wingRight.position.set(0.5, 0.4, 0)
    this.wingRight.rotation.y = -Math.PI / 2
    this.wingRight.rotation.x = Math.PI / 6
    this.add(this.wingRight)

    // Tail (flowing mane-like)
    const tailMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaaff,
      metalness: 0.2,
      roughness: 0.8
    })
    const tail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.15, 1, 8),
      tailMaterial
    )
    tail.position.set(0, 0.1, -1.3)
    tail.rotation.x = Math.PI / 3
    this.add(tail)

    // Mane
    const mane = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.4, 0.8),
      tailMaterial
    )
    mane.position.set(0, 0.5, 0.7)
    this.add(mane)
  }

  update(delta: number, input: InputState, mouseDelta: { x: number; y: number }) {
    // Handle trick animation
    if (this.isPerformingTrick) {
      this.animateTrick(delta)
      // Still update position during trick
      this.position.add(this.velocity.clone().multiplyScalar(delta))
      return
    }

    // Mouse look (yaw and pitch)
    const mouseSensitivity = 0.002
    this.rotation.y -= mouseDelta.x * mouseSensitivity
    this.rotation.x -= mouseDelta.y * mouseSensitivity

    // Clamp pitch
    this.rotation.x = THREE.MathUtils.clamp(this.rotation.x, -Math.PI / 3, Math.PI / 3)

    // Keyboard turning
    if (input.turnLeft) {
      this.rotation.y += this.config.turnSpeed * delta
      this.bank = THREE.MathUtils.lerp(this.bank, 0.5, 0.1)
    }
    if (input.turnRight) {
      this.rotation.y -= this.config.turnSpeed * delta
      this.bank = THREE.MathUtils.lerp(this.bank, -0.5, 0.1)
    }
    if (!input.turnLeft && !input.turnRight) {
      this.bank = THREE.MathUtils.lerp(this.bank, 0, 0.05)
    }

    // Keyboard pitch
    if (input.pitchUp) {
      this.rotation.x = THREE.MathUtils.lerp(this.rotation.x, -Math.PI / 4, 0.05)
    }
    if (input.pitchDown) {
      this.rotation.x = THREE.MathUtils.lerp(this.rotation.x, Math.PI / 4, 0.05)
    }

    // Apply bank angle
    this.rotation.z = this.bank

    // Calculate forward direction
    const forward = new THREE.Vector3(0, 0, 1)
    forward.applyQuaternion(this.quaternion)

    // Thrust
    if (input.accelerate) {
      this.velocity.add(forward.multiplyScalar(this.config.acceleration * delta))
    }
    if (input.brake) {
      this.velocity.multiplyScalar(0.95)
    }

    // Clamp speed
    if (this.velocity.length() > this.config.maxSpeed) {
      this.velocity.setLength(this.config.maxSpeed)
    }

    // Apply drag
    this.velocity.multiplyScalar(0.98)

    // Update position
    this.position.add(this.velocity.clone().multiplyScalar(delta))

    // Keep above ground
    if (this.position.y < 5) {
      this.position.y = 5
      this.velocity.y = Math.max(0, this.velocity.y)
    }

    // Animate wings
    this.wingPhase += delta * 8
    const wingFlap = Math.sin(this.wingPhase) * 0.3
    this.wingLeft.rotation.x = Math.PI / 6 + wingFlap
    this.wingRight.rotation.x = Math.PI / 6 + wingFlap
  }

  private animateTrick(delta: number) {
    const completed = this.updateTrick(delta)

    // Animate based on trick type
    const rotation = this.trickProgress * Math.PI * 2

    if (this.trickType === 'flip') {
      // Forward flip (pitch rotation)
      this.rotation.x = rotation
    } else if (this.trickType === 'somersault') {
      // Backward somersault
      this.rotation.x = -rotation
    } else if (this.trickType === 'barrelRoll') {
      // Roll rotation
      this.rotation.z = rotation
    }

    if (completed) {
      // Reset rotation to level after trick
      this.rotation.x = 0
      this.rotation.z = 0
    }
  }
}
