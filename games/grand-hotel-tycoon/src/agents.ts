/**
 * Characters.
 *
 * Guests and staff are `InstancedMesh`es cloned from a handful of merged
 * prototypes — eight guest outfits and five staff uniforms — so a busy resort
 * with thirty people in it still only costs about a dozen draw calls. Each
 * prototype bakes its colours into vertex data, which is why they can all
 * share one material.
 *
 * The manager is the exception: it's the one character the player watches
 * constantly, so it gets a real jointed rig with a proper walk cycle.
 */
import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

import { PALETTE as P, GUEST_COLORS, hex, GUEST_H } from "./config";
import type { StaffRole } from "./content";

/** Paint every vertex of a mesh one flat colour, ready for merging. */
function paint(mesh: Mesh, color: string): Mesh {
  const c = Color3.FromHexString(color);
  const n = mesh.getTotalVertices();
  const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    data[i * 4] = c.r;
    data[i * 4 + 1] = c.g;
    data[i * 4 + 2] = c.b;
    data[i * 4 + 3] = 1;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, data);
  return mesh;
}

export interface CharSpec {
  shirt: string;
  trousers: string;
  skin: string;
  hair: string;
  /** Optional hat/cap colour — staff wear one so they read as employees. */
  hat?: string;
  /** Something carried in one hand, tinted this colour. */
  prop?: string;
}

/**
 * Build one merged, vertex-coloured character. Feet sit on y=0 and the whole
 * figure is GUEST_H tall so instances can be dropped straight onto the ground.
 */
function buildCharacter(scene: Scene, name: string, s: CharSpec): Mesh {
  const parts: Mesh[] = [];
  const H = GUEST_H;

  // legs
  for (const ox of [-0.13, 0.13]) {
    const leg = CreateBox(`${name}_leg`, { width: 0.17, height: H * 0.3, depth: 0.19 }, scene);
    leg.position.set(ox, H * 0.15, 0);
    parts.push(paint(leg, s.trousers));
  }

  // shoes
  for (const ox of [-0.13, 0.13]) {
    const shoe = CreateBox(`${name}_shoe`, { width: 0.2, height: 0.09, depth: 0.3 }, scene);
    shoe.position.set(ox, 0.045, 0.05);
    parts.push(paint(shoe, "#3b3a44"));
  }

  // torso — slightly tapered so it doesn't read as a plain box
  const torso = CreateCylinder(
    `${name}_torso`,
    { diameterTop: 0.46, diameterBottom: 0.54, height: H * 0.36, tessellation: 10 },
    scene,
  );
  torso.position.set(0, H * 0.48, 0);
  torso.scaling.z = 0.72;
  parts.push(paint(torso, s.shirt));

  // arms
  for (const ox of [-0.29, 0.29]) {
    const arm = CreateCylinder(
      `${name}_arm`,
      { diameter: 0.14, height: H * 0.3, tessellation: 8 },
      scene,
    );
    arm.position.set(ox, H * 0.47, 0);
    arm.rotation.z = ox > 0 ? -0.12 : 0.12;
    parts.push(paint(arm, s.shirt));
    const hand = CreateSphere(`${name}_hand`, { diameter: 0.16, segments: 6 }, scene);
    hand.position.set(ox * 1.09, H * 0.32, 0);
    parts.push(paint(hand, s.skin));
  }

  // neck + head
  const neck = CreateCylinder(`${name}_neck`, { diameter: 0.17, height: 0.1, tessellation: 8 }, scene);
  neck.position.set(0, H * 0.68, 0);
  parts.push(paint(neck, s.skin));

  const head = CreateSphere(`${name}_head`, { diameter: 0.42, segments: 12 }, scene);
  head.position.set(0, H * 0.83, 0);
  head.scaling.set(1, 1.08, 0.94);
  parts.push(paint(head, s.skin));

  // hair — a cap-shaped half sphere
  const hair = CreateSphere(`${name}_hair`, { diameter: 0.45, segments: 12, slice: 0.56 }, scene);
  hair.position.set(0, H * 0.845, -0.01);
  hair.scaling.set(1, 1.0, 0.98);
  parts.push(paint(hair, s.hair));

  // eyes, so the little people actually have faces from the iso camera
  for (const ox of [-0.09, 0.09]) {
    const eye = CreateSphere(`${name}_eye`, { diameter: 0.075, segments: 6 }, scene);
    eye.position.set(ox, H * 0.845, 0.185);
    parts.push(paint(eye, "#22303a"));
  }

  if (s.hat) {
    const brim = CreateCylinder(`${name}_brim`, { diameter: 0.52, height: 0.035, tessellation: 14 }, scene);
    brim.position.set(0, H * 0.96, 0);
    parts.push(paint(brim, s.hat));
    const crown = CreateCylinder(
      `${name}_crown`,
      { diameterTop: 0.3, diameterBottom: 0.34, height: 0.19, tessellation: 12 },
      scene,
    );
    crown.position.set(0, H * 1.02, 0);
    parts.push(paint(crown, s.hat));
  }

  if (s.prop) {
    const prop = CreateBox(`${name}_prop`, { width: 0.26, height: 0.3, depth: 0.2 }, scene);
    prop.position.set(0.36, H * 0.26, 0.06);
    parts.push(paint(prop, s.prop));
  }

  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, false);
  if (!merged) throw new Error(`failed to merge character ${name}`);
  merged.name = name;
  merged.isPickable = false;
  merged.useVertexColors = true;
  // Hiding an instance source (setEnabled(false) / isVisible = false) can take
  // its instances down with it depending on the render path, so park the
  // prototype far below the world instead. It stays a legal shadow caster and
  // never enters the camera or shadow frustum.
  merged.position.y = -500;
  return merged;
}

