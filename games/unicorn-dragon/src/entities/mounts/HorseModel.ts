import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

/**
 * Loads the three.js example Horse.glb (morph-target run cycle, vertex
 * colors) once, normalizes it (size, facing, tintable colors) and stamps
 * out per-mount instances. Falls back to a smooth procedural horse if the
 * model cannot load.
 *
 * Verified structure of Horse.glb: one mesh (POSITION/COLOR_0/TEXCOORD_0,
 * 15 morph targets), one material (metallic 0 / roughness 1, vertex-colored
 * dark brown), one animation ("horse_A_") animating morph weights only.
 * Raw size ~322 units long, ~183 tall.
 */

export interface HorseInstance {
  /** Normalized container: head faces +Z, body length ~3.4, hooves ~y=-1. */
  group: THREE.Group
  mixer: THREE.AnimationMixer | null
  action: THREE.AnimationAction | null
  material: THREE.MeshStandardMaterial
  /** Top of the skull between the ears, group-local (horn anchor). */
  headAnchor: THREE.Vector3
  /** Tail root on the croup, group-local (tail puff / ribbon anchor). */
  tailAnchor: THREE.Vector3
  /** Top of the shoulders, group-local (wing + mane-end anchor). */
  withersAnchor: THREE.Vector3
}

interface HorseTemplate {
  geometry: THREE.BufferGeometry
  clip: THREE.AnimationClip | null
  scale: number
  rotationY: number
  offsetY: number
  headAnchor: THREE.Vector3
  tailAnchor: THREE.Vector3
  withersAnchor: THREE.Vector3
}

let template: HorseTemplate | null = null

const TARGET_LENGTH = 3.4

/** Load + preprocess the GLB once. Resolves to false if the load failed. */
export async function loadHorseTemplate(): Promise<boolean> {
  if (template) return template.clip !== null
  try {
    const loader = new GLTFLoader()
    // Relative path so it works when served from a subdirectory.
    const gltf = await loader.loadAsync('./Horse.glb')
    let mesh: THREE.Mesh | null = null
    gltf.scene.traverse(obj => {
      if (!mesh && (obj as THREE.Mesh).isMesh) mesh = obj as THREE.Mesh
    })
    if (!mesh) throw new Error('No mesh in Horse.glb')
    const source = mesh as THREE.Mesh

    const geometry = source.geometry.clone()
    normalizeColors(geometry)

    // Measure the model from the BASE positions only. Note: three.js'
    // computeBoundingBox() expands the box by every morph target, which
    // for this model is ~10x the rest-pose size — using it would scale
    // the horse down to nothing.
    const pos = geometry.getAttribute('position')
    const box = new THREE.Box3()
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      box.expandByPoint(v.fromBufferAttribute(pos, i))
    }
    const length = box.max.z - box.min.z
    const scale = TARGET_LENGTH / length

    // Anatomical landmarks, read from the mesh rather than guessed:
    //  * poll     = highest vertex (top of the skull, between the ears)
    //  * tail     = rear-most vertex of the torso (ignoring stretched legs)
    //  * withers  = highest vertex near the body centre (shoulder ridge)
    const maxY = box.max.y
    const halfLength = length / 2
    let poll = new THREE.Vector3(0, -Infinity, 0)
    let tail = new THREE.Vector3(0, 0, Infinity)
    let withers = new THREE.Vector3(0, -Infinity, 0)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      if (v.y > poll.y) poll.copy(v)
      // Torso only: above the legs.
      if (v.y > maxY * 0.55 && v.z < tail.z) tail.copy(v)
      if (Math.abs(v.z) < halfLength * 0.2 && v.y > withers.y) withers.copy(v)
    }
    // The head is whichever end the poll sits at; face it toward +Z.
    const rotationY = poll.z >= 0 ? 0 : Math.PI
    const sign = poll.z >= 0 ? 1 : -1
    if (sign < 0) {
      // Mirror the landmarks into the rotated (head = +Z) frame.
      poll.z *= -1
      tail.z *= -1
      withers.z *= -1
      const swap = tail.clone()
      tail.copy(swap)
    }

    // Vertical placement: centre the body on y=0 so hooves land near -1.
    const offsetY = -((box.min.y + box.max.y) / 2) * scale - 0.1
    const toLocal = (p: THREE.Vector3) =>
      new THREE.Vector3(0, p.y * scale + offsetY, p.z * scale)

    const headAnchor = toLocal(poll)
    const tailAnchor = toLocal(tail)
    const withersAnchor = toLocal(withers)

    // Rebind the morph-weight animation to a stable node name ("horse").
    let clip: THREE.AnimationClip | null = null
    if (gltf.animations.length > 0) {
      const srcClip = gltf.animations[0]
      const tracks = srcClip.tracks.map(t => {
        const clone = t.clone()
        const prop = clone.name.split('.').pop()
        clone.name = `horse.${prop}`
        return clone
      })
      clip = new THREE.AnimationClip('run', srcClip.duration, tracks)
    }

    template = {
      geometry,
      clip,
      scale,
      rotationY,
      offsetY,
      headAnchor,
      tailAnchor,
      withersAnchor,
    }
    return true
  } catch (err) {
    console.warn('Horse.glb failed to load; using procedural fallback', err)
    template = null
    return false
  }
}

