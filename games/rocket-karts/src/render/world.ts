/**
 * Builds everything static about a track: road, curbs, barriers, start
 * gantry, item boxes, boost pads and themed scenery. All procedural — no
 * asset files — with flat-shaded vertex-coloured geometry and thin instances
 * for the props so a whole forest is a handful of draw calls.
 */
import { Scene } from '@babylonjs/core/scene';
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { type TrackGeom, PAD_LENGTH, headingOf, locate, pointAt } from '../shared/track.ts';
import type { Theme } from '../shared/tracks.ts';
import { hex } from './scene.ts';

export interface ItemBoxView {
  outer: Mesh;
  inner: Mesh;
  scale: number;
  active: boolean;
  phase: number;
}

export interface World {
  root: TransformNode;
  boxes: ItemBoxView[];
  pads: { tex: Texture }[];
  update(dt: number, t: number): void;
  dispose(): void;
}

interface Placement {
  x: number;
  z: number;
  yaw: number;
  scale: number;
}

function vertexColorMaterial(scene: Scene, name: string, emissive = 0): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.White();
  m.specularColor = new Color3(0.04, 0.04, 0.04);
  m.backFaceCulling = false;
  if (emissive > 0) m.emissiveColor = new Color3(emissive, emissive, emissive);
  return m;
}

function flatMaterial(scene: Scene, name: string, color: string, opts: { emissive?: string; alpha?: number; spec?: number } = {}): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = hex(color);
  m.specularColor = new Color3(opts.spec ?? 0.05, opts.spec ?? 0.05, opts.spec ?? 0.05);
  if (opts.emissive) m.emissiveColor = hex(opts.emissive);
  if (opts.alpha !== undefined) m.alpha = opts.alpha;
  return m;
}

