import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */
export const PALETTE = {
  skyTop: 0x3f9bff,
  skyMid: 0x9fdcff,
  skyBottom: 0xffedd0,
  fog: 0xcfe9ff,
  grassLight: 0x8fe368,
  grass: 0x76d34f,
  grassDark: 0x5cba3e,
  dirtLight: 0xc08a4e,
  dirt: 0x9e6b3a,
  dirtDark: 0x77492a,
  water: 0x3fb7e6,
  trunk: 0x8a5a33,
  foliage: [0x4fbf67, 0x39a95e, 0x63d178, 0x2f9455] as number[],
  rock: 0xaeb9c4,
  flower: [0xff7eb6, 0xffd166, 0xff6f61, 0xb388ff, 0xffffff] as number[],
  mushroomCap: 0xff5d5d,
  mushroomStem: 0xfff3e0,
  platformTop: 0x8fe368,
  platformStone: 0x9aa7c7,
  cloud: 0xffffff,
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ */
/* Terrain shape (analytic, shared by geometry + collision)            */
/* ------------------------------------------------------------------ */
export function edgeRadius(theta: number): number {
  return 20 + 2.2 * Math.sin(theta * 3 + 1.7) + 1.1 * Math.sin(theta * 7 + 0.4);
}

export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(z, x);
  const edge = edgeRadius(theta);
  if (r > edge) return -100;
  let h =
    1.05 * Math.sin(x * 0.22 + 1.3) * Math.cos(z * 0.2 + 0.6) +
    0.55 * Math.sin(z * 0.37 + 2.1) * Math.cos(x * 0.31);
  h += 2.6 * Math.exp(-((x + 9) ** 2 + (z + 7) ** 2) / 24); // big hill
  h += 1.5 * Math.exp(-((x - 12) ** 2 + (z - 9) ** 2) / 16); // small rise
  const t = THREE.MathUtils.clamp((edge - r) / 5, 0, 1);
  const rim = t * t * (3 - 2 * t);
  return h * rim + 0.15 * rim;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/** Non-indexed copy with per-face vertex colors (slight jitter per facet). */
function paintFacets(
  src: THREE.BufferGeometry,
  colorOf: (cx: number, cy: number, cz: number) => THREE.Color,
  jitter: number | ((cx: number, cy: number, cz: number) => number) = 0.05,
): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src;
  g.deleteAttribute('uv');
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let f = 0; f < pos.count; f += 3) {
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3;
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
    const c = colorOf(cx, cy, cz).clone();
    const jAmt = typeof jitter === 'function' ? jitter(cx, cy, cz) : jitter;
    const j = 1 + (Math.random() - 0.5) * 2 * jAmt;
    c.r = THREE.MathUtils.clamp(c.r * j, 0, 1);
    c.g = THREE.MathUtils.clamp(c.g * j, 0, 1);
    c.b = THREE.MathUtils.clamp(c.b * j, 0, 1);
    for (let v = 0; v < 3; v++) {
      colors[(f + v) * 3] = c.r;
      colors[(f + v) * 3 + 1] = c.g;
      colors[(f + v) * 3 + 2] = c.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function solid(src: THREE.BufferGeometry, hex: number, jitter = 0.05, matrix?: THREE.Matrix4) {
  const base = new THREE.Color(hex);
  const g = paintFacets(src, () => base, jitter);
  if (matrix) g.applyMatrix4(matrix);
  return g;
}

const mat4 = (px: number, py: number, pz: number, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(px, py, pz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );

/* ------------------------------------------------------------------ */
/* Island                                                              */
/* ------------------------------------------------------------------ */
function buildGrassTop(): THREE.BufferGeometry {
  const RINGS = 20;
  const SEGS = 64;
  const positions: number[] = [0, terrainHeight(0, 0), 0];
  for (let i = 1; i <= RINGS; i++) {
    for (let j = 0; j < SEGS; j++) {
      const theta = (j / SEGS) * Math.PI * 2;
      const edge = edgeRadius(theta);
      let r = (i / RINGS) * edge;
      let t = theta;
      if (i < RINGS) {
        // less jitter near the flat center: thin fan triangles there would
        // otherwise pick up noisy flat-shading normals (radial streaks)
        const falloff = THREE.MathUtils.smoothstep((i / RINGS) * edge, 2, 8);
        r += rand(-0.45, 0.45) * falloff;
        t += rand(-0.02, 0.02) * falloff;
      }
      const x = Math.cos(t) * r;
      const z = Math.sin(t) * r;
      positions.push(x, terrainHeight(x, z), z);
    }
  }
  const indices: number[] = [];
  const idx = (i: number, j: number) => (i === 0 ? 0 : 1 + (i - 1) * SEGS + (j % SEGS));
  for (let j = 0; j < SEGS; j++) indices.push(0, idx(1, j + 1), idx(1, j));
  for (let i = 1; i < RINGS; i++) {
    for (let j = 0; j < SEGS; j++) {
      const a = idx(i, j);
      const b = idx(i, j + 1);
      const c = idx(i + 1, j);
      const d = idx(i + 1, j + 1);
      // alternate the quad diagonal to avoid a radial "pinwheel" pattern
      if ((i + j) % 2 === 0) indices.push(a, b, d, a, d, c);
      else indices.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  const light = new THREE.Color(PALETTE.grassLight);
  const mid = new THREE.Color(PALETTE.grass);
  const dark = new THREE.Color(PALETTE.grassDark);
  const painted = paintFacets(
    geo,
    (_x, y) => {
      const k = THREE.MathUtils.clamp((y + 0.6) / 3.4, 0, 1);
      return k > 0.5 ? mid.clone().lerp(light, (k - 0.5) * 2) : dark.clone().lerp(mid, k * 2);
    },
    // fade jitter toward the island center: thin fan triangles there would
    // otherwise read as radial color slivers
    (cx, _cy, cz) => 0.075 * THREE.MathUtils.smoothstep(Math.hypot(cx, cz), 1.5, 7),
  );
  painted.computeVertexNormals();
  return painted;
}

function buildDirtSides(): THREE.BufferGeometry {
  const SEGS = 64;
  // profile rows: [radius multiplier, y]
  const rows: Array<[number, number]> = [
    [1.0, 0.35],
    [1.04, -1.4],
    [0.88, -4.4],
    [0.58, -7.6],
  ];
  const positions: number[] = [];
  for (const [mult, y] of rows) {
    for (let j = 0; j < SEGS; j++) {
      const theta = (j / SEGS) * Math.PI * 2;
      const edge = edgeRadius(theta);
      const jr = mult === 1.0 ? 0 : rand(-0.5, 0.5);
      const jy = mult === 1.0 ? 0 : rand(-0.35, 0.35);
      positions.push(
        Math.cos(theta) * (edge * mult + jr),
        y + jy,
        Math.sin(theta) * (edge * mult + jr),
      );
    }
  }
  const tipIndex = positions.length / 3;
  positions.push(0, -10.5, 0);
  const indices: number[] = [];
  const idx = (i: number, j: number) => i * SEGS + (j % SEGS);
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < SEGS; j++) {
      const a = idx(i, j);
      const b = idx(i, j + 1);
      const c = idx(i + 1, j);
      const d = idx(i + 1, j + 1);
      indices.push(a, d, b, a, c, d);
    }
  }
  for (let j = 0; j < SEGS; j++) {
    indices.push(idx(rows.length - 1, j), tipIndex, idx(rows.length - 1, j + 1));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  const top = new THREE.Color(PALETTE.dirtLight);
  const mid = new THREE.Color(PALETTE.dirt);
  const deep = new THREE.Color(PALETTE.dirtDark);
  const painted = paintFacets(
    geo,
    (_x, y) => {
      const k = THREE.MathUtils.clamp(-y / 10.5, 0, 1);
      return k < 0.35 ? top.clone().lerp(mid, k / 0.35) : mid.clone().lerp(deep, (k - 0.35) / 0.65);
    },
    0.06,
  );
  painted.computeVertexNormals();
  return painted;
}

/** Small floating side-island (static landing pad). */
function buildMiniIsland(cx: number, cy: number, cz: number, radius: number): THREE.BufferGeometry[] {
  const grassGeo = solid(
    new THREE.CylinderGeometry(radius, radius * 0.94, 0.7, 14),
    PALETTE.grass,
    0.05,
    mat4(cx, cy - 0.35, cz),
  );
  const dirtGeo = solid(
    new THREE.ConeGeometry(radius * 0.95, radius * 1.5, 12),
    PALETTE.dirt,
    0.07,
    mat4(cx, cy - 0.72 - radius * 0.75, cz, 1, -1, 1),
  );
  return [grassGeo, dirtGeo];
}

/* ------------------------------------------------------------------ */
/* Decor: trees, rocks, flowers (merged into one mesh)                 */
/* ------------------------------------------------------------------ */
function buildDecor(avoid: Array<{ x: number; z: number; r: number }>): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];

  const blocked = (x: number, z: number, r: number) =>
    avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.r + r);

  const scatter = (count: number, minR: number, maxR: number, clearance: number) => {
    const out: Array<{ x: number; z: number; y: number }> = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 40) {
      const theta = Math.random() * Math.PI * 2;
      const r = rand(minR, maxR) * Math.min(1, edgeRadius(theta) / 22);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = terrainHeight(x, z);
      if (y < -1 || blocked(x, z, clearance)) continue;
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < clearance)) continue;
      out.push({ x, z, y });
    }
    return out;
  };

  // Round leafy trees
  for (const p of scatter(9, 7, 19, 3.2)) {
    const s = rand(0.85, 1.4);
    const leaf = PALETTE.foliage[Math.floor(Math.random() * PALETTE.foliage.length)];
    const trunkH = 1.7 * s;
    parts.push(
      solid(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, trunkH, 6), PALETTE.trunk, 0.05,
        mat4(p.x, p.y + trunkH / 2, p.z, 1, 1, 1, rand(0, 6.28))),
      solid(new THREE.IcosahedronGeometry(1.15 * s, 0), leaf, 0.06,
        mat4(p.x, p.y + trunkH + 0.75 * s, p.z, 1, 0.92, 1, rand(0, 6.28))),
      solid(new THREE.IcosahedronGeometry(0.8 * s, 0), leaf, 0.06,
        mat4(p.x + 0.55 * s, p.y + trunkH + 1.35 * s, p.z + 0.2 * s, 1, 1, 1, rand(0, 6.28))),
      solid(new THREE.IcosahedronGeometry(0.62 * s, 0), leaf, 0.06,
        mat4(p.x - 0.5 * s, p.y + trunkH + 1.2 * s, p.z - 0.3 * s, 1, 1, 1, rand(0, 6.28))),
    );
  }

  // Pine trees
  for (const p of scatter(6, 9, 18, 3.0)) {
    const s = rand(0.9, 1.5);
    const leaf = PALETTE.foliage[Math.floor(Math.random() * PALETTE.foliage.length)];
    parts.push(
      solid(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 1.2 * s, 6), PALETTE.trunk, 0.05,
        mat4(p.x, p.y + 0.6 * s, p.z)),
      solid(new THREE.ConeGeometry(1.25 * s, 1.7 * s, 7), leaf, 0.05,
        mat4(p.x, p.y + 1.8 * s, p.z, 1, 1, 1, rand(0, 6.28))),
      solid(new THREE.ConeGeometry(0.95 * s, 1.5 * s, 7), leaf, 0.05,
        mat4(p.x, p.y + 2.7 * s, p.z, 1, 1, 1, rand(0, 6.28))),
      solid(new THREE.ConeGeometry(0.62 * s, 1.3 * s, 7), leaf, 0.05,
        mat4(p.x, p.y + 3.55 * s, p.z, 1, 1, 1, rand(0, 6.28))),
    );
  }

  // Rocks
  for (const p of scatter(9, 5, 19, 2.0)) {
    const s = rand(0.35, 1.1);
    parts.push(
      solid(new THREE.IcosahedronGeometry(s, 0), PALETTE.rock, 0.08,
        mat4(p.x, p.y + s * 0.35, p.z, 1, rand(0.55, 0.8), rand(0.8, 1.2), rand(0, 6.28))),
    );
  }

  // Flowers
  for (const p of scatter(26, 2, 19, 1.1)) {
    const col = PALETTE.flower[Math.floor(Math.random() * PALETTE.flower.length)];
    parts.push(
      solid(new THREE.CylinderGeometry(0.03, 0.04, 0.4, 4), 0x4a9e3f, 0.04,
        mat4(p.x, p.y + 0.2, p.z)),
      solid(new THREE.IcosahedronGeometry(0.13, 0), col, 0.05,
        mat4(p.x, p.y + 0.45, p.z, 1, 0.75, 1)),
    );
  }

  // Grass tufts
  for (const p of scatter(20, 2, 19, 0.9)) {
    parts.push(
      solid(new THREE.ConeGeometry(0.16, 0.5, 4), PALETTE.grassDark, 0.1,
        mat4(p.x, p.y + 0.22, p.z, 1, 1, 1, rand(0, 6.28), rand(-0.15, 0.15))),
    );
  }

  const merged = mergeGeometries(parts);
  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Jump pads (bouncy mushrooms)                                        */
