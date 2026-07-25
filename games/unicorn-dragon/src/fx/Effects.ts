import * as THREE from 'three'
import { getSparkTexture } from './textures'

interface Burst {
  points: THREE.Points
  velocities: THREE.Vector3[]
  life: number
  maxLife: number
  gravity: number
}

/**
 * Central pool for one-shot particle bursts and ribbon trails.
 * Everything is updated from the main game loop (no rAF side-loops).
 */
export class Effects {
  private scene: THREE.Scene
  private bursts: Burst[] = []
  private ribbons: Ribbon[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  /** Radial particle burst. Colors may be a single hex or a list (rainbow). */
  burst(
    position: THREE.Vector3,
    colors: number | number[],
    count = 24,
    speed = 18,
    life = 0.7,
    size = 0.6,
    gravity = 0
  ) {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colorArr = new Float32Array(count * 3)
    const velocities: THREE.Vector3[] = []
    const palette = Array.isArray(colors) ? colors : [colors]
    const c = new THREE.Color()

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x
      positions[i * 3 + 1] = position.y
      positions[i * 3 + 2] = position.z
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize()
      velocities.push(dir.multiplyScalar(speed * (0.4 + Math.random() * 0.6)))
      c.setHex(palette[i % palette.length])
      colorArr[i * 3] = c.r
      colorArr[i * 3 + 1] = c.g
      colorArr[i * 3 + 2] = c.b
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArr, 3))

    const material = new THREE.PointsMaterial({
      size,
      map: getSparkTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const points = new THREE.Points(geometry, material)
    this.scene.add(points)
    this.bursts.push({ points, velocities, life, maxLife: life, gravity })
  }

  /** Create a managed ribbon trail; caller feeds it head positions. */
  createRibbon(colors: number[], width: number, segments = 26): Ribbon {
    const ribbon = new Ribbon(colors, width, segments)
    this.scene.add(ribbon.mesh)
    this.ribbons.push(ribbon)
    return ribbon
  }

  removeRibbon(ribbon: Ribbon) {
    this.scene.remove(ribbon.mesh)
    ribbon.dispose()
    this.ribbons = this.ribbons.filter(r => r !== ribbon)
  }

  update(delta: number) {
    this.bursts = this.bursts.filter(b => {
      b.life -= delta
      if (b.life <= 0) {
        this.scene.remove(b.points)
        b.points.geometry.dispose()
        ;(b.points.material as THREE.Material).dispose()
        return false
      }
      const pos = b.points.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < b.velocities.length; i++) {
        const v = b.velocities[i]
        v.y -= b.gravity * delta
        pos[i * 3] += v.x * delta
        pos[i * 3 + 1] += v.y * delta
        pos[i * 3 + 2] += v.z * delta
      }
      b.points.geometry.attributes.position.needsUpdate = true
      ;(b.points.material as THREE.PointsMaterial).opacity = b.life / b.maxLife
      return true
    })

    for (const ribbon of this.ribbons) ribbon.update(delta)
  }
}

/**
 * Camera-cheap ribbon trail: a horizontal triangle strip following a
 * history of head positions, vertex-colored (rainbow-capable), additive.
 */
export class Ribbon {
  mesh: THREE.Mesh
  opacity = 0
  private history: THREE.Vector3[] = []
  private segments: number
  private width: number
  private geometry: THREE.BufferGeometry
  private material: THREE.MeshBasicMaterial

  constructor(colors: number[], width: number, segments: number) {
    this.segments = segments
    this.width = width
    this.geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(segments * 2 * 3)
    const colorArr = new Float32Array(segments * 2 * 3)
    const c = new THREE.Color()
    for (let i = 0; i < segments; i++) {
      const t = i / (segments - 1)
      const idx = Math.min(Math.floor(t * colors.length), colors.length - 1)
      c.setHex(colors[idx])
      for (let s = 0; s < 2; s++) {
        colorArr[(i * 2 + s) * 3] = c.r
        colorArr[(i * 2 + s) * 3 + 1] = c.g
        colorArr[(i * 2 + s) * 3 + 2] = c.b
      }
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colorArr, 3))

    const indices: number[] = []
    for (let i = 0; i < segments - 1; i++) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    this.geometry.setIndex(indices)

    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.frustumCulled = false
  }

  /** Push the current head position (world space). */
  push(position: THREE.Vector3) {
    // A big jump means a teleport (or a stalled tab): restart the trail
    // instead of stretching one enormous quad across the world.
    const previous = this.history[0]
    if (previous) {
      const d2 = previous.distanceToSquared(position)
      // Teleport (or a stalled tab): restart instead of stretching one
      // enormous quad across the world.
      if (d2 > 400) this.history.length = 0
      // Sample by distance, not by frame, so the streak has the same
      // world-space length at 30fps and at 144fps.
      else if (d2 < 0.09) return
    }
    this.history.unshift(position.clone())
    if (this.history.length > this.segments) this.history.pop()
    this.rebuild()
  }

  fadeTo(opacity: number) {
    this.opacity = opacity
  }

  private rebuild() {
    const pos = this.geometry.attributes.position.array as Float32Array
    const up = new THREE.Vector3(0, 1, 0)
    const dir = new THREE.Vector3()
    const side = new THREE.Vector3()
    for (let i = 0; i < this.segments; i++) {
      const p = this.history[Math.min(i, this.history.length - 1)] ?? new THREE.Vector3()
      const q = this.history[Math.min(i + 1, this.history.length - 1)] ?? p
      dir.subVectors(p, q)
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1)
      side.crossVectors(dir, up).normalize()
      const w = this.width * (1 - i / this.segments)
      pos[(i * 2) * 3] = p.x + side.x * w
      pos[(i * 2) * 3 + 1] = p.y + w * 0.15
      pos[(i * 2) * 3 + 2] = p.z + side.z * w
      pos[(i * 2 + 1) * 3] = p.x - side.x * w
      pos[(i * 2 + 1) * 3 + 1] = p.y - w * 0.15
      pos[(i * 2 + 1) * 3 + 2] = p.z - side.z * w
    }
    this.geometry.attributes.position.needsUpdate = true
  }

  update(delta: number) {
    this.material.opacity = THREE.MathUtils.lerp(this.material.opacity, this.opacity, delta * 6)
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}

/** 2D canvas overlay drawing radial speed lines at high velocity. */
export class SpeedLines {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private lines: { angle: number; dist: number; len: number; speed: number }[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    for (let i = 0; i < 26; i++) {
      this.lines.push({
        angle: Math.random() * Math.PI * 2,
        dist: 0.35 + Math.random() * 0.5,
        len: 0.1 + Math.random() * 0.22,
        speed: 0.6 + Math.random() * 1.4,
      })
    }
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', resize)
    resize()
  }

  /** intensity 0..1 — 0 clears the canvas. */
  render(intensity: number, delta: number) {
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (intensity <= 0.01) return
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const radius = Math.hypot(cx, cy)
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * intensity})`
    ctx.lineWidth = 2
    for (const line of this.lines) {
      line.dist += line.speed * delta * (0.5 + intensity)
      if (line.dist > 1) {
        line.dist = 0.3 + Math.random() * 0.2
        line.angle = Math.random() * Math.PI * 2
      }
      const r0 = line.dist * radius
      const r1 = Math.min((line.dist + line.len * intensity) * radius, radius)
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(line.angle) * r0, cy + Math.sin(line.angle) * r0)
      ctx.lineTo(cx + Math.cos(line.angle) * r1, cy + Math.sin(line.angle) * r1)
      ctx.stroke()
    }
  }
}
