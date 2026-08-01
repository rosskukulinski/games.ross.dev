/**
 * Particles, shockwaves and the progress gauge.
 *
 * One `ParticleSystem` per effect *type*, repositioned and pulsed with
 * `manualEmitCount` per burst — far cheaper than spawning a system per event,
 * and it keeps the total particle budget bounded.
 */
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PALETTE as P, hex } from "./config";

interface Shock {
  mesh: Mesh;
  mat: StandardMaterial;
  t: number;
  life: number;
  from: number;
  to: number;
}

export class Fx {
  private scene: Scene;
  private coins!: ParticleSystem;
  private sparkle!: ParticleSystem;
  private splash!: ParticleSystem;
  private confetti!: ParticleSystem;
  private dust!: ParticleSystem;
  private smoke!: ParticleSystem;
  private shocks: Shock[] = [];
  private shockPool: Shock[] = [];

  constructor(scene: Scene, tex: { flare: Texture; coin: Texture; star: Texture }) {
    this.scene = scene;

    this.coins = this.system("coinsPs", tex.coin, 220, {
      minSize: 0.34,
      maxSize: 0.6,
      minLife: 0.5,
      maxLife: 0.95,
      power: 4.5,
      gravity: -14,
      color1: new Color4(1, 1, 1, 1),
      color2: new Color4(1, 0.9, 0.55, 1),
    });

    this.sparkle = this.system("sparklePs", tex.flare, 320, {
      minSize: 0.22,
      maxSize: 0.62,
      minLife: 0.3,
      maxLife: 0.7,
      power: 3.2,
      gravity: -2.5,
      additive: true,
      color1: new Color4(1, 1, 0.85, 1),
      color2: new Color4(1, 0.85, 0.4, 1),
    });

    this.splash = this.system("splashPs", tex.flare, 260, {
      minSize: 0.2,
      maxSize: 0.7,
      minLife: 0.35,
      maxLife: 0.8,
      power: 5,
      gravity: -16,
      additive: true,
      color1: new Color4(0.75, 0.98, 1, 1),
      color2: new Color4(0.3, 0.8, 0.95, 1),
    });

    this.confetti = this.system("confettiPs", tex.star, 380, {
      minSize: 0.22,
      maxSize: 0.5,
      minLife: 1.3,
      maxLife: 2.4,
      power: 8,
      gravity: -9,
      color1: new Color4(1, 0.45, 0.65, 1),
      color2: new Color4(0.45, 0.9, 1, 1),
    });

    this.dust = this.system("dustPs", tex.flare, 220, {
      minSize: 0.5,
      maxSize: 1.5,
      minLife: 0.5,
      maxLife: 1.1,
      power: 2.6,
      gravity: 1.2,
      color1: new Color4(1, 0.96, 0.85, 0.85),
      color2: new Color4(0.85, 0.78, 0.62, 0.5),
    });

    this.smoke = this.system("smokePs", tex.flare, 160, {
      minSize: 0.35,
      maxSize: 0.9,
      minLife: 0.6,
      maxLife: 1.2,
      power: 1.4,
      gravity: 2.2,
      color1: new Color4(0.62, 0.72, 0.5, 0.7),
      color2: new Color4(0.5, 0.6, 0.42, 0.3),
    });

    // reusable expanding rings
    for (let i = 0; i < 8; i++) {
      const mesh = CreateTorus(`shock${i}`, { diameter: 1, thickness: 0.1, tessellation: 28 }, scene);
      const mat = new StandardMaterial(`shockMat${i}`, scene);
      mat.disableLighting = true;
      mat.emissiveColor = Color3.White();
      mat.alpha = 0;
      mesh.material = mat;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      this.shockPool.push({ mesh, mat, t: 0, life: 1, from: 1, to: 6 });
    }
  }

  private system(
    name: string,
    texture: Texture,
    capacity: number,
    o: {
      minSize: number;
      maxSize: number;
      minLife: number;
      maxLife: number;
      power: number;
      gravity: number;
      additive?: boolean;
      color1: Color4;
      color2: Color4;
    },
  ): ParticleSystem {
    const ps = new ParticleSystem(name, capacity, this.scene);
    ps.particleTexture = texture;
    ps.emitter = new Vector3(0, 0, 0);
    ps.minEmitBox = new Vector3(-0.18, 0, -0.18);
    ps.maxEmitBox = new Vector3(0.18, 0.2, 0.18);
    ps.color1 = o.color1;
    ps.color2 = o.color2;
    ps.colorDead = new Color4(o.color2.r, o.color2.g, o.color2.b, 0);
    ps.minSize = o.minSize;
    ps.maxSize = o.maxSize;
    ps.minLifeTime = o.minLife;
    ps.maxLifeTime = o.maxLife;
    ps.emitRate = 0; // burst-only; driven by manualEmitCount
    ps.manualEmitCount = 0;
    ps.blendMode = o.additive ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
    ps.gravity = new Vector3(0, o.gravity, 0);
    ps.direction1 = new Vector3(-1, 2.4, -1);
    ps.direction2 = new Vector3(1, 3.4, 1);
    ps.minAngularSpeed = -6;
    ps.maxAngularSpeed = 6;
    ps.minEmitPower = o.power * 0.5;
    ps.maxEmitPower = o.power;
    ps.updateSpeed = 0.016;
    ps.start();
    return ps;
  }

