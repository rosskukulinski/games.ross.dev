import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { PALETTE } from '../core/SceneManager'

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

/** Non-indexed copy with per-facet vertex colors (robot-rally style). */
function paintFacets(
  src: THREE.BufferGeometry,
  colorOf: (cx: number, cy: number, cz: number) => THREE.Color,
  jitter = 0.05
): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src
  g.deleteAttribute('uv')
  const pos = g.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  for (let f = 0; f < pos.count; f += 3) {
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3
    const cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3
    const c = colorOf(cx, cy, cz).clone()
    const j = 1 + (Math.random() - 0.5) * 2 * jitter
    c.r = THREE.MathUtils.clamp(c.r * j, 0, 1)
    c.g = THREE.MathUtils.clamp(c.g * j, 0, 1)
    c.b = THREE.MathUtils.clamp(c.b * j, 0, 1)
    for (let v = 0; v < 3; v++) {
      colors[(f + v) * 3] = c.r
      colors[(f + v) * 3 + 1] = c.g
      colors[(f + v) * 3 + 2] = c.b
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

function solid(src: THREE.BufferGeometry, hex: number, jitter = 0.05, matrix?: THREE.Matrix4) {
  const base = new THREE.Color(hex)
  const g = paintFacets(src, () => base, jitter)
  if (matrix) g.applyMatrix4(matrix)
  return g
}

const mat4 = (
  px: number,
  py: number,
  pz: number,
  sx = 1,
  sy = 1,
  sz = 1,
  ry = 0,
  rx = 0,
  rz = 0
) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(px, py, pz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  )

/**
 * Builds the static world: sea-of-clouds floor, floating islands with
 * vegetation (merged flat-shaded vertex-colored geometry) and the fantasy
 * stone bridge used for the flip trick. The trick zone stays exactly where
 * v1 had it (x -12..12, z 70..90, under y 33).
 */
export class World {
  group = new THREE.Group()
  private torchFlames: THREE.Mesh[] = []
  private flags: THREE.Mesh[] = []
  private time = 0

  constructor(scene: THREE.Scene) {
    this.addCloudSea()
    this.addIslands()
    this.addBridge()
    scene.add(this.group)
  }

  /** Soft pastel "floor" far below: a big disc plus scattered puffs. */
  private addCloudSea() {
    const sea = new THREE.Mesh(
      new THREE.CircleGeometry(1200, 48),
      new THREE.MeshStandardMaterial({ color: PALETTE.cloudShade, roughness: 1 })
    )
    sea.rotation.x = -Math.PI / 2
    sea.position.y = -6
    sea.receiveShadow = true
    this.group.add(sea)

    // Rolling puffs poking out of the sea to give depth when diving low.
    const puffGeoms: THREE.BufferGeometry[] = []
    for (let i = 0; i < 90; i++) {
      const r = rand(6, 22)
      const geometry = new THREE.IcosahedronGeometry(r, 1)
      geometry.applyMatrix4(
        mat4(rand(-650, 650), -6 + rand(-2, 3), rand(-650, 650), 1, rand(0.3, 0.5), 1)
      )
      puffGeoms.push(solid(geometry, Math.random() < 0.7 ? PALETTE.cloud : PALETTE.cloudShade, 0.03))
    }
    const puffs = new THREE.Mesh(
      mergeGeometries(puffGeoms),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })
    )
    puffs.receiveShadow = true
    this.group.add(puffs)
    puffGeoms.forEach(g => g.dispose())
  }

  /** One merged mesh per island: rock base, grass cap, trees, flowers. */
  private makeIsland(size: number): THREE.Mesh {
    const parts: THREE.BufferGeometry[] = []

    // Rocky underside: stretched, downward-pointing cone of facets.
    const rock = new THREE.ConeGeometry(size, size * 1.6, 9, 3)
    rock.applyMatrix4(mat4(0, -size * 0.8, 0, 1, 1, rand(0.8, 1.1), rand(0, Math.PI), Math.PI))
    parts.push(
      paintFacets(rock, (_x, y) =>
        new THREE.Color(y < -size ? PALETTE.dirtDark : PALETTE.dirt), 0.08
      )
    )

    // Grass cap: squashed dodecahedron, slightly wider than the rock.
    const cap = new THREE.DodecahedronGeometry(size * 1.05, 1)
    cap.applyMatrix4(mat4(0, size * 0.08, 0, 1, 0.32, 1))
    parts.push(
      paintFacets(cap, (_x, y) =>
        new THREE.Color(y > 0 ? PALETTE.grass : PALETTE.grassDark), 0.07
      )
    )

    // Trees.
    const treeCount = 1 + Math.floor(size / 9)
    for (let t = 0; t < treeCount; t++) {
      const a = rand(0, Math.PI * 2)
      const r = rand(0, size * 0.55)
      const tx = Math.cos(a) * r
      const tz = Math.sin(a) * r
      const baseY = size * 0.14
      const trunkH = rand(2.5, 4.5) * (size / 15)
      const trunk = new THREE.CylinderGeometry(trunkH * 0.09, trunkH * 0.14, trunkH, 5)
      trunk.applyMatrix4(mat4(tx, baseY + trunkH / 2, tz))
      parts.push(solid(trunk, PALETTE.trunk, 0.06))
      const blobs = 2 + Math.floor(Math.random() * 2)
      const leaf = pick(PALETTE.foliage)
      for (let b = 0; b < blobs; b++) {
        const fr = trunkH * rand(0.4, 0.6)
        const foliage = new THREE.IcosahedronGeometry(fr, 0)
        foliage.applyMatrix4(
          mat4(tx + rand(-fr, fr) * 0.4, baseY + trunkH + b * fr * 0.5, tz + rand(-fr, fr) * 0.4)
        )
        parts.push(solid(foliage, leaf, 0.09))
      }
    }

    // Flowers: tiny bright octahedra sprinkled on the cap.
    const flowerCount = Math.floor(size * 0.8)
    for (let f = 0; f < flowerCount; f++) {
      const a = rand(0, Math.PI * 2)
      const r = rand(0, size * 0.8)
      const flower = new THREE.OctahedronGeometry(rand(0.25, 0.5) * (size / 15), 0)
      flower.applyMatrix4(mat4(Math.cos(a) * r, size * 0.2, Math.sin(a) * r))
      parts.push(solid(flower, pick(PALETTE.flower), 0.05))
    }

    // A few hanging rock chunks under the island.
    for (let c = 0; c < 3; c++) {
      const chunk = new THREE.DodecahedronGeometry(rand(0.1, 0.2) * size, 0)
      chunk.applyMatrix4(
        mat4(rand(-0.4, 0.4) * size, -size * rand(1.5, 2.1), rand(-0.4, 0.4) * size)
      )
      parts.push(solid(chunk, PALETTE.rock, 0.08))
    }

    const merged = mergeGeometries(parts)
    parts.forEach(g => g.dispose())
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  private addIslands() {
    const spots: [number, number, number, number][] = [
      // [x, y, z, size] — original v1 positions kept, plus extras. None
      // intrude on the bridge corridor (x -12..12, z 70..90).
      [100, 20, 100, 18],
      [-80, 40, 150, 15],
      [150, 60, -50, 22],
      [-120, 30, -100, 17],
      [50, 50, -150, 14],
      [-190, 55, 40, 24],
      [220, 35, 90, 16],
      [0, 26, -240, 26],
      [-60, 70, 260, 15],
      [160, 80, 210, 12],
      [-260, 45, -180, 20],
    ]
    for (const [x, y, z, size] of spots) {
      const island = this.makeIsland(size)
      island.position.set(x, y, z)
      island.rotation.y = rand(0, Math.PI * 2)
      this.group.add(island)
    }
  }

  /** Fantasy stone bridge across the flight path at z=80 (trick zone). */
  private addBridge() {
    const parts: THREE.BufferGeometry[] = []
    const stoneOf = (y: number) =>
      new THREE.Color(y > 33 ? PALETTE.stone : PALETTE.stoneDark)

    // Two chunky towers at x = ±17.
    for (const side of [-1, 1]) {
      const x = side * 17
      const tower = new THREE.CylinderGeometry(3.4, 4.6, 42, 8)
      tower.applyMatrix4(mat4(x, 21, 80))
      parts.push(paintFacets(tower, (_cx, cy) => stoneOf(cy), 0.06))

      // Crown ring + crenellations.
      const crown = new THREE.CylinderGeometry(4.2, 4.2, 2.2, 8)
      crown.applyMatrix4(mat4(x, 43, 80))
      parts.push(solid(crown, PALETTE.stone, 0.06))
      for (let c = 0; c < 6; c++) {
        const a = (c / 6) * Math.PI * 2
        const merlon = new THREE.BoxGeometry(1.4, 1.6, 1.4)
        merlon.applyMatrix4(mat4(x + Math.cos(a) * 3.6, 45, 80 + Math.sin(a) * 3.6, 1, 1, 1, -a))
        parts.push(solid(merlon, PALETTE.stone, 0.06))
      }

      // Conical fairy-tale roof.
      const roof = new THREE.ConeGeometry(4.6, 7, 8)
      roof.applyMatrix4(mat4(x, 49.5, 80))
      parts.push(solid(roof, 0x8f6fd8, 0.06))
    }

    // Stone arch between the towers (fly under it!). The default torus
    // lies in the XY plane, which already spans x = -15..15 with the
    // opening downwards — no extra rotation needed.
    const arch = new THREE.TorusGeometry(15, 2.6, 8, 20, Math.PI)
    arch.applyMatrix4(mat4(0, 21, 80, 1, 1, 1.6))
    parts.push(paintFacets(arch, (_cx, cy) => stoneOf(cy + 12), 0.07))

    // Deck with cobblestone-ish facets and side walls.
    const deck = new THREE.BoxGeometry(44, 2.4, 9)
    deck.applyMatrix4(mat4(0, 36, 80))
    parts.push(paintFacets(deck, () => new THREE.Color(PALETTE.stone), 0.09))
    for (const side of [-1, 1]) {
      const wall = new THREE.BoxGeometry(44, 1.6, 0.9)
      wall.applyMatrix4(mat4(0, 38, 80 + side * 4.2))
      parts.push(solid(wall, PALETTE.stoneDark, 0.08))
    }

    const merged = mergeGeometries(parts)
    parts.forEach(g => g.dispose())
    const bridge = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 })
    )
    bridge.castShadow = true
    bridge.receiveShadow = true
    this.group.add(bridge)

    // Torch flames on the towers: HDR emissive cones that flicker (bloom).
    const flameMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffa030).multiplyScalar(3.2),
      toneMapped: true,
    })
    for (const side of [-1, 1]) {
      for (const off of [-1, 1]) {
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), flameMaterial)
        flame.position.set(side * 17 + off * 3, 39.5, 80 + off * 2)
        this.group.add(flame)
        this.torchFlames.push(flame)
      }
    }

    // Pennant flags strung between the towers.
    const flagColors = [0xff8fc4, 0xffd166, 0x9be8ff, 0xc3a3ff, 0x9df0a8]
    for (let i = 0; i < 9; i++) {
      const t = i / 8
      const x = -14 + t * 28
      const sag = Math.sin(t * Math.PI) * 2.4
      const flag = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, 1.6, 3),
        new THREE.MeshStandardMaterial({
          color: flagColors[i % flagColors.length],
          roughness: 0.8,
          side: THREE.DoubleSide,
        })
      )
      flag.position.set(x, 41.5 - sag, 80)
      flag.rotation.x = Math.PI
      this.group.add(flag)
      this.flags.push(flag)
    }
  }

  update(delta: number) {
    this.time += delta
    for (let i = 0; i < this.torchFlames.length; i++) {
      const flicker = 1 + Math.sin(this.time * 13 + i * 2.4) * 0.18 + Math.sin(this.time * 29 + i) * 0.1
      this.torchFlames[i].scale.set(flicker, 1 / flicker + 0.3, flicker)
    }
    for (let i = 0; i < this.flags.length; i++) {
      this.flags[i].rotation.z = Math.sin(this.time * 3 + i * 0.9) * 0.25
    }
  }
}
