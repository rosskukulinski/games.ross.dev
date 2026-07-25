import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

/** Soft radial "flare" sprite texture drawn on a canvas — no external assets. */
export function makeFlareTexture(scene: Scene, tint = "255,255,255"): DynamicTexture {
  const size = 128;
  const tex = new DynamicTexture("flare", size, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${tint},1)`);
  g.addColorStop(0.25, `rgba(${tint},0.8)`);
  g.addColorStop(0.6, `rgba(${tint},0.25)`);
  g.addColorStop(1, `rgba(${tint},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

/** Engine exhaust trail that follows the ship. */
export function createEngineTrail(scene: Scene, emitter: AbstractMesh): ParticleSystem {
  const ps = new ParticleSystem("trail", 900, scene);
  ps.particleTexture = makeFlareTexture(scene);
  ps.emitter = emitter;
  ps.minEmitBox = new Vector3(-0.35, -0.05, -0.2);
  ps.maxEmitBox = new Vector3(0.35, 0.05, 0.2);
  ps.color1 = new Color4(0.25, 0.95, 1.0, 0.9);
  ps.color2 = new Color4(0.55, 0.35, 1.0, 0.85);
  ps.colorDead = new Color4(1.0, 0.35, 0.15, 0.0);
  ps.minSize = 0.2;
  ps.maxSize = 0.55;
  ps.minLifeTime = 0.22;
  ps.maxLifeTime = 0.45;
  ps.emitRate = 320;
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.direction1 = new Vector3(-0.4, -0.4, -9);
  ps.direction2 = new Vector3(0.4, 0.4, -13);
  ps.minEmitPower = 0.9;
  ps.maxEmitPower = 1.6;
  ps.updateSpeed = 0.016;
  ps.start();
  return ps;
}

/** Streaking "warp" speed lines rushing past the player. */
export function createSpeedLines(scene: Scene): ParticleSystem {
  const ps = new ParticleSystem("speedlines", 400, scene);
  ps.particleTexture = makeFlareTexture(scene, "190,225,255");
  ps.emitter = new Vector3(0, 5, 120);
  ps.minEmitBox = new Vector3(-16, -3, -30);
  ps.maxEmitBox = new Vector3(16, 8, 40);
  ps.color1 = new Color4(0.45, 0.85, 1.0, 0.5);
  ps.color2 = new Color4(0.8, 0.55, 1.0, 0.4);
  ps.colorDead = new Color4(0.4, 0.6, 1.0, 0.0);
  ps.minSize = 0.35;
  ps.maxSize = 0.8;
  ps.minLifeTime = 1.2;
  ps.maxLifeTime = 2.2;
  ps.emitRate = 90;
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.direction1 = new Vector3(0, 0, -80);
  ps.direction2 = new Vector3(0, 0, -110);
  ps.minEmitPower = 1;
  ps.maxEmitPower = 1.4;
  ps.isBillboardBased = true;
  ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
  ps.updateSpeed = 0.016;
  ps.start();
  return ps;
}

/** Golden sparkle burst when a star is collected. */
export function createPickupBurst(scene: Scene): ParticleSystem {
  const ps = new ParticleSystem("pickupBurst", 200, scene);
  ps.particleTexture = makeFlareTexture(scene, "255,230,160");
  ps.emitter = new Vector3(0, -100, 0);
  ps.color1 = new Color4(1.0, 0.9, 0.4, 1.0);
  ps.color2 = new Color4(1.0, 0.6, 0.9, 1.0);
  ps.colorDead = new Color4(1.0, 0.6, 0.2, 0.0);
  ps.minSize = 0.15;
  ps.maxSize = 0.5;
  ps.minLifeTime = 0.25;
  ps.maxLifeTime = 0.55;
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.createSphereEmitter(0.4, 0);
  ps.minEmitPower = 4;
  ps.maxEmitPower = 9;
  ps.manualEmitCount = 0;
  ps.emitRate = 0;
  ps.updateSpeed = 0.016;
  ps.gravity = new Vector3(0, -6, 0);
  ps.start();
  return ps;
}

export interface Explosion {
  burst: (pos: Vector3) => void;
}

/** Two-layer explosion: hot core flash + flying sparks. */
export function createExplosion(scene: Scene): Explosion {
  const core = new ParticleSystem("boomCore", 160, scene);
  core.particleTexture = makeFlareTexture(scene, "255,190,120");
  core.emitter = new Vector3(0, -100, 0);
  core.color1 = new Color4(1.0, 0.85, 0.4, 1.0);
  core.color2 = new Color4(1.0, 0.45, 0.15, 1.0);
  core.colorDead = new Color4(0.5, 0.1, 0.3, 0.0);
  core.minSize = 1.4;
  core.maxSize = 3.4;
  core.minLifeTime = 0.3;
  core.maxLifeTime = 0.7;
  core.blendMode = ParticleSystem.BLENDMODE_ADD;
  core.createSphereEmitter(0.6, 0);
  core.minEmitPower = 2;
  core.maxEmitPower = 7;
  core.emitRate = 0;
  core.updateSpeed = 0.016;
  core.start();

  const sparks = new ParticleSystem("boomSparks", 400, scene);
  sparks.particleTexture = makeFlareTexture(scene, "180,240,255");
  sparks.emitter = new Vector3(0, -100, 0);
  sparks.color1 = new Color4(0.3, 0.95, 1.0, 1.0);
  sparks.color2 = new Color4(1.0, 0.3, 0.85, 1.0);
  sparks.colorDead = new Color4(1.0, 0.5, 0.1, 0.0);
  sparks.minSize = 0.15;
  sparks.maxSize = 0.45;
  sparks.minLifeTime = 0.5;
  sparks.maxLifeTime = 1.2;
  sparks.blendMode = ParticleSystem.BLENDMODE_ADD;
  sparks.createSphereEmitter(0.5, 0);
  sparks.minEmitPower = 8;
  sparks.maxEmitPower = 20;
  sparks.emitRate = 0;
  sparks.gravity = new Vector3(0, -14, 0);
  sparks.isBillboardBased = true;
  sparks.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
  sparks.updateSpeed = 0.016;
  sparks.start();

  return {
    burst(pos: Vector3) {
      (core.emitter as Vector3).copyFrom(pos);
      (sparks.emitter as Vector3).copyFrom(pos);
      core.manualEmitCount = 90;
      sparks.manualEmitCount = 260;
    },
  };
}
