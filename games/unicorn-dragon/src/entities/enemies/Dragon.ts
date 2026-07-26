import * as THREE from 'three'
import { getSparkTexture } from '../../fx/textures'
import type { ProjectileConfig } from '../projectiles/Projectile'

export interface DragonConfig {
  name: string
  maxHealth: number
  damage: number
  speed: number
  /** Main scale colour. */
  color: number
  /** Belly / wing membrane colour. */
  bellyColor: number
  /** Emissive accent: eyes, spines, aura. */
  glowColor: number
  scale: number
  /** Element flavour drives the aura particle behaviour. */
  element: 'fire' | 'frost' | 'shadow'
  /** Seconds between breath attacks. Deliberately slow — kids play this. */
  attackInterval: number
  /** Beyond this distance the dragon ignores the player entirely. */
  attackRange: number
}

/** What a dragon wants to do this frame (see {@link Dragon.tryAttack}). */
export type DragonAction =
  | { kind: 'windup' }
  | { kind: 'fire'; position: THREE.Vector3; direction: THREE.Vector3 }

/**
 * Procedural articulated dragon: a serpentine spine of tapering segments
 * that undulates, hinged flapping wings that bank, a horned head with
 * glowing eyes and a hinged jaw, plus a per-element aura particle system.
 * Death triggers a tumbling fall; Game removes it once isFallFinished().
 */
export class Dragon extends THREE.Group {
  config: DragonConfig
  health: number
  isDead = false
  /** Seconds since death (drives the tumble). */
  deathTime = 0