/* ------------------------------------------------------------------ */
export class JumpPad {
  readonly group = new THREE.Group();
  readonly radius = 1.5;
  readonly topY: number;
  private cap: THREE.Group;
  private squashT = 0;

  constructor(x: number, z: number) {
    const groundY = terrainHeight(x, z);
    const stemH = 0.9;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.75, stemH, 9),
      new THREE.MeshStandardMaterial({ color: PALETTE.mushroomStem, flatShading: true, roughness: 0.8 }),
    );
    stem.position.y = stemH / 2;
    stem.castShadow = true;

    this.cap = new THREE.Group();
    const capMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.45, 14, 9),
      new THREE.MeshStandardMaterial({ color: PALETTE.mushroomCap, flatShading: true, roughness: 0.65 }),
    );
    capMesh.scale.set(1, 0.55, 1);
    capMesh.castShadow = true;
    this.cap.add(capMesh);
    const dotMat = new THREE.MeshStandardMaterial({ color: 0xfff8f0, roughness: 0.8 });
    for (let i = 0; i < 5; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(rand(0.16, 0.26), 8, 6), dotMat);
      const a = (i / 5) * Math.PI * 2 + rand(-0.3, 0.3);
      const rr = rand(0.45, 0.95);
      dot.position.set(Math.cos(a) * rr, 0.62 * Math.sqrt(1 - (rr / 1.5) ** 2) + 0.12, Math.sin(a) * rr);
      dot.scale.y = 0.4;
      this.cap.add(dot);
    }
    this.cap.position.y = stemH + 0.55;

    this.group.add(stem, this.cap);
    this.group.position.set(x, groundY, z);
    this.topY = groundY + stemH + 0.55 + 0.55;
  }

  center(): THREE.Vector3 {
    return new THREE.Vector3(this.group.position.x, this.topY, this.group.position.z);
  }

  trigger(): void {
    this.squashT = 1;
  }

  update(dt: number): void {
    if (this.squashT > 0) {
      this.squashT = Math.max(0, this.squashT - dt * 2.6);
      const s = Math.sin(this.squashT * Math.PI);
      this.cap.scale.set(1 + s * 0.3, 1 - s * 0.45, 1 + s * 0.3);
    } else {
      this.cap.scale.set(1, 1, 1);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Moving platforms                                                    */
/* ------------------------------------------------------------------ */
export class MovingPlatform {
  readonly group = new THREE.Group();
  readonly halfX = 1.9;
  readonly halfZ = 1.9;
  readonly velocity = new THREE.Vector3();
  private from: THREE.Vector3;
  private to: THREE.Vector3;
  private period: number;
  private phase: number;

  constructor(from: THREE.Vector3, to: THREE.Vector3, period: number, phase = 0) {
    this.from = from;
    this.to = to;
    this.period = period;
    this.phase = phase;
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.7, 3.8),
      new THREE.MeshStandardMaterial({ color: PALETTE.platformStone, flatShading: true, roughness: 0.85 }),
    );
    stone.position.y = -0.35;
    stone.castShadow = true;
    stone.receiveShadow = true;
    const turf = new THREE.Mesh(
      new THREE.BoxGeometry(3.9, 0.22, 3.9),
      new THREE.MeshStandardMaterial({ color: PALETTE.platformTop, flatShading: true, roughness: 0.9 }),
    );
    turf.position.y = 0.06;
    turf.receiveShadow = true;
    turf.castShadow = true;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: PALETTE.dirt, flatShading: true, roughness: 0.9 }),
    );
    cone.position.y = -1.4;
    cone.scale.y = -1;
    this.group.add(stone, turf, cone);
    this.group.position.copy(from);
  }

  /** World y of the walkable surface. */
  get top(): number {
    return this.group.position.y + 0.17;
  }

  update(t: number, dt: number): void {
    const k = 0.5 - 0.5 * Math.cos((t / this.period + this.phase) * Math.PI * 2);
    const prev = this.group.position.clone();
    this.group.position.lerpVectors(this.from, this.to, k);
    if (dt > 0) {
      this.velocity.subVectors(this.group.position, prev).divideScalar(dt);
    }
  }
}

