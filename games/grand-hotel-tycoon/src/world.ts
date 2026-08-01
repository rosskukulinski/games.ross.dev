/**
 * Scene construction: island, sky, lighting, and every building the resort can
 * grow. Nothing here knows about game rules — it exposes `add*` calls that the
 * game layer invokes when something is bought, plus the handles (door position,
 * window light, status icon) those buildings need to be driven by.
 */
import { Scene } from "@babylonjs/core/scene";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Curve3 } from "@babylonjs/core/Maths/math.path";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

import {
  PALETTE as P,
  hex,
  BAND_N,
  BAND_S,
  PLOT_WEST,
  PLOT_TIERS,
  ROAD_WEST,
  ROAD_HALF_WIDTH,
  DESK,
  QUEUE_HEAD,
  CAM_ALPHA,
  CAM_BETA,
  CAM_FIT,
  lotById,
  LOTS,
  ROOM_W,
  ROOM_D,
  type Lot,
} from "./config";
import {
  makeSkyTexture,
  makeGrassTexture,
  makePathTexture,
  makeSandTexture,
  makeWallTexture,
  makeRoofTexture,
  makeFacadeTexture,
  makeLobbyFacadeTexture,
  makeWaterTexture,
  makeFlareTexture,
  makeCoinTexture,
  makeStarTexture,
  makeMoodTexture,
  makeRoomIconTexture,
  makeStripeTexture,
  makeSignTexture,
  makeFrondTexture,
  makeRearTexture,
  makeHotelSignTexture,
  type SignKind,
} from "./textures";

/**
 * Which cell of the room-status sheet to show. Named, because the reserved and
 * occupied cells were once both index 1 and the bug — rooms showing a sleeping
 * guest before anyone had arrived — was invisible in code review.
 */
export const ROOM_ICON = { free: 0, reserved: 1, busy: 2, dirty: 3 } as const;

/** Number of cells in the room-status sheet. */
const ROOM_ICON_CELLS = 4;

/** Everything the game layer needs to drive one guest room. */
export interface RoomVisual {
  lot: Lot;
  root: TransformNode;
  /** Where a guest stands before disappearing inside. */
  door: { x: number; z: number };
  windowMat: StandardMaterial;
  icon: Mesh;
  iconMat: StandardMaterial;
  /** Walls and roof — faded out while the manager is inside the room. */
  shell: Mesh[];
}

export class World {
  scene: Scene;
  camera: ArcRotateCamera;
  glow: GlowLayer;
  shadows: ShadowGenerator;
  sun: DirectionalLight;

  root!: TransformNode;
  private lawn!: Mesh;
  private promenade!: Mesh;
  private sea!: Mesh;
  private island!: Mesh;
  private waterMat: StandardMaterial | null = null;
  private seaMat!: StandardMaterial;

  /** Shared materials, created once. */
  mats!: {
    wall: StandardMaterial;
    roof: StandardMaterial;
    accent: StandardMaterial;
    deck: StandardMaterial;
    glass: StandardMaterial;
    gold: StandardMaterial;
    leaf: StandardMaterial;
    trunk: StandardMaterial;
    slide: StandardMaterial;
    padGlow: StandardMaterial;
    ghost: StandardMaterial;
  };

  tex!: {
    flare: DynamicTexture;
    coin: DynamicTexture;
    star: DynamicTexture;
    mood: DynamicTexture;
    roomIcon: DynamicTexture;
  };

  /** Prototype meshes cloned/instanced by other systems. */
  protos!: {
    cash: Mesh;
    floatie: Mesh;
  };

  /** Solid buildings, for the layout self-check — see debugLayoutIssues(). */
  structures: Mesh[] = [];
  /**
   * Axis-aligned boxes the manager cannot walk through. Deliberately a short
   * list — rooms stay walk-through because cleaning happens *inside* them.
   */
  solids: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  private time = 0;
  private tier = 0;
  private fountainSpray: Mesh[] = [];
  private palmFronds: TransformNode[] = [];
  private slideRiders: Mesh[] = [];

  /** Smoothed camera target, driven by the game each frame. */
  private camTarget = new Vector3(0, 0, 0);
  camShake = 0;

