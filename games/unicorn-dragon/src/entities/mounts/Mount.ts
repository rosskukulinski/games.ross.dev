import * as THREE from 'three'
import { InputState } from '../../core/InputManager'

export interface MountConfig {
  name: string
  maxSpeed: number
  acceleration: number
  turnSpeed: number
  movementType: 'fly' | 'float'
  color: number
}

export abstract class Mount extends THREE.Group {
  config: MountConfig
  velocity = new THREE.Vector3()
  isPerformingTrick = false
  protected trickProgress = 0
  protected trickType: string | null = null

  constructor(config: MountConfig) {
    super()
    this.config = config
  }

  abstract update(delta: number, input: InputState, mouseDelta: { x: number; y: number }): void

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
      this.isPerformingTrick = false
      this.trickType = null
      this.trickProgress = 0
      return true // Trick completed
    }
    return false
  }
}
