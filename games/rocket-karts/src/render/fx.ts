/**
 * Particles: drift sparks, boost flames, off-road dust, hit bursts, pickup
 * sparkles, star trails and finish confetti. All from one procedural flare
 * texture. Per-kart systems are created once and switched on and off.
 */
import type { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

export function makeFlareTexture(scene: Scene, name = 'flare'): DynamicTexture {
  const size = 64;
  const tex = new DynamicTexture(name, size, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.2)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.update(false);
  tex.hasAlpha = true;
  return tex;
}

export function makeSquareTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture('square', 16, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(2, 2, 12, 12);
  tex.update(false);
  tex.hasAlpha = true;
  return tex;
}

const TIER_COLORS: [Color4, Color4][] = [
  [new Color4(0.4, 0.95, 1, 1), new Color4(0.8, 1, 1, 1)],
  [new Color4(1, 0.7, 0.25, 1), new Color4(1, 0.95, 0.6, 1)],
  [new Color4(1, 0.3, 0.85, 1), new Color4(0.75, 0.5, 1, 1)],
];

export class KartFx {
  private readonly sparksL: ParticleSystem;
  private readonly sparksR: ParticleSystem;
  private readonly flameL: ParticleSystem;
  private readonly flameR: ParticleSystem;
  private readonly dust: ParticleSystem;
  private readonly star: ParticleSystem;

  constructor(
    scene: Scene,
    flare: DynamicTexture,
    anchors: { wheelL: TransformNode; wheelR: TransformNode; exhaustL: TransformNode; exhaustR: TransformNode; rear: TransformNode; root: TransformNode }
  ) {
    const sparks = (emitter: TransformNode): ParticleSystem => {
      const ps = new ParticleSystem('sparks', 220, scene);
      ps.particleTexture = flare;
      ps.emitter = emitter as unknown as Vector3;
      ps.minEmitBox = new Vector3(-0.1, 0, -0.1);
      ps.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
      ps.minSize = 0.12;
      ps.maxSize = 0.32;
      ps.minLifeTime = 0.18;
      ps.maxLifeTime = 0.42;
      ps.emitRate = 0;
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.direction1 = new Vector3(-1.5, 0.6, -4);
      ps.direction2 = new Vector3(1.5, 2.4, -7);
      ps.minEmitPower = 1.2;
      ps.maxEmitPower = 2.6;
      ps.gravity = new Vector3(0, -9, 0);
      ps.isLocal = true;
      ps.updateSpeed = 0.016;
      ps.start();
      return ps;
    };
    const flame = (emitter: TransformNode): ParticleSystem => {
      const ps = new ParticleSystem('flame', 260, scene);
      ps.particleTexture = flare;
      ps.emitter = emitter as unknown as Vector3;
      ps.minEmitBox = new Vector3(-0.05, -0.05, 0);
      ps.maxEmitBox = new Vector3(0.05, 0.05, 0);
      ps.color1 = new Color4(1, 0.85, 0.35, 1);
      ps.color2 = new Color4(1, 0.45, 0.1, 1);
      ps.colorDead = new Color4(0.6, 0.1, 0.4, 0);
      ps.minSize = 0.25;
      ps.maxSize = 0.55;
      ps.minLifeTime = 0.12;
      ps.maxLifeTime = 0.3;
      ps.emitRate = 0;
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.direction1 = new Vector3(-0.3, -0.2, -6);
      ps.direction2 = new Vector3(0.3, 0.3, -10);
      ps.minEmitPower = 1;
      ps.maxEmitPower = 1.6;
      ps.isLocal = true;
      ps.updateSpeed = 0.016;
      ps.start();
      return ps;
    };
    this.sparksL = sparks(anchors.wheelL);
    this.sparksR = sparks(anchors.wheelR);
    this.flameL = flame(anchors.exhaustL);
    this.flameR = flame(anchors.exhaustR);

    this.dust = new ParticleSystem('dust', 160, scene);
    this.dust.particleTexture = flare;
    this.dust.emitter = anchors.rear as unknown as Vector3;
    this.dust.minEmitBox = new Vector3(-0.7, 0, -0.2);
    this.dust.maxEmitBox = new Vector3(0.7, 0.2, 0.2);
    this.dust.color1 = new Color4(0.75, 0.68, 0.5, 0.5);
    this.dust.color2 = new Color4(0.6, 0.55, 0.4, 0.4);
    this.dust.colorDead = new Color4(0.6, 0.55, 0.45, 0);
    this.dust.minSize = 0.6;
    this.dust.maxSize = 1.4;
    this.dust.minLifeTime = 0.4;
    this.dust.maxLifeTime = 0.9;
    this.dust.emitRate = 0;
    this.dust.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.dust.direction1 = new Vector3(-0.6, 0.8, -1);
    this.dust.direction2 = new Vector3(0.6, 1.6, -3);
    this.dust.minEmitPower = 0.6;
    this.dust.maxEmitPower = 1.4;
    this.dust.isLocal = true;
    this.dust.updateSpeed = 0.016;
    this.dust.start();

    this.star = new ParticleSystem('starTrail', 300, scene);
    this.star.particleTexture = flare;
    this.star.emitter = anchors.root as unknown as Vector3;
    this.star.minEmitBox = new Vector3(-0.8, 0.3, -1);
    this.star.maxEmitBox = new Vector3(0.8, 1.4, 1);
    this.star.color1 = new Color4(1, 0.9, 0.3, 1);
    this.star.color2 = new Color4(0.4, 0.9, 1, 1);
    this.star.colorDead = new Color4(1, 0.4, 0.9, 0);
    this.star.minSize = 0.2;
    this.star.maxSize = 0.5;
    this.star.minLifeTime = 0.3;
    this.star.maxLifeTime = 0.7;
    this.star.emitRate = 0;
    this.star.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.star.direction1 = new Vector3(-1, 1, -1);
    this.star.direction2 = new Vector3(1, 3, 1);
    this.star.minEmitPower = 0.5;
    this.star.maxEmitPower = 1.5;
    this.star.updateSpeed = 0.016;
    this.star.start();
  }

  update(p: { drift: number; driftCharge: number; boostTime: number; offroad: boolean; speed: number; starTime: number }, tier: number): void {
    const drifting = p.drift !== 0 && Math.abs(p.speed) > 6;
    const rate = drifting ? 110 + tier * 60 : 0;
    const [c1, c2] = TIER_COLORS[Math.max(0, Math.min(2, tier - 1))];
    for (const s of [this.sparksL, this.sparksR]) {
      s.emitRate = rate;
      s.color1 = c1;
      s.color2 = c2;
      s.colorDead = new Color4(c1.r, c1.g, c1.b, 0);
    }
    const boosting = p.boostTime > 0;
    this.flameL.emitRate = boosting ? 180 : 0;
    this.flameR.emitRate = boosting ? 180 : 0;
    this.dust.emitRate = p.offroad && Math.abs(p.speed) > 5 ? 60 : 0;
    this.star.emitRate = p.starTime > 0 ? 160 : 0;
  }

  dispose(): void {
    for (const ps of [this.sparksL, this.sparksR, this.flameL, this.flameR, this.dust, this.star]) ps.dispose(false);
  }
}

/** One-shot bursts at arbitrary points, shared by the whole scene. */
export class Bursts {
  private readonly hit: ParticleSystem;
  private readonly sparkle: ParticleSystem;
  private readonly pop: ParticleSystem;
  private readonly bubble: ParticleSystem;
  private readonly confetti: ParticleSystem;

  constructor(scene: Scene, flare: DynamicTexture, square: DynamicTexture) {
    const make = (name: string, cap: number, c1: Color4, c2: Color4, dead: Color4, size: [number, number], life: [number, number], power: [number, number], gravity: number, tex: DynamicTexture = flare, add = true): ParticleSystem => {
      const ps = new ParticleSystem(name, cap, scene);
      ps.particleTexture = tex;
      ps.emitter = new Vector3(0, -100, 0);
      ps.color1 = c1;
      ps.color2 = c2;
      ps.colorDead = dead;
      ps.minSize = size[0];
      ps.maxSize = size[1];
      ps.minLifeTime = life[0];
      ps.maxLifeTime = life[1];
      ps.blendMode = add ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
      ps.createSphereEmitter(0.5, 0);
      ps.minEmitPower = power[0];
      ps.maxEmitPower = power[1];
      ps.emitRate = 0;
      ps.manualEmitCount = 0;
      ps.gravity = new Vector3(0, gravity, 0);
      ps.updateSpeed = 0.016;
      ps.start();
      return ps;
    };
    this.hit = make('hitBurst', 200, new Color4(1, 0.8, 0.3, 1), new Color4(1, 0.4, 0.2, 1), new Color4(1, 0.2, 0.2, 0), [0.3, 0.8], [0.3, 0.7], [4, 11], -10);
    this.sparkle = make('sparkle', 160, new Color4(1, 1, 0.8, 1), new Color4(0.6, 1, 1, 1), new Color4(1, 0.9, 0.4, 0), [0.15, 0.4], [0.3, 0.7], [3, 7], -3);
    this.pop = make('rocketPop', 220, new Color4(1, 0.6, 0.2, 1), new Color4(1, 0.9, 0.5, 1), new Color4(0.5, 0.1, 0.1, 0), [0.5, 1.4], [0.3, 0.8], [3, 9], -6);
    this.bubble = make('bubblePop', 120, new Color4(0.6, 0.9, 1, 0.9), new Color4(0.9, 0.98, 1, 0.9), new Color4(0.6, 0.9, 1, 0), [0.2, 0.5], [0.3, 0.6], [2, 6], -4);
    this.confetti = make('confetti', 500, new Color4(1, 0.3, 0.5, 1), new Color4(0.3, 0.9, 1, 1), new Color4(1, 0.9, 0.3, 0.9), [0.18, 0.32], [1.4, 2.6], [5, 12], -7, square, false);
    this.confetti.color1 = new Color4(1, 0.85, 0.2, 1);
    this.confetti.color2 = new Color4(1, 0.3, 0.7, 1);
    this.confetti.minAngularSpeed = -6;
    this.confetti.maxAngularSpeed = 6;
  }

  private fire(ps: ParticleSystem, x: number, y: number, z: number, count: number): void {
    (ps.emitter as Vector3).set(x, y, z);
    ps.manualEmitCount = count;
  }

  hitAt(x: number, z: number): void {
    this.fire(this.hit, x, 1, z, 70);
  }

  sparkleAt(x: number, z: number): void {
    this.fire(this.sparkle, x, 1.2, z, 50);
  }

  rocketPopAt(x: number, z: number): void {
    this.fire(this.pop, x, 0.9, z, 90);
  }

  bubblePopAt(x: number, z: number): void {
    this.fire(this.bubble, x, 0.9, z, 50);
  }

  confettiAt(x: number, z: number): void {
    this.fire(this.confetti, x, 4, z, 220);
  }

  dispose(): void {
    for (const ps of [this.hit, this.sparkle, this.pop, this.bubble, this.confetti]) ps.dispose(false);
  }
}
