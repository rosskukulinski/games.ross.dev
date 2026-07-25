import type { Scene } from "@babylonjs/core/scene";
import { Scene as SceneClass } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import {
  makeWoodTexture,
  makeBoardTexture,
  makeMarqueeTexture,
  makeBallTexture,
  makeCarpetTexture,
  makeFlareTexture,
} from "./textures";
import {
  BALL_R,
  LANE_HALF,
  LANE_START_Z,
  RAMP_END_Z,
  RAMP_START_Z,
  ROOM_FLOOR_Y,
  RING_RADII,
  RING_COLORS,
  POCKET_U,
  POCKET_V,
  POCKET_R,
  POCKET_COLOR,
  BOARD_HALF_W,
  BOARD_TOP_V,
  BOARD_BOT_V,
  BALLS_PER_GAME,
  RACK_Z0,
  RETURN_X,
  PALETTE,
  rampH,
} from "./config";
import { BOARD_N, BOARD_TILT_ROT, boardPoint } from "./board";

export interface RingLight {
  mesh: Mesh;
  mat: PBRMetallicRoughnessMaterial;
  base: Color3;
  glow: number;
}

export interface World {
  root: TransformNode;
  ball: Mesh;
  ballShadowGen: ShadowGenerator;
  rings: RingLight[];
  pockets: RingLight[];
  bulbs: { mesh: Mesh; mat: PBRMetallicRoughnessMaterial }[];
  marqueeMat: PBRMetallicRoughnessMaterial;
  rackBalls: Mesh[];
  aim: {
    root: TransformNode;
    shaft: Mesh;
    tip: Mesh;
    mat: PBRMetallicRoughnessMaterial;
  };
  boardLight: PointLight;
  neonMats: PBRMetallicRoughnessMaterial[];
  /** Large emissive-tinted surfaces that must NOT bleed into the glow layer. */
  glowExcluded: Mesh[];
}

function hex(c: string): Color3 {
  return Color3.FromHexString(c);
}

/** PBRMetallicRoughnessMaterial only exposes _twoSidedLighting internally. */
function setTwoSided(m: PBRMetallicRoughnessMaterial): void {
  (m as unknown as { _twoSidedLighting: boolean })._twoSidedLighting = true;
  m.backFaceCulling = false;
}

function pbr(scene: Scene, name: string, color: string, rough = 0.6, metal = 0.0) {
  const m = new PBRMetallicRoughnessMaterial(name, scene);
  m.baseColor = hex(color);
  m.roughness = rough;
  m.metallic = metal;
  return m;
}

function emissive(scene: Scene, name: string, color: string, strength = 1) {
  const m = pbr(scene, name, "#050505", 0.35, 0);
  m.emissiveColor = hex(color).scale(strength);
  return m;
}

/** Axis-aligned neon bar. */
function neonBar(
  scene: Scene,
  name: string,
  size: Vector3,
  pos: Vector3,
  mat: PBRMetallicRoughnessMaterial
): Mesh {
  const b = CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
  b.position.copyFrom(pos);
  b.material = mat;
  return b;
}

/**
 * Sweep a 2D cross-section profile along +Z, offsetting each row by the lane
 * ramp height. One mesh for the whole cabinet body -> cheap and seamless.
 */
function sweepProfile(
  scene: Scene,
  name: string,
  profile: [number, number][],
  z0: number,
  z1: number,
  steps: number
): Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // cumulative arc length across the profile for the V coordinate
  const arc: number[] = [0];
  for (let i = 1; i < profile.length; i++) {
    const dx = profile[i][0] - profile[i - 1][0];
    const dy = profile[i][1] - profile[i - 1][1];
    arc.push(arc[i - 1] + Math.hypot(dx, dy));
  }

  const P = profile.length;
  for (let r = 0; r <= steps; r++) {
    const z = z0 + ((z1 - z0) * r) / steps;
    const yOff = rampH(z);
    for (let i = 0; i < P; i++) {
      positions.push(profile[i][0], profile[i][1] + yOff, z);
      uvs.push(z * 0.78, arc[i] * 0.75);
    }
  }
  for (let r = 0; r < steps; r++) {
    for (let i = 0; i < P - 1; i++) {
      const a = r * P + i;
      const b = (r + 1) * P + i;
      const c = r * P + i + 1;
      const d = (r + 1) * P + i + 1;
      indices.push(a, b, c, c, b, d);
    }
  }

  const mesh = new Mesh(name, scene);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.uvs = uvs;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  vd.normals = normals;
  vd.applyToMesh(mesh);
  return mesh;
}