  private burst(ps: ParticleSystem, x: number, y: number, z: number, n: number): void {
    (ps.emitter as Vector3).set(x, y, z);
    ps.manualEmitCount = n;
  }

  /** Coins fountaining out of a collected cash pile. */
  coinBurst(x: number, y: number, z: number, n = 10): void {
    this.burst(this.coins, x, y, z, n);
  }

  /** Warm sparkle — check-ins, tips, anything good and small. */
  sparkleBurst(x: number, y: number, z: number, n = 14): void {
    this.burst(this.sparkle, x, y, z, n);
  }

  splashBurst(x: number, y: number, z: number, n = 20): void {
    this.burst(this.splash, x, y, z, n);
  }

  confettiBurst(x: number, y: number, z: number, n = 90): void {
    this.burst(this.confetti, x, y, z, n);
  }

  /** Dust kicked up when a building lands. */
  dustBurst(x: number, y: number, z: number, n = 40): void {
    this.burst(this.dust, x, y, z, n);
  }

  /** Grubby puff over a dirty room. */
  smokePuff(x: number, y: number, z: number, n = 4): void {
    this.burst(this.smoke, x, y, z, n);
  }

  /** Flat expanding ring on the ground. */
  shockwave(x: number, y: number, z: number, color: string, to = 7, life = 0.7): void {
    const s = this.shockPool.pop();
    if (!s) return;
    s.mesh.setEnabled(true);
    s.mesh.position.set(x, y, z);
    s.mesh.rotation.x = Math.PI / 2;
    s.mat.emissiveColor = hex(color);
    s.t = 0;
    s.life = life;
    s.from = 0.6;
    s.to = to;
    this.shocks.push(s);
  }

  update(dt: number): void {
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.t += dt / s.life;
      if (s.t >= 1) {
        s.mesh.setEnabled(false);
        s.mat.alpha = 0;
        this.shocks.splice(i, 1);
        this.shockPool.push(s);
        continue;
      }
      const e = 1 - Math.pow(1 - s.t, 3);
      const r = s.from + (s.to - s.from) * e;
      s.mesh.scaling.set(r, r, 1 + e * 2);
      s.mat.alpha = 0.85 * (1 - s.t) * (1 - s.t);
    }
  }
}

/* ========================================================================= */
/* progress gauge                                                            */
/* ========================================================================= */

/**
 * The filling ring that appears over whatever the manager is busy with.
 * This is the whole interaction language of the game — walk near a job and
 * the ring fills — so it gets redrawn on a dedicated canvas rather than being
 * faked with a scaling mesh.
 */
export class ProgressRing {
  private mesh: Mesh;
  private tex: DynamicTexture;
  private ctx: CanvasRenderingContext2D;
  private mat: StandardMaterial;
  private lastDrawn = -1;
  private color: string = P.padGlow;

  constructor(scene: Scene, noGlow: (m: Mesh) => void) {
    const SIZE = 192;
    this.mesh = CreatePlane("progRing", { width: 1.5, height: 1.5 }, scene);
    this.mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.mesh.isPickable = false;
    this.mesh.setEnabled(false);

    this.tex = new DynamicTexture("progRingTex", { width: SIZE, height: SIZE }, scene, true);
    this.ctx = this.tex.getContext() as unknown as CanvasRenderingContext2D;
    this.tex.hasAlpha = true;

    this.mat = new StandardMaterial("progRingMat", scene);
    this.mat.diffuseTexture = this.tex;
    this.mat.useAlphaFromDiffuseTexture = true;
    this.mat.disableLighting = true;
    this.mat.emissiveColor = Color3.White();
    this.mesh.material = this.mat;
    noGlow(this.mesh);
  }

  hide(): void {
    this.mesh.setEnabled(false);
    this.lastDrawn = -1;
  }

  show(x: number, y: number, z: number, progress: number, color: string = P.padGlow): void {
    this.mesh.setEnabled(true);
    this.mesh.position.set(x, y, z);
    if (color !== this.color) {
      this.color = color;
      this.lastDrawn = -1;
    }
    // only repaint the canvas when the arc has visibly moved
    if (Math.abs(progress - this.lastDrawn) < 0.02 && this.lastDrawn >= 0) return;
    this.lastDrawn = progress;
    this.draw(progress);
  }

  private draw(p: number): void {
    const c = this.ctx;
    const S = 192;
    const cx = S / 2;
    const r = S * 0.36;
    c.clearRect(0, 0, S, S);

    // drop shadow + track
    c.strokeStyle = "rgba(23,56,74,0.28)";
    c.lineWidth = 26;
    c.lineCap = "round";
    c.beginPath();
    c.arc(cx, cx + 3, r, 0, Math.PI * 2);
    c.stroke();

    c.strokeStyle = "rgba(255,255,255,0.55)";
    c.lineWidth = 22;
    c.beginPath();
    c.arc(cx, cx, r, 0, Math.PI * 2);
    c.stroke();

    // the filling arc
    if (p > 0.001) {
      c.strokeStyle = this.color;
      c.lineWidth = 22;
      c.beginPath();
      c.arc(cx, cx, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p));
      c.stroke();
      // bright head on the leading edge
      const a = -Math.PI / 2 + Math.PI * 2 * Math.min(1, p);
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(cx + Math.cos(a) * r, cx + Math.sin(a) * r, 9, 0, Math.PI * 2);
      c.fill();
    }

    this.tex.update();
  }
}
