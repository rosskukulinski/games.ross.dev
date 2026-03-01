import * as THREE from 'three'
import { SceneManager } from './core/SceneManager'
import { InputManager } from './core/InputManager'
import { CameraController } from './core/CameraController'
import { Mount } from './entities/mounts/Mount'
import { Unicorn } from './entities/mounts/Unicorn'
import { Pony } from './entities/mounts/Pony'
import { MOUNTS } from './config/mounts'
import { CombatSystem } from './systems/CombatSystem'
import { Dragon, DRAGON_TYPES } from './entities/enemies/Dragon'

export class Game {
  private sceneManager: SceneManager
  private inputManager: InputManager
  private cameraController: CameraController
  private combatSystem: CombatSystem

  private mounts: Mount[] = []
  private currentMountIndex = 0
  private dragons: Dragon[] = []

  private clock: THREE.Clock
  private isRunning = false

  // HUD elements
  private healthBar: HTMLElement
  private scoreDisplay: HTMLElement
  private comboDisplay: HTMLElement
  private mountNameDisplay: HTMLElement
  private trickNotification: HTMLElement
  private mountSlots: NodeListOf<Element>

  // Game state
  private health = 100
  private score = 0
  private combo = 1
  private comboTimer = 0

  constructor() {
    this.clock = new THREE.Clock()

    // Get HUD elements
    this.healthBar = document.getElementById('health-bar')!
    this.scoreDisplay = document.getElementById('score')!
    this.comboDisplay = document.getElementById('combo')!
    this.mountNameDisplay = document.getElementById('mount-name')!
    this.trickNotification = document.getElementById('trick-notification')!
    this.mountSlots = document.querySelectorAll('.mount-slot')
  }

  async init() {
    const container = document.getElementById('game')!

    // Initialize systems
    this.sceneManager = new SceneManager(container)
    this.inputManager = new InputManager()
    this.cameraController = new CameraController(this.sceneManager.camera)

    // Create mounts
    this.createMounts()

    // Initialize combat system
    this.combatSystem = new CombatSystem(this.sceneManager.scene)
    this.setupCombatCallbacks()

    // Add ground reference plane
    this.addGroundReference()

    // Add some floating islands for visual reference
    this.addFloatingIslands()

    // Add a bridge to fly under
    this.addBridge()

    // Spawn some dragons to fight
    this.spawnDragons()

    // Start game loop
    this.isRunning = true
    this.gameLoop()
  }

  private createMounts() {
    const mountConfigs = Object.values(MOUNTS)

    mountConfigs.forEach((config, index) => {
      let mount: Mount

      if (config.movementType === 'fly') {
        mount = new Unicorn(config)
      } else {
        mount = new Pony(config)
      }

      mount.position.set(0, 30, 0)
      mount.visible = index === 0

      this.mounts.push(mount)
      this.sceneManager.scene.add(mount)
    })

    // Set camera to follow first mount
    this.cameraController.setTarget(this.mounts[0])
    this.updateMountUI()
  }

  private addGroundReference() {
    // Semi-transparent ground plane for spatial reference
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x228833,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = 0
    ground.receiveShadow = true
    this.sceneManager.scene.add(ground)

    // Grid helper
    const grid = new THREE.GridHelper(1000, 50, 0x444444, 0x444444)
    grid.position.y = 0.1
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.2
    this.sceneManager.scene.add(grid)
  }

