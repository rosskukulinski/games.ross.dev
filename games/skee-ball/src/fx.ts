import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { makeFlareTexture, makePopupTexture } from "./textures";

/** Floating "+50" style score labels. */
export class PopupManager {
  private pool: {
    mesh: Mesh;
    mat: StandardMaterial;
    life: number;
    maxLife: number;
    vel: Vector3;
  }[] = [];

  constructor(private scene: Scene) {}

  spawn(pos: Vector3, text: string, color: string, scale = 1): void {
    const tex = makePopupTexture(this.scene, text, color);
    const mat = new StandardMaterial("popupMat", this.scene);
    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;
    mat.opacityTexture = tex;
    mat.emissiveColor = new Color3(0.85, 0.85, 0.85);
    mat.disableLighting = true;
    mat.backFaceCulling = false;

    const mesh = CreatePlane("popup", { width: 1.15 * scale, height: 0.43 * scale }, this.scene);
    mesh.material = mat;
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mesh.position.copyFrom(pos);
    mesh.isPickable = false;

    this.pool.push({
      mesh,
      mat,
      life: 0,
      maxLife: 1.5,
      vel: new Vector3((Math.random() - 0.5) * 0.15, 0.62, 0),
    });
  }

  update(dt: number): void {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.life += dt;
      const t = p.life / p.maxLife;
      p.mesh.position.addInPlace(p.vel.scale(dt));
      p.vel.y *= 0.985;
      const pop = t < 0.12 ? 0.6 + (t / 0.12) * 0.55 : 1.15 - (t - 0.12) * 0.18;
      p.mesh.scaling.setAll(pop);
      p.mat.alpha = t > 0.6 ? Math.max(0, 1 - (t - 0.6) / 0.4) : 1;
      if (t >= 1) {
        p.mesh.dispose();
        p.mat.dispose();
        this.pool.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const p of this.pool) {
      p.mesh.dispose();
      p.mat.dispose();
    }
    this.pool.length = 0;
  }
}

export interface Bursts {
  score: (pos: Vector3, points: number) => void;
  confetti: () => void;
  sparkle: (pos: Vector3) => void;
}

export function createBursts(scene: Scene): Bursts {
  // -------- scoring burst (sparks flying out of the hole) --------
  const spark = new ParticleSystem("scoreBurst", 700, scene);
  spark.particleTexture = makeFlareTexture(scene, "255,225,160");
  spark.emitter = new Vector3(0, -50, 0);
  spark.color1 = new Color4(1, 0.88, 0.4, 1);
  spark.color2 = new Color4(1, 0.42, 0.85, 1);
  spark.colorDead = new Color4(1, 0.5, 0.15, 0);
  spark.minSize = 0.025;
  spark.maxSize = 0.1;
  spark.minLifeTime = 0.35;
  spark.maxLifeTime = 0.95;
  spark.blendMode = ParticleSystem.BLENDMODE_ADD;
  spark.createSphereEmitter(0.04, 0);
  spark.minEmitPower = 0.8;
  spark.maxEmitPower = 3.2;
  spark.emitRate = 0;
  spark.gravity = new Vector3(0, -2.4, 0);
  spark.updateSpeed = 0.016;
  spark.start();

  // -------- ring shockwave flash --------
  const ring = new ParticleSystem("ringFlash", 120, scene);
  ring.particleTexture = makeFlareTexture(scene, "255,255,255");
  ring.emitter = new Vector3(0, -50, 0);
  ring.color1 = new Color4(1, 1, 1, 0.9);
  ring.color2 = new Color4(0.6, 0.9, 1, 0.8);
  ring.colorDead = new Color4(0.7, 0.7, 1, 0);
  ring.minSize = 0.18;
  ring.maxSize = 0.5;
  ring.minLifeTime = 0.22;
  ring.maxLifeTime = 0.4;
  ring.blendMode = ParticleSystem.BLENDMODE_ADD;
  ring.createSphereEmitter(0.02, 0);
  ring.minEmitPower = 0.2;
  ring.maxEmitPower = 0.7;
  ring.emitRate = 0;
  ring.updateSpeed = 0.016;
  ring.start();

  // -------- celebration confetti raining over the cabinet --------
  const conf = new ParticleSystem("confetti", 900, scene);
  conf.particleTexture = makeFlareTexture(scene, "255,255,255");
  conf.emitter = new Vector3(0, 2.9, 5.4);
  conf.minEmitBox = new Vector3(-1.4, 0, -1.6);
  conf.maxEmitBox = new Vector3(1.4, 0.3, 1.2);
  conf.color1 = new Color4(1, 0.85, 0.25, 1);
  conf.color2 = new Color4(0.35, 0.95, 1, 1);
  conf.colorDead = new Color4(1, 0.3, 0.8, 0);
  conf.minSize = 0.03;
  conf.maxSize = 0.085;
  conf.minLifeTime = 1.6;
  conf.maxLifeTime = 3.2;
  conf.blendMode = ParticleSystem.BLENDMODE_ADD;
  conf.direction1 = new Vector3(-0.5, -0.2, -0.4);
  conf.direction2 = new Vector3(0.5, 0.2, 0.4);
  conf.minEmitPower = 0.3;
  conf.maxEmitPower = 1.1;
  conf.gravity = new Vector3(0, -1.4, 0);
  conf.minAngularSpeed = -6;
  conf.maxAngularSpeed = 6;
  conf.emitRate = 0;
  conf.updateSpeed = 0.016;
  conf.start();

  return {
    score(pos: Vector3, points: number) {
      (spark.emitter as Vector3).copyFrom(pos);
      (ring.emitter as Vector3).copyFrom(pos);
      const n = points >= 100 ? 320 : points >= 40 ? 170 : points >= 20 ? 90 : 45;
      spark.manualEmitCount = n;
      ring.manualEmitCount = points >= 40 ? 26 : 12;
    },
    sparkle(pos: Vector3) {
      (spark.emitter as Vector3).copyFrom(pos);
      spark.manualEmitCount = 26;
    },
    confetti() {
      conf.manualEmitCount = 420;
    },
  };
}