/**
 * Convert the model's brown vertex colors into a brightness mask so
 * material.color tints cleanly (white/pink/midnight variants) while the
 * darker mane/hooves/muzzle shading survives.
 */
function normalizeColors(geometry: THREE.BufferGeometry) {
  const color = geometry.getAttribute('color')
  if (!color) return
  let maxLum = 0.0001
  const lums = new Float32Array(color.count)
  for (let i = 0; i < color.count; i++) {
    const l = 0.299 * color.getX(i) + 0.587 * color.getY(i) + 0.114 * color.getZ(i)
    lums[i] = l
    if (l > maxLum) maxLum = l
  }
  const out = new Float32Array(color.count * 3)
  for (let i = 0; i < color.count; i++) {
    const norm = Math.pow(lums[i] / maxLum, 0.55)
    const v = 0.38 + 0.62 * norm
    out[i * 3] = v
    out[i * 3 + 1] = v
    out[i * 3 + 2] = v
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(out, 3))
}

/** Create a tinted instance (shared geometry, own material + mixer). */
export function createHorseInstance(tint: number): HorseInstance {
  if (template) {
    // Horse.glb ships no NORMAL attribute (glTF spec: flat shading). Our
    // own material must opt into flatShading or every face renders black.
    const material = new THREE.MeshStandardMaterial({
      color: tint,
      vertexColors: true,
      roughness: 0.75,
      metalness: 0.05,
      flatShading: true,
    })
    const mesh = new THREE.Mesh(template.geometry, material)
    mesh.name = 'horse'
    mesh.castShadow = true
    mesh.scale.setScalar(template.scale)
    mesh.rotation.y = template.rotationY
    mesh.position.y = template.offsetY

    const group = new THREE.Group()
    group.add(mesh)

    const mixer = new THREE.AnimationMixer(group)
    let action: THREE.AnimationAction | null = null
    if (template.clip) {
      action = mixer.clipAction(template.clip)
      action.play()
    }
    return {
      group,
      mixer,
      action,
      material,
      headAnchor: template.headAnchor.clone(),
      tailAnchor: template.tailAnchor.clone(),
      withersAnchor: template.withersAnchor.clone(),
    }
  }
  return createFallbackHorse(tint)
}

