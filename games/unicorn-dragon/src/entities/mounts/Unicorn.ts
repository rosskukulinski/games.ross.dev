import * as THREE from 'three'
import { Mount, MountConfig } from './Mount'
import { InputState } from '../../core/InputManager'
import { createHorseInstance, createHorn, createWing, HorseInstance } from './HorseModel'
import { getSparkTexture } from '../../fx/textures'

/**
 * Flying unicorn: the real animated Horse.glb (tinted per variant) with a
 * glowing spiral horn, glowing mane blobs, feathered wings and sparkles.
 * Flight physics are unchanged from v1.
 */
export class Unicorn extends Mount {
  private bank = 0
  private wingLeft: THREE.Group
  private wingRight: THREE.Group
  private wingPhase = 0
  private horse: HorseInstance
  private sparkles: THREE.Points
  private maneBlobs: THREE.Mesh[] = []
  private tailPuffs: THREE.Mesh[] = []
  private flowPhase = 0

  constructor(config: MountConfig) {
    super(config)
    this.horse = createHorseInstance(config.color)
    this.add(this.horse.group)
    this.buildAccessories()
    this.createSparkles()
  }

  private buildAccessories() {
    const head = this.horse.headAnchor
    const tail = this.horse.tailAnchor
    const withers = this.horse.withersAnchor

    // Glowing spiral horn, rooted on the forehead just ahead of the poll.
    const horn = createHorn()
    horn.position.set(0, head.y - 0.05, head.z + 0.05)
    horn.rotation.x = -Math.PI / 9
    horn.scale.setScalar(1.15)
    this.add(horn)

    // Glowing mane: flattened blobs running the neck crest, poll -> withers.
    const maneMaterial = new THREE.MeshStandardMaterial({
      color: this.config.accent,
      emissive: new THREE.Color(this.config.accent),
      emissiveIntensity: 0.5,
      roughness: 0.6,
      flatShading: true,
    })
    const crestTop = new THREE.Vector3(0, head.y - 0.08, head.z - 0.16)
    for (let i = 0; i < 7; i++) {
      const t = i / 6
      const blob = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.13 - t * 0.03, 1),
        maneMaterial
      )
      blob.position.lerpVectors(crestTop, withers, t)
      // Sit the crest slightly proud of the neck line.
      blob.position.y += 0.05 * (1 - t)
      blob.scale.set(0.5, 1.15, 1.5)
      this.maneBlobs.push(blob)
      this.add(blob)
    }

    // Flowing tail: a chain of puffs streaming back from the croup.
    for (let i = 0; i < 5; i++) {
      const t = i / 4
      const puff = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.14 - t * 0.025, 1),
        maneMaterial
      )
      puff.position.set(0, tail.y - t * 0.16, tail.z - 0.06 - t * 0.24)
      puff.scale.set(0.62, 0.85, 1.35)
      this.tailPuffs.push(puff)
      this.add(puff)
    }

    // Feathered wings on shoulder pivots. The wing shape is authored in
    // the XY plane spanning +X outward; tipping the MESH -90° about X
    // lays it flat like a spread bird wing, while the PIVOT rotates about
    // the body's forward axis so the flap raises and lowers it.
    this.wingRight = this.makeWingPivot(1, withers)
    this.wingLeft = this.makeWingPivot(-1, withers)
  }

  private makeWingPivot(side: number, withers: THREE.Vector3): THREE.Group {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.14, withers.y + 0.08, withers.z + 0.05)
    const wing = createWing(this.config.accent)
    wing.rotation.x = -Math.PI / 2
    wing.scale.set(side * 1.15, 1.15, 1.15)
    pivot.add(wing)
    this.add(pivot)
    return pivot
  }

  private createSparkles() {
    const count = 26
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const accent = new THREE.Color(this.config.accent)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2.4
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1.6
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3
      const c = accent.clone().lerp(new THREE.Color(0xffffff), Math.random() * 0.6)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.sparkles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.16,
        map: getSparkTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    this.add(this.sparkles)
  }

  getTailWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.horse.tailAnchor)
    out.z -= 1.1
    return this.localToWorld(out)
  }

  /** Mane and tail ripple; amplitude grows with airspeed. */
  private animateFlow(delta: number, speedRatio: number) {
    this.flowPhase += delta * (4 + speedRatio * 7)
    const amp = 0.05 + speedRatio * 0.14
    for (let i = 0; i < this.maneBlobs.length; i++) {
      const wave = Math.sin(this.flowPhase - i * 0.7)
      this.maneBlobs[i].rotation.z = wave * amp * 1.6
      this.maneBlobs[i].position.x = wave * amp * 0.25 * (i / this.maneBlobs.length)
    }
    for (let i = 0; i < this.tailPuffs.length; i++) {
      const t = i / Math.max(this.tailPuffs.length - 1, 1)
      const wave = Math.sin(this.flowPhase * 0.9 - i * 0.8)
      this.tailPuffs[i].position.x = wave * amp * 1.4 * t
      this.tailPuffs[i].position.y =
        this.horse.tailAnchor.y - t * 0.16 + Math.cos(this.flowPhase - i) * amp * 0.5 * t
    }
  }

  update(delta: number, input: InputState, mouseDelta: { x: number; y: number }) {
    // Gallop animation speed follows flight speed.
    const speedRatio = this.getSpeedRatio()
    if (this.horse.action) {
      this.horse.action.timeScale = 0.35 + speedRatio * 1.75
    }
    this.horse.mixer?.update(delta)

    // Sparkles slowly orbit; mane and tail stream in the wind.
    this.sparkles.rotation.y += delta * 0.8
    this.animateFlow(delta, speedRatio)

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

    // Animate wings: base dihedral plus a flap that quickens with speed.
    this.wingPhase += delta * (5 + speedRatio * 8)
    const wingFlap = 0.25 + Math.sin(this.wingPhase) * (0.4 + speedRatio * 0.25)
    this.wingRight.rotation.z = wingFlap
    this.wingLeft.rotation.z = -wingFlap
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
