import * as THREE from 'three'
import { SceneManager } from './core/SceneManager'
import { InputManager } from './core/InputManager'
import { CameraController } from './core/CameraController'
import { TouchControls } from './core/TouchControls'
import { GameAudio } from './core/Audio'
import { Mount } from './entities/mounts/Mount'
import { Unicorn } from './entities/mounts/Unicorn'
import { Pony } from './entities/mounts/Pony'
import { loadHorseTemplate } from './entities/mounts/HorseModel'
import { MOUNTS } from './config/mounts'
import { CombatSystem } from './systems/CombatSystem'
import { Dragon, DRAGON_TYPES } from './entities/enemies/Dragon'
import { World } from './world/World'
import { Effects, Ribbon, SpeedLines } from './fx/Effects'

const RAINBOW = [0xff5d7a, 0xffa53d, 0xffe94a, 0x5ce87a, 0x4ad9ff, 0x8f7bff, 0xef7bff]

export class Game {
  private sceneManager: SceneManager
  private inputManager: InputManager
  private cameraController: CameraController
  private combatSystem: CombatSystem
  private world: World
  private effects: Effects
  private audio: GameAudio
  private speedLines: SpeedLines
  private trickRibbon: Ribbon

  private mounts: Mount[] = []
  private currentMountIndex = 0
  private dragons: Dragon[] = []

  private clock: THREE.Clock
  private isRunning = false
  /** True once init() has finished and the loop is rendering. */
  ready = false
  /** Set when the GLB loaded successfully (exposed for smoke tests). */
  modelLoaded = false

  // HUD elements
  private healthBar: HTMLElement
  private scoreDisplay: HTMLElement
  private comboDisplay: HTMLElement
  private mountNameDisplay: HTMLElement
  private trickNotification: HTMLElement
  private mountSlots: NodeListOf<Element>
  private vignette: HTMLElement
  private muteButton: HTMLElement
  private gameOverPanel: HTMLElement
  private loadingPanel: HTMLElement | null

  // Game state
  private health = 100
  private score = 0
  private combo = 1
  private comboTimer = 0
  private tricksLanded = 0
  private dragonsDefeated = 0
  private ribbonTimer = 0
  private tmpVec = new THREE.Vector3()

  constructor() {
    this.clock = new THREE.Clock()

    // Get HUD elements
    this.healthBar = document.getElementById('health-bar')!
    this.scoreDisplay = document.getElementById('score')!
    this.comboDisplay = document.getElementById('combo')!
    this.mountNameDisplay = document.getElementById('mount-name')!
    this.trickNotification = document.getElementById('trick-notification')!
    this.mountSlots = document.querySelectorAll('.mount-slot')
    this.vignette = document.getElementById('vignette')!
    this.muteButton = document.getElementById('mute-btn')!
    this.gameOverPanel = document.getElementById('game-over')!
    this.loadingPanel = document.getElementById('loading')
  }

  async init() {
    const container = document.getElementById('game')!

    // Initialize systems
    this.sceneManager = new SceneManager(container)
    this.inputManager = new InputManager()
    this.cameraController = new CameraController(this.sceneManager.camera)
    this.audio = new GameAudio()
    this.inputManager.onGesture = () => this.audio.ensure()
    new TouchControls(this.inputManager)
    this.effects = new Effects(this.sceneManager.scene)
    this.speedLines = new SpeedLines(document.getElementById('speed-lines') as HTMLCanvasElement)

    // Load the animated horse model before building mounts.
    this.modelLoaded = await loadHorseTemplate()

    // Create mounts
    this.createMounts()

    // Initialize combat system
    this.combatSystem = new CombatSystem(this.sceneManager.scene)
    this.setupCombatCallbacks()

    // Static world: cloud sea, floating islands, fantasy bridge.
    this.world = new World(this.sceneManager.scene)

    // Rainbow ribbon that streams from the tail during tricks.
    this.trickRibbon = this.effects.createRibbon(RAINBOW, 0.42, 26)

    // Spawn some dragons to fight
    this.spawnDragons()

    this.setupUI()

    this.loadingPanel?.classList.add('hidden')

    // Start game loop
    this.isRunning = true
    this.ready = true
    this.updateHUD()
    this.gameLoop()
  }