export interface StaticPlatform {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  top: number;
}

/* ------------------------------------------------------------------ */
/* Sky, clouds, water                                                  */
/* ------------------------------------------------------------------ */
function buildSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(PALETTE.skyTop) },
      midColor: { value: new THREE.Color(PALETTE.skyMid) },
      bottomColor: { value: new THREE.Color(PALETTE.skyBottom) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = h > 0.12
          ? mix(midColor, topColor, smoothstep(0.12, 0.75, h))
          : mix(bottomColor, midColor, smoothstep(-0.25, 0.12, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), mat);
  sky.frustumCulled = false;
  return sky;
}

function buildCloud(): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const n = 3 + Math.floor(Math.random() * 3);
  let x = 0;
  for (let i = 0; i < n; i++) {
    const s = rand(1.4, 2.6) * (1 - Math.abs(i - n / 2) / n);
    parts.push(
      solid(new THREE.IcosahedronGeometry(Math.max(s, 0.9), 1), PALETTE.cloud, 0.02,
        mat4(x, rand(-0.2, 0.3), rand(-0.6, 0.6), 1, 0.55, 1)),
    );
    x += s * 1.15;
  }
  const mesh = new THREE.Mesh(
    mergeGeometries(parts),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 1,
      emissive: 0xf4faff,
      emissiveIntensity: 0.55,
    }),
  );
  return mesh;
}

