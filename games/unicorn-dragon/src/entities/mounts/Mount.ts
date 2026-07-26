import * as THREE from 'three'
import { InputState } from '../../core/InputManager'

export interface MountConfig {
  name: string
  maxSpeed: number
  acceleration: number
  turnSpeed: number
  movementType: 'fly' | 'float'
  color: number
  /** Mane/tail/wing accent color. */
  accent: number
}

export abstract class Mount extends THREE.Group {
  config: MountConfig
  velocity = new THREE.Vector3()
  isPerformingTrick = false
  /** Name of the trick that just finished (read by Game, then cleared). */
  lastCompletedTrick: string | null = null
  protected trickProgress = 0
  protected trickType: string | null = null

  constructor(config: MountConfig) {
    super()
    this.config = config
  }

  abstract update(delta: number, input: InputState, mouseDelta: { x: number; y: number }): void

  /** Current speed as a 0..1 fraction of max speed. */
  getSpeedRatio(): number {
    return THREE.MathUtils.clamp(this.velocity.length() / this.config.maxSpeed, 0, 1)
  }

  /** World-space position of the tail (ribbon trail anchor). */
  getTailWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.set(0, 0.4, -1.6).applyMatrix4(this.matrixWorld)
  }

  startTrick(type: string) {
    if (this.isPerformingTrick) return false
    this.isPerformingTrick = true
    this.trickType = type
    this.trickProgress = 0
    return true
  }

  protected updateTrick(delta: number): boolean {
    if (!this.isPerformingTrick) return false

    const TRICK_DURATION = 0.8
    this.trickProgress += delta / TRICK_DURATION

    if (this.trickProgress >= 1) {
      this.lastCompletedTrick = this.trickType
      this.isPerformingTrick = false
      this.trickType = null
      this.trickProgress = 0
      return true // Trick completed
    }
    return false
  }
}