/** A closed strip between two lateral offsets, coloured per sample. */
function ribbon(
  scene: Scene,
  name: string,
  geom: TrackGeom,
  latA: number,
  latB: number,
  y: number,
  colorAt: (i: number) => Color3,
  yB = y
): Mesh {
  const n = geom.samples.length;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const upA = yB === y;
  for (let i = 0; i < n; i++) {
    const s = geom.samples[i];
    positions.push(s.x + s.nx * latA, y, s.z + s.nz * latA);
    positions.push(s.x + s.nx * latB, yB, s.z + s.nz * latB);
    if (upA) normals.push(0, 1, 0, 0, 1, 0);
    else normals.push(-s.nx, 0.2, -s.nz, -s.nx, 0.2, -s.nz);
    const c = colorAt(i);
    colors.push(c.r, c.g, c.b, 1, c.r, c.g, c.b, 1);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const mesh = new Mesh(name, scene);
  const vd = new VertexData();
  vd.positions = positions;
  vd.normals = normals;
  vd.colors = colors;
  vd.indices = indices;
  vd.applyToMesh(mesh);
  mesh.isPickable = false;
  return mesh;
}

function placementMatrix(p: Placement): Matrix {
  return Matrix.Compose(new Vector3(p.scale, p.scale, p.scale), Quaternion.RotationAxis(Vector3.Up(), p.yaw), new Vector3(p.x, 0, p.z));
}

/** Put copies of `part` (with its own local offset matrix) at every placement. */
function instantiate(part: Mesh, local: Matrix, placements: Placement[]): void {
  if (placements.length === 0) {
    part.setEnabled(false);
    return;
  }
  const buf = new Float32Array(16 * placements.length);
  placements.forEach((p, i) => {
    local.multiply(placementMatrix(p)).copyToArray(buf, i * 16);
  });
  part.thinInstanceSetBuffer('matrix', buf, 16, true);
  part.isPickable = false;
}

function partMatrix(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, yaw = 0, pitch = 0, roll = 0): Matrix {
  return Matrix.Compose(new Vector3(sx, sy, sz), Quaternion.RotationYawPitchRoll(yaw, pitch, roll), new Vector3(x, y, z));
}

export function buildWorld(scene: Scene, geom: TrackGeom, theme: Theme, rand: () => number): World {
  const root = new TransformNode('world', scene);
  const def = geom.def;
  const halfW = def.width / 2;
  const limit = halfW + def.shoulder;
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    own.push(x);
    return x;
  };
  const parent = (m: Mesh): Mesh => {
    m.parent = root;
    keep(m);
    return m;
  };

  // --- Ground ---------------------------------------------------------------
  const groundTex = keep(new DynamicTexture('groundTex', 256, scene, false));
  {
    const ctx = groundTex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = theme.groundAlt;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);
    // speckle so the plane never reads as flat vinyl
    for (let i = 0; i < 380; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rand() * 0.06})`;
      ctx.beginPath();
      ctx.arc(rand() * 256, rand() * 256, 1 + rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    groundTex.update(false);
    groundTex.wrapU = Texture.WRAP_ADDRESSMODE;
    groundTex.wrapV = Texture.WRAP_ADDRESSMODE;
    groundTex.uScale = 60;
    groundTex.vScale = 60;
  }
  const groundMat = keep(new StandardMaterial('groundMat', scene));
  groundMat.diffuseTexture = groundTex;
  groundMat.specularColor = Color3.Black();
  const groundSize = theme.id === 'beach' ? 520 : 1400;
  const ground = parent(
    theme.id === 'beach'
      ? CreateDisc('ground', { radius: groundSize / 2, tessellation: 64 }, scene)
      : CreateGround('ground', { width: groundSize, height: groundSize }, scene)
  );
  if (theme.id === 'beach') ground.rotation.x = Math.PI / 2;
  ground.material = groundMat;
  ground.position.y = 0;
  ground.receiveShadows = false;

  if (theme.id === 'beach') {
    const seaMat = keep(flatMaterial(scene, 'sea', '#27b6d4', { emissive: '#0a4a5c', spec: 0.5 }));
    const sea = parent(CreateGround('sea', { width: 1800, height: 1800 }, scene));
    sea.material = seaMat;
    sea.position.y = -0.35;
    // foam ring where the sand meets the water
    const foam = parent(CreateTorus('foam', { diameter: groundSize + 4, thickness: 6, tessellation: 64 }, scene));
    foam.material = keep(flatMaterial(scene, 'foamMat', '#f6ffff', { emissive: '#dff9ff' }));
    foam.position.y = -0.3;
    foam.scaling.y = 0.08;
  }

  // --- Road, lines, curbs, barriers -----------------------------------------
  const roadBase = hex(theme.road);
  const roadMat = keep(vertexColorMaterial(scene, 'roadMat'));
  const road = parent(
    ribbon(scene, 'road', geom, -halfW, halfW, 0.05, (i) => {
      const s = geom.samples[i];
      const v = 0.94 + 0.06 * Math.sin(i * 0.61) * Math.cos(s.x * 0.07);
      return roadBase.scale(v);
    })
  );
  road.material = roadMat;

  const edge = hex(theme.roadEdge);
  const edgeMat = keep(vertexColorMaterial(scene, 'edgeMat', theme.night ? 0.9 : 0));
  for (const side of [-1, 1]) {
    const line = parent(ribbon(scene, `edge${side}`, geom, side * (halfW - 0.75), side * (halfW - 0.35), 0.07, () => edge));
    line.material = edgeMat;
  }
  // dashed centre line
  const dashMat = keep(vertexColorMaterial(scene, 'dashMat', theme.night ? 0.5 : 0));
  const dash = parent(
    ribbon(scene, 'dash', geom, -0.16, 0.16, 0.065, (i) => (Math.floor(i / 3) % 2 === 0 ? edge : roadBase))
  );
  dash.material = dashMat;

  const curbA = hex(theme.curbA);
  const curbB = hex(theme.curbB);
  const curbMat = keep(vertexColorMaterial(scene, 'curbMat', theme.night ? 0.35 : 0));
  for (const side of [-1, 1]) {
    const curb = parent(
      ribbon(scene, `curb${side}`, geom, side * halfW, side * (halfW + 1.0), 0.08, (i) => (Math.floor(i / 2) % 2 === 0 ? curbA : curbB))
    );
    curb.material = curbMat;
  }

  const barA = hex(theme.barrier);
  const barB = hex(theme.barrierAlt);
  const wallMat = keep(vertexColorMaterial(scene, 'wallMat', theme.night ? 0.6 : 0.05));
  const railMat = keep(vertexColorMaterial(scene, 'railMat', theme.night ? 0.3 : 0));
  const railColor = theme.night ? hex('#1a1330') : hex('#2a2440');
  for (const side of [-1, 1]) {
    const wall = parent(
      ribbon(scene, `wall${side}`, geom, side * limit, side * limit, 0, (i) => (Math.floor(i / 3) % 2 === 0 ? barA : barB), 1.05)
    );
    wall.material = wallMat;
    const rail = parent(ribbon(scene, `rail${side}`, geom, side * (limit - 0.25), side * (limit + 0.25), 1.08, () => railColor));
    rail.material = railMat;
  }

  // --- Start / finish ---------------------------------------------------------
  {
    const cols = 12;
    const rows = 2;
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const cellW = (halfW * 2) / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const s0 = -1 + r * 1.1;
        const s1 = s0 + 1.1;
        const l0 = -halfW + c * cellW;
        const l1 = l0 + cellW;
        const white = (r + c) % 2 === 0;
        const col = white ? [0.96, 0.96, 0.96] : [0.08, 0.08, 0.1];
        const base = positions.length / 3;
        for (const [s, l] of [
          [s0, l0],
          [s0, l1],
          [s1, l1],
          [s1, l0],
        ]) {
          const p = pointAt(geom, s, l);
          positions.push(p.x, 0.09, p.z);
          normals.push(0, 1, 0);
          colors.push(col[0], col[1], col[2], 1);
        }
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const mesh = new Mesh('startLine', scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.normals = normals;
    vd.colors = colors;
    vd.indices = indices;
    vd.applyToMesh(mesh);
    mesh.material = keep(vertexColorMaterial(scene, 'startMat', theme.night ? 0.4 : 0));
    parent(mesh);

    // gantry
    const start = pointAt(geom, 0.5, 0);
    const yaw = headingOf(start.tx, start.tz);
    const gantry = new TransformNode('gantry', scene);
    gantry.parent = root;
    gantry.position.set(start.x, 0, start.z);
    gantry.rotation.y = yaw;
    keep(gantry);
    const postMat = keep(flatMaterial(scene, 'postMat', theme.night ? '#3a2f6b' : '#f4f1e6'));
    const accentMat = keep(flatMaterial(scene, 'gantryAccent', theme.curbA, { emissive: theme.night ? theme.curbA : undefined }));
    for (const side of [-1, 1]) {
      const post = CreateBox('post', { width: 0.6, height: 6.2, depth: 0.6 }, scene);
      post.parent = gantry;
      post.position.set(side * (limit + 0.6), 3.1, 0);
      post.material = postMat;
      const foot = CreateBox('foot', { width: 1.4, height: 0.5, depth: 1.4 }, scene);
      foot.parent = gantry;
      foot.position.set(side * (limit + 0.6), 0.25, 0);
      foot.material = accentMat;
    }
    const bar = CreateBox('bar', { width: limit * 2 + 1.8, height: 0.55, depth: 0.55 }, scene);
    bar.parent = gantry;
    bar.position.set(0, 6.0, 0);
    bar.material = postMat;

    const bannerTex = keep(new DynamicTexture('banner', { width: 1024, height: 160 }, scene, false));
    const ctx = bannerTex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = theme.night ? '#1d1440' : '#2b2450';
    ctx.fillRect(0, 0, 1024, 160);
    for (let i = 0; i < 32; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#fff' : '#111';
      ctx.fillRect(i * 32, 0, 32, 22);
      ctx.fillStyle = i % 2 === 1 ? '#fff' : '#111';
      ctx.fillRect(i * 32, 138, 32, 22);
    }
    ctx.font = '900 92px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.curbA;
    ctx.fillText('ROCKET KARTS', 516, 84);
    ctx.fillStyle = '#fff7ec';
    ctx.fillText('ROCKET KARTS', 512, 80);
    // update(true) flips the canvas on upload so row 0 lands at v=1, the top
    // of a plane. (The sky and pads deliberately use update(false).)
    bannerTex.update(true);
    const bannerMat = keep(new StandardMaterial('bannerMat', scene));
    bannerMat.diffuseTexture = bannerTex;
    if (theme.night) bannerMat.emissiveTexture = bannerTex;
    bannerMat.emissiveColor = Color3.Black();
    bannerMat.specularColor = Color3.Black();
    bannerMat.backFaceCulling = false;
    const banner = CreatePlane('bannerPlane', { width: limit * 2 + 1.2, height: 1.6 }, scene);
    banner.parent = gantry;
    banner.position.set(0, 5.0, 0);
    banner.material = bannerMat;
  }

  // --- Boost pads ---------------------------------------------------------------
  const pads: { tex: Texture }[] = [];
  {
    const padTex = keep(new DynamicTexture('padTex', { width: 256, height: 256 }, scene, false));
    const ctx = padTex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(10,20,40,0.55)';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = theme.night ? '#4ef5ff' : '#ffb347';
    for (let r = 0; r < 3; r++) {
      const y = 20 + r * 80;
      ctx.beginPath();
      ctx.moveTo(24, y + 40);
      ctx.lineTo(128, y);
      ctx.lineTo(232, y + 40);
      ctx.lineTo(232, y + 62);
      ctx.lineTo(128, y + 24);
      ctx.lineTo(24, y + 62);
      ctx.closePath();
      ctx.fill();
    }
    padTex.update(false);
    padTex.hasAlpha = true;
    padTex.wrapV = Texture.WRAP_ADDRESSMODE;
    const padMat = keep(new StandardMaterial('padMat', scene));
    padMat.diffuseTexture = padTex;
    padMat.emissiveTexture = padTex;
    padMat.emissiveColor = Color3.Black();
    padMat.specularColor = Color3.Black();
    padMat.useAlphaFromDiffuseTexture = true;
    padMat.backFaceCulling = false;
    for (const pad of geom.pads) {
      const m = parent(CreateGround(`pad`, { width: pad.halfWidth * 2, height: PAD_LENGTH }, scene));
      m.position.set(pad.x, 0.075, pad.z);
      m.rotation.y = headingOf(pad.tx, pad.tz);
      m.material = padMat;
    }
    pads.push({ tex: padTex });
  }

  // --- Item boxes ---------------------------------------------------------------
  const boxes: ItemBoxView[] = [];
  {
    const outerMat = keep(flatMaterial(scene, 'boxOuter', '#9ff3ff', { emissive: '#2fb9d6', alpha: 0.55, spec: 0.8 }));
    const innerMat = keep(flatMaterial(scene, 'boxInner', '#fff3b0', { emissive: '#ffd23b' }));
    geom.boxes.forEach((b, i) => {
      const outer = parent(CreateBox(`box${i}`, { size: 1.5 }, scene));
      outer.material = outerMat;
      outer.position.set(b.x, 1.1, b.z);
      const inner = parent(CreateBox(`boxIn${i}`, { size: 0.62 }, scene));
      inner.material = innerMat;
      inner.position.set(b.x, 1.1, b.z);
      boxes.push({ outer, inner, scale: 1, active: true, phase: i * 0.9 });
    });
  }

  // --- Scenery ------------------------------------------------------------------
  const center = geom.samples.reduce((acc, s) => ({ x: acc.x + s.x / geom.samples.length, z: acc.z + s.z / geom.samples.length }), { x: 0, z: 0 });
  const clearOfTrack = (x: number, z: number, margin: number): boolean => {
    const loc = locate(geom, x, z, -1);
    return Math.abs(loc.lateral) > limit + margin;
  };
  const scatter = (gap: number, minD: number, maxD: number, chance: number, margin = 1.5): Placement[] => {
    const out: Placement[] = [];
    const n = geom.samples.length;
    const every = Math.max(1, Math.round(gap / geom.step));
    for (let i = 0; i < n; i += every) {
      const s = geom.samples[i];
      for (const side of [-1, 1]) {
        if (rand() > chance) continue;
        const d = limit + minD + rand() * (maxD - minD);
        const along = (rand() - 0.5) * gap * 0.8;
        const x = s.x + s.nx * side * d + s.tx * along;
        const z = s.z + s.nz * side * d + s.tz * along;
        if (!clearOfTrack(x, z, margin)) continue;
        out.push({ x, z, yaw: rand() * Math.PI * 2, scale: 0.8 + rand() * 0.6 });
      }
    }
    return out;
  };
  const ringPlacements = (count: number, rMin: number, rMax: number, scaleMin: number, scaleMax: number): Placement[] => {
    const out: Placement[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand() * 0.4;
      const r = rMin + rand() * (rMax - rMin);
      out.push({ x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r, yaw: rand() * Math.PI * 2, scale: scaleMin + rand() * (scaleMax - scaleMin) });
    }
    return out;
  };
  const lowPolySphere = (name: string, d: number): Mesh => {
    const m = CreateSphere(name, { diameter: d, segments: 5 }, scene);
    m.convertToFlatShadedMesh();
    return m;
  };

  if (theme.id === 'meadow') {
    const trunkMat = keep(flatMaterial(scene, 'trunk', '#8a5a2b'));
    const leafA = keep(flatMaterial(scene, 'leafA', '#2f9e4f'));
    const leafB = keep(flatMaterial(scene, 'leafB', '#57c25d'));
    const trees = scatter(7, 2.5, 16, 0.75);
    const treesA = trees.filter((_, i) => i % 2 === 0);
    const treesB = trees.filter((_, i) => i % 2 === 1);
    for (const [tag, set, mat] of [
      ['A', treesA, leafA],
      ['B', treesB, leafB],
    ] as const) {
      const trunk = parent(CreateCylinder(`trunk${tag}`, { height: 2.4, diameter: 0.55, tessellation: 6 }, scene));
      trunk.material = trunkMat;
      instantiate(trunk, partMatrix(0, 1.2, 0), set);
      const cone1 = parent(CreateCylinder(`cone1${tag}`, { height: 3.2, diameterTop: 0, diameterBottom: 3.4, tessellation: 7 }, scene));
      cone1.convertToFlatShadedMesh();
      cone1.material = mat;
      instantiate(cone1, partMatrix(0, 3.2, 0), set);
      const cone2 = parent(CreateCylinder(`cone2${tag}`, { height: 2.6, diameterTop: 0, diameterBottom: 2.5, tessellation: 7 }, scene));
      cone2.convertToFlatShadedMesh();
      cone2.material = mat;
      instantiate(cone2, partMatrix(0, 4.9, 0), set);
    }
    const bushMat = keep(flatMaterial(scene, 'bush', '#3fae57'));
    const bush = parent(lowPolySphere('bush', 1.7));
    bush.material = bushMat;
    instantiate(bush, partMatrix(0, 0.55, 0, 1, 0.7, 1), scatter(5, 0.8, 5, 0.5, 0.6));
    const rockMat = keep(flatMaterial(scene, 'rock', '#a7a7b3'));
    const rock = parent(lowPolySphere('rock', 1.3));
    rock.material = rockMat;
    instantiate(rock, partMatrix(0, 0.4, 0, 1.2, 0.7, 1), scatter(11, 1.5, 12, 0.35));
    // flowers: tiny bright dots in the grass
    const flowerMat = keep(flatMaterial(scene, 'flower', '#ff6fa8', { emissive: '#7a2a4a' }));
    const flower = parent(lowPolySphere('flower', 0.5));
    flower.material = flowerMat;
    instantiate(flower, partMatrix(0, 0.25, 0), scatter(3, 0.5, 14, 0.55, 0.3));
    const flowerMat2 = keep(flatMaterial(scene, 'flower2', '#ffe25e', { emissive: '#6a5a10' }));
    const flower2 = parent(lowPolySphere('flower2', 0.5));
    flower2.material = flowerMat2;
    instantiate(flower2, partMatrix(0, 0.25, 0), scatter(3, 0.5, 14, 0.55, 0.3));
    // rolling hills on the horizon
    const hillMat = keep(flatMaterial(scene, 'hill', '#4f9d5a'));
    const hill = parent(lowPolySphere('hill', 1));
    hill.material = hillMat;
    instantiate(hill, partMatrix(0, -8, 0, 120, 38, 120), ringPlacements(14, 300, 420, 0.7, 1.4));
    // balloons by the start line
    const balloonMats = ['#ff4f6d', '#ffd23b', '#4ef5ff', '#ff7ad9'].map((c, i) => keep(flatMaterial(scene, `balloon${i}`, c, { spec: 0.6 })));
    for (let i = 0; i < 10; i++) {
      const p = pointAt(geom, 2 + (rand() - 0.5) * 30, (rand() > 0.5 ? 1 : -1) * (limit + 2 + rand() * 4));
      if (!clearOfTrack(p.x, p.z, 0.5)) continue;
      const b = parent(lowPolySphere(`balloon${i}`, 1.1));
      b.material = balloonMats[i % balloonMats.length];
      b.position.set(p.x, 3 + rand() * 2, p.z);
      b.scaling.y = 1.2;
      const str = parent(CreateCylinder(`string${i}`, { height: 3.4, diameter: 0.05 }, scene));
      str.material = trunkMat;
      str.position.set(p.x, b.position.y - 1.9, p.z);
    }
  } else if (theme.id === 'beach') {
    const trunkMat = keep(flatMaterial(scene, 'palmTrunk', '#b07d48'));
    const frondMat = keep(flatMaterial(scene, 'frond', '#2fa86a'));
    const palms = scatter(9, 2, 14, 0.7);
    const trunk = parent(CreateCylinder('palmTrunkMesh', { height: 5, diameterTop: 0.35, diameterBottom: 0.6, tessellation: 6 }, scene));
    trunk.material = trunkMat;
    instantiate(trunk, partMatrix(0, 2.5, 0, 1, 1, 1, 0, 0, 0.12), palms);
    for (let i = 0; i < 6; i++) {
      const frond = parent(CreateBox(`frond${i}`, { width: 0.7, height: 0.1, depth: 3.2 }, scene));
      frond.material = frondMat;
      const yaw = (i / 6) * Math.PI * 2;
      instantiate(frond, partMatrix(Math.sin(yaw) * 1.2 + 0.55, 5.0, Math.cos(yaw) * 1.2, 1, 1, 1, yaw, -0.45, 0), palms);
    }
    const umbrellaMats = ['#ff7a3d', '#4ef5ff', '#ffd23b'].map((c, i) => keep(flatMaterial(scene, `umb${i}`, c)));
    const poleMat = keep(flatMaterial(scene, 'pole', '#fff5e6'));
    const umbrellas = scatter(17, 1.5, 9, 0.5);
    umbrellaMats.forEach((mat, i) => {
      const set = umbrellas.filter((_, j) => j % umbrellaMats.length === i);
      const top = parent(CreateCylinder(`umbTop${i}`, { height: 0.9, diameterTop: 0, diameterBottom: 2.8, tessellation: 8 }, scene));
      top.convertToFlatShadedMesh();
      top.material = mat;
      instantiate(top, partMatrix(0, 2.7, 0), set);
      const pole = parent(CreateCylinder(`umbPole${i}`, { height: 2.6, diameter: 0.12 }, scene));
      pole.material = poleMat;
      instantiate(pole, partMatrix(0, 1.3, 0), set);
    });
    const rockMat = keep(flatMaterial(scene, 'rockB', '#c9b797'));
    const rock = parent(lowPolySphere('rockB', 1.4));
    rock.material = rockMat;
    instantiate(rock, partMatrix(0, 0.4, 0, 1.3, 0.7, 1), scatter(10, 1, 10, 0.35));
    const shellMat = keep(flatMaterial(scene, 'shell', '#ffd6e0'));
    const shell = parent(lowPolySphere('shell', 0.5));
    shell.material = shellMat;
    instantiate(shell, partMatrix(0, 0.15, 0, 1, 0.5, 1), scatter(4, 0.5, 12, 0.45, 0.3));
    // islands out at sea
    const islandMat = keep(flatMaterial(scene, 'island', '#3f9a5a'));
    const island = parent(lowPolySphere('island', 1));
    island.material = islandMat;
    instantiate(island, partMatrix(0, -6, 0, 70, 22, 70), ringPlacements(7, 380, 520, 0.6, 1.3));
  } else {
    // neon night city
    const pillarMat = keep(flatMaterial(scene, 'pillar', '#1c1740'));
    const bandA = keep(flatMaterial(scene, 'bandA', '#ff2fd0', { emissive: '#ff2fd0' }));
    const bandB = keep(flatMaterial(scene, 'bandB', '#4ef5ff', { emissive: '#4ef5ff' }));
    const pillars = scatter(12, 1.5, 9, 0.6);
    const pillar = parent(CreateBox('pillarMesh', { width: 1.3, height: 7, depth: 1.3 }, scene));
    pillar.material = pillarMat;
    instantiate(pillar, partMatrix(0, 3.5, 0), pillars);
    const b1 = parent(CreateBox('band1', { width: 1.42, height: 0.35, depth: 1.42 }, scene));
    b1.material = bandA;
    instantiate(b1, partMatrix(0, 2.2, 0), pillars);
    const b2 = parent(CreateBox('band2', { width: 1.42, height: 0.35, depth: 1.42 }, scene));
    b2.material = bandB;
    instantiate(b2, partMatrix(0, 5.4, 0), pillars);
    // rings over the road: standing hoops at a few spots
    for (let i = 0; i < 6; i++) {
      const s = (i / 6) * geom.length + 40;
      const p = pointAt(geom, s, 0);
      const ring = parent(CreateTorus(`ring${i}`, { diameter: def.width + 4, thickness: 0.45, tessellation: 24 }, scene));
      ring.material = i % 2 === 0 ? bandA : bandB;
      ring.position.set(p.x, 3.4, p.z);
      ring.rotation.y = headingOf(p.tx, p.tz);
      ring.rotation.x = Math.PI / 2;
      ring.scaling.y = 0.55;
    }
    // skyline
    const winTex = keep(new DynamicTexture('win', 128, scene, false));
    const ctx = winTex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = '#0d0a24';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 4; y < 128; y += 10) {
      for (let x = 4; x < 128; x += 10) {
        if (rand() < 0.5) continue;
        ctx.fillStyle = rand() < 0.5 ? '#ffd76a' : rand() < 0.5 ? '#4ef5ff' : '#ff7ad9';
        ctx.fillRect(x, y, 5, 6);
      }
    }
    winTex.update(false);
    winTex.wrapU = Texture.WRAP_ADDRESSMODE;
    winTex.wrapV = Texture.WRAP_ADDRESSMODE;
    const bldgMat = keep(new StandardMaterial('bldg', scene));
    bldgMat.diffuseTexture = winTex;
    bldgMat.emissiveTexture = winTex;
    bldgMat.emissiveColor = Color3.Black();
    bldgMat.specularColor = Color3.Black();
    const bldg = parent(CreateBox('bldgMesh', { width: 1, height: 1, depth: 1 }, scene));
    bldg.material = bldgMat;
    const towers = ringPlacements(60, 230, 380, 1, 1).map((p) => ({ ...p, scale: 1 }));
    const buf = new Float32Array(16 * towers.length);
    towers.forEach((p, i) => {
      const w = 14 + rand() * 22;
      const h = 30 + rand() * 90;
      Matrix.Compose(new Vector3(w, h, w), Quaternion.RotationAxis(Vector3.Up(), p.yaw), new Vector3(p.x, h / 2 - 1, p.z)).copyToArray(buf, i * 16);
    });
    bldg.thinInstanceSetBuffer('matrix', buf, 16, true);
    // floating orbs
    const orbMat = keep(flatMaterial(scene, 'orb', '#ffffff', { emissive: '#8f7bff' }));
    const orb = parent(lowPolySphere('orb', 0.7));
    orb.material = orbMat;
    instantiate(orb, partMatrix(0, 3 + rand() * 4, 0), scatter(6, 0.5, 12, 0.5, 0.5));
    const ground2 = ground.material as StandardMaterial;
    ground2.emissiveColor = new Color3(0.03, 0.03, 0.07);
  }

  // Everything under one parent, so the world can be swapped as a unit.
  for (const m of root.getChildMeshes()) m.freezeWorldMatrix();

  return {
    root,
    boxes,
    pads,
    update(dt, t) {
      for (const b of boxes) {
        const target = b.active ? 1 : 0;
        b.scale += (target - b.scale) * Math.min(1, 8 * dt);
        const sc = b.scale < 0.01 ? 0 : b.scale;
        b.outer.scaling.setAll(sc);
        b.inner.scaling.setAll(sc);
        b.outer.rotation.y += dt * 1.4;
        b.outer.rotation.x += dt * 0.9;
        b.inner.rotation.y -= dt * 2.2;
        const y = 1.1 + Math.sin(t * 2.2 + b.phase) * 0.14;
        b.outer.position.y = y;
        b.inner.position.y = y;
        b.outer.setEnabled(sc > 0);
        b.inner.setEnabled(sc > 0);
      }
      for (const p of pads) p.tex.vOffset = (p.tex.vOffset + dt * 1.6) % 1;
    },
    dispose() {
      for (const m of root.getChildMeshes()) m.dispose(false, false);
      for (const o of own) o.dispose();
      root.dispose();
    },
  };
}
