/** Rockets and bubble traps: pooled meshes keyed by the race's ids. */
import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { hex } from './scene.ts';

interface RocketView {
  root: TransformNode;
  trail: ParticleSystem;
  seen: boolean;
}

interface TrapView {
  mesh: Mesh;
  seen: boolean;
  phase: number;
}

export class Projectiles {
  private rockets = new Map<number, RocketView>();
  private traps = new Map<number, TrapView>();
  private readonly rocketMat: StandardMaterial;
  private readonly finMat: StandardMaterial;
  private readonly tipMat: StandardMaterial;
  private readonly trapMat: StandardMaterial;

  constructor(private readonly scene: Scene, private readonly flare: DynamicTexture) {
    this.rocketMat = new StandardMaterial('rocketMat', scene);
    this.rocketMat.diffuseColor = hex('#ff3b3b');
    this.rocketMat.specularColor = new Color3(0.4, 0.4, 0.4);
    this.finMat = new StandardMaterial('finMat', scene);
    this.finMat.diffuseColor = hex('#ffd23b');
    this.tipMat = new StandardMaterial('tipMat', scene);
    this.tipMat.diffuseColor = hex('#fff1c9');
    this.tipMat.emissiveColor = new Color3(1, 0.5, 0.2);
    this.trapMat = new StandardMaterial('trapMat', scene);
    this.trapMat.diffuseColor = hex('#9fe7ff');
    this.trapMat.emissiveColor = new Color3(0.25, 0.6, 0.9);
    this.trapMat.specularColor = new Color3(0.9, 0.9, 0.9);
    this.trapMat.alpha = 0.6;
  }

  private makeRocket(): RocketView {
    const root = new TransformNode('rocket', this.scene);
    const body = CreateCylinder('rBody', { height: 1.3, diameter: 0.5, tessellation: 10 }, this.scene);
    body.material = this.rocketMat;
    body.rotation.x = Math.PI / 2;
    body.parent = root;
    const tip = CreateCylinder('rTip', { height: 0.5, diameterTop: 0, diameterBottom: 0.5, tessellation: 10 }, this.scene);
    tip.material = this.tipMat;
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.9;
    tip.parent = root;
    for (let i = 0; i < 3; i++) {
      const fin = CreateBox(`fin${i}`, { width: 0.08, height: 0.5, depth: 0.45 }, this.scene);
      fin.material = this.finMat;
      fin.parent = root;
      fin.position.z = -0.5;
      fin.position.y = 0.3;
      fin.rotation.z = (i / 3) * Math.PI * 2;
      fin.setPivotPoint(new Vector3(0, -0.3, 0));
    }
    const trail = new ParticleSystem('rocketTrail', 200, this.scene);
    trail.particleTexture = this.flare;
    trail.emitter = root as unknown as Vector3;
    trail.minEmitBox = new Vector3(0, 0, -0.6);
    trail.maxEmitBox = new Vector3(0, 0, -0.6);
    trail.color1 = new Color4(1, 0.8, 0.3, 1);
    trail.color2 = new Color4(1, 0.4, 0.1, 1);
    trail.colorDead = new Color4(0.5, 0.5, 0.5, 0);
    trail.minSize = 0.3;
    trail.maxSize = 0.7;
    trail.minLifeTime = 0.2;
    trail.maxLifeTime = 0.5;
    trail.emitRate = 160;
    trail.blendMode = ParticleSystem.BLENDMODE_ADD;
    trail.direction1 = new Vector3(-0.3, -0.3, -3);
    trail.direction2 = new Vector3(0.3, 0.3, -5);
    trail.minEmitPower = 0.5;
    trail.maxEmitPower = 1;
    trail.isLocal = true;
    trail.updateSpeed = 0.016;
    trail.start();
    return { root, trail, seen: true };
  }

  private makeTrap(): TrapView {
    const mesh = CreateSphere('trap', { diameter: 1.9, segments: 10 }, this.scene);
    mesh.material = this.trapMat;
    return { mesh, seen: true, phase: Math.random() * 6 };
  }

  update(rockets: { id: number; x: number; z: number; heading: number }[], traps: { id: number; x: number; z: number }[], t: number): void {
    for (const r of this.rockets.values()) r.seen = false;
    for (const p of rockets) {
      let v = this.rockets.get(p.id);
      if (!v) {
        v = this.makeRocket();
        this.rockets.set(p.id, v);
      }
      v.seen = true;
      v.root.position.set(p.x, 0.9, p.z);
      v.root.rotation.y = p.heading;
      v.root.rotation.z = t * 6;
    }
    for (const [id, v] of this.rockets) {
      if (!v.seen) {
        v.trail.dispose(false);
        v.root.dispose(false, true);
        this.rockets.delete(id);
      }
    }
    for (const v of this.traps.values()) v.seen = false;
    for (const p of traps) {
      let v = this.traps.get(p.id);
      if (!v) {
        v = this.makeTrap();
        this.traps.set(p.id, v);
      }
      v.seen = true;
      v.mesh.position.set(p.x, 0.95 + Math.sin(t * 2.5 + v.phase) * 0.12, p.z);
      const s = 1 + Math.sin(t * 4 + v.phase) * 0.05;
      v.mesh.scaling.set(s, 1 / s, s);
    }
    for (const [id, v] of this.traps) {
      if (!v.seen) {
        v.mesh.dispose(false, true);
        this.traps.delete(id);
      }
    }
  }

  clear(): void {
    this.update([], [], 0);
  }
}