const STAFF_SPECS: Record<StaffRole, CharSpec> = {
  maid: { shirt: "#7fd4f5", trousers: "#4a6b7d", skin: P.skinA, hair: "#6b4a2f", hat: "#ffffff", prop: "#e8734a" },
  porter: { shirt: "#c8324a", trousers: "#2d3a44", skin: P.skinB, hair: "#241a12", hat: "#ffd24a" },
  clerk: { shirt: "#4a5fd4", trousers: "#2d3a44", skin: P.skinA, hair: "#3a2418", hat: "#ffffff" },
  lifeguard: { shirt: "#ffd23b", trousers: "#e8734a", skin: P.skinC, hair: "#1a1210", hat: "#e8734a", prop: "#ffffff" },
  waiter: { shirt: "#2e2e38", trousers: "#2e2e38", skin: P.skinA, hair: "#4a3020", hat: "#ffffff", prop: "#f0e2cc" },
};

const HAIRS = ["#3a2418", "#6b4a2f", "#241a12", "#8a6242", "#c4913f", "#4a2a2a"];
const TROUSERS = ["#3d5a6b", "#5b4a6b", "#4a5b3d", "#6b4a4a", "#2d3a44"];
const SKINS = [P.skinA, P.skinB, P.skinC];

export class CharacterFactory {
  private mat: StandardMaterial;
  guestProtos: Mesh[] = [];
  staffProtos = new Map<StaffRole, Mesh>();

  constructor(scene: Scene, shadows: ShadowGenerator) {
    // one material for every character in the game; all colour lives in the
    // baked vertex data, so this never needs to change
    this.mat = new StandardMaterial("charMat", scene);
    this.mat.diffuseColor = Color3.White();
    this.mat.specularColor = hex("#ffffff").scale(0.12);
    this.mat.specularPower = 40;

    GUEST_COLORS.forEach((shirt, i) => {
      const m = buildCharacter(scene, `guestProto${i}`, {
        shirt,
        trousers: TROUSERS[i % TROUSERS.length],
        skin: SKINS[i % SKINS.length],
        hair: HAIRS[i % HAIRS.length],
      });
      m.material = this.mat;
      shadows.addShadowCaster(m);
      this.guestProtos.push(m);
    });

    (Object.keys(STAFF_SPECS) as StaffRole[]).forEach((role) => {
      const m = buildCharacter(scene, `staffProto_${role}`, STAFF_SPECS[role]);
      m.material = this.mat;
      shadows.addShadowCaster(m);
      this.staffProtos.set(role, m);
    });
  }

  newGuest(variant: number): InstancedMesh {
    const proto = this.guestProtos[variant % this.guestProtos.length];
    const inst = proto.createInstance(`guest_${instCounter++}`);
    inst.isPickable = false;
    return inst;
  }

  newStaff(role: StaffRole): InstancedMesh {
    const proto = this.staffProtos.get(role)!;
    const inst = proto.createInstance(`staff_${instCounter++}`);
    inst.isPickable = false;
    return inst;
  }
}

