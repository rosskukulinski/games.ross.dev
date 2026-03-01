export interface InputState {
  accelerate: boolean
  brake: boolean
  turnLeft: boolean
  turnRight: boolean
  pitchUp: boolean
  pitchDown: boolean
  fire: boolean
  trick: boolean
  switchMount: number | null
}

export class InputManager {
  private state: InputState
  private mousePosition = { x: 0, y: 0 }
  private mouseDelta = { x: 0, y: 0 }
  private isPointerLocked = false

  constructor() {
    this.state = this.getDefaultState()

    window.addEventListener('keydown', this.onKeyDown.bind(this))
    window.addEventListener('keyup', this.onKeyUp.bind(this))
    window.addEventListener('mousemove', this.onMouseMove.bind(this))
    window.addEventListener('mousedown', this.onMouseDown.bind(this))
    window.addEventListener('mouseup', this.onMouseUp.bind(this))
    window.addEventListener('click', this.requestPointerLock.bind(this))
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this))
  }

  private getDefaultState(): InputState {
    return {
      accelerate: false,
      brake: false,
      turnLeft: false,
      turnRight: false,
      pitchUp: false,
      pitchDown: false,
      fire: false,
      trick: false,
      switchMount: null
    }
  }

  private requestPointerLock() {
    if (!this.isPointerLocked) {
      document.body.requestPointerLock()
    }
  }

  private onPointerLockChange() {
    this.isPointerLocked = document.pointerLockElement === document.body
  }

  private onKeyDown(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.accelerate = true
        break
      case 'KeyS':
      case 'ArrowDown':
        this.state.brake = true
        break
      case 'KeyA':
      case 'ArrowLeft':
        this.state.turnLeft = true
        break
      case 'KeyD':
      case 'ArrowRight':
        this.state.turnRight = true
        break
      case 'Space':
        this.state.pitchUp = true
        break
      case 'ControlLeft':
      case 'ControlRight':
        this.state.pitchDown = true
        break
      case 'KeyQ':
        this.state.trick = true
        break
      case 'Digit1':
        this.state.switchMount = 1
        break
      case 'Digit2':
        this.state.switchMount = 2
        break
      case 'Digit3':
        this.state.switchMount = 3
        break
      case 'Digit4':
        this.state.switchMount = 4
        break
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.accelerate = false
        break
      case 'KeyS':
      case 'ArrowDown':
        this.state.brake = false
        break
      case 'KeyA':
      case 'ArrowLeft':
        this.state.turnLeft = false
        break
      case 'KeyD':
      case 'ArrowRight':
        this.state.turnRight = false
        break
      case 'Space':
        this.state.pitchUp = false
        break
      case 'ControlLeft':
      case 'ControlRight':
        this.state.pitchDown = false
        break
      case 'KeyQ':
        this.state.trick = false
        break
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (this.isPointerLocked) {
      this.mouseDelta.x = e.movementX
      this.mouseDelta.y = e.movementY
    }
    this.mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1
    this.mousePosition.y = -(e.clientY / window.innerHeight) * 2 + 1
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      this.state.fire = true
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (e.button === 0) {
      this.state.fire = false
    }
  }

  getState(): InputState {
    return { ...this.state }
  }

  getMouseDelta() {
    const delta = { ...this.mouseDelta }
    this.mouseDelta = { x: 0, y: 0 }
    return delta
  }

  getMousePosition() {
    return { ...this.mousePosition }
  }

  resetOneTimeInputs() {
    this.state.switchMount = null
  }
}