/** Flat quad from 4 world corners (CCW) with a fixed normal. */
function quadMesh(scene: Scene, name: string, corners: Vector3[], normal: Vector3): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const c of corners) {
    positions.push(c.x, c.y, c.z);
    normals.push(normal.x, normal.y, normal.z);
  }
  const mesh = new Mesh(name, scene);
  const vd = new VertexData();
  vd.positions = positions;
  vd.normals = normals;
  vd.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
  vd.indices = [0, 1, 2, 0, 2, 3];
  vd.applyToMesh(mesh);
  return mesh;
}

export function buildWorld(scene: Scene): World {
  const root = new TransformNode("world", scene);

  scene.clearColor = new Color4(0.035, 0.02, 0.07, 1);
  scene.ambientColor = new Color3(0.12, 0.1, 0.2);
  scene.fogMode = SceneClass.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.05, 0.03, 0.1);
  scene.fogDensity = 0.055;

  // ---------------------------------------------------------------- lighting
  const hemi = new HemisphericLight("hemi", new Vector3(0.1, 1, -0.2), scene);
  hemi.intensity = 0.3;
  hemi.diffuse = hex("#7fa8ff");
  hemi.groundColor = hex("#2a1840");
  hemi.specular = hex("#334466");

  const key = new DirectionalLight("key", new Vector3(0.12, -1, 0.28), scene);
  key.position = new Vector3(0, 5, 1.5);
  key.intensity = 2.2;
  key.diffuse = hex("#ffd7a8");
  key.specular = hex("#fff0d0");

  const laneSpot = new SpotLight(
    "laneSpot",
    new Vector3(0, 3.1, 3.0),
    new Vector3(0, -1, 0.12),
    1.3,
    6,
    scene
  );
  laneSpot.intensity = 14;
  laneSpot.diffuse = hex("#ffc470");
  laneSpot.specular = hex("#ffe0b0");

  const boardLight = new PointLight("boardLight", new Vector3(0, 1.3, 6.5), scene);
  boardLight.intensity = 1.6;
  boardLight.diffuse = hex("#ff9ee4");
  boardLight.range = 5;

  // dedicated wash so the target board reads clearly from the foul line
  const boardSpot = new SpotLight(
    "boardSpot",
    new Vector3(0, 2.45, 5.85),
    new Vector3(0, -0.42, 1),
    1.15,
    4,
    scene
  );
  boardSpot.intensity = 2.4;
  boardSpot.diffuse = hex("#fff0d6");
  boardSpot.specular = hex("#ffffff");

  const rimLight = new PointLight("rimLight", new Vector3(-1.4, 1.2, 1.2), scene);
  rimLight.intensity = 1.6;
  rimLight.diffuse = hex("#37f2ff");
  rimLight.range = 6;

  const humpLight = new PointLight("humpLight", new Vector3(0, 1.15, 5.4), scene);
  humpLight.intensity = 1.5;
  humpLight.diffuse = hex("#ffc287");
  humpLight.range = 3.4;

  const shadowGen = new ShadowGenerator(1024, key);
  shadowGen.useBlurExponentialShadowMap = true;
  shadowGen.blurKernel = 24;
  shadowGen.darkness = 0.45;

  // ------------------------------------------------------------------- room
  const carpet = CreateGround("carpet", { width: 26, height: 34, subdivisions: 2 }, scene);
  carpet.position.set(0, ROOM_FLOOR_Y, 4);
  const carpetMat = pbr(scene, "carpetMat", "#ffffff", 0.95, 0);
  const carpetTex = makeCarpetTexture(scene);
  carpetTex.uScale = 9;
  carpetTex.vScale = 12;
  carpetMat.baseTexture = carpetTex;
  carpetMat.emissiveColor = new Color3(0.028, 0.02, 0.05);
  carpet.material = carpetMat;
  carpet.receiveShadows = true;
  carpet.parent = root;

  const backWall = CreateBox("backWall", { width: 26, height: 8, depth: 0.4 }, scene);
  backWall.position.set(0, 3.5, 13);
  backWall.material = pbr(scene, "wallMat", "#150c26", 0.9, 0);
  backWall.parent = root;

  // distant arcade cabinets for depth
  const cabDark = pbr(scene, "cabDark", "#0f0a1e", 0.85, 0);
  const neonSideMats: PBRMetallicRoughnessMaterial[] = [];
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const zz = 3.2 + Math.floor(i / 2) * 2.6;
    const cab = CreateBox("cab" + i, { width: 0.9, height: 1.9, depth: 1.0 }, scene);
    cab.position.set(side * (2.6 + (i % 4) * 0.35), ROOM_FLOOR_Y + 0.95, zz);
    cab.rotation.y = side * 0.25;
    cab.material = cabDark;
    cab.parent = root;
    const col = i % 3 === 0 ? PALETTE.neonCyan : i % 3 === 1 ? PALETTE.neonMagenta : PALETTE.neonGold;
    const m = emissive(scene, "cabNeon" + i, col, 0.7);
    neonSideMats.push(m);
    const strip = CreateBox("cabStrip" + i, { width: 0.94, height: 0.05, depth: 0.06 }, scene);
    strip.position.set(cab.position.x, cab.position.y + 0.75, zz - 0.52);
    strip.rotation.y = cab.rotation.y;
    strip.material = m;
    strip.parent = root;
    const screen = CreateBox("cabScreen" + i, { width: 0.62, height: 0.5, depth: 0.04 }, scene);
    screen.position.set(cab.position.x, cab.position.y + 0.3, zz - 0.52);
    screen.rotation.y = cab.rotation.y;
    screen.material = emissive(scene, "cabScreenM" + i, i % 2 ? "#1d3f8f" : "#4a1d6f", 0.5);
    screen.parent = root;
  }

  // ------------------------------------------------------------- lane + body
  const woodMat = pbr(scene, "woodMat", "#ffffff", 0.42, 0.02);
  const woodTex = makeWoodTexture(scene, "laneWood");
  woodTex.uScale = 1;
  woodTex.vScale = 1;
  woodMat.baseTexture = woodTex;
  setTwoSided(woodMat);

  const OUT = 0.62;
  const RAIL_TOP = 0.155;
  const profile: [number, number][] = [
    [-OUT, -0.42],
    [-OUT, RAIL_TOP],
    [-LANE_HALF, RAIL_TOP],
    [-LANE_HALF, 0],
    [LANE_HALF, 0],
    [LANE_HALF, RAIL_TOP],
    [OUT, RAIL_TOP],
    [OUT, -0.42],
  ];
  const body = sweepProfile(scene, "cabinetBody", profile, LANE_START_Z - 0.85, RAMP_END_Z, 96);
  body.material = woodMat;
  body.receiveShadows = true;
  body.parent = root;

  // front apron of the cabinet (player end)
  const apron = CreateBox("apron", { width: OUT * 2, height: 0.58, depth: 0.06 }, scene);
  apron.position.set(0, -0.13, LANE_START_Z - 0.87);
  apron.material = woodMat;
  apron.parent = root;

  // ------------------------------------------------------------- neon trim
  const neonMats: PBRMetallicRoughnessMaterial[] = [];
  const cyanNeon = emissive(scene, "neonCyan", PALETTE.neonCyan, 1.5);
  const magentaNeon = emissive(scene, "neonMagenta", PALETTE.neonMagenta, 1.5);
  neonMats.push(cyanNeon, magentaNeon, ...neonSideMats);

  const flatLen = RAMP_START_Z - (LANE_START_Z - 0.85);
  const flatMidZ = (LANE_START_Z - 0.85 + RAMP_START_Z) / 2;
  for (const s of [-1, 1]) {
    neonBar(
      scene,
      "trimFlat" + s,
      new Vector3(0.05, 0.035, flatLen),
      new Vector3(s * OUT, RAIL_TOP + 0.015, flatMidZ),
      s < 0 ? cyanNeon : magentaNeon
    ).parent = root;

    // ramp section trim (rotated to the average ramp angle)
    const rampLen = RAMP_END_Z - RAMP_START_Z;
    const rise = rampH(RAMP_END_Z);
    const bar = neonBar(
      scene,
      "trimRamp" + s,
      new Vector3(0.05, 0.035, Math.hypot(rampLen, rise)),
      new Vector3(s * OUT, RAIL_TOP + 0.015 + rise / 2, (RAMP_START_Z + RAMP_END_Z) / 2),
      s < 0 ? cyanNeon : magentaNeon
    );
    bar.rotation.x = -Math.atan2(rise, rampLen);
    bar.parent = root;

    // vertical accent on the front corners
    const post = neonBar(
      scene,
      "trimPost" + s,
      new Vector3(0.05, 0.5, 0.05),
      new Vector3(s * OUT, -0.14, LANE_START_Z - 0.87),
      s < 0 ? cyanNeon : magentaNeon
    );
    post.parent = root;
  }
  // foul line strip across the lane
  const foul = neonBar(
    scene,
    "foulLine",
    new Vector3(LANE_HALF * 2, 0.006, 0.035),
    new Vector3(0, 0.004, 1.35),
    emissive(scene, "foulMat", "#ffd54a", 0.8)
  );
  foul.parent = root;

  // ------------------------------------------------------ pit + head cabinet
  const cabinetMat = pbr(scene, "cabinetMat", PALETTE.cabinet, 0.55, 0.05);
  const feltMat = pbr(scene, "feltMat", PALETTE.felt, 0.95, 0);

  // the catch pit floor between the hump and the board
  const pit = CreateBox("pit", { width: 1.5, height: 0.05, depth: 1.5 }, scene);
  pit.position.set(0, 0.06, 7.0);
  pit.material = feltMat;
  pit.parent = root;

  const HEAD_HALF = 0.86;
  const HEAD_TOP = 2.0;
  const HEAD_BOT = -0.45;
  for (const s of [-1, 1]) {
    const wall = CreateBox("headWall" + s, { width: 0.09, height: HEAD_TOP - HEAD_BOT, depth: 1.7 }, scene);
    wall.position.set(s * HEAD_HALF, (HEAD_TOP + HEAD_BOT) / 2, 7.5);
    wall.material = cabinetMat;
    wall.parent = root;
    const edge = neonBar(
      scene,
      "headEdge" + s,
      new Vector3(0.06, HEAD_TOP - HEAD_BOT - 0.1, 0.06),
      new Vector3(s * HEAD_HALF, (HEAD_TOP + HEAD_BOT) / 2, 6.66),
      s < 0 ? cyanNeon : magentaNeon
    );
    edge.parent = root;
  }
  const headTop = CreateBox("headTop", { width: HEAD_HALF * 2 + 0.1, height: 0.1, depth: 1.7 }, scene);
  headTop.position.set(0, HEAD_TOP, 7.5);
  headTop.material = cabinetMat;
  headTop.parent = root;
  const headTopEdge = neonBar(
    scene,
    "headTopEdge",
    new Vector3(HEAD_HALF * 2, 0.06, 0.06),
    new Vector3(0, HEAD_TOP - 0.02, 6.66),
    emissive(scene, "neonGold", PALETTE.neonGold, 1.4)
  );
  headTopEdge.parent = root;
  neonMats.push(headTopEdge.material as PBRMetallicRoughnessMaterial);

  // soft under-glow strip inside the head cabinet
  for (const s2 of [-1, 1]) {
    const strip = neonBar(
      scene,
      "headInner" + s2,
      new Vector3(0.03, 0.9, 0.03),
      new Vector3(s2 * (HEAD_HALF - 0.09), 1.15, 7.9),
      emissive(scene, "headInnerMat" + s2, s2 < 0 ? "#5ad7ff" : "#ff6ad7", 0.5)
    );
    strip.parent = root;
  }

  const headBack = CreateBox("headBack", { width: HEAD_HALF * 2, height: HEAD_TOP - HEAD_BOT, depth: 0.1 }, scene);
  headBack.position.set(0, (HEAD_TOP + HEAD_BOT) / 2, 8.35);
  headBack.material = cabinetMat;
  headBack.parent = root;

  // --------------------------------------------------------------- the board
  const boardMat = pbr(scene, "boardMat", "#ffffff", 0.75, 0);
  boardMat.baseTexture = makeBoardTexture(scene);
  setTwoSided(boardMat);
  boardMat.emissiveColor = new Color3(0.09, 0.085, 0.13);

  const boardMesh = quadMesh(
    scene,
    "board",
    [
      boardPoint(-BOARD_HALF_W, BOARD_BOT_V),
      boardPoint(BOARD_HALF_W, BOARD_BOT_V),
      boardPoint(BOARD_HALF_W, BOARD_TOP_V),
      boardPoint(-BOARD_HALF_W, BOARD_TOP_V),
    ],
    BOARD_N
  );
  boardMesh.material = boardMat;
  boardMesh.parent = root;
  boardMesh.receiveShadows = true;

  // rings: emissive tori sitting proud of the board face
  const rings: RingLight[] = [];
  for (let i = 0; i < RING_RADII.length; i++) {
    const r = RING_RADII[i];
    const mat = emissive(scene, "ringMat" + i, RING_COLORS[i], 0.85);
    const t = CreateTorus(
      "ring" + i,
      { diameter: r * 2, thickness: 0.021, tessellation: 48 },
      scene
    );
    t.position.copyFrom(boardPoint(0, 0, 0.012));
    t.rotation.x = BOARD_TILT_ROT;
    t.material = mat;
    t.parent = root;
    rings.push({ mesh: t, mat, base: hex(RING_COLORS[i]).scale(0.85), glow: 0 });
  }

  // 100-point pockets: recessed tube + glowing lip
  const pockets: RingLight[] = [];
  for (const s of [-1, 1]) {
    const mat = emissive(scene, "pocketMat" + s, POCKET_COLOR, 0.9);
    const t = CreateTorus(
      "pocket" + s,
      { diameter: POCKET_R * 2, thickness: 0.022, tessellation: 32 },
      scene
    );
    t.position.copyFrom(boardPoint(s * POCKET_U, POCKET_V, 0.012));
    t.rotation.x = BOARD_TILT_ROT;
    t.material = mat;
    t.parent = root;
    pockets.push({ mesh: t, mat, base: hex(POCKET_COLOR).scale(0.9), glow: 0 });

    const tube = CreateCylinder(
      "pocketTube" + s,
      { diameter: POCKET_R * 1.9, height: 0.16, tessellation: 20 },
      scene
    );
    tube.position.copyFrom(boardPoint(s * POCKET_U, POCKET_V, -0.08));
    tube.rotation.x = BOARD_TILT_ROT;
    tube.material = pbr(scene, "tubeMat" + s, "#08040c", 0.9, 0);
    tube.parent = root;
  }

  // ---------------------------------------------------------------- marquee
  const marqueeMat = pbr(scene, "marqueeMat", "#0a0616", 0.6, 0);
  marqueeMat.baseTexture = makeMarqueeTexture(scene);
  marqueeMat.emissiveTexture = makeMarqueeTexture(scene);
  marqueeMat.emissiveColor = new Color3(0.72, 0.7, 0.78);
  marqueeMat.backFaceCulling = false;

  const MQ_Y = 2.32;
  const MQ_Z = 7.55;
  const MQ_HW = 0.95;
  const MQ_HH = 0.27;
  const mqNormal = new Vector3(0, 0.28, -0.96).normalize();
  const marquee = quadMesh(
    scene,
    "marquee",
    [
      new Vector3(-MQ_HW, MQ_Y - MQ_HH, MQ_Z - MQ_HH * 0.28),
      new Vector3(MQ_HW, MQ_Y - MQ_HH, MQ_Z - MQ_HH * 0.28),
      new Vector3(MQ_HW, MQ_Y + MQ_HH, MQ_Z + MQ_HH * 0.28),
      new Vector3(-MQ_HW, MQ_Y + MQ_HH, MQ_Z + MQ_HH * 0.28),
    ],
    mqNormal
  );
  marquee.material = marqueeMat;
  marquee.parent = root;

  const mqFrame = CreateBox("mqFrame", { width: MQ_HW * 2 + 0.16, height: MQ_HH * 2 + 0.16, depth: 0.08 }, scene);
  mqFrame.position.set(0, MQ_Y, MQ_Z + 0.09);
  mqFrame.rotation.x = -0.28;
  mqFrame.material = cabinetMat;
  mqFrame.parent = root;

  // chasing bulbs around the marquee
  const bulbs: { mesh: Mesh; mat: PBRMetallicRoughnessMaterial }[] = [];
  const bulbCount = 22;
  for (let i = 0; i < bulbCount; i++) {
    const t = i / bulbCount;
    // rectangle path around the marquee
    let x: number;
    let y: number;
    const per = t * 2;
    if (per < 1) {
      x = -MQ_HW - 0.07 + (MQ_HW * 2 + 0.14) * per;
      y = MQ_Y + MQ_HH + 0.07;
    } else {
      x = MQ_HW + 0.07 - (MQ_HW * 2 + 0.14) * (per - 1);
      y = MQ_Y - MQ_HH - 0.07;
    }
    const mat = emissive(scene, "bulb" + i, "#ffe9a8", 1.2);
    const b = CreateSphere("bulbMesh" + i, { diameter: 0.055, segments: 8 }, scene);
    b.position.set(x, y, MQ_Z - 0.06);
    b.material = mat;
    b.parent = root;
    bulbs.push({ mesh: b, mat });
  }

  // ------------------------------------------------------- return + ball rack
  const railMat = pbr(scene, "railMat", "#3b2c56", 0.45, 0.3);

  // side return channel
  const chan = CreateBox("returnChannel", { width: 0.3, height: 0.05, depth: 8.2 }, scene);
  chan.position.set(RETURN_X, -0.14, 3.3);
  chan.rotation.x = -0.02;
  chan.material = railMat;
  chan.parent = root;
  const chanGlowMat = emissive(scene, "chanGlow", "#37f2ff", 0.35);
  for (const s of [-1, 1]) {
    const lip = CreateBox("chanLip" + s, { width: 0.035, height: 0.09, depth: 8.2 }, scene);
    lip.position.set(RETURN_X + s * 0.155, -0.11, 3.3);
    lip.rotation.x = -0.02;
    lip.material = railMat;
    lip.parent = root;
    const glow = CreateBox("chanGlowBar" + s, { width: 0.02, height: 0.012, depth: 8.2 }, scene);
    glow.position.set(RETURN_X + s * 0.155, -0.062, 3.3);
    glow.rotation.x = -0.02;
    glow.material = chanGlowMat;
    glow.parent = root;
  }

  // front rack that catches returned balls
  const rack = CreateBox("rack", { width: 1.5, height: 0.05, depth: 0.34 }, scene);
  rack.position.set(0, -0.13, LANE_START_Z - 0.6);
  rack.material = railMat;
  rack.parent = root;
  rack.receiveShadows = true;
  for (const s of [-1, 1]) {
    const lip = CreateBox("rackLip" + s, { width: 1.5, height: 0.1, depth: 0.035 }, scene);
    lip.position.set(0, -0.1, LANE_START_Z - 0.6 + s * 0.16);
    lip.material = railMat;
    lip.parent = root;
  }
  const rackGlow = neonBar(
    scene,
    "rackGlow",
    new Vector3(1.5, 0.02, 0.02),
    new Vector3(0, -0.055, LANE_START_Z - 0.44),
    cyanNeon
  );
  rackGlow.parent = root;

  // ------------------------------------------------------------------- ball
  const ballMat = pbr(scene, "ballMat", "#ffffff", 0.22, 0.04);
  ballMat.baseTexture = makeBallTexture(scene);
  ballMat.emissiveColor = new Color3(0.05, 0.045, 0.04);
  const ball = CreateSphere("ball", { diameter: BALL_R * 2, segments: 24 }, scene);
  ball.material = ballMat;
  ball.parent = root;
  shadowGen.addShadowCaster(ball);

  const rackBalls: Mesh[] = [];
  for (let i = 0; i < BALLS_PER_GAME; i++) {
    const b = ball.clone("rackBall" + i);
    b.parent = root;
    b.position.set(-0.62 + i * 0.155, -0.07, RACK_Z0 - 1.9);
    b.isVisible = false;
    shadowGen.addShadowCaster(b);
    rackBalls.push(b);
  }

  // ------------------------------------------------------------ aim indicator
  const aimRoot = new TransformNode("aimRoot", scene);
  aimRoot.parent = root;
  const aimMat = emissive(scene, "aimMat", "#44dd66", 1.4);
  aimMat.alpha = 0.92;
  const shaft = CreateBox("aimShaft", { width: 0.11, height: 0.012, depth: 1 }, scene);
  shaft.material = aimMat;
  shaft.parent = aimRoot;
  const tip = CreateCylinder(
    "aimTip",
    { diameterTop: 0, diameterBottom: 0.26, height: 0.3, tessellation: 4 },
    scene
  );
  tip.rotation.x = Math.PI / 2;
  tip.material = aimMat;
  tip.parent = aimRoot;
  aimRoot.setEnabled(false);

  // --------------------------------------------------------- bokeh dust motes
  const bokeh = new ParticleSystem("bokeh", 220, scene);
  bokeh.particleTexture = makeFlareTexture(scene, "190,180,255");
  bokeh.emitter = new Vector3(0, 1.4, 4);
  bokeh.minEmitBox = new Vector3(-5, -1.2, -4);
  bokeh.maxEmitBox = new Vector3(5, 2.4, 6);
  bokeh.color1 = new Color4(1, 0.75, 0.5, 0.22);
  bokeh.color2 = new Color4(0.45, 0.7, 1, 0.18);
  bokeh.colorDead = new Color4(0.5, 0.4, 1, 0);
  bokeh.minSize = 0.05;
  bokeh.maxSize = 0.22;
  bokeh.minLifeTime = 3;
  bokeh.maxLifeTime = 7;
  bokeh.emitRate = 32;
  bokeh.blendMode = ParticleSystem.BLENDMODE_ADD;
  bokeh.direction1 = new Vector3(-0.05, 0.09, -0.03);
  bokeh.direction2 = new Vector3(0.05, 0.2, 0.03);
  bokeh.minEmitPower = 0.05;
  bokeh.maxEmitPower = 0.16;
  bokeh.updateSpeed = 0.014;
  bokeh.start();

  // a couple of hanging "arcade lamp" glows above the cabinet
  for (const s of [-1, 1]) {
    const lamp = CreateSphere("lamp" + s, { diameter: 0.16, segments: 10 }, scene);
    lamp.position.set(s * 1.5, 2.5, 3.2);
    lamp.material = emissive(scene, "lampMat" + s, s < 0 ? "#ffb066" : "#7ad4ff", 1.3);
    lamp.parent = root;
    const stem = CreateBox("lampStem" + s, { width: 0.012, height: 1.2, depth: 0.012 }, scene);
    stem.position.set(s * 1.5, 3.1, 3.2);
    stem.material = new StandardMaterial("stemMat" + s, scene);
    (stem.material as StandardMaterial).diffuseColor = new Color3(0.05, 0.04, 0.08);
    stem.parent = root;
  }

  return {
    root,
    ball,
    ballShadowGen: shadowGen,
    rings,
    pockets,
    bulbs,
    marqueeMat,
    rackBalls,
    aim: { root: aimRoot, shaft, tip, mat: aimMat },
    boardLight,
    neonMats,
    glowExcluded: [boardMesh, carpet, backWall],
  };
}
