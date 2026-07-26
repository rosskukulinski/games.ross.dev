import * as THREE from 'three'

let sparkTexture: THREE.Texture | null = null

/**
 * Soft round particle sprite. Without this every THREE.Points draws as a
 * hard square, which reads as "programmer art" at gameplay distance.
 */
export function getSparkTexture(): THREE.Texture {
  if (sparkTexture) return sparkTexture
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.3, 'rgba(255,255,255,0.75)')
  grad.addColorStop(0.7, 'rgba(255,255,255,0.18)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  sparkTexture = new THREE.CanvasTexture(canvas)
  return sparkTexture
}