  constructor(engine: Engine) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.5, 0.83, 0.96, 1);
    this.scene.ambientColor = new Color3(0.5, 0.55, 0.6);
    this.scene.collisionsEnabled = false;
    this.scene.skipPointerMovePicking = true;
    // must come after the scene exists — TransformNode binds to the active scene
    this.root = new TransformNode("world", this.scene);

    // ------------------------------------------------------------- camera
    this.camera = new ArcRotateCamera(
      "cam",
      CAM_ALPHA,
      CAM_BETA,
      30,
      new Vector3(-2, 0, 0),
      this.scene,
    );
    this.camera.fov = 0.72;
    this.camera.minZ = 1;
    this.camera.maxZ = 700;
    // deliberately no attachControl: a five-year-old should never be able to
    // spin the camera under the floor and lose the hotel

    // ------------------------------------------------------------ lighting
    const hemi = new HemisphericLight("hemi", new Vector3(-0.2, 1, -0.25), this.scene);
    hemi.intensity = 0.72;
    hemi.diffuse = hex("#cfeaff");
    hemi.groundColor = hex("#6d8f6a");
    hemi.specular = hex("#2a3a44");

    this.sun = new DirectionalLight("sun", new Vector3(-0.42, -0.86, 0.3), this.scene);
    this.sun.position = new Vector3(24, 40, -22);
    this.sun.intensity = 1.55;
    this.sun.diffuse = hex("#fff3d6");
    this.sun.specular = hex("#fffaf0");

    this.shadows = new ShadowGenerator(2048, this.sun);
    this.shadows.useBlurExponentialShadowMap = true;
    this.shadows.blurKernel = 26;
    this.shadows.darkness = 0.24;
    this.shadows.bias = 0.0015;
    this.shadows.normalBias = 0.012;
    this.sun.shadowMinZ = 4;
    this.sun.shadowMaxZ = 130;
    // Pin the ortho box instead of letting Babylon fit it around every caster
    // in the resort — an auto-fitted frustum spanning 60+ units spreads the
    // 2048 map so thin that the shadows wash out to nothing.
    this.sun.autoCalcShadowZBounds = false;
    this.sun.orthoLeft = -36;
    this.sun.orthoRight = 36;
    this.sun.orthoBottom = -32;
    this.sun.orthoTop = 32;

    // ---------------------------------------------------------------- glow
    // Kept gentle: this is a bright daytime scene, so glow is a highlight on
    // the bell, the safe, lit windows and the build pads — not a mood. Big
    // surfaces and every billboard are denied via noGlow().
    this.glow = new GlowLayer("glow", this.scene, { mainTextureRatio: 0.5 });
    this.glow.intensity = 0.55;
    this.glow.blurKernelSize = 24;

    this.buildMaterials();
    this.buildSky();
    this.buildIsland();
    this.buildLobby();
    this.buildProtos();
    this.setPlotTier(0, false);
  }

  /**
   * Keep a mesh out of the glow layer.
   *
   * `addIncludedOnlyMesh` would be the tidier way round, but it makes the glow
   * layer composite a broken fullscreen quad that paints a stray billboard
   * texture over the whole frame. The deny-list is what the other Babylon game
   * in this repo uses, and it behaves.
   */
  noGlow(m: Mesh): void {
    this.glow.addExcludedMesh(m);
  }

  /* ===================================================================== */
  /* materials                                                              */
  /* ===================================================================== */

  private std(name: string, color: string, opts: { spec?: number; emis?: string } = {}): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = hex(color);
    m.specularColor = hex("#ffffff").scale(opts.spec ?? 0.08);
    m.specularPower = 48;
    if (opts.emis) m.emissiveColor = hex(opts.emis);
    return m;
  }

  private buildMaterials(): void {
    const wall = this.std("wallMat", "#ffffff", { spec: 0.05 });
    const wallTex = makeWallTexture(this.scene);
    wallTex.uScale = 2;
    wallTex.vScale = 1;
    wall.diffuseTexture = wallTex;

    const roof = this.std("roofMat", "#ffffff", { spec: 0.14 });
    const roofTex = makeRoofTexture(this.scene);
    roofTex.uScale = 3;
    roofTex.vScale = 2;
    roof.diffuseTexture = roofTex;

    const glass = this.std("glassMat", "#bfe9f5", { spec: 0.6, emis: "#123a4a" });
    glass.alpha = 0.62;

    const gold = this.std("goldMat", "#ffd24a", { spec: 0.75, emis: "#6b4a00" });

    const slide = this.std("slideMat", "#ffffff", { spec: 0.4 });
    const stripe = makeStripeTexture(this.scene, P.slide, P.slideAlt);
    stripe.uScale = 1;
    stripe.vScale = 7;
    slide.diffuseTexture = stripe;
    // a warm lift rather than the dark tint that made it read as maroon
    slide.emissiveColor = hex("#4a2438");
    // NOT double-sided: duplicating the geometry with flipped normals made the
    // inward-facing copy z-fight the lit outer surface into muddy brown
    slide.backFaceCulling = true;

    const padGlow = this.std("padGlowMat", P.padGlow, { emis: "#1d7f92" });
    padGlow.alpha = 0.85;

    const ghost = this.std("ghostMat", "#eaffff", { emis: "#2c6f80" });
    ghost.alpha = 0.3;
    ghost.backFaceCulling = false;

    this.mats = {
      wall,
      roof,
      accent: this.std("accentMat", P.roof, { spec: 0.2 }),
      deck: this.std("deckMat", P.deck, { spec: 0.1 }),
      glass,
      gold,
      leaf: this.std("leafMat", P.leaf, { spec: 0.12 }),
      trunk: this.std("trunkMat", P.trunk, { spec: 0.06 }),
      slide,
      padGlow,
      ghost,
    };

    this.tex = {
      flare: makeFlareTexture(this.scene),
      coin: makeCoinTexture(this.scene),
      star: makeStarTexture(this.scene),
      mood: makeMoodTexture(this.scene),
      roomIcon: makeRoomIconTexture(this.scene),
    };
  }

  /* ===================================================================== */
  /* sky, sea, island                                                       */
  /* ===================================================================== */

  private buildSky(): void {
    const dome = CreateSphere("sky", { diameter: 620, segments: 20, sideOrientation: Mesh.BACKSIDE }, this.scene);
    const m = new StandardMaterial("skyMat", this.scene);
    m.disableLighting = true;
    m.emissiveTexture = makeSkyTexture(this.scene);
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.backFaceCulling = false;
    dome.material = m;
    dome.infiniteDistance = true;
    dome.isPickable = false;
    dome.applyFog = false;
    this.noGlow(dome);

    // the sun itself, as a soft emissive disc high in the sky
    const sunBall = CreateSphere("sunBall", { diameter: 18, segments: 12 }, this.scene);
    sunBall.position = new Vector3(-120, 96, 150);
    const sm = new StandardMaterial("sunBallMat", this.scene);
    sm.disableLighting = true;
    sm.emissiveColor = hex("#fff6cf");
    sunBall.material = sm;
    sunBall.isPickable = false;
    this.noGlow(sunBall);
  }

  private buildIsland(): void {
    const ISLE_X = 17;
    const SQUASH = 0.62;

    // ------------------------------------------------------------ open sea
    this.sea = CreateGround("sea", { width: 700, height: 700, subdivisions: 1 }, this.scene);
    this.sea.position.set(ISLE_X, -2.1, 0);
    this.seaMat = this.std("seaMat", "#ffffff", { spec: 0.45 });
    const seaTex = makeWaterTexture(this.scene);
    // heavy tiling on a huge plane is what produced the diagonal moiré in the
    // first screenshot pass; fewer repeats plus anisotropy fixes it
    seaTex.uScale = 18;
    seaTex.vScale = 18;
    seaTex.anisotropicFilteringLevel = 8;
    this.seaMat.diffuseTexture = seaTex;
    this.seaMat.diffuseColor = hex("#8fdcec");
    this.seaMat.emissiveColor = hex("#0d3d4d");
    this.sea.material = this.seaMat;
    this.sea.isPickable = false;
    this.sea.receiveShadows = false;
    this.noGlow(this.sea);

    // ------------------------------------------------------------- beach
    // The island is round, so the lawn is round too — a rectangular grass
    // patch on a circular island read as unfinished.
    this.island = CreateCylinder(
      "beach",
      { diameterTop: 146, diameterBottom: 156, height: 3.0, tessellation: 72 },
      this.scene,
    );
    this.island.position.set(ISLE_X, -1.6, 0);
    this.island.scaling.z = SQUASH;
    const sandMat = this.std("sandMat", "#ffffff", { spec: 0.05 });
    const sandTex = makeSandTexture(this.scene);
    sandTex.uScale = 26;
    sandTex.vScale = 26;
    sandTex.anisotropicFilteringLevel = 8;
    sandMat.diffuseTexture = sandTex;
    this.island.material = sandMat;
    this.island.receiveShadows = true;
    this.island.isPickable = false;
    this.noGlow(this.island);

    // ----------------------------------------------------------- the lawn
    this.lawn = CreateCylinder(
      "lawn",
      { diameter: 128, height: 3.2, tessellation: 72 },
      this.scene,
    );
    this.lawn.position.set(ISLE_X, -1.6, 0);
    this.lawn.scaling.z = SQUASH;
    const grassMat = this.std("grassMat", "#ffffff", { spec: 0.03 });
    const grassTex = makeGrassTexture(this.scene);
    grassTex.uScale = 22;
    grassTex.vScale = 22;
    grassTex.anisotropicFilteringLevel = 8;
    grassMat.diffuseTexture = grassTex;
    this.lawn.material = grassMat;
    this.lawn.receiveShadows = true;
    this.lawn.isPickable = false;
    this.noGlow(this.lawn);

    // ------------------------------------------- promenade + approach road
    const east = PLOT_TIERS[PLOT_TIERS.length - 1];
    const promLen = -ROAD_WEST + east + 8;
    const pathMat = this.std("pathMat", "#ffffff", { spec: 0.06 });
    const pathTex = makePathTexture(this.scene);
    pathTex.uScale = promLen / 5;
    pathTex.vScale = 1.6;
    pathTex.anisotropicFilteringLevel = 8;
    pathMat.diffuseTexture = pathTex;

    this.promenade = CreateGround(
      "prom",
      { width: promLen, height: ROAD_HALF_WIDTH * 2 + 2.4, subdivisions: 1 },
      this.scene,
    );
    // generous vertical gaps: at this camera's grazing angle, coplanar ground
    // planes z-fight into vertical stripes
    this.promenade.position.set((ROAD_WEST + east + 8) / 2, 0.06, 0);
    this.promenade.material = pathMat;
    this.promenade.receiveShadows = true;
    this.promenade.isPickable = false;
    this.noGlow(this.promenade);

    // paved aprons in front of each band so buildings sit on paving, not grass
    for (const z of [BAND_N - 3.6, BAND_S + 3.6]) {
      const apron = CreateGround(
        "apron",
        { width: east - PLOT_WEST + 14, height: 3.6, subdivisions: 1 },
        this.scene,
      );
      apron.position.set((PLOT_WEST + east) / 2 + 3, 0.04, z);
      apron.material = pathMat;
      apron.receiveShadows = true;
      apron.isPickable = false;
      this.noGlow(apron);
    }

    // a connecting spur from the promenade to each lot's front door
    for (const lot of LOTS) {
      const spur = CreateGround("spur", { width: 3.4, height: 7, subdivisions: 1 }, this.scene);
      spur.position.set(lot.x, 0.03, lot.facing * 5);
      spur.material = pathMat;
      spur.receiveShadows = true;
      spur.isPickable = false;
      this.noGlow(spur);
    }

    // a scatter of palms around the island edge, purely scenic
    const rnd = seeded(88);
    for (let i = 0; i < 26; i++) {
      const ang = (i / 26) * Math.PI * 2 + rnd() * 0.22;
      const rx = 56 + rnd() * 8;
      const rz = 33 + rnd() * 5;
      const x = ISLE_X + Math.cos(ang) * rx;
      const z = Math.sin(ang) * rz;
      if (Math.abs(z) < 8 && x < PLOT_TIERS[3] + 14) continue; // keep the road clear
      this.palmTree(x, z, 0.85 + rnd() * 0.5, false);
    }
  }

  /* ===================================================================== */
  /* lobby and reception                                                    */
  /* ===================================================================== */

  private buildLobby(): void {
    const g = new TransformNode("lobby", this.scene);
    const cx = DESK.x - 1.5;

    // main block
    const body = CreateBox("lobbyBody", { width: 13, height: 5.4, depth: 8 }, this.scene);
    body.position.set(cx, 2.7, 7.5);
    body.material = this.mats.wall;
    body.parent = g;
    body.receiveShadows = true;
    this.shadows.addShadowCaster(body);
    this.structures.push(body);

    // glazed front
    const front = CreatePlane("lobbyFront", { width: 12.6, height: 5.2 }, this.scene);
    front.position.set(cx, 2.7, 3.48);
    front.rotation.y = 0; // Babylon planes face -Z, so 0 faces the camera
    const fm = new StandardMaterial("lobbyFrontMat", this.scene);
    fm.diffuseTexture = makeLobbyFacadeTexture(this.scene);
    fm.specularColor = hex("#ffffff").scale(0.18);
    fm.emissiveColor = hex("#2a2418");
    front.material = fm;
    front.parent = g;
    this.noGlow(front);

    // flat roof + parapet + a row of little skylights
    const roofSlab = CreateBox("lobbyRoof", { width: 13.8, height: 0.7, depth: 8.8 }, this.scene);
    roofSlab.position.set(cx, 5.7, 7.5);
    roofSlab.material = this.mats.accent;
    roofSlab.parent = g;
    this.shadows.addShadowCaster(roofSlab);

    for (let i = -2; i <= 2; i++) {
      const dome = CreateSphere("skylight", { diameter: 1.5, segments: 8 }, this.scene);
      dome.position.set(cx + i * 2.6, 6.0, 7.5);
      dome.scaling.y = 0.5;
      dome.material = this.mats.glass;
      dome.parent = g;
    }

    // Name board on the facade band just above the porte-cochère. A big
    // roof-mounted sign looked good in isolation but occluded the first guest
    // room behind it, which matters more.
    const signBoard = CreatePlane("hotelSign", { width: 9.4, height: 1.55 }, this.scene);
    signBoard.position.set(cx, 4.72, 3.42);
    const hsm = new StandardMaterial("hotelSignMat", this.scene);
    hsm.diffuseTexture = makeHotelSignTexture(this.scene);
    hsm.useAlphaFromDiffuseTexture = true;
    hsm.disableLighting = true;
    hsm.emissiveColor = hex("#ffffff");
    signBoard.material = hsm;
    signBoard.parent = g;
    this.noGlow(signBoard);

    // porte-cochère over the entrance
    const canopy = CreateBox("canopy", { width: 9, height: 0.4, depth: 3.4 }, this.scene);
    canopy.position.set(cx, 3.9, 1.9);
    canopy.material = this.mats.accent;
    canopy.parent = g;
    this.shadows.addShadowCaster(canopy);
    for (const px of [cx - 4, cx + 4]) {
      const post = CreateCylinder("post", { diameter: 0.36, height: 3.9, tessellation: 10 }, this.scene);
      post.position.set(px, 1.95, 1.9);
      post.material = this.mats.wall;
      post.parent = g;
      this.shadows.addShadowCaster(post);
    }

    // ------------------------------------------------------ reception point
    // There is no counter. A desk box tall enough to read as furniture also
    // hid the manager from this fixed camera and was something to collide
    // with, and it earned neither. A bell on a stand marks the spot instead.
    const welcomeMat = CreateGround("welcomeMat", { width: 4.6, height: 3.2, subdivisions: 1 }, this.scene);
    welcomeMat.position.set(DESK.x, 0.07, DESK.z - 0.6);
    const matMat = this.std("welcomeMatMat", "#c8324a", { spec: 0.1 });
    welcomeMat.material = matMat;
    welcomeMat.receiveShadows = true;
    welcomeMat.isPickable = false;
    welcomeMat.parent = g;
    this.noGlow(welcomeMat);

    const podium = CreateCylinder(
      "bellPodium",
      { diameterTop: 0.62, diameterBottom: 0.78, height: 0.86, tessellation: 16 },
      this.scene,
    );
    podium.position.set(DESK.x, 0.43, DESK.z);
    podium.material = this.mats.accent;
    podium.parent = g;
    podium.receiveShadows = true;
    this.shadows.addShadowCaster(podium);

    const bellBase = CreateCylinder("bellBase", { diameter: 0.5, height: 0.08, tessellation: 14 }, this.scene);
    bellBase.position.set(DESK.x, 0.9, DESK.z);
    bellBase.material = this.mats.gold;
    bellBase.parent = g;

    const bell = CreateSphere("bell", { diameter: 0.44, segments: 10 }, this.scene);
    bell.position.set(DESK.x, 1.03, DESK.z);
    bell.scaling.y = 0.72;
    bell.material = this.mats.gold;
    bell.parent = g;
    this.shadows.addShadowCaster(bell);

    // a sign post marking the queue head
    const signPost = CreateCylinder("signPost", { diameter: 0.16, height: 2.2, tessellation: 8 }, this.scene);
    signPost.position.set(QUEUE_HEAD.x + 2.4, 1.1, QUEUE_HEAD.z - 0.5);
    signPost.material = this.mats.trunk;
    signPost.parent = g;
    const signPlate = CreatePlane("signPlate", { width: 1.7, height: 0.9 }, this.scene);
    signPlate.position.set(QUEUE_HEAD.x + 2.4, 2.35, QUEUE_HEAD.z - 0.55);
    signPlate.rotation.y = 0;
    const spm = new StandardMaterial("signPlateMat", this.scene);
    spm.diffuseTexture = makeSignTexture(this.scene, "checkin");
    spm.emissiveColor = hex("#3a3020");
    spm.diffuseTexture.hasAlpha = true;
    spm.useAlphaFromDiffuseTexture = true;
    spm.backFaceCulling = false;
    signPlate.material = spm;
    signPlate.parent = g;
    this.noGlow(signPlate);

    g.parent = this.root;
  }

  /* ===================================================================== */
  /* prototypes                                                             */
  /* ===================================================================== */

  private buildProtos(): void {
    // cash bundle: a small stack of notes with a coin on top
    const cash = CreateBox("cashProto", { width: 0.62, height: 0.2, depth: 0.42 }, this.scene);
    const cashMat = this.std("cashMat", "#7fd48a", { spec: 0.2, emis: "#173a1e" });
    cash.material = cashMat;
    cash.setEnabled(false);
    cash.isPickable = false;

    const band = CreateBox("cashBand", { width: 0.66, height: 0.22, depth: 0.13 }, this.scene);
    band.material = this.std("cashBandMat", P.coin, { emis: "#4a3400" });
    band.parent = cash;
    band.isPickable = false;

    // pool floatie: a bright ring
    const floatie = CreateTorus("floatieProto", { diameter: 1.15, thickness: 0.34, tessellation: 16 }, this.scene);
    floatie.rotation.x = Math.PI / 2;
    floatie.material = this.std("floatieMat", "#ff8b5e", { spec: 0.3, emis: "#4a2010" });
    floatie.setEnabled(false);
    floatie.isPickable = false;
    floatie.bakeCurrentTransformIntoVertices();

    this.protos = { cash, floatie };
  }

  /* ===================================================================== */
  /* plot tiers                                                             */
  /* ===================================================================== */

  setPlotTier(tier: number, animate = true): void {
    this.tier = Math.max(0, Math.min(PLOT_TIERS.length - 1, tier));
    if (animate) this.camShake = Math.max(this.camShake, 0.5);
  }

  get plotEast(): number {
    return PLOT_TIERS[this.tier];
  }

  /** Where the camera sits when nothing else is going on. */
  get plotCenter(): Vector3 {
    return new Vector3((PLOT_WEST + this.plotEast) / 2, 0, 0);
  }

  get plotWidth(): number {
    return this.plotEast - PLOT_WEST + 22;
  }

  /* ===================================================================== */
  /* buildings                                                              */
  /* ===================================================================== */

  /** A guest-room bungalow. */
  addRoom(lotId: string, roomNo: number): RoomVisual {
    const lot = lotById(lotId);
    const g = new TransformNode(`room${roomNo}`, this.scene);
    const faceZ = lot.z + lot.facing * (ROOM_D / 2);

    const body = CreateBox(`roomBody${roomNo}`, { width: ROOM_W, height: 3.0, depth: ROOM_D }, this.scene);
    body.position.set(lot.x, 1.5, lot.z);
    body.material = this.mats.wall;
    body.receiveShadows = true;
    body.parent = g;
    this.shadows.addShadowCaster(body);
    this.structures.push(body);

    // facade plane carrying the door, windows and number plate
    const facade = CreatePlane(`roomFace${roomNo}`, { width: 5.6, height: 3.0 }, this.scene);
    facade.position.set(lot.x, 1.5, faceZ + lot.facing * 0.02);
    facade.rotation.y = lot.facing > 0 ? Math.PI : 0;
    const fm = new StandardMaterial(`roomFaceMat${roomNo}`, this.scene);
    fm.diffuseTexture = makeFacadeTexture(this.scene, roomNo);
    fm.specularColor = hex("#ffffff").scale(0.1);
    facade.material = fm;
    facade.parent = g;

    // Rooms in the south band point their front at the promenade, which means
    // their back is what the camera sees. Give it windows so it isn't a box.
    const rear = CreatePlane(`roomRear${roomNo}`, { width: 5.6, height: 3.0 }, this.scene);
    rear.position.set(lot.x, 1.5, lot.z - lot.facing * 2.27);
    rear.rotation.y = lot.facing > 0 ? 0 : Math.PI;
    const rm = new StandardMaterial(`roomRearMat${roomNo}`, this.scene);
    rm.diffuseTexture = makeRearTexture(this.scene, roomNo);
    rm.specularColor = hex("#ffffff").scale(0.08);
    rear.material = rm;
    rear.parent = g;

    // hip roof — a 4-sided pyramid squashed to the building footprint
    const roof = CreateCylinder(
      `roomRoof${roomNo}`,
      { diameterTop: 0, diameterBottom: 1, tessellation: 4, height: 1 },
      this.scene,
    );
    roof.rotation.y = Math.PI / 4;
    roof.scaling.set(6.6 / Math.SQRT2, 1.5, 5.5 / Math.SQRT2);
    roof.position.set(lot.x, 3.0 + 0.72, lot.z);
    roof.material = this.mats.roof;
    roof.parent = g;
    this.shadows.addShadowCaster(roof);

    // warm window glow, switched on while the room is occupied
    const windowMat = this.std(`roomWin${roomNo}`, P.windowLit, { emis: "#000000" });
    const glowPane = CreatePlane(`roomGlow${roomNo}`, { width: 4.6, height: 1.5 }, this.scene);
    glowPane.position.set(lot.x, 1.6, faceZ + lot.facing * 0.06);
    glowPane.rotation.y = lot.facing > 0 ? Math.PI : 0;
    glowPane.material = windowMat;
    windowMat.alpha = 0.0;
    glowPane.parent = g;

    // status icon floating over the roof
    const icon = CreatePlane(`roomIcon${roomNo}`, { width: 2.1, height: 2.1 }, this.scene);
    icon.position.set(lot.x, 6.2, lot.z);
    icon.billboardMode = Mesh.BILLBOARDMODE_ALL;
    // each room needs its own texture instance so it can scroll to its own
    // status cell independently
    const iconMat = new StandardMaterial(`roomIconMat${roomNo}`, this.scene);
    const iconTex = makeRoomIconTexture(this.scene);
    iconTex.hasAlpha = true;
    iconTex.uScale = 1 / ROOM_ICON_CELLS;
    iconMat.diffuseTexture = iconTex;
    iconMat.useAlphaFromDiffuseTexture = true;
    iconMat.disableLighting = true;
    iconMat.emissiveColor = hex("#ffffff");
    icon.material = iconMat;
    icon.parent = g;
    this.noGlow(icon);

    g.parent = this.root;
    this.popIn(g, lot.x, lot.z);

    return {
      lot,
      root: g,
      door: { x: lot.x, z: lot.z + lot.facing * 3.4 },
      windowMat,
      icon,
      iconMat,
      shell: [body, facade, rear, roof],
    };
  }

  /** Sets which of the 3 cells of the room-status sheet is showing. */
  setRoomIcon(rv: RoomVisual, index: (typeof ROOM_ICON)[keyof typeof ROOM_ICON]): void {
    const t = rv.iconMat.diffuseTexture as Texture;
    t.uOffset = index / ROOM_ICON_CELLS;
  }

  /** Generic amenity block — differs by palette, roof shape and sign. */
  addAmenity(id: string, lotId: string): TransformNode {
    const lot = lotById(lotId);
    const g = new TransformNode(`am_${id}`, this.scene);

    if (id === "pool") {
      this.buildPool(lot, g);
    } else {
      const spec: Record<string, { w: number; d: number; h: number; color: string; sign: SignKind }> = {
        bathrooms: { w: 6, d: 4.5, h: 3.0, color: "#bfe9f5", sign: "bath" },
        restaurant: { w: 9, d: 6, h: 3.8, color: "#ffd9c2", sign: "food" },
        gym: { w: 8.5, d: 5.5, h: 3.6, color: "#d8e8c0", sign: "gym" },
        spa: { w: 7, d: 5, h: 3.2, color: "#e8d5f5", sign: "spa" },
      };
      const s = spec[id] ?? spec.bathrooms;
      const faceZ = lot.z + lot.facing * (s.d / 2);

      const body = CreateBox(`${id}Body`, { width: s.w, height: s.h, depth: s.d }, this.scene);
      body.position.set(lot.x, s.h / 2, lot.z);
      const bm = this.std(`${id}Mat`, s.color, { spec: 0.1 });
      body.material = bm;
      body.receiveShadows = true;
      body.parent = g;
      this.shadows.addShadowCaster(body);
      this.structures.push(body);

      const roof = CreateCylinder(
        `${id}Roof`,
        { diameterTop: 0, diameterBottom: 1, tessellation: 4, height: 1 },
        this.scene,
      );
      roof.rotation.y = Math.PI / 4;
      roof.scaling.set((s.w + 1) / Math.SQRT2, 1.6, (s.d + 1) / Math.SQRT2);
      roof.position.set(lot.x, s.h + 0.78, lot.z);
      roof.material = this.mats.roof;
      roof.parent = g;
      this.shadows.addShadowCaster(roof);

      // Big pictogram sign so a non-reader knows what the building is — on
      // BOTH faces, because south-band buildings turn their front towards the
      // promenade and therefore their back towards the camera.
      const sm = new StandardMaterial(`${id}SignMat`, this.scene);
      sm.diffuseTexture = makeSignTexture(this.scene, s.sign);
      sm.diffuseTexture.hasAlpha = true;
      sm.useAlphaFromDiffuseTexture = true;
      sm.disableLighting = true;
      sm.emissiveColor = hex("#ffffff");

      for (const side of [1, -1] as const) {
        const sz = lot.z + lot.facing * side * (s.d / 2);
        const sign = CreatePlane(`${id}Sign${side}`, { width: 3.0, height: 1.8 }, this.scene);
        sign.position.set(lot.x, s.h * 0.62, sz + lot.facing * side * 0.05);
        sign.rotation.y = lot.facing * side > 0 ? Math.PI : 0;
        sign.material = sm;
        sign.parent = g;
        this.noGlow(sign);
      }

      // doorway
      const door = CreateBox(`${id}Door`, { width: 1.7, height: 2.2, depth: 0.16 }, this.scene);
      door.position.set(lot.x, 1.1, faceZ + lot.facing * 0.08);
      door.material = this.std(`${id}DoorMat`, P.door, { spec: 0.2 });
      door.parent = g;
    }

    g.parent = this.root;
    this.popIn(g, lot.x, lot.z);
    return g;
  }

  /* ------------------------------------------------------------ the pool */

  private poolWaterMesh: Mesh | null = null;

  private buildPool(lot: Lot, g: TransformNode): void {
    // Sized to sit between the bath house and the restaurant, with the north
    // coping flush with the rest of the south band. The old 14x9 pool pushed
    // its coping 2.6 m into the walkway and parked sun loungers past it.
    const w = 12;
    const d = 6.5;
    const cope = 1.1;
    const x = lot.x;
    const z = lot.z;

    // sunken basin
    const basin = CreateBox("poolBasin", { width: w, height: 2.2, depth: d }, this.scene);
    basin.position.set(x, -1.05, z);
    basin.material = this.std("poolBasinMat", "#0f6f8c", { spec: 0.3 });
    basin.parent = g;
    this.structures.push(basin);

    // water surface, just below deck level
    const water = CreateGround("poolWater", { width: w - 0.5, height: d - 0.5, subdivisions: 1 }, this.scene);
    water.position.set(x, 0.06, z);
    this.waterMat = this.std("poolWaterMat", "#ffffff", { spec: 0.85 });
    const wt = makeWaterTexture(this.scene);
    wt.uScale = 3;
    wt.vScale = 2;
    this.waterMat.diffuseTexture = wt;
    this.waterMat.emissiveColor = hex("#0e5f7a");
    this.waterMat.alpha = 0.9;
    this.waterMat.specularPower = 96;
    water.material = this.waterMat;
    water.parent = g;
    water.isPickable = false;
    this.poolWaterMesh = water;

    // coping frame around the water
    const copeMat = this.std("copeMat", "#f7ead0", { spec: 0.12 });
    const frame: [number, number, number, number][] = [
      [x, z - d / 2 - cope / 2, w + cope * 2, cope],
      [x, z + d / 2 + cope / 2, w + cope * 2, cope],
      [x - w / 2 - cope / 2, z, cope, d],
      [x + w / 2 + cope / 2, z, cope, d],
    ];
    for (const [fx, fz, fw, fd] of frame) {
      const b = CreateBox("cope", { width: fw, height: 0.3, depth: fd }, this.scene);
      b.position.set(fx, 0.17, fz);
      b.material = copeMat;
      b.receiveShadows = true;
      b.parent = g;
    }

    // Sun deck on the SOUTH side — the far side from the promenade. Putting
    // it on the near side stuck loungers and parasols out into the walkway.
    for (let i = -1; i <= 1; i++) {
      const lx = x + i * 4.0;
      const lz = z - d / 2 - 1.9;
      const bed = CreateBox("lounger", { width: 1.9, height: 0.28, depth: 0.85 }, this.scene);
      bed.position.set(lx, 0.5, lz);
      bed.rotation.z = 0.06;
      bed.material = this.std("loungerMat", "#ffffff", { spec: 0.1 });
      bed.parent = g;
      this.shadows.addShadowCaster(bed);
      for (const ox of [-0.7, 0.7]) {
        const leg = CreateCylinder("leg", { diameter: 0.1, height: 0.4, tessellation: 6 }, this.scene);
        leg.position.set(lx + ox, 0.2, lz);
        leg.material = this.mats.gold;
        leg.parent = g;
      }
      const pole = CreateCylinder("parasolPole", { diameter: 0.11, height: 2.7, tessellation: 8 }, this.scene);
      pole.position.set(lx + 1.4, 1.35, lz);
      pole.material = this.mats.trunk;
      pole.parent = g;
      const shade = CreateCylinder(
        "parasol",
        { diameterTop: 0, diameterBottom: 3.0, tessellation: 10, height: 0.75 },
        this.scene,
      );
      shade.position.set(lx + 1.4, 2.85, lz);
      shade.material = i % 2 === 0 ? this.mats.accent : this.std("parasolAlt", P.slide, { spec: 0.15 });
      shade.parent = g;
      this.shadows.addShadowCaster(shade);
    }
  }

  /**
   * The water slide, bought separately once the pool exists.
   *
   * The first attempt wound too many turns into too small a radius and read as
   * a flat pink snail shell from the iso camera. One tall turn with a real
   * vertical drop, landing inside the pool, reads unmistakably as a slide.
   */
  addSlide(): TransformNode {
    const lot = lotById("s4");
    const g = new TransformNode("slide", this.scene);
    const cx = lot.x - 5.5;
    const cz = lot.z - 1;
    const topY = 10.4;
    const rad0 = 3.9;
    const startAng = -Math.PI / 2;
    const startX = cx + Math.cos(startAng) * rad0;
    const startZ = cz + Math.sin(startAng) * rad0;

    // tower + platform
    const tower = CreateBox("slideTower", { width: 2.4, height: topY, depth: 2.4 }, this.scene);
    tower.position.set(startX, topY / 2, startZ);
    tower.material = this.std("slideTowerMat", "#ffe6c9", { spec: 0.1 });
    tower.parent = g;
    tower.receiveShadows = true;
    this.shadows.addShadowCaster(tower);
    this.structures.push(tower);

    const platform = CreateBox("slidePlat", { width: 3.8, height: 0.32, depth: 3.8 }, this.scene);
    platform.position.set(startX, topY + 0.16, startZ);
    platform.material = this.mats.accent;
    platform.parent = g;
    this.shadows.addShadowCaster(platform);

    // handrail posts round the platform
    for (const [ox, oz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]] as const) {
      const post = CreateCylinder("railPost", { diameter: 0.14, height: 1.1, tessellation: 6 }, this.scene);
      post.position.set(startX + ox, topY + 0.85, startZ + oz);
      post.material = this.mats.gold;
      post.parent = g;
    }

    // ladder
    for (let i = 0; i < 14; i++) {
      const rung = CreateBox("rung", { width: 1.5, height: 0.12, depth: 0.12 }, this.scene);
      rung.position.set(startX, 0.9 + i * 0.7, startZ - 1.35);
      rung.material = this.mats.gold;
      rung.parent = g;
    }

    // the flume — one full turn, dropping ~10 m over ~23 m of run
    const pts: Vector3[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = startAng + t * Math.PI * 2;
      const rad = rad0 - t * 1.1;
      // ease out at the bottom so it flattens into the water instead of
      // spearing through the pool floor
      const drop = 1 - Math.pow(1 - t, 1.7);
      const y = topY - drop * (topY - 0.7);
      pts.push(new Vector3(cx + Math.cos(ang) * rad + t * 5.2, y, cz + Math.sin(ang) * rad + t * 1.4));
    }
    const curve = Curve3.CreateCatmullRomSpline(pts, 5, false);
    this.slidePath = curve.getPoints();

    const flume = CreateTube(
      "flume",
      {
        path: this.slidePath,
        radius: 0.95,
        tessellation: 14,
        cap: Mesh.NO_CAP,
      },
      this.scene,
    );
    flume.material = this.mats.slide;
    flume.parent = g;
    this.shadows.addShadowCaster(flume);

    // support legs down the run
    for (let i = 8; i < this.slidePath.length - 4; i += 18) {
      const p = this.slidePath[i];
      if (p.y < 1.8) continue;
      const leg = CreateCylinder("slideLeg", { diameter: 0.3, height: p.y, tessellation: 8 }, this.scene);
      leg.position.set(p.x, p.y / 2, p.z);
      leg.material = this.std("slideLegMat", "#ffffff", { spec: 0.2 });
      leg.parent = g;
      this.shadows.addShadowCaster(leg);
    }

    // riders whooshing down on a loop
    for (let i = 0; i < 3; i++) {
      const rider = CreateSphere(`rider${i}`, { diameter: 0.82, segments: 8 }, this.scene);
      rider.material = this.std(
        `riderMat${i}`,
        ["#ffe27a", "#9ce88a", "#ff9ec4"][i],
        { spec: 0.25, emis: "#2a2200" },
      );
      rider.parent = g;
      rider.isPickable = false;
      this.slideRiders.push(rider);
    }

    g.parent = this.root;
    this.popIn(g, startX, startZ);
    return g;
  }

  private slidePath: Vector3[] = [];

  /* ------------------------------------------------------------- decor */

  addDecor(id: string, at: { x: number; z: number }): TransformNode {
    const g = new TransformNode(`decor_${id}`, this.scene);

    switch (id) {
      case "planters": {
        // An ice cream cart. Six window boxes of flowers was correct for a
        // hotel and completely uninteresting to look at; this is the first
        // thing most players buy, so it should be worth buying.
        const cart = CreateBox("iceCart", { width: 2.6, height: 1.35, depth: 1.5 }, this.scene);
        cart.position.set(at.x, 1.0, at.z);
        cart.material = this.std("iceCartMat", "#fffbf3", { spec: 0.2 });
        cart.parent = g;
        cart.receiveShadows = true;
        this.shadows.addShadowCaster(cart);

        // candy-stripe skirt
        const skirt = CreateBox("iceSkirt", { width: 2.7, height: 0.55, depth: 1.6 }, this.scene);
        skirt.position.set(at.x, 0.62, at.z);
        const skirtMat = this.std("iceSkirtMat", "#ffffff", { spec: 0.15 });
        const st = makeStripeTexture(this.scene, "#ff5fa2", "#fffbf3");
        st.uScale = 5;
        st.vScale = 1;
        skirtMat.diffuseTexture = st;
        skirt.material = skirtMat;
        skirt.parent = g;

        // counter top and a serving hatch
        const top = CreateBox("iceTop", { width: 2.9, height: 0.14, depth: 1.8 }, this.scene);
        top.position.set(at.x, 1.72, at.z);
        top.material = this.mats.accent;
        top.parent = g;
        this.shadows.addShadowCaster(top);

        // wheels
        for (const ox of [-0.95, 0.95]) {
          const wheel = CreateCylinder("iceWheel", { diameter: 0.62, height: 0.16, tessellation: 14 }, this.scene);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(at.x + ox, 0.31, at.z - 0.72);
          wheel.material = this.std("iceWheelMat", "#4a3a2e", { spec: 0.2 });
          wheel.parent = g;
        }

        // striped parasol on a pole
        const pole = CreateCylinder("icePole", { diameter: 0.11, height: 2.4, tessellation: 8 }, this.scene);
        pole.position.set(at.x + 1.1, 2.9, at.z);
        pole.material = this.mats.gold;
        pole.parent = g;
        const shade = CreateCylinder(
          "iceShade",
          { diameterTop: 0, diameterBottom: 3.4, tessellation: 12, height: 0.8 },
          this.scene,
        );
        shade.position.set(at.x + 1.1, 4.3, at.z);
        shade.material = skirtMat;
        shade.parent = g;
        this.shadows.addShadowCaster(shade);

        // an oversized cone on the roof, so it reads from the iso camera
        const coneY = 2.5;
        const cone = CreateCylinder(
          "iceCone",
          { diameterTop: 0.62, diameterBottom: 0.06, tessellation: 12, height: 0.95 },
          this.scene,
        );
        cone.position.set(at.x - 0.7, coneY, at.z);
        cone.material = this.std("iceConeMat", "#e8b46a", { spec: 0.15 });
        cone.parent = g;
        const scoops: [number, string][] = [
          [0.42, "#ff9ec4"],
          [0.78, "#fff3c4"],
          [1.08, "#a8e6b0"],
        ];
        for (const [dy, col] of scoops) {
          const scoop = CreateSphere("iceScoop", { diameter: 0.66, segments: 10 }, this.scene);
          scoop.position.set(at.x - 0.7, coneY + dy, at.z);
          scoop.material = this.std("iceScoopMat" + col, col, { spec: 0.3 });
          scoop.parent = g;
          this.shadows.addShadowCaster(scoop);
        }
        const cherry = CreateSphere("iceCherry", { diameter: 0.24, segments: 8 }, this.scene);
        cherry.position.set(at.x - 0.7, coneY + 1.42, at.z);
        cherry.material = this.std("iceCherryMat", "#e83a5a", { spec: 0.4, emis: "#3a0810" });
        cherry.parent = g;
        break;
      }
      case "fountain": {
        const base = CreateCylinder("fBase", { diameter: 5.2, height: 0.7, tessellation: 22 }, this.scene);
        base.position.set(at.x, 0.35, at.z);
        base.material = this.std("fBaseMat", "#f0e2cc", { spec: 0.15 });
        base.parent = g;
        base.receiveShadows = true;
        this.shadows.addShadowCaster(base);
        this.structures.push(base);

        const bowl = CreateCylinder("fBowl", { diameter: 4.3, height: 0.28, tessellation: 22 }, this.scene);
        bowl.position.set(at.x, 0.72, at.z);
        const bw = this.std("fWaterMat", "#57d8f0", { spec: 0.8, emis: "#0d4a5c" });
        bowl.material = bw;
        bowl.parent = g;

        const stem = CreateCylinder("fStem", { diameterTop: 0.5, diameterBottom: 0.9, height: 1.9, tessellation: 14 }, this.scene);
        stem.position.set(at.x, 1.6, at.z);
        stem.material = this.std("fStemMat", "#f0e2cc", { spec: 0.15 });
        stem.parent = g;
        this.shadows.addShadowCaster(stem);

        const top = CreateCylinder("fTop", { diameter: 2.1, height: 0.22, tessellation: 18 }, this.scene);
        top.position.set(at.x, 2.6, at.z);
        top.material = this.std("fTopMat", "#f7ead0", { spec: 0.15 });
        top.parent = g;

        for (let i = 0; i < 8; i++) {
          const jet = CreateCylinder("fJet", { diameter: 0.14, height: 1.4, tessellation: 6 }, this.scene);
          const a = (i / 8) * Math.PI * 2;
          jet.position.set(at.x + Math.cos(a) * 0.6, 3.2, at.z + Math.sin(a) * 0.6);
          jet.rotation.z = Math.cos(a) * 0.5;
          jet.rotation.x = -Math.sin(a) * 0.5;
          const jm = this.std("fJetMat", "#bff0ff", { spec: 0.7, emis: "#2a6f80" });
          jm.alpha = 0.7;
          jet.material = jm;
          jet.parent = g;
          this.fountainSpray.push(jet);
        }
        break;
      }
      case "palms": {
        // Planted behind the north room band, not on the strip beside the
        // promenade where the pad sits — a row of trunks down the middle of
        // the walkway just got in the way. The crowns still clear the
        // rooflines, so they read from the camera as a backdrop.
        const PALM_Z = 13.2;
        for (let i = 0; i < 7; i++) {
          this.palmTree(at.x - 12 + i * 4.2, PALM_Z + (i % 2 === 0 ? 0.7 : -0.7), 1.1, true, g);
        }
        break;
      }
      case "carpet": {
        const rug = CreateGround("carpetRug", { width: 26, height: 3.2, subdivisions: 1 }, this.scene);
        rug.position.set(at.x - 4, 0.04, 0);
        rug.material = this.std("carpetMat", "#c8324a", { spec: 0.12, emis: "#2a0810" });
        rug.parent = g;
        for (let i = 0; i < 10; i++) {
          for (const sz of [-1.9, 1.9]) {
            const post = CreateCylinder("ropePost", { diameter: 0.16, height: 1.0, tessellation: 8 }, this.scene);
            post.position.set(at.x - 16 + i * 2.7, 0.5, sz);
            post.material = this.mats.gold;
            post.parent = g;
          }
        }
        break;
      }
      case "statue": {
        const plinth = CreateBox("plinth", { width: 2.4, height: 2.0, depth: 2.4 }, this.scene);
        plinth.position.set(at.x, 1.0, at.z);
        plinth.material = this.std("plinthMat", "#e8dcc4", { spec: 0.2 });
        plinth.parent = g;
        this.shadows.addShadowCaster(plinth);

        const body = CreateCylinder("statueBody", { diameterTop: 0.7, diameterBottom: 1.0, height: 1.9, tessellation: 12 }, this.scene);
        body.position.set(at.x, 2.95, at.z);
        body.material = this.mats.gold;
        body.parent = g;
        this.shadows.addShadowCaster(body);

        const head = CreateSphere("statueHead", { diameter: 0.85, segments: 10 }, this.scene);
        head.position.set(at.x, 4.2, at.z);
        head.material = this.mats.gold;
        head.parent = g;

        const hat = CreateCylinder("statueHat", { diameter: 1.15, height: 0.14, tessellation: 14 }, this.scene);
        hat.position.set(at.x, 4.56, at.z);
        hat.material = this.mats.gold;
        hat.parent = g;

        const arm = CreateCylinder("statueArm", { diameter: 0.22, height: 1.5, tessellation: 8 }, this.scene);
        arm.position.set(at.x + 0.6, 3.5, at.z);
        arm.rotation.z = -0.9;
        arm.material = this.mats.gold;
        arm.parent = g;
        break;
      }
      case "fireworks": {
        for (let i = 0; i < 4; i++) {
          const tube = CreateCylinder("fwTube", { diameter: 0.5, height: 1.3, tessellation: 10 }, this.scene);
          tube.position.set(at.x - 3 + i * 2, 0.65, at.z);
          tube.rotation.z = (i - 1.5) * 0.12;
          tube.material = this.std("fwMat", "#c8324a", { spec: 0.2, emis: "#3a0a12" });
          tube.parent = g;
          this.shadows.addShadowCaster(tube);
        }
        this.fireworksAt = { x: at.x, z: at.z };
        break;
      }
    }

    g.parent = this.root;
    this.popIn(g, at.x, at.z);
    return g;
  }

  fireworksAt: { x: number; z: number } | null = null;

  /** Shared frond material — one alpha-cut leaf texture for every palm. */
  private frondMat: StandardMaterial | null = null;

  private palmTree(x: number, z: number, scale: number, shadow: boolean, parent?: TransformNode): void {
    if (!this.frondMat) {
      const fm = this.std("frondMat", "#ffffff", { spec: 0.06 });
      const tex = makeFrondTexture(this.scene, P.leaf, P.leafDark);
      fm.diffuseTexture = tex;
      fm.useAlphaFromDiffuseTexture = true;
      fm.backFaceCulling = false;
      // alpha-tested rather than blended, so fronds sort correctly against
      // each other and against the buildings behind them
      fm.diffuseTexture.hasAlpha = true;
      fm.transparencyMode = 1; // ALPHATEST
      this.frondMat = fm;
    }

    const g = new TransformNode("palm", this.scene);
    const h = 5.2 * scale;
    const trunk = CreateCylinder(
      "palmTrunk",
      { diameterTop: 0.34 * scale, diameterBottom: 0.62 * scale, height: h, tessellation: 8 },
      this.scene,
    );
    trunk.position.set(x, h / 2, z);
    trunk.rotation.z = 0.07;
    trunk.material = this.mats.trunk;
    trunk.parent = g;
    if (shadow) this.shadows.addShadowCaster(trunk);

    const crown = new TransformNode("crown", this.scene);
    crown.position.set(x, h, z);
    crown.parent = g;
    for (let i = 0; i < 8; i++) {
      const frond = CreatePlane("frond", { width: 1.5 * scale, height: 4.2 * scale }, this.scene);
      const a = (i / 8) * Math.PI * 2 + (i % 2) * 0.18;
      const droop = i % 2 === 0 ? 0.62 : 0.42;
      // pivot at the stem end so the frond radiates outward from the crown
      frond.setPivotPoint(new Vector3(0, -2.1 * scale, 0));
      frond.position.set(Math.cos(a) * 0.25 * scale, 0.1, Math.sin(a) * 0.25 * scale);
      frond.rotation.set(Math.PI / 2 - droop, a + Math.PI / 2, 0);
      frond.material = this.frondMat;
      frond.parent = crown;
      if (shadow) this.shadows.addShadowCaster(frond);
    }
    for (let i = 0; i < 3; i++) {
      const nut = CreateSphere("coconut", { diameter: 0.42 * scale, segments: 6 }, this.scene);
      nut.position.set(Math.cos(i * 2.1) * 0.4, -0.25, Math.sin(i * 2.1) * 0.4);
      nut.material = this.mats.trunk;
      nut.parent = crown;
    }
    this.palmFronds.push(crown);
    g.parent = parent ?? this.root;
  }

  /* ===================================================================== */
  /* animation                                                              */
  /* ===================================================================== */

  /**
   * Scale a freshly built structure up from nothing with an elastic pop.
   * Children are positioned in world space under an untransformed parent, so
   * the pivot has to be moved to the lot centre or the building grows out of
   * the world origin instead of out of its own footprint.
   */
  private popIn(node: TransformNode, x: number, z: number): void {
    node.setPivotPoint(new Vector3(x, 0, z));
    node.scaling.setAll(0.01);
    popTargets.push({ node, t: 0 });
  }

  update(dt: number, camFocus: Vector3): void {
    this.time += dt;

    // ------------------------------------------------------- water motion
    const st = this.seaMat.diffuseTexture as Texture | null;
    if (st) {
      st.uOffset = this.time * 0.012;
      st.vOffset = this.time * 0.008;
    }
    if (this.waterMat) {
      const wt = this.waterMat.diffuseTexture as Texture | null;
      if (wt) {
        wt.uOffset = this.time * 0.045;
        wt.vOffset = Math.sin(this.time * 0.4) * 0.04 + this.time * 0.021;
      }
      if (this.poolWaterMesh) {
        this.poolWaterMesh.position.y = 0.06 + Math.sin(this.time * 1.6) * 0.015;
      }
    }

    // --------------------------------------------------------- palm sway
    for (let i = 0; i < this.palmFronds.length; i++) {
      const c = this.palmFronds[i];
      c.rotation.z = Math.sin(this.time * 0.85 + i * 1.3) * 0.055;
      c.rotation.x = Math.cos(this.time * 0.7 + i * 0.7) * 0.04;
    }

    // ------------------------------------------------------ fountain jets
    for (let i = 0; i < this.fountainSpray.length; i++) {
      const j = this.fountainSpray[i];
      j.scaling.y = 0.75 + Math.sin(this.time * 3.4 + i * 0.8) * 0.22;
    }

    // ----------------------------------------------------- slide riders
    if (this.slidePath.length > 2) {
      for (let i = 0; i < this.slideRiders.length; i++) {
        const r = this.slideRiders[i];
        const t = (this.time * 0.34 + i * 0.5) % 1;
        const idx = Math.min(this.slidePath.length - 1, Math.floor(t * this.slidePath.length));
        const p = this.slidePath[idx];
        r.position.copyFrom(p);
        r.position.y += 0.15;
        r.scaling.setAll(0.9 + Math.sin(t * 22) * 0.08);
      }
    }

    // ------------------------------------------------- structure pop-ins
    for (let i = popTargets.length - 1; i >= 0; i--) {
      const pt = popTargets[i];
      pt.t += dt / 0.62;
      if (pt.t >= 1) {
        pt.node.scaling.setAll(1);
        popTargets.splice(i, 1);
        continue;
      }
      const e = outElastic(pt.t);
      pt.node.scaling.set(e, e * (0.7 + 0.3 * e), e);
    }

    // -------------------------------------------------------------- camera
    const want = camFocus;
    this.camTarget.x += (want.x - this.camTarget.x) * Math.min(1, dt * 3.4);
    this.camTarget.z += (want.z - this.camTarget.z) * Math.min(1, dt * 3.4);

    let shakeX = 0;
    let shakeZ = 0;
    if (this.camShake > 0.001) {
      shakeX = (Math.random() - 0.5) * this.camShake;
      shakeZ = (Math.random() - 0.5) * this.camShake;
      this.camShake *= Math.pow(0.0025, dt);
    } else {
      this.camShake = 0;
    }

    this.camera.target.set(this.camTarget.x + shakeX, 1.2, this.camTarget.z + shakeZ);

    const wantRadius = Math.max(38, this.plotWidth * CAM_FIT);
    this.camera.radius += (wantRadius - this.camera.radius) * Math.min(1, dt * 1.6);

    // Key light from the front-left, so the two faces the fixed camera can
    // actually see are the two the sun hits. Lighting from behind the camera's
    // blind side left every visible wall flat grey.
    this.sun.position.set(this.camTarget.x - 26, 44, this.camTarget.z - 30);
    this.sun.setDirectionToTarget(new Vector3(this.camTarget.x, 0, this.camTarget.z));
  }
}

/* ======================================================================== */
/* helpers                                                                   */
/* ======================================================================== */

const popTargets: { node: TransformNode; t: number }[] = [];

function outElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