  private addFloatingIslands() {
    const islandMaterial = new THREE.MeshStandardMaterial({
      color: 0x556644,
      roughness: 0.9
    })

    const islandPositions = [
      [100, 20, 100],
      [-80, 40, 150],
      [150, 60, -50],
      [-120, 30, -100],
      [50, 50, -150]
    ]

    islandPositions.forEach(pos => {
      const size = 15 + Math.random() * 20
      const island = new THREE.Mesh(
        new THREE.DodecahedronGeometry(size, 1),
        islandMaterial
      )
      island.position.set(pos[0], pos[1], pos[2])
      island.scale.y = 0.5
      island.castShadow = true
      island.receiveShadow = true
      this.sceneManager.scene.add(island)

      // Add some grass/trees on top
      const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x33aa44 })
      const grass = new THREE.Mesh(
        new THREE.ConeGeometry(size * 0.6, size * 0.3, 8),
        grassMaterial
      )
      grass.position.set(pos[0], pos[1] + size * 0.4, pos[2])
      this.sceneManager.scene.add(grass)
    })
  }

  private addBridge() {
    // Stone bridge to fly under
    const bridgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.8
    })

    // Bridge arch
    const archGeometry = new THREE.TorusGeometry(15, 3, 8, 16, Math.PI)
    const arch = new THREE.Mesh(archGeometry, bridgeMaterial)
    arch.position.set(0, 20, 80)
    arch.rotation.y = Math.PI / 2
    arch.castShadow = true
    arch.receiveShadow = true
    this.sceneManager.scene.add(arch)

    // Bridge deck
    const deckGeometry = new THREE.BoxGeometry(40, 2, 8)
    const deck = new THREE.Mesh(deckGeometry, bridgeMaterial)
    deck.position.set(0, 35, 80)
    deck.castShadow = true
    deck.receiveShadow = true
    this.sceneManager.scene.add(deck)

    // Pillars
    const pillarGeometry = new THREE.CylinderGeometry(2, 2.5, 35, 8)
    const pillarLeft = new THREE.Mesh(pillarGeometry, bridgeMaterial)
    pillarLeft.position.set(-15, 17.5, 80)
    pillarLeft.castShadow = true
    this.sceneManager.scene.add(pillarLeft)

    const pillarRight = new THREE.Mesh(pillarGeometry, bridgeMaterial)
    pillarRight.position.set(15, 17.5, 80)
    pillarRight.castShadow = true
    this.sceneManager.scene.add(pillarRight)
  }

  private setupCombatCallbacks() {
    this.combatSystem.onEnemyHit = (enemy, damage) => {
      const killed = enemy.takeDamage(damage)
      if (killed) {
        this.score += 500
        this.showKillNotification(enemy.config.name)
        this.updateHUD()
        // Remove from dragons array
        this.dragons = this.dragons.filter(d => d !== enemy)
        // Respawn after delay
        setTimeout(() => this.spawnSingleDragon(), 3000)
      }
    }

    this.combatSystem.onPlayerHit = (damage) => {
      this.health = Math.max(0, this.health - damage)
      this.updateHUD()
      if (this.health <= 0) {
        this.gameOver()
      }
    }

    this.combatSystem.onHitEffect = (effect) => {
      this.spawnHitParticles(effect.position, effect.color)
    }
  }

  private spawnDragons() {
    // Spawn 3 dragons at various positions
    const positions = [
      new THREE.Vector3(50, 40, 100),
      new THREE.Vector3(-60, 50, 120),
      new THREE.Vector3(80, 35, 60)
    ]

    const types = Object.keys(DRAGON_TYPES)

    positions.forEach((pos, i) => {
      const typeKey = types[i % types.length]
      const dragon = new Dragon(DRAGON_TYPES[typeKey])
      dragon.position.copy(pos)
      this.dragons.push(dragon)
      this.sceneManager.scene.add(dragon)
    })
  }

  private spawnSingleDragon() {
    const types = Object.keys(DRAGON_TYPES)
    const typeKey = types[Math.floor(Math.random() * types.length)]
    const dragon = new Dragon(DRAGON_TYPES[typeKey])

    // Random position around player
    const mount = this.getCurrentMount()
    const angle = Math.random() * Math.PI * 2
    const distance = 80 + Math.random() * 40
    dragon.position.set(
      mount.position.x + Math.cos(angle) * distance,
      30 + Math.random() * 40,
      mount.position.z + Math.sin(angle) * distance
    )

    this.dragons.push(dragon)
    this.sceneManager.scene.add(dragon)
  }

  private spawnHitParticles(position: THREE.Vector3, color: number) {
    // Simple particle burst
    const particleCount = 15
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const velocities: THREE.Vector3[] = []

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x
      positions[i * 3 + 1] = position.y
      positions[i * 3 + 2] = position.z
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      ))
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({
      color,
      size: 0.5,
      transparent: true,
      opacity: 1
    })

    const particles = new THREE.Points(geometry, material)
    this.sceneManager.scene.add(particles)

    // Animate particles
    let lifetime = 0.5
    const animate = () => {
      lifetime -= 0.016
      if (lifetime <= 0) {
        this.sceneManager.scene.remove(particles)
        return
      }

      const posArray = geometry.attributes.position.array as Float32Array
      for (let i = 0; i < particleCount; i++) {
        posArray[i * 3] += velocities[i].x * 0.016
        posArray[i * 3 + 1] += velocities[i].y * 0.016
        posArray[i * 3 + 2] += velocities[i].z * 0.016
      }
      geometry.attributes.position.needsUpdate = true
      material.opacity = lifetime * 2

      requestAnimationFrame(animate)
    }
    animate()
  }

  private showKillNotification(enemyName: string) {
    const nameEl = this.trickNotification.querySelector('.trick-name')!
    const scoreEl = this.trickNotification.querySelector('.trick-score')!
    nameEl.textContent = enemyName + ' DEFEATED!'
    scoreEl.textContent = '+500'

    this.trickNotification.classList.add('show')
    setTimeout(() => {
      this.trickNotification.classList.remove('show')
    }, 1500)
  }

  private gameOver() {
    this.isRunning = false
    alert(`Game Over! Final Score: ${this.score}`)
    // Reload to restart
    window.location.reload()
  }

  private getCurrentMount(): Mount {
    return this.mounts[this.currentMountIndex]
  }

  private switchMount(index: number) {
    if (index < 1 || index > this.mounts.length) return
    const newIndex = index - 1
    if (newIndex === this.currentMountIndex) return

    const currentMount = this.getCurrentMount()
    const newMount = this.mounts[newIndex]

    // Transfer position and velocity
    newMount.position.copy(currentMount.position)
    newMount.rotation.y = currentMount.rotation.y
    newMount.velocity.copy(currentMount.velocity)

    // Switch visibility
    currentMount.visible = false
    newMount.visible = true

    this.currentMountIndex = newIndex
    this.cameraController.setTarget(newMount)
    this.updateMountUI()
  }

  private updateMountUI() {
    const mount = this.getCurrentMount()
    this.mountNameDisplay.textContent = mount.config.name

    this.mountSlots.forEach((slot, index) => {
      slot.classList.toggle('active', index === this.currentMountIndex)
    })
  }

  private checkBridgeZone(): boolean {
    const mount = this.getCurrentMount()
    const pos = mount.position

    // Bridge is at z=80, y=20-35, x=-15 to 15
    const inBridgeX = pos.x > -12 && pos.x < 12
    const inBridgeZ = pos.z > 70 && pos.z < 90
    const underBridge = pos.y < 33 && pos.y > 5

    return inBridgeX && inBridgeZ && underBridge
  }

  private triggerTrick(type: string) {
    const mount = this.getCurrentMount()
    if (mount.startTrick(type)) {
      // Will award points when trick completes
    }
  }

  private awardTrickPoints(trickName: string, basePoints: number) {
    const points = Math.floor(basePoints * this.combo)
    this.score += points
    this.combo = Math.min(this.combo + 0.5, 5)
    this.comboTimer = 3

    // Show notification
    const nameEl = this.trickNotification.querySelector('.trick-name')!
    const scoreEl = this.trickNotification.querySelector('.trick-score')!
    nameEl.textContent = trickName.toUpperCase() + '!'
    scoreEl.textContent = '+' + points

    this.trickNotification.classList.add('show')
    setTimeout(() => {
      this.trickNotification.classList.remove('show')
    }, 1500)

    this.updateHUD()
  }

  private updateHUD() {
    this.healthBar.style.width = `${this.health}%`

    if (this.health < 25) {
      this.healthBar.classList.add('critical')
      this.healthBar.classList.remove('warning')
    } else if (this.health < 50) {
      this.healthBar.classList.add('warning')
      this.healthBar.classList.remove('critical')
    } else {
      this.healthBar.classList.remove('critical', 'warning')
    }

    this.scoreDisplay.textContent = this.score.toLocaleString()

    if (this.combo > 1) {
      this.comboDisplay.textContent = `x${this.combo.toFixed(1)}`
      this.comboDisplay.classList.remove('hidden')
    } else {
      this.comboDisplay.classList.add('hidden')
    }
  }

  private gameLoop() {
    if (!this.isRunning) return

    const delta = Math.min(this.clock.getDelta(), 0.1) // Cap delta to prevent large jumps
    const input = this.inputManager.getState()
    const mouseDelta = this.inputManager.getMouseDelta()

    // Handle mount switching
    if (input.switchMount !== null) {
      this.switchMount(input.switchMount)
    }

    // Update current mount
    const mount = this.getCurrentMount()
    const wasPerformingTrick = mount.isPerformingTrick

    mount.update(delta, input, mouseDelta)

    // Check if trick just completed
    if (wasPerformingTrick && !mount.isPerformingTrick) {
      this.awardTrickPoints('Flip', 100)
    }

    // Check for bridge zone (auto-flip)
    if (this.checkBridgeZone() && !mount.isPerformingTrick) {
      this.triggerTrick('flip')
    }

    // Manual somersault
    if (input.trick && !mount.isPerformingTrick && !this.checkBridgeZone()) {
      this.triggerTrick('somersault')
    }

    // Handle firing
    this.combatSystem.playerFire(mount, input.fire)

    // Update combat system
    this.combatSystem.update(delta, this.dragons, mount)

    // Update dragons
    this.dragons.forEach(dragon => {
      dragon.update(delta)
      // Make dragons face player
      dragon.lookAt(mount.position)
    })

    // Update camera
    this.cameraController.update(delta)

    // Update combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= delta
      if (this.comboTimer <= 0) {
        this.combo = 1
        this.updateHUD()
      }
    }

    // Reset one-time inputs
    this.inputManager.resetOneTimeInputs()

    // Render
    this.sceneManager.render()

    requestAnimationFrame(() => this.gameLoop())
  }
}