  private setupUI() {
    this.muteButton.addEventListener('click', e => {
      e.stopPropagation()
      this.audio.ensure()
      this.audio.setMuted(!this.audio.muted)
      this.muteButton.textContent = this.audio.muted ? '🔇' : '🔊'
      this.muteButton.classList.toggle('muted', this.audio.muted)
    })

    document.getElementById('restart-btn')!.addEventListener('click', e => {
      e.stopPropagation()
      window.location.reload()
    })
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

  private setupCombatCallbacks() {
    this.combatSystem.onEnemyHit = (enemy, damage) => {
      this.audio.hit()
      const killed = enemy.takeDamage(damage)
      if (killed) {
        this.score += 500
        this.dragonsDefeated++
        this.showNotification(enemy.config.name + ' DEFEATED!', '+500')
        this.updateHUD()
        this.audio.kill()
        this.cameraController.addShake(0.35)
        // Dramatic death burst at the dragon.
        this.effects.burst(enemy.position.clone(), enemy.config.glowColor, 60, 26, 1.1, 0.9, 6)
        this.effects.burst(
          enemy.position.clone(),
          [0xffffff, enemy.config.bellyColor],
          26,
          14,
          0.8,
          0.6
        )
        // Respawn after delay (the dead dragon keeps tumbling meanwhile).
        setTimeout(() => this.spawnSingleDragon(), 3000)
      }
    }

    this.combatSystem.onPlayerHit = damage => {
      this.health = Math.max(0, this.health - damage)
      this.updateHUD()
      this.audio.playerHit()
      this.cameraController.addShake(0.5)
      this.flashVignette()
      if (this.health <= 0) {
        this.gameOver()
      }
    }

    this.combatSystem.onHitEffect = effect => {
      this.effects.burst(effect.position, [effect.color, 0xffffff], 22, 16, 0.5, 0.5)
    }
  }

  private flashVignette() {
    this.vignette.classList.remove('flash')
    // Force reflow so the animation can retrigger.
    void this.vignette.offsetWidth
    this.vignette.classList.add('flash')
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
      dragon.setAnchor(pos)
      this.dragons.push(dragon)
      this.sceneManager.scene.add(dragon)
    })
  }

  private spawnSingleDragon() {
    if (!this.isRunning) return
    const types = Object.keys(DRAGON_TYPES)
    const typeKey = types[Math.floor(Math.random() * types.length)]
    const dragon = new Dragon(DRAGON_TYPES[typeKey])

    // Random position around player
    const mount = this.getCurrentMount()
    const angle = Math.random() * Math.PI * 2
    const distance = 80 + Math.random() * 40
    dragon.setAnchor(
      new THREE.Vector3(
        mount.position.x + Math.cos(angle) * distance,
        30 + Math.random() * 40,
        mount.position.z + Math.sin(angle) * distance
      )
    )

    this.dragons.push(dragon)
    this.sceneManager.scene.add(dragon)
    this.audio.roar()
  }

  private showNotification(name: string, score: string) {
    const nameEl = this.trickNotification.querySelector('.trick-name')!
    const scoreEl = this.trickNotification.querySelector('.trick-score')!
    nameEl.textContent = name
    scoreEl.textContent = score

    this.trickNotification.classList.remove('show')
    void (this.trickNotification as HTMLElement).offsetWidth
    this.trickNotification.classList.add('show')
    setTimeout(() => {
      this.trickNotification.classList.remove('show')
    }, 1500)
  }

  private gameOver() {
    this.isRunning = false
    this.audio.gameOver()
    document.getElementById('final-score')!.textContent = this.score.toLocaleString()
    document.getElementById('final-stats')!.textContent =
      `${this.tricksLanded} tricks landed · ${this.dragonsDefeated} dragons defeated`
    this.gameOverPanel.classList.remove('hidden')
    if (document.pointerLockElement) document.exitPointerLock()
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
    this.audio.switchMount()
    this.effects.burst(
      newMount.position.clone(),
      [newMount.config.accent, 0xffffff],
      30,
      12,
      0.6,
      0.5
    )
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
    mount.startTrick(type)
  }

  private awardTrickPoints(trickName: string, basePoints: number) {
    const points = Math.floor(basePoints * this.combo)
    this.score += points
    this.tricksLanded++
    this.combo = Math.min(this.combo + 0.5, 5)
    this.comboTimer = 3

    this.showNotification(trickName.toUpperCase() + '!', '+' + points)
    this.audio.trick(this.combo)

    // Rainbow ribbon burst + sparkle explosion at the mount.
    const mount = this.getCurrentMount()
    this.effects.burst(mount.position.clone(), RAINBOW, 55, 20, 1.0, 0.55)
    this.ribbonTimer = 1.2
    this.cameraController.addShake(0.12)

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

  /** Debug/testing surface (window.__game). */
  getState() {
    const mount = this.getCurrentMount()
    return {
      ready: this.ready,
      running: this.isRunning,
      modelLoaded: this.modelLoaded,
      health: this.health,
      score: this.score,
      combo: this.combo,
      tricksLanded: this.tricksLanded,
      dragonsDefeated: this.dragonsDefeated,
      dragons: this.dragons.length,
      mountIndex: this.currentMountIndex,
      mountName: mount.config.name,
      speed: mount.velocity.length(),
      position: mount.position.toArray(),
      projectiles: this.combatSystem.getProjectileCount(),
    }
  }

  /** Debug helpers so smoke tests can drive the game deterministically. */
  debugSwitchMount(index: number) {
    this.switchMount(index)
    this.getCurrentMount().updateMatrixWorld()
    this.cameraController.snap()
  }

  debugTrick() {
    if (!this.getCurrentMount().isPerformingTrick) this.triggerTrick('somersault')
  }

  /** Move the follow camera (screenshot harness only). */
  debugCameraOffset(x: number, y: number, z: number) {
    this.cameraController.offset.set(x, y, z)
  }

  /** Teleport + aim the mount (used by the screenshot harness). */
  debugPlace(x: number, y: number, z: number, yaw: number) {
    const mount = this.getCurrentMount()
    mount.position.set(x, y, z)
    mount.rotation.set(0, yaw, 0)
    mount.velocity.set(0, 0, 0)
    mount.updateMatrixWorld()
    this.cameraController.snap()
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
      const name = mount.lastCompletedTrick === 'somersault' ? 'Somersault' : 'Flip'
      mount.lastCompletedTrick = null
      this.awardTrickPoints(name, 100)
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
    if (this.combatSystem.playerFire(mount, input.fire)) {
      this.audio.shoot()
    }

    // Update combat system
    this.combatSystem.update(delta, this.dragons, mount)

    // Update dragons; retire the ones that have finished falling.
    this.dragons = this.dragons.filter(dragon => {
      dragon.update(delta)
      if (dragon.isDead) {
        if (dragon.isFallFinished()) {
          this.sceneManager.scene.remove(dragon)
          return false
        }
        return true
      }
      // Living dragons patrol slowly and track the player with the head.
      dragon.updateFlight(delta, mount.position)
      return true
    })

    // Ribbon trail from the tail while tricking / just after.
    const speedRatio = mount.getSpeedRatio()
    if (mount.isPerformingTrick) this.ribbonTimer = Math.max(this.ribbonTimer, 0.5)
    mount.updateMatrixWorld()
    this.trickRibbon.push(mount.getTailWorldPosition(this.tmpVec))
    if (this.ribbonTimer > 0) {
      this.ribbonTimer -= delta
      this.trickRibbon.fadeTo(0.85)
    } else {
      this.trickRibbon.fadeTo(0)
    }

    // Camera + world + effects
    this.cameraController.speedRatio = speedRatio
    this.cameraController.update(delta)
    this.world.update(delta)
    this.sceneManager.update(delta)
    this.effects.update(delta)

    // Speed lines + wind audio scale with velocity.
    const rush = Math.max(0, (speedRatio - 0.55) / 0.45)
    this.speedLines.render(rush, delta)
    this.audio.setSpeed(speedRatio)

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