let instCounter = 0;

/**
 * Drive an instanced character's bob, lean and squash from its speed.
 * `phase` is per-agent so a crowd doesn't march in lockstep.
 */
export function animateWalker(
  inst: InstancedMesh,
  x: number,
  z: number,
  heading: number,
  speed01: number,
  phase: number,
  t: number,
): void {
  const cycle = t * 9 + phase;
  const bob = Math.abs(Math.sin(cycle)) * 0.09 * speed01;
  const squash = 1 + Math.sin(cycle * 2) * 0.05 * speed01;
  inst.position.set(x, bob, z);
  inst.rotation.y = heading;
  inst.rotation.x = -speed01 * 0.1;
  inst.rotation.z = Math.sin(cycle) * 0.06 * speed01;
  inst.scaling.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
}

/* ========================================================================= */
/* the manager                                                               */
/* ========================================================================= */

/** How tall the carried-cash tower gets at full capacity. */
const NOTE_COUNT = 24;
const NOTE_STEP = 0.13;

/** A jointed rig so the one character the player steers actually walks. */
export class ManagerRig {
  root: TransformNode;
  private hips: TransformNode;
  private legs: TransformNode[] = [];
  private arms: TransformNode[] = [];
  private torso!: Mesh;
  private head!: TransformNode;
  private cashStack: Mesh[] = [];
  private t = 0;