/* ------------------------------------------------------------------ */
/* World                                                               */
/* ------------------------------------------------------------------ */
export class World {
  readonly group = new THREE.Group();
  readonly pads: JumpPad[] = [];
  readonly movers: MovingPlatform[] = [];
  readonly statics: StaticPlatform[] = [];
  readonly orbSpots: THREE.Vector3[] = [];
  readonly sun: THREE.DirectionalLight;
  private clouds: Array<{ mesh: THREE.Mesh; speed: number }> = [];
  private water: THREE.Mesh;
  private waterBase: Float32Array;

  constructor(scene: THREE.Scene) {
    scene.fog = new THREE.Fog(PALETTE.fog, 70, 220);
    scene.add(buildSky());

    /* Lights */
    const hemi = new THREE.HemisphereLight(0xbfe8ff, 0xe6cfa4, 0.5);
    scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff7ec, 2.4);
    this.sun.position.set(24, 34, 16);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.camera.near = 5;
    this.sun.shadow.camera.far = 90;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.camera.updateProjectionMatrix();
    scene.add(this.sun);
    scene.add(this.sun.target);
    const rim = new THREE.DirectionalLight(0x9ecbff, 0.55);
    rim.position.set(-18, 14, -24);
    scene.add(rim);

    /* Island */
    const grass = new THREE.Mesh(
      buildGrassTop(),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
    );
    grass.receiveShadow = true;
    const dirt = new THREE.Mesh(
      buildDirtSides(),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
    );
    dirt.castShadow = true;
    this.group.add(grass, dirt);