/** Smooth procedural stand-in used only if the GLB fails to load. */
function createFallbackHorse(tint: number): HorseInstance {
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.75,
    metalness: 0.05,
  })

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.7, 8, 16), material)
  body.rotation.x = Math.PI / 2
  body.position.y = 0.1
  body.castShadow = true
  group.add(body)

  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 8, 12), material)
  neck.position.set(0, 0.7, 1.05)
  neck.rotation.x = -Math.PI / 5
  neck.castShadow = true
  group.add(neck)

  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.55, 8, 12), material)
  head.position.set(0, 1.18, 1.5)
  head.rotation.x = Math.PI / 2.6
  head.castShadow = true
  group.add(head)

  const earGeom = new THREE.ConeGeometry(0.08, 0.22, 6)
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(earGeom, material)
    ear.position.set(s * 0.14, 1.45, 1.3)
    group.add(ear)
  }

  const legGeom = new THREE.CapsuleGeometry(0.09, 0.85, 6, 8)
  for (const [x, z] of [[-0.3, 0.65], [0.3, 0.65], [-0.3, -0.65], [0.3, -0.65]]) {
    const leg = new THREE.Mesh(legGeom, material)
    leg.position.set(x, -0.55, z)
    leg.castShadow = true
    group.add(leg)
  }

  return {
    group,
    mixer: null,
    action: null,
    material,
    headAnchor: new THREE.Vector3(0, 1.4, 1.35),
    tailAnchor: new THREE.Vector3(0, 0.45, -1.3),
    withersAnchor: new THREE.Vector3(0, 0.55, 0.3),
  }
}

/** Glowing spiral unicorn horn (HDR emissive gold — blooms nicely). */
export function createHorn(): THREE.Group {
  const horn = new THREE.Group()
  const coneMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe3a0,
    emissive: new THREE.Color(0xffc24d),
    emissiveIntensity: 1.6,
    roughness: 0.35,
    metalness: 0.4,
  })
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.72, 10), coneMaterial)
  cone.position.y = 0.36
  horn.add(cone)

  // Spiral ridge wrapped around the cone (brighter, HDR emissive).
  const helixPoints: THREE.Vector3[] = []
  const TURNS = 4.5
  for (let i = 0; i <= 60; i++) {
    const t = i / 60
    const angle = t * Math.PI * 2 * TURNS
    const r = 0.095 * (1 - t * 0.92)
    helixPoints.push(new THREE.Vector3(Math.cos(angle) * r, t * 0.68, Math.sin(angle) * r))
  }
  const helix = new THREE.CatmullRomCurve3(helixPoints)
  const spiralMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffd88a).multiplyScalar(2.4),
  })
  const spiral = new THREE.Mesh(new THREE.TubeGeometry(helix, 80, 0.018, 5), spiralMaterial)
  horn.add(spiral)
  return horn
}

/** Feathered, softly glowing wing (right side; mirror for left). */
export function createWing(accent: number): THREE.Mesh {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.quadraticCurveTo(0.7, 0.75, 1.9, 0.72)
  shape.quadraticCurveTo(1.55, 0.3, 1.75, 0.12)
  shape.quadraticCurveTo(1.3, 0.05, 1.45, -0.18)
  shape.quadraticCurveTo(0.9, -0.18, 0.95, -0.4)
  shape.quadraticCurveTo(0.4, -0.28, 0, 0)

  const geometry = new THREE.ShapeGeometry(shape, 10)
  const material = new THREE.MeshStandardMaterial({
    color: 0xfff4ff,
    emissive: new THREE.Color(accent),
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    roughness: 0.35,
    flatShading: true,
    depthWrite: false,
  })
  const wing = new THREE.Mesh(geometry, material)
  wing.renderOrder = 2

  // Feather ribs so the wing reads as feathered, not as a blank sheet.
  const ribMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(accent).lerp(new THREE.Color(0xffffff), 0.35),
    transparent: true,
    opacity: 0.55,
  })
  for (let i = 0; i < 5; i++) {
    const t = i / 4
    const len = 1.15 - t * 0.45
    const rib = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.035), ribMaterial)
    rib.position.set(0.55 + t * 0.75, 0.32 - t * 0.42, 0.002)
    rib.rotation.z = -0.55 - t * 0.25
    wing.add(rib)
  }
  return wing
}