  constructor(scene: Scene, shadows: ShadowGenerator) {
    this.root = new TransformNode("manager", scene);
    this.hips = new TransformNode("managerHips", scene);
    this.hips.parent = this.root;

    const mat = (name: string, color: string, emis = "#000000") => {
      const m = new StandardMaterial(name, scene);
      m.diffuseColor = hex(color);
      m.specularColor = hex("#ffffff").scale(0.16);
      m.specularPower = 40;
      m.emissiveColor = hex(emis);
      return m;
    };

    const shirtMat = mat("mgrShirt", P.managerShirt, "#2a0f06");
    const trouserMat = mat("mgrTrouser", "#2d3a44");
    const skinMat = mat("mgrSkin", P.skinA);
    const goldMat = mat("mgrGold", P.managerTrim, "#5a4000");
    const darkMat = mat("mgrDark", "#22303a");

    const H = 1.78;

    // legs, pivoted at the hip so they can swing
    for (const ox of [-0.16, 0.16]) {
      const pivot = new TransformNode("legPivot", scene);
      pivot.position.set(ox, H * 0.34, 0);
      pivot.parent = this.hips;
      const leg = CreateBox("mgrLeg", { width: 0.19, height: H * 0.34, depth: 0.21 }, scene);
      leg.position.y = -H * 0.17;
      leg.material = trouserMat;
      leg.parent = pivot;
      const shoe = CreateBox("mgrShoe", { width: 0.22, height: 0.1, depth: 0.34 }, scene);
      shoe.position.set(0, -H * 0.34 + 0.05, 0.06);
      shoe.material = darkMat;
      shoe.parent = pivot;
      shadows.addShadowCaster(leg);
      this.legs.push(pivot);
    }

    // torso
    this.torso = CreateCylinder(
      "mgrTorso",
      { diameterTop: 0.5, diameterBottom: 0.6, height: H * 0.36, tessellation: 12 },
      scene,
    );
    this.torso.position.set(0, H * 0.52, 0);
    this.torso.scaling.z = 0.74;
    this.torso.material = shirtMat;
    this.torso.parent = this.hips;
    shadows.addShadowCaster(this.torso);

    // gold trim band — catches the glow layer, so the player is always findable
    const band = CreateCylinder("mgrBand", { diameter: 0.62, height: 0.09, tessellation: 12 }, scene);
    band.position.set(0, H * 0.4, 0);
    band.scaling.z = 0.74;
    band.material = goldMat;
    band.parent = this.hips;

    // arms, pivoted at the shoulder
    for (const ox of [-0.32, 0.32]) {
      const pivot = new TransformNode("armPivot", scene);
      pivot.position.set(ox, H * 0.63, 0);
      pivot.parent = this.hips;
      const arm = CreateCylinder("mgrArm", { diameter: 0.15, height: H * 0.31, tessellation: 8 }, scene);
      arm.position.y = -H * 0.155;
      arm.material = shirtMat;
      arm.parent = pivot;
      const hand = CreateSphere("mgrHand", { diameter: 0.17, segments: 8 }, scene);
      hand.position.y = -H * 0.32;
      hand.material = skinMat;
      hand.parent = pivot;
      shadows.addShadowCaster(arm);
      this.arms.push(pivot);
    }

    // head group
    this.head = new TransformNode("mgrHeadGrp", scene);
    this.head.position.set(0, H * 0.74, 0);
    this.head.parent = this.hips;

    const neck = CreateCylinder("mgrNeck", { diameter: 0.18, height: 0.1, tessellation: 8 }, scene);
    neck.material = skinMat;
    neck.parent = this.head;

    const head = CreateSphere("mgrHead", { diameter: 0.46, segments: 14 }, scene);
    head.position.y = 0.28;
    head.scaling.set(1, 1.06, 0.95);
    head.material = skinMat;
    head.parent = this.head;
    shadows.addShadowCaster(head);

    const hair = CreateSphere("mgrHair", { diameter: 0.49, segments: 14, slice: 0.5 }, scene);
    hair.position.y = 0.3;
    hair.material = mat("mgrHair", "#4a3020");
    hair.parent = this.head;

    for (const ox of [-0.1, 0.1]) {
      const eye = CreateSphere("mgrEye", { diameter: 0.08, segments: 6 }, scene);
      eye.position.set(ox, 0.29, 0.2);
      eye.material = darkMat;
      eye.parent = this.head;
    }

    // a smart concierge cap in the resort's own colours
    const brim = CreateCylinder("mgrBrim", { diameter: 0.58, height: 0.04, tessellation: 16 }, scene);
    brim.position.y = 0.47;
    brim.material = goldMat;
    brim.parent = this.head;
    const crown = CreateCylinder(
      "mgrCrown",
      { diameterTop: 0.34, diameterBottom: 0.4, height: 0.22, tessellation: 14 },
      scene,
    );
    crown.position.y = 0.58;
    crown.material = shirtMat;
    crown.parent = this.head;
    shadows.addShadowCaster(crown);

    // A ridiculous tower of banknotes balanced on the manager's head. It is
    // the main readout for "how much am I carrying" and the funniest thing in
    // the game, so it is deliberately taller than the character.
    const noteA = mat("noteA", "#4fbf6a", "#123016");
    const noteB = mat("noteB", "#86dd97", "#123016");
    const bandMat = mat("noteBand", "#e8c65a", "#3a2f00");
    for (let i = 0; i < NOTE_COUNT; i++) {
      const note = CreateBox("mgrNote", { width: 0.72, height: 0.075, depth: 0.46 }, scene);
      note.position.set(0, H * 1.02 + i * NOTE_STEP, 0);
      note.rotation.y = (i % 2 ? 0.2 : -0.16) + i * 0.05;
      note.material = i % 2 === 0 ? noteA : noteB;
      note.parent = this.root;
      note.setEnabled(false);
      // a paper band every fifth note, so the tower reads as bundles
      if (i % 5 === 4) {
        const wrap = CreateBox("mgrBand", { width: 0.78, height: 0.05, depth: 0.16 }, scene);
        wrap.position.y = 0.02;
        wrap.material = bandMat;
        wrap.parent = note;
      }
      shadows.addShadowCaster(note);
      this.cashStack.push(note);
    }
  }

  /**
   * Size the tower from the money on hand.
   *
   * Logarithmic: there is no carry cap any more, so a linear mapping would
   * either peg instantly or never move. This keeps the stack visibly growing
   * from the first coin into the thousands.
   */
  setMoney(amount: number): void {
    const n =
      amount <= 0
        ? 0
        : Math.max(1, Math.min(NOTE_COUNT, Math.round(Math.log10(1 + amount / 8) * 9)));
    if (n === this.noteCount) return;
    this.noteCount = n;
    for (let i = 0; i < this.cashStack.length; i++) {
      this.cashStack[i].setEnabled(i < n);
    }
  }

  private noteCount = -1;