    /* Floating mini island (reachable via mushroom bounce / moving platform) */
    const mini = { x: 14, y: 5.0, z: -15, r: 3.4 };
    const miniMesh = new THREE.Mesh(
      mergeGeometries(buildMiniIsland(mini.x, mini.y, mini.z, mini.r)),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
    );
    miniMesh.castShadow = true;
    miniMesh.receiveShadow = true;
    this.group.add(miniMesh);
    this.statics.push({ x: mini.x, z: mini.z, halfX: mini.r * 0.92, halfZ: mini.r * 0.92, top: mini.y });

    /* Jump pads */
    const padSpots: Array<[number, number]> = [
      [6.5, 6.5],
      [-12.5, 3.5],
      [10, -10.5],
    ];
    for (const [x, z] of padSpots) {
      const pad = new JumpPad(x, z);
      this.pads.push(pad);
      this.group.add(pad.group);
    }

    /* Moving platforms */
    const m1 = new MovingPlatform(
      new THREE.Vector3(1.5, 2.6, -15),
      new THREE.Vector3(9.5, 4.2, -15.5),
      6,
    );
    const m2 = new MovingPlatform(
      new THREE.Vector3(-16, 3.4, -9),
      new THREE.Vector3(-10, 5.6, -14),
      7,
      0.5,
    );
    this.movers.push(m1, m2);
    this.group.add(m1.group, m2.group);

