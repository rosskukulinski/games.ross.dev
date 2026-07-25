import * as THREE from 'three'

/**
 * Third-person follow camera. Adds a speed/dive FOV kick and a decaying
 * shake impulse on top of the v1 smoothing behaviour.
 */
export class CameraController {
  camera: THREE.PerspectiveCamera
  target: THREE.Object3D | null = null
  offset = new THREE.Vector3(0, 5, -15)
  smoothness = 0.08
  lookAheadDistance = 5
  /** Set each frame by Game: 0..1 flight speed fraction. */
  speedRatio = 0

  private baseFov: number
  private currentFov: number
  private shake = 0

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
    this.baseFov = camera.fov
    this.currentFov = camera.fov
  }

  setTarget(target: THREE.Object3D) {
    this.target = target
  }

  /** Jump the camera straight to its follow pose (no smoothing). */
  snap() {
    if (!this.target) return
    const yawQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, this.target.rotation.y, 0)
    )
    this.camera.position
      .copy(this.target.position)
      .add(this.offset.clone().applyQuaternion(yawQuat))
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.target.quaternion)
    this.camera.lookAt(
      this.target.position.clone().add(forward.multiplyScalar(this.lookAheadDistance))
    )
  }

  /** Add a shake impulse (0..1). */
  addShake(amount: number) {
    this.shake = Math.min(this.shake + amount, 1)
  }

  update(delta: number) {
    if (!this.target) return

    // Calculate desired camera position behind and above target
    const targetPosition = this.target.position.clone()

    // Rotate offset by target's rotation (but only yaw, not pitch/roll)
    const yawQuat = new THREE.Quaternion()
    yawQuat.setFromEuler(new THREE.Euler(0, this.target.rotation.y, 0))

    // Pull the camera back a touch at speed for a sense of rush.
    const offset = this.offset.clone()
    offset.z -= this.speedRatio * 2.5
    const offsetRotated = offset.applyQuaternion(yawQuat)
    const desiredPosition = targetPosition.clone().add(offsetRotated)

    // Smooth interpolation
    this.camera.position.lerp(desiredPosition, this.smoothness)

    // Look at a point slightly ahead of the target
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.target.quaternion)
    const lookAtPoint = targetPosition.clone().add(forward.multiplyScalar(this.lookAheadDistance))
    this.camera.lookAt(lookAtPoint)

    // FOV kick: faster + diving = wider.
    const diving = Math.max(0, -forward.y)
    const targetFov = this.baseFov + this.speedRatio * 12 + diving * 6
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, targetFov, 0.06)
    if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
      this.camera.fov = this.currentFov
      this.camera.updateProjectionMatrix()
    }

    // Decaying shake applied after the lookAt so it reads as a jolt.
    if (this.shake > 0.001) {
      const s = this.shake * 0.9
      this.camera.position.x += (Math.random() - 0.5) * s
      this.camera.position.y += (Math.random() - 0.5) * s
      this.camera.rotateZ((Math.random() - 0.5) * this.shake * 0.05)
      this.shake = Math.max(0, this.shake - delta * 2.4)
    }
  }
}