  update(x: number, z: number, heading: number, speed01: number, dt: number): void {
    this.t += dt * (0.6 + speed01 * 1.6);
    this.root.position.set(x, 0, z);
    this.root.rotation.y = heading;

    const swing = Math.sin(this.t * 7.5) * 0.72 * speed01;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.arms[0].rotation.x = -swing * 0.8;
    this.arms[1].rotation.x = swing * 0.8;

    // bob and a slight forward lean into the run
    const bob = Math.abs(Math.sin(this.t * 7.5)) * 0.075 * speed01;
    this.hips.position.y = bob;
    this.hips.rotation.x = speed01 * 0.13;
    this.head.rotation.x = -speed01 * 0.09;

    // idle breathing when standing still
    if (speed01 < 0.05) {
      this.torso.scaling.y = 1 + Math.sin(this.t * 2.2) * 0.022;
    } else {
      this.torso.scaling.y = 1;
    }

    // The tower sways like a pendulum — barely at the bottom, wildly at the
    // top, and more the faster you run. Each note leans a little further than
    // the one below it, which is what sells the wobble.
    const wob = Math.sin(this.t * 4.2) * (0.035 + speed01 * 0.09);
    const lean = Math.sin(this.t * 2.6) * 0.02;
    for (let i = 0; i < this.noteCount && i < this.cashStack.length; i++) {
      const up = i + 1;
      this.cashStack[i].rotation.z = wob * up + lean * up * 0.5;
      this.cashStack[i].rotation.x = Math.cos(this.t * 3.1 + i * 0.2) * 0.012 * up;
      this.cashStack[i].position.x = Math.sin(this.t * 4.2) * 0.014 * up * up * 0.06;
    }
  }

  /** Squash-and-stretch pop, used when the manager banks a pile of cash. */
  pop(): void {
    this.torso.scaling.y = 1.24;
  }
}

/* ========================================================================= */
/* mood bubbles                                                              */
/* ========================================================================= */

export type Mood = 0 | 1 | 2 | 3; // happy, neutral, grumpy, has-key

/**
 * A small pool of billboarded speech bubbles. Only the guests who most need
 * attention get one, which keeps the draw-call cost fixed no matter how long
 * the queue gets.
 */
export class MoodPool {
  private bubbles: { mesh: Mesh; mat: StandardMaterial; used: boolean }[] = [];

  /**
   * `makeSheet` is called once per bubble rather than cloning a shared
   * texture — a cloned DynamicTexture does not reliably carry its canvas
   * contents across, and each bubble needs its own uOffset anyway.
   */
  constructor(
    scene: Scene,
    makeSheet: () => DynamicTexture,
    noGlow: (m: Mesh) => void,
    size = 12,
  ) {
    for (let i = 0; i < size; i++) {
      const mesh = CreatePlane(`mood${i}`, { width: 0.9, height: 0.9 }, scene);
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mesh.isPickable = false;
      const mat = new StandardMaterial(`moodMat${i}`, scene);
      const tex = makeSheet();
      tex.hasAlpha = true;
      (tex as Texture).uScale = 1 / 4;
      mat.diffuseTexture = tex;
      mat.useAlphaFromDiffuseTexture = true;
      mat.disableLighting = true;
      mat.emissiveColor = Color3.White();
      mesh.material = mat;
      mesh.setEnabled(false);
      noGlow(mesh);
      this.bubbles.push({ mesh, mat, used: false });
    }
  }

  /** Call once per frame before assigning bubbles. */
  beginFrame(): void {
    for (const b of this.bubbles) b.used = false;
  }

  /** Place a bubble; silently does nothing once the pool is exhausted. */
  show(x: number, y: number, z: number, mood: Mood, bounce: number): void {
    const b = this.bubbles.find((v) => !v.used);
    if (!b) return;
    b.used = true;
    b.mesh.setEnabled(true);
    b.mesh.position.set(x, y + Math.sin(bounce) * 0.06, z);
    const scale = 0.9 + Math.sin(bounce * 2) * 0.05;
    b.mesh.scaling.set(scale, scale, scale);
    const tex = b.mat.diffuseTexture as Texture;
    tex.uOffset = mood / 4;
  }

  /** Hide anything not claimed this frame. */
  endFrame(): void {
    for (const b of this.bubbles) if (!b.used) b.mesh.setEnabled(false);
  }
}

/* ========================================================================= */
/* loose props                                                               */
/* ========================================================================= */

/** Bobbing cash pile dropped by a guest, waiting to be walked over. */
export function makeCashPile(proto: Mesh, id: number): InstancedMesh {
  const inst = proto.createInstance(`cash_${id}`);
  inst.isPickable = false;
  return inst;
}

export function makeFloatie(proto: Mesh, id: number): InstancedMesh {
  const inst = proto.createInstance(`floatie_${id}`);
  inst.isPickable = false;
  return inst;
}