    /* Decor (avoid pads, spawn, platform lanes) */
    const avoid = [
      { x: 0, z: 2, r: 3.5 }, // spawn
      ...padSpots.map(([x, z]) => ({ x, z, r: 3 })),
      { x: 12, z: 9, r: 2.5 }, // small rise kept open
    ];
    this.group.add(buildDecor(avoid));

    /* Orb spots: mix of ground, hills, pads, platforms, mini island */
    const groundSpot = (x: number, z: number, lift = 1.3) =>
      new THREE.Vector3(x, terrainHeight(x, z) + lift, z);
    this.orbSpots.push(
      groundSpot(4, -6),
      groundSpot(-6, 9),
      groundSpot(14, 3),
      groundSpot(-15.5, -4),
      groundSpot(0.5, 15),
      groundSpot(-9, -7, 1.5), // top of the big hill
      groundSpot(12, 9, 1.4), // small rise
      new THREE.Vector3(6.5, terrainHeight(6.5, 6.5) + 4.6, 6.5), // above mushroom 1
      new THREE.Vector3(5.5, 5.8, -15.2), // over the moving platform lane
      new THREE.Vector3(mini.x, mini.y + 1.4, mini.z), // mini island
    );

    /* Clouds */
    for (let i = 0; i < 7; i++) {
      const cloud = buildCloud();
      const a = Math.random() * Math.PI * 2;
      const r = rand(30, 70);
      cloud.position.set(Math.cos(a) * r, rand(14, 30), Math.sin(a) * r);
      cloud.scale.setScalar(rand(1, 1.9));
      this.group.add(cloud);
      this.clouds.push({ mesh: cloud, speed: rand(0.4, 1.1) });
    }

    /* Water */
    const waterGeo = new THREE.PlaneGeometry(600, 600, 52, 52);
    waterGeo.rotateX(-Math.PI / 2);
    this.waterBase = (waterGeo.getAttribute('position').array as Float32Array).slice();
    this.water = new THREE.Mesh(
      waterGeo,
      new THREE.MeshStandardMaterial({
        color: PALETTE.water,
        flatShading: true,
        roughness: 0.4,
        metalness: 0.05,
        transparent: true,
        opacity: 0.94,
      }),
    );
    this.water.position.y = -12.5;
    this.group.add(this.water);

    scene.add(this.group);
  }

  heightAt(x: number, z: number): number {
    return terrainHeight(x, z);
  }

  update(t: number, dt: number): void {
    for (const m of this.movers) m.update(t, dt);
    for (const p of this.pads) p.update(dt);
    for (const c of this.clouds) {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 90) c.mesh.position.x = -90;
    }
    /* Gentle water waves */
    const attr = this.water.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const base = this.waterBase;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const z = base[i + 2];
      arr[i + 1] = base[i + 1] + Math.sin(x * 0.05 + t * 0.9) * Math.cos(z * 0.06 + t * 0.7) * 0.55;
    }
    attr.needsUpdate = true;
  }
}
