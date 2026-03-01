import * as THREE from 'three'

export class CameraController {
  camera: THREE.PerspectiveCamera
  target: THREE.Object3D | null = null
  offset = new THREE.Vector3(0, 5, -15)
  smoothness = 0.08
  lookAheadDistance = 5

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
  }

  setTarget(target: THREE.Object3D) {
    this.target = target
  }

  update(_delta: number) {
    if (!this.target) return

    // Calculate desired camera position behind and above target
    const targetPosition = this.target.position.clone()

    // Rotate offset by target's rotation (but only yaw, not pitch/roll)
    const yawQuat = new THREE.Quaternion()
    yawQuat.setFromEuler(new THREE.Euler(0, this.target.rotation.y, 0))

    const offsetRotated = this.offset.clone().applyQuaternion(yawQuat)
    const desiredPosition = targetPosition.clone().add(offsetRotated)

    // Smooth interpolation
    this.camera.position.lerp(desiredPosition, this.smoothness)

    // Look at a point slightly ahead of the target
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.target.quaternion)
    const lookAtPoint = targetPosition.clone().add(forward.multiplyScalar(this.lookAheadDistance))

    // Smooth look-at
    const currentLookAt = new THREE.Vector3()
    this.camera.getWorldDirection(currentLookAt)
    currentLookAt.add(this.camera.position)

    currentLookAt.lerp(lookAtPoint, this.smoothness * 2)
    this.camera.lookAt(lookAtPoint)
  }
}
