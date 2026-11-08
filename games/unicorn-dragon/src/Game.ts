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
  /** Bumped on every restart so stale respawn timers from the last run do nothing. */
  private runId = 0
  private nearestDragonDist: number | null = null
  /** performance.now() when the game-over card appeared (guards accidental taps). */
  private gameOverAt = 0
  /** On-screen marker that points at the nearest dragon. */
  private dragonPointer: HTMLElement
  private pointerVec = new THREE.Vector3()

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
    this.dragonPointer = document.getElementById('dragon-pointer')!
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

    const restartBtn = document.getElementById('restart-btn')!
    restartBtn.addEventListener('click', e => {
      e.stopPropagation()
      this.restart()
    })
    // Enter / Space restarts from the game-over card too.
    window.addEventListener('keydown', e => {
      if (this.isRunning || !this.ready) return
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault()
        this.restart()
      }
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
        // Killing a dragon patches you up. Now that dragons fight back, this
        // is the only way to recover — without it a long run always ends in
        // an unwinnable slide toward game over.
        this.health = Math.min(100, this.health + 20)
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
        const run = this.runId
        setTimeout(() => {
          if (run === this.runId) this.spawnSingleDragon()
        }, 3000)
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
    // Spawn 3 dragons. The first patrols just ahead of the start, near
    // flight height, so there is something to shoot within seconds.
    const positions = [
      new THREE.Vector3(-6, 36, 100),
      new THREE.Vector3(-60, 45, 130),
      new THREE.Vector3(70, 38, 110)
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

    dragon.setAnchor(this.pointAheadOfPlayer())

    this.dragons.push(dragon)
    this.sceneManager.scene.add(dragon)
    this.audio.roar()
  }

  /**
   * A spot ahead of the player (within ~50° of their heading) at a
   * comfortable distance, so new dragons appear where they will be seen.
   */
  private pointAheadOfPlayer(): THREE.Vector3 {
    const mount = this.getCurrentMount()
    const angle = mount.rotation.y + (Math.random() - 0.5) * 1.7
    const distance = 60 + Math.random() * 30
    return new THREE.Vector3(
      mount.position.x + Math.sin(angle) * distance,
      THREE.MathUtils.clamp(mount.position.y + (Math.random() - 0.4) * 16, 18, 60),
      mount.position.z + Math.cos(angle) * distance
    )
  }

  /** Start a fresh run in place (no page reload). */
  restart() {
    if (this.isRunning) return
    // Ignore taps in the first moment so a kid mashing FIRE can't skip the card.
    if (performance.now() - this.gameOverAt < 700) return
    this.runId++

    this.health = 100
    this.score = 0
    this.combo = 1
    this.comboTimer = 0
    this.tricksLanded = 0
    this.dragonsDefeated = 0
    this.ribbonTimer = 0

    this.combatSystem.clearAllProjectiles()
    this.dragons.forEach(d => this.sceneManager.scene.remove(d))
    this.dragons = []

    for (const mount of this.mounts) {
      mount.position.set(0, 30, 0)
      mount.rotation.set(0, 0, 0)
      mount.velocity.set(0, 0, 0)
      mount.isPerformingTrick = false
      mount.lastCompletedTrick = null
    }
    const mount = this.getCurrentMount()
    mount.updateMatrixWorld()
    this.cameraController.snap()

    this.spawnDragons()
    this.gameOverPanel.classList.add('hidden')
    this.updateHUD()

    this.isRunning = true
    this.clock.getDelta() // drop the time spent on the game-over card
    this.gameLoop()
  }

  /**
   * Point at the nearest living dragon: a ring around it when it's on
   * screen, an edge arrow (with a dragon icon) when it's off screen.
   */
  private updateDragonPointer(nearest: Dragon | null) {
    const el = this.dragonPointer
    if (!nearest) {
      el.className = 'hidden'
      return
    }
    const camera = this.sceneManager.camera
    const p = this.pointerVec.copy(nearest.position).project(camera)
    const behind = p.z > 1
    let x = p.x
    let y = p.y
    if (behind) {
      x = -x
      y = -y
    }
    const w = window.innerWidth
    const h = window.innerHeight
    const onScreen = !behind && Math.abs(x) < 0.9 && Math.abs(y) < 0.85
    if (onScreen) {
      el.className = 'ring'
      el.style.transform = `translate(${((x + 1) / 2) * w}px, ${((1 - y) / 2) * h}px)`
      return
    }
    // Push the direction out to an ellipse inside the screen edges.
    let ang = Math.atan2(y * h, x * w)
    if (behind && Math.abs(x) < 0.01 && Math.abs(y) < 0.01) ang = -Math.PI / 2
    const rx = w / 2 - 70
    const ry = h / 2 - 90
    const px = w / 2 + Math.cos(ang) * rx
    const py = h / 2 - Math.sin(ang) * ry
    el.className = 'arrow'
    el.style.transform = `translate(${px}px, ${py}px)`
    el.style.setProperty('--rot', `${-ang}rad`)
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
    this.gameOverAt = performance.now()
    this.dragonPointer.className = 'hidden'
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
      kills: this.dragonsDefeated,
      state: !this.ready ? 'loading' : this.isRunning ? 'playing' : 'gameover',
      nearestDragonDist: this.nearestDragonDist,
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

    // Handle firing (auto-aims at a dragon roughly ahead)
    if (this.combatSystem.playerFire(mount, input.fire, this.dragons)) {
      this.audio.shoot()
    }

    // Update combat system
    this.combatSystem.update(delta, this.dragons, mount)

    // Update dragons; retire the ones that have finished falling.
    let nearest: Dragon | null = null
    let nearestDist = Infinity
    const heading = this.tmpVec.set(Math.sin(mount.rotation.y), 0, Math.cos(mount.rotation.y))
    this.dragons = this.dragons.filter(dragon => {
      dragon.update(delta)
      if (dragon.isDead) {
        if (dragon.isFallFinished()) {
          this.sceneManager.scene.remove(dragon)
          return false
        }
        return true
      }
      // A dragon left behind (out of sight, behind the camera) is moved up
      // ahead again, so a kid who just flies straight on keeps meeting them.
      const dist = dragon.position.distanceTo(mount.position)
      if (dist > 90) {
        const toDragonX = dragon.position.x - mount.position.x
        const toDragonZ = dragon.position.z - mount.position.z
        if (toDragonX * heading.x + toDragonZ * heading.z < 0) {
          dragon.setAnchor(this.pointAheadOfPlayer())
        }
      }
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = dragon
      }

      // Living dragons patrol slowly and track the player with the head.
      dragon.updateFlight(delta, mount.position)

      // ...and breathe at the player once they're close and in the head's arc.
      const action = dragon.tryAttack(delta, mount.position)
      if (action?.kind === 'windup') {
        this.audio.roar()
      } else if (action?.kind === 'fire') {
        this.combatSystem.enemyFire(action.position, action.direction, dragon.getBreathConfig())
        this.effects.burst(action.position.clone(), [dragon.config.glowColor, 0xffffff], 16, 11, 0.45, 0.4)
      }
      return true
    })

    this.nearestDragonDist = nearest ? Math.round(nearestDist) : null

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

    this.updateDragonPointer(nearest)

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