  private spine: THREE.Group[] = []
  private wingLeft: THREE.Group
  private wingRight: THREE.Group
  private head: THREE.Group
  private jaw: THREE.Mesh
  private bodyMaterial: THREE.MeshStandardMaterial
  private glowMaterial: THREE.MeshBasicMaterial
  private aura: THREE.Points
  private auraVelocities: THREE.Vector3[] = []
  private wingPhase = Math.random() * Math.PI * 2
  private swimPhase = Math.random() * Math.PI * 2
  private tumbleAxis = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5
  ).normalize()
  private flashTimer = 0
  /** Centre of the lazy patrol circle (set on spawn). */
  private anchor = new THREE.Vector3()
  private patrolPhase = Math.random() * Math.PI * 2
  private patrolRadius = 5 + Math.random() * 4
  private headYaw = 0
  /** Staggered so the three dragons never breathe in unison. */
  private attackTimer = 3 + Math.random() * 4
  /** Counts down during the telegraph; the shot leaves at zero. */
  private windupTimer = 0
  private readonly WINDUP = 0.8

  constructor(config: DragonConfig) {
    super()
    this.config = config
    this.health = config.maxHealth
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.65,
      metalness: 0.15,
      flatShading: true,
    })
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(config.glowColor).multiplyScalar(2.6),
    })
    this.buildSpine()
    this.buildHead()
    this.buildWings()
    this.createAura()
    this.scale.setScalar(config.scale)
  }

  /* ---------------------------------------------------------------- */
  /* Construction                                                      */
  /* ---------------------------------------------------------------- */

  /**
   * Chain of nested groups from the shoulders back to the tail tip.
   * Each link is rotated a little each frame -> smooth serpentine motion.
   */
  private buildSpine() {
    const SEGMENTS = 11
    const bellyMaterial = new THREE.MeshStandardMaterial({
      color: this.config.bellyColor,
      roughness: 0.75,
      flatShading: true,
    })

    let parent: THREE.Object3D = this
    for (let i = 0; i < SEGMENTS; i++) {
      const t = i / (SEGMENTS - 1)
      const link = new THREE.Group()
      // First link sits at the shoulders; the rest chain backwards.
      link.position.z = i === 0 ? 0 : -0.78
      parent.add(link)
      this.spine.push(link)
      parent = link

      // Body segment: squashed sphere tapering toward the tail.
      const radius = 1.05 * (1 - t * 0.82) + 0.08
      const seg = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), this.bodyMaterial)
      seg.scale.set(0.92, 0.85, 1.25)
      seg.castShadow = true
      link.add(seg)

      // Pale belly plate.
      const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.72, 1), bellyMaterial)
      belly.position.set(0, -radius * 0.55, 0)
      belly.scale.set(0.9, 0.4, 1.3)
      link.add(belly)

      // Glowing dorsal fin: bigger near the shoulders.
      const finH = 0.75 * (1 - t * 0.55)
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.16, finH, 4), this.glowMaterial)
      fin.position.set(0, radius * 0.95, 0)
      fin.rotation.x = -0.35
      link.add(fin)

      // Hind legs on the 3rd link only (dragons, not worms).
      if (i === 2) {
        for (const side of [-1, 1]) {
          const thigh = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.22, 0.5, 4, 8),
            this.bodyMaterial
          )
          thigh.position.set(side * 0.75, -0.55, 0)
          thigh.rotation.z = side * 0.5
          thigh.castShadow = true
          link.add(thigh)
          const claw = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 5), this.bodyMaterial)
          claw.position.set(side * 1.05, -1.0, 0.1)
          claw.rotation.x = Math.PI / 2
          link.add(claw)
        }
      }
    }

    // Tail fin blade at the very tip.
    const tip = this.spine[this.spine.length - 1]
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 4), this.glowMaterial)
    blade.position.set(0, 0.1, -0.7)
    blade.rotation.x = -Math.PI / 2
    blade.scale.set(0.35, 1, 1)
    tip.add(blade)
  }

  private buildHead() {
    this.head = new THREE.Group()
    this.head.position.set(0, 0.35, 1.35)
    this.add(this.head)

    // Neck taper from shoulders to skull.
    for (let i = 0; i < 3; i++) {
      const t = i / 2
      const neck = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.75 - t * 0.22, 1),
        this.bodyMaterial
      )
      neck.position.set(0, -0.28 + t * 0.18, -0.75 + t * 0.5)
      neck.scale.set(0.9, 0.85, 1.1)
      neck.castShadow = true
      this.head.add(neck)
    }

    // Skull: wedge-shaped, wider at the back.
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), this.bodyMaterial)
    skull.scale.set(0.85, 0.78, 1.35)
    skull.position.set(0, 0.12, 0.62)
    skull.castShadow = true
    this.head.add(skull)

    // Snout.
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 6), this.bodyMaterial)
    snout.position.set(0, 0.02, 1.35)
    snout.rotation.x = Math.PI / 2
    snout.scale.set(1, 1, 0.75)
    this.head.add(snout)

    // Hinged lower jaw.
    this.jaw = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.95, 5), this.bodyMaterial)
    this.jaw.position.set(0, -0.22, 1.25)
    this.jaw.rotation.x = Math.PI / 2
    this.jaw.scale.set(1, 1, 0.6)
    this.head.add(this.jaw)

    // Glowing eyes, brow horns, cheek spikes.
    const eyeGeom = new THREE.SphereGeometry(0.14, 10, 10)
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeom, this.glowMaterial)
      eye.position.set(side * 0.34, 0.28, 0.85)
      this.head.add(eye)

      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.95, 5), this.bodyMaterial)
      horn.position.set(side * 0.34, 0.55, 0.1)
      horn.rotation.set(-Math.PI / 2.6, 0, side * 0.35)
      this.head.add(horn)

      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 4), this.glowMaterial)
      spike.position.set(side * 0.45, 0.0, 0.3)
      spike.rotation.set(-Math.PI / 2, 0, side * 0.8)
      this.head.add(spike)
    }

    // Maw glow (breath weapon origin).
    const maw = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), this.glowMaterial)
    maw.position.set(0, -0.06, 1.75)
    this.head.add(maw)
  }

  /** Wing = shoulder group -> bone arm -> membrane fan of finger panels. */
  private buildWing(side: number): THREE.Group {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.85, 0.55, 0.15)

    const membraneMaterial = new THREE.MeshStandardMaterial({
      color: this.config.bellyColor,
      emissive: new THREE.Color(this.config.glowColor),
      emissiveIntensity: 0.5,
      roughness: 0.6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      flatShading: true,
    })

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 1.5, 4, 8), this.bodyMaterial)
    arm.position.set(side * 0.85, 0, 0)
    arm.rotation.z = Math.PI / 2
    shoulder.add(arm)

    // Membrane: three scalloped panels fanning back from the arm.
    for (let f = 0; f < 3; f++) {
      const shape = new THREE.Shape()
      const len = 2.6 - f * 0.35
      shape.moveTo(0, 0)
      shape.lineTo(len, -0.15 - f * 0.55)
      shape.quadraticCurveTo(len * 0.65, -0.85 - f * 0.8, 0.2, -0.45 - f * 0.35)
      shape.lineTo(0, 0)
      const panel = new THREE.Mesh(new THREE.ShapeGeometry(shape, 6), membraneMaterial)
      panel.position.set(side * 0.35, 0, -f * 0.25)
      panel.rotation.x = -Math.PI / 2 + 0.12
      panel.scale.x = side
      shoulder.add(panel)

      const finger = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.03, len, 4),
        this.bodyMaterial
      )
      finger.position.set(
        side * (0.35 + (len / 2) * 0.98),
        0,
        -f * 0.25 - (0.2 + f * 0.35)
      )
      finger.rotation.z = Math.PI / 2
      finger.rotation.y = side * (0.12 + f * 0.22)
      shoulder.add(finger)
    }

    // Claw hook at the wing elbow.
    const hook = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 4), this.glowMaterial)
    hook.position.set(side * 1.7, 0.15, 0.1)
    hook.rotation.z = -side * 0.6
    shoulder.add(hook)

    return shoulder
  }

  private buildWings() {
    this.wingRight = this.buildWing(1)
    this.wingRight.scale.setScalar(1.45)
    this.add(this.wingRight)
    this.wingLeft = this.buildWing(-1)
    this.wingLeft.scale.setScalar(1.45)
    this.add(this.wingLeft)
  }

  /** Element-flavoured aura particles orbiting the body. */
  private createAura() {
    const count = this.config.element === 'shadow' ? 40 : 30
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const base = new THREE.Color(this.config.glowColor)
    for (let i = 0; i < count; i++) {
      const p = this.randomAuraPoint()
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
      const c = base.clone().lerp(new THREE.Color(0xffffff), Math.random() * 0.22)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
      this.auraVelocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          this.config.element === 'fire' ? 0.8 + Math.random() : (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.6
        )
      )
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.aura = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: this.config.element === 'frost' ? 0.42 : 0.34,
        map: getSparkTexture(),
        vertexColors: true,
        transparent: true,
        opacity: this.config.element === 'shadow' ? 0.55 : 0.85,
        blending:
          this.config.element === 'shadow' ? THREE.NormalBlending : THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    this.add(this.aura)

    // Frost wyrms also carry solid crystal shards.
    if (this.config.element === 'frost') {
      const crystalMaterial = new THREE.MeshStandardMaterial({
        color: 0xcdf3ff,
        emissive: new THREE.Color(this.config.glowColor),
        emissiveIntensity: 0.6,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.8,
        flatShading: true,
      })
      for (let i = 0; i < 6; i++) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), crystalMaterial)
        const a = (i / 6) * Math.PI * 2
        shard.position.set(Math.cos(a) * 2.2, Math.sin(a * 1.7) * 1.2, Math.sin(a) * 2.2 - 0.5)
        shard.scale.y = 2.2
        this.aura.add(shard)
      }
    }
  }

  private randomAuraPoint(): THREE.Vector3 {
    return new THREE.Vector3(
      (Math.random() - 0.5) * 3.2,
      (Math.random() - 0.5) * 2.2 - (this.config.element === 'fire' ? 0.8 : 0),
      (Math.random() - 0.5) * 6
    )
  }

  /* ---------------------------------------------------------------- */
  /* Animation                                                         */
  /* ---------------------------------------------------------------- */

  /** Remember the spawn point as the centre of the patrol circle. */
  setAnchor(position: THREE.Vector3) {
    this.anchor.copy(position)
    this.position.copy(position)
  }

  /**
   * Lazy patrol: the body cruises a slow circle and banks into the turn
   * while the head tracks the player. Facing the player dead-on (as v1
   * did) hid the whole serpentine body behind the skull.
   */
  updateFlight(delta: number, target: THREE.Vector3) {
    if (this.isDead) return
    if (this.anchor.lengthSq() === 0) this.anchor.copy(this.position)

    this.patrolPhase += delta * 0.28
    const c = Math.cos(this.patrolPhase)
    const s = Math.sin(this.patrolPhase)
    this.position.set(
      this.anchor.x + c * this.patrolRadius,
      this.position.y,
      this.anchor.z + s * this.patrolRadius
    )
    // Ease the bob back toward the anchor height.
    this.position.y += (this.anchor.y - this.position.y) * Math.min(delta * 0.8, 1)

    // Face along the circle tangent, banked into the turn.
    const bodyYaw = Math.atan2(-s, c) + Math.PI / 2
    this.rotation.y = bodyYaw
    this.rotation.z = THREE.MathUtils.lerp(this.rotation.z, -0.22, Math.min(delta * 2, 1))

    // Head tracks the player within a natural neck range.
    const toTarget = Math.atan2(target.x - this.position.x, target.z - this.position.z)
    let diff = toTarget - bodyYaw
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    this.headYaw = THREE.MathUtils.lerp(
      this.headYaw,
      THREE.MathUtils.clamp(diff, -1.2, 1.2),
      Math.min(delta * 2.5, 1)
    )
  }

  update(delta: number) {
    if (this.isDead) {
      this.updateDeath(delta)
      return
    }

    // Wing flap with a bank twist; downstroke faster than the recovery.
    this.wingPhase += delta * 3.4
    const flap = Math.sin(this.wingPhase)
    const eased = Math.sign(flap) * Math.pow(Math.abs(flap), 0.65)
    // Base dihedral keeps the membranes tilted up so they read as wings
    // from behind instead of vanishing edge-on.
    this.wingRight.rotation.z = 0.32 + eased * 0.62
    this.wingLeft.rotation.z = -(0.32 + eased * 0.62)
    this.wingRight.rotation.y = -eased * 0.18
    this.wingLeft.rotation.y = eased * 0.18

    // Serpentine spine: a travelling sine wave down the chain.
    this.swimPhase += delta * 2.1
    for (let i = 1; i < this.spine.length; i++) {
      const wave = Math.sin(this.swimPhase - i * 0.55)
      const amount = 0.055 + (i / this.spine.length) * 0.13
      this.spine[i].rotation.y = wave * amount
      this.spine[i].rotation.x = Math.cos(this.swimPhase * 0.8 - i * 0.4) * amount * 0.45
    }

    // Head sway (on top of the player-tracking yaw) + idle jaw.
    this.head.rotation.y = this.headYaw + Math.sin(this.swimPhase * 0.6) * 0.14
    this.head.rotation.x = Math.sin(this.swimPhase * 0.45) * 0.09
    this.jaw.rotation.x = Math.PI / 2 + 0.12 + Math.sin(this.swimPhase * 0.9) * 0.1

    // Attack telegraph: the jaw yawns open and the glow swells so a player
    // can see the breath coming and dodge it.
    if (this.windupTimer > 0) {
      const charge = 1 - this.windupTimer / this.WINDUP
      this.jaw.rotation.x += charge * 0.75
      const pulse = 2.6 + charge * 3.4 + Math.sin(this.windupTimer * 40) * 0.4
      this.glowMaterial.color.copy(new THREE.Color(this.config.glowColor).multiplyScalar(pulse))
    } else {
      this.glowMaterial.color.copy(new THREE.Color(this.config.glowColor).multiplyScalar(2.6))
    }

    // Body bob follows the flap.
    this.position.y += Math.sin(this.wingPhase) * delta * 1.6

    this.updateAura(delta)

    if (this.flashTimer > 0) {
      this.flashTimer -= delta
      if (this.flashTimer <= 0) this.bodyMaterial.emissive.setHex(0x000000)
    }
  }

  private updateAura(delta: number) {
    const pos = this.aura.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < this.auraVelocities.length; i++) {
      const v = this.auraVelocities[i]
      pos[i * 3] += v.x * delta
      pos[i * 3 + 1] += v.y * delta
      pos[i * 3 + 2] += v.z * delta
      // Recycle when a particle strays too far.
      if (
        Math.abs(pos[i * 3]) > 2.6 ||
        Math.abs(pos[i * 3 + 1]) > 2.4 ||
        Math.abs(pos[i * 3 + 2]) > 4
      ) {
        const p = this.randomAuraPoint()
        pos[i * 3] = p.x
        pos[i * 3 + 1] = p.y
        pos[i * 3 + 2] = p.z
      }
    }
    this.aura.geometry.attributes.position.needsUpdate = true
    if (this.config.element === 'frost') this.aura.rotation.y += delta * 0.5
  }

  /** Tumbling death fall. */
  private updateDeath(delta: number) {
    this.deathTime += delta
    this.position.y -= (6 + this.deathTime * 14) * delta
    this.rotateOnAxis(this.tumbleAxis, delta * 3.2)
    const fade = Math.max(0, 1 - this.deathTime / 2.2)
    this.scale.setScalar(this.config.scale * (0.6 + fade * 0.4))
    // Wings go limp.
    this.wingRight.rotation.z = -1.2
    this.wingLeft.rotation.z = 1.2
  }

  isFallFinished(): boolean {
    return this.isDead && this.deathTime > 2.2
  }

  takeDamage(amount: number): boolean {
    if (this.isDead) return false
    this.health -= amount
    this.flashDamage()

    if (this.health <= 0) {
      this.die()
      return true
    }
    return false
  }

  private flashDamage() {
    this.bodyMaterial.emissive.setHex(0xff3333)
    this.flashTimer = 0.12
  }

  private die() {
    this.isDead = true
    this.deathTime = 0
  }

  /**
   * Breath-attack pacing. Call once per frame after {@link updateFlight}.
   *
   * A dragon only attacks when the player is inside `attackRange` AND its head
   * is actually pointed at them, so you are never sniped from off-screen. Each
   * shot is preceded by a visible {@link WINDUP} telegraph.
   *
   * @returns `windup` on the frame the telegraph starts, `fire` on the frame
   * the breath launches, otherwise `null`.
   */
  tryAttack(delta: number, target: THREE.Vector3): DragonAction | null {
    if (this.isDead) {
      this.windupTimer = 0
      return null
    }

    // Mid-telegraph: keep charging, then breathe.
    if (this.windupTimer > 0) {
      this.windupTimer -= delta
      if (this.windupTimer > 0) return null

      this.windupTimer = 0
      this.attackTimer = this.config.attackInterval * (0.8 + Math.random() * 0.4)

      const position = this.getFirePosition()
      const direction = target.clone().sub(position).normalize()
      // Aim at where the player is *now*, never where they're heading, and
      // scatter the shot slightly — a dead-accurate dragon is no fun to dodge.
      direction.x += (Math.random() - 0.5) * 0.06
      direction.y += (Math.random() - 0.5) * 0.06
      direction.z += (Math.random() - 0.5) * 0.06
      return { kind: 'fire', position, direction: direction.normalize() }
    }

    if (this.position.distanceTo(target) > this.config.attackRange) return null

    // Only breathe when the head has actually swung onto the player.
    const toTarget = Math.atan2(target.x - this.position.x, target.z - this.position.z)
    let aimError = toTarget - (this.rotation.y + this.headYaw)
    while (aimError > Math.PI) aimError -= Math.PI * 2
    while (aimError < -Math.PI) aimError += Math.PI * 2
    if (Math.abs(aimError) > 0.5) return null

    this.attackTimer -= delta
    if (this.attackTimer > 0) return null

    this.windupTimer = this.WINDUP
    return { kind: 'windup' }
  }

  /**
   * Breath projectile for this dragon. Damage comes from the dragon's own
   * stats; speeds are well under the player's bolts so the shots stay
   * dodgeable.
   */
  getBreathConfig(): ProjectileConfig {
    const base = {
      damage: this.config.damage,
      color: this.config.glowColor,
      lifetime: 4
    }
    switch (this.config.element) {
      case 'fire':
        return { ...base, speed: 38, size: 0.5 }
      case 'frost':
        return { ...base, speed: 32, size: 0.55 }
      default:
        return { ...base, speed: 44, size: 0.4 }
    }
  }

  /** Head/mouth world position (breath attacks, death burst origin). */
  getFirePosition(): THREE.Vector3 {
    const out = new THREE.Vector3(0, -0.06, 1.75)
    this.head.updateWorldMatrix(true, false)
    return out.applyMatrix4(this.head.matrixWorld)
  }

  getCollisionRadius(): number {
    return 2.4 * this.config.scale
  }
}

// Dragon presets — same three types and stats as v1, richer colours.
export const DRAGON_TYPES: Record<string, DragonConfig> = {
  'fire-drake': {
    name: 'Fire Drake',
    maxHealth: 100,
    damage: 15,
    speed: 40,
    color: 0xd64a22,
    bellyColor: 0xffc48a,
    glowColor: 0xff9d2e,
    scale: 1.35,
    element: 'fire',
    attackInterval: 5.5,
    attackRange: 65
  },
  'frost-wyrm': {
    name: 'Frost Wyrm',
    maxHealth: 150,
    damage: 20,
    speed: 30,
    color: 0x4f9fd8,
    bellyColor: 0xe4f8ff,
    glowColor: 0x7fe9ff,
    scale: 1.6,
    element: 'frost',
    attackInterval: 6.5,
    attackRange: 60
  },
  'shadow-dragon': {
    name: 'Shadow Dragon',
    maxHealth: 80,
    damage: 25,
    speed: 50,
    color: 0x4a3a76,
    bellyColor: 0x8f74d4,
    glowColor: 0xc07dff,
    scale: 1.2,
    element: 'shadow',
    attackInterval: 4.5,
    attackRange: 70
  }
}
