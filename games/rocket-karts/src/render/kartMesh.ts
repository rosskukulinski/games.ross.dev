/**
 * A kart: chunky low-poly body, four wheels, a helmeted driver, spoiler,
 * exhausts that glow under boost, and a blob shadow. Built once, then posed.
 */
import { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { KartDef } from '../shared/karts.ts';
import { SPIN_TIME, driftTier } from '../shared/kart.ts';
import { hex } from './scene.ts';

export interface KartPose {
  x: number;
  z: number;
  heading: number;
  speed: number;
  steer: number;
  drift: number;
  driftCharge: number;
  boostTime: number;
  spinTime: number;
  starTime: number;
  offroad: boolean;
}

export const DRIFT_COLORS = ['#4ef5ff', '#ffb347', '#ff4fd8'];

export class KartView {
  readonly root: TransformNode;
  readonly body: TransformNode;
  readonly rearAnchor: TransformNode;
  readonly exhaustL: TransformNode;
  readonly exhaustR: TransformNode;
  readonly wheelL: TransformNode;
  readonly wheelR: TransformNode;
  private readonly wheels: Mesh[] = [];
  private readonly frontPivots: TransformNode[] = [];
  private readonly bodyMat: StandardMaterial;
  private readonly accentMat: StandardMaterial;
  private readonly exhaustMat: StandardMaterial;
  private readonly baseColor: Color3;
  private readonly accentColor: Color3;
  private readonly shadow: Mesh;
  private hop = 0;
  private spinAngle = 0;
  private wheelSpin = 0;
  private bob = 0;
  private readonly own: { dispose(): void }[] = [];

  constructor(scene: Scene, def: KartDef, shadowTex: DynamicTexture) {
    this.root = new TransformNode(`kart-${def.id}`, scene);
    this.body = new TransformNode('body', scene);
    this.body.parent = this.root;

    const keep = <T extends { dispose(): void }>(x: T): T => {
      this.own.push(x);
      return x;
    };
    const mat = (name: string, color: string, spec = 0.25): StandardMaterial => {
      const m = keep(new StandardMaterial(name, scene));
      m.diffuseColor = hex(color);
      m.specularColor = new Color3(spec, spec, spec);
      m.specularPower = 32;
      return m;
    };
    this.baseColor = hex(def.color);
    this.accentColor = hex(def.accent);
    this.bodyMat = mat('bodyMat', def.color, 0.4);
    this.accentMat = mat('accentMat', def.accent, 0.3);
    const dark = mat('darkMat', '#1e1a33', 0.1);
    const tyre = mat('tyreMat', '#1a1826', 0.05);
    const hub = mat('hubMat', '#d8d8e6', 0.5);
    const skin = mat('skinMat', '#ffd9b3', 0.1);
    const visor = mat('visorMat', '#1a1830', 0.9);
    this.exhaustMat = mat('exhaustMat', '#7a7690', 0.5);

    const box = (name: string, w: number, h: number, d: number, m: StandardMaterial, x: number, y: number, z: number, parent: TransformNode = this.body): Mesh => {
      const b = CreateBox(name, { width: w, height: h, depth: d }, scene);
      b.material = m;
      b.position.set(x, y, z);
      b.parent = parent;
      b.isPickable = false;
      return b;
    };

    // chassis
    box('chassis', 1.5, 0.42, 2.3, this.bodyMat, 0, 0.5, 0);
    const nose = box('nose', 1.1, 0.34, 0.8, this.bodyMat, 0, 0.5, 1.45);
    nose.rotation.x = -0.12;
    box('noseTip', 0.7, 0.22, 0.4, this.accentMat, 0, 0.48, 1.9);
    box('sidePodL', 0.34, 0.4, 1.1, this.accentMat, -0.85, 0.42, -0.1);
    box('sidePodR', 0.34, 0.4, 1.1, this.accentMat, 0.85, 0.42, -0.1);
    box('seatBack', 1.0, 0.5, 0.25, dark, 0, 0.85, -0.55);
    box('dash', 1.0, 0.16, 0.5, dark, 0, 0.76, 0.5);
    // spoiler
    box('spoiler', 1.8, 0.1, 0.5, this.accentMat, 0, 1.05, -1.15);
    box('spoilerL', 0.1, 0.4, 0.3, dark, -0.6, 0.85, -1.1);
    box('spoilerR', 0.1, 0.4, 0.3, dark, 0.6, 0.85, -1.1);
    // exhausts
    this.exhaustL = new TransformNode('exL', scene);
    this.exhaustL.parent = this.body;
    this.exhaustL.position.set(-0.4, 0.42, -1.3);
    this.exhaustR = new TransformNode('exR', scene);
    this.exhaustR.parent = this.body;
    this.exhaustR.position.set(0.4, 0.42, -1.3);
    for (const [name, node] of [
      ['pipeL', this.exhaustL],
      ['pipeR', this.exhaustR],
    ] as const) {
      const pipe = CreateCylinder(name, { height: 0.5, diameter: 0.26, tessellation: 8 }, scene);
      pipe.material = this.exhaustMat;
      pipe.rotation.x = Math.PI / 2;
      pipe.parent = node;
      pipe.position.z = 0.1;
      pipe.isPickable = false;
    }
    this.rearAnchor = new TransformNode('rear', scene);
    this.rearAnchor.parent = this.body;
    this.rearAnchor.position.set(0, 0.25, -1.0);
    this.wheelL = new TransformNode('wheelAnchorL', scene);
    this.wheelL.parent = this.body;
    this.wheelL.position.set(-0.85, 0.15, -0.85);
    this.wheelR = new TransformNode('wheelAnchorR', scene);
    this.wheelR.parent = this.body;
    this.wheelR.position.set(0.85, 0.15, -0.85);

    // driver
    box('torso', 0.6, 0.5, 0.45, this.accentMat, 0, 0.95, -0.15);
    const head = CreateSphere('head', { diameter: 0.5, segments: 8 }, scene);
    head.material = skin;
    head.position.set(0, 1.3, -0.12);
    head.parent = this.body;
    const helmet = CreateSphere('helmet', { diameter: 0.6, segments: 8 }, scene);
    helmet.material = this.bodyMat;
    helmet.position.set(0, 1.36, -0.16);
    helmet.parent = this.body;
    helmet.scaling.z = 0.95;
    const visorMesh = box('visor', 0.44, 0.16, 0.2, visor, 0, 1.3, 0.16);
    visorMesh.rotation.x = 0.1;
    box('helmetStripe', 0.1, 0.36, 0.5, this.accentMat, 0, 1.6, -0.16);
    // hands on the wheel
    box('wheel', 0.5, 0.06, 0.3, dark, 0, 0.9, 0.35);

    // wheels
    const positions: [number, number, number][] = [
      [-0.85, 0.31, 0.85],
      [0.85, 0.31, 0.85],
      [-0.85, 0.31, -0.85],
      [0.85, 0.31, -0.85],
    ];
    positions.forEach((p, i) => {
      const pivot = new TransformNode(`wheelPivot${i}`, scene);
      pivot.parent = this.body;
      pivot.position.set(p[0], p[1], p[2]);
      if (i < 2) this.frontPivots.push(pivot);
      const w = CreateCylinder(`wheel${i}`, { height: 0.4, diameter: 0.64, tessellation: 12 }, scene);
      w.material = tyre;
      w.rotation.z = Math.PI / 2;
      w.parent = pivot;
      w.isPickable = false;
      const h = CreateCylinder(`hub${i}`, { height: 0.42, diameter: 0.34, tessellation: 8 }, scene);
      h.material = hub;
      h.rotation.z = Math.PI / 2;
      h.parent = w;
      h.isPickable = false;
      this.wheels.push(w);
    });

    // blob shadow
    this.shadow = CreateDisc('shadow', { radius: 1.5, tessellation: 20 }, scene);
    const shadowMat = keep(new StandardMaterial('shadowMat', scene));
    shadowMat.disableLighting = true;
    shadowMat.emissiveColor = Color3.Black();
    shadowMat.diffuseColor = Color3.Black();
    shadowMat.specularColor = Color3.Black();
    shadowMat.alpha = 0.45;
    shadowMat.backFaceCulling = false;
    void shadowTex;
    this.shadow.material = shadowMat;
    this.shadow.rotation.x = Math.PI / 2;
    this.shadow.position.y = 0.17;
    this.shadow.parent = this.root;
    this.shadow.isPickable = false;
  }

  setVisible(v: boolean): void {
    this.root.setEnabled(v);
  }

  /** Tier of the drift currently charging, for the spark colour. 0 = none. */
  driftTier(pose: KartPose): number {
    return pose.drift === 0 ? 0 : driftTier(pose.driftCharge);
  }

  pose(p: KartPose, dt: number, t: number): void {
    this.root.position.x = p.x;
    this.root.position.z = p.z;

    if (p.spinTime > 0) {
      this.spinAngle += (dt / SPIN_TIME) * Math.PI * 2;
    } else {
      // ease back to zero so a spin that ends mid-turn does not snap
      this.spinAngle *= Math.max(0, 1 - 10 * dt);
      if (Math.abs(this.spinAngle) < 0.01) this.spinAngle = 0;
    }
    const driftYaw = p.drift * 0.42 * Math.min(1, 0.5 + p.driftCharge);
    this.root.rotation.y = p.heading + driftYaw + this.spinAngle;

    // hop into a drift, lean into corners, bob on the grass
    if (p.drift !== 0 && this.hop === 0 && p.speed > 5) this.hop = 0.001;
    if (this.hop > 0) {
      this.hop += dt * 4.5;
      if (this.hop >= 1) this.hop = 0;
    }
    if (p.drift === 0) this.hop = 0;
    const hopY = this.hop > 0 ? Math.sin(this.hop * Math.PI) * 0.45 : 0;
    this.bob = p.offroad && Math.abs(p.speed) > 4 ? Math.sin(t * 34) * 0.05 : this.bob * 0.8;
    this.body.position.y = hopY + this.bob;
    this.body.rotation.z = -p.steer * 0.1 - p.drift * 0.14;
    const accelPitch = p.boostTime > 0 ? -0.08 : 0;
    this.body.rotation.x = accelPitch;

    this.wheelSpin += (p.speed * dt) / 0.32;
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;
    for (const f of this.frontPivots) f.rotation.y = p.steer * 0.5 + p.drift * 0.3;

    // exhaust tips glow under boost; body shimmers under a star
    if (p.boostTime > 0) {
      this.exhaustMat.emissiveColor = new Color3(1, 0.45, 0.15);
    } else {
      this.exhaustMat.emissiveColor = Color3.Black();
    }
    if (p.starTime > 0) {
      const h = (t * 3) % 1;
      const c = Color3.FromHSV(h * 360, 0.75, 1);
      this.bodyMat.emissiveColor = c.scale(0.7);
      this.accentMat.emissiveColor = Color3.FromHSV(((h + 0.5) % 1) * 360, 0.75, 1).scale(0.7);
    } else {
      this.bodyMat.emissiveColor = Color3.Black();
      this.accentMat.emissiveColor = Color3.Black();
    }
    this.shadow.scaling.setAll(1 - hopY * 0.35);
  }

  get color(): Color3 {
    return this.baseColor;
  }

  get accent(): Color3 {
    return this.accentColor;
  }

  dispose(): void {
    this.root.dispose(false, true);
    for (const o of this.own) o.dispose();
  }
}

/** Soft dark disc for the blob shadows; shared by every kart. */
export function makeShadowTexture(scene: Scene): DynamicTexture {
  const size = 128;
  const tex = new DynamicTexture('shadowTex', size, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.4)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.update(false);
  tex.hasAlpha = true;
  return tex;
}
