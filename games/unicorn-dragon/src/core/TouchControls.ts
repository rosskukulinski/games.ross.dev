import { InputManager } from './InputManager'

/**
 * Virtual joystick (left) + action buttons (right) for tablets/phones.
 * Only shown on coarse-pointer devices. Writes into InputManager.touch;
 * all keyboard/mouse input keeps working alongside.
 */
export class TouchControls {
  readonly enabled: boolean

  constructor(input: InputManager) {
    this.enabled = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
    const root = document.getElementById('touch-controls')
    if (!root) return
    if (!this.enabled) {
      root.style.display = 'none'
      return
    }
    root.style.display = 'block'

    // --- Joystick -----------------------------------------------------
    const zone = document.getElementById('joystick-zone')!
    const knob = document.getElementById('joystick-knob')!
    let joyId: number | null = null
    let cx = 0
    let cy = 0
    const RANGE = 44

    const applyJoy = (dx: number, dy: number) => {
      const len = Math.hypot(dx, dy)
      if (len > RANGE) {
        dx = (dx / len) * RANGE
        dy = (dy / len) * RANGE
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`
      const nx = dx / RANGE
      const ny = dy / RANGE
      input.touch.turnLeft = nx < -0.3
      input.touch.turnRight = nx > 0.3
      input.touch.accelerate = ny < -0.25
      input.touch.brake = ny > 0.45
    }
    const resetJoy = () => {
      joyId = null
      knob.style.transform = 'translate(0px, 0px)'
      input.touch.turnLeft = false
      input.touch.turnRight = false
      input.touch.accelerate = false
      input.touch.brake = false
    }

    zone.addEventListener('touchstart', e => {
      e.preventDefault()
      const t = e.changedTouches[0]
      joyId = t.identifier
      const rect = zone.getBoundingClientRect()
      cx = rect.left + rect.width / 2
      cy = rect.top + rect.height / 2
      applyJoy(t.clientX - cx, t.clientY - cy)
    }, { passive: false })
    zone.addEventListener('touchmove', e => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === joyId) applyJoy(t.clientX - cx, t.clientY - cy)
      }
    }, { passive: false })
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === joyId) resetJoy()
      }
    }
    zone.addEventListener('touchend', end)
    zone.addEventListener('touchcancel', end)

    // --- Buttons ------------------------------------------------------
    const bind = (id: string, down: () => void, up: () => void) => {
      const el = document.getElementById(id)!
      el.addEventListener('touchstart', e => {
        e.preventDefault()
        el.classList.add('pressed')
        down()
      }, { passive: false })
      const release = (e: Event) => {
        e.preventDefault()
        el.classList.remove('pressed')
        up()
      }
      el.addEventListener('touchend', release)
      el.addEventListener('touchcancel', release)
    }

    bind('btn-fire', () => { input.touch.fire = true }, () => { input.touch.fire = false })
    bind('btn-trick', () => { input.touch.trick = true }, () => { input.touch.trick = false })
    bind('btn-up', () => { input.touch.pitchUp = true }, () => { input.touch.pitchUp = false })
    bind('btn-down', () => { input.touch.pitchDown = true }, () => { input.touch.pitchDown = false })

    // Mount slots become tappable on touch devices.
    document.querySelectorAll('.mount-slot').forEach((slot, i) => {
      slot.addEventListener('touchstart', e => {
        e.preventDefault()
        input.touch.switchMount = i + 1
      }, { passive: false })
    })
  }
}
