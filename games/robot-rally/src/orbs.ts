import * as THREE from 'three';

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255, 240, 190, 0.95)');
  g.addColorStop(0.3, 'rgba(255, 210, 100, 0.5)');
  g.addColorStop(1, 'rgba(255, 180, 60, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const glowTex = makeGlowTexture();

/** Vertical alpha ramp for the light beams: bright at the orb, gone at the top. */
function makeBeamTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(255, 230, 150, 0.0)');
  g.addColorStop(0.04, 'rgba(255, 230, 150, 0.9)');
  g.addColorStop(0.35, 'rgba(255, 210, 110, 0.45)');
  g.addColorStop(1, 'rgba(255, 190, 80, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const BEAM_H = 16;
const beamGeo = new THREE.CylinderGeometry(0.32, 0.18, BEAM_H, 12, 1, true);
beamGeo.translate(0, BEAM_H / 2, 0);
const beamTex = makeBeamTexture();

const orbGeo = new THREE.IcosahedronGeometry(0.38, 0);
const orbMat = new THREE.MeshStandardMaterial({
  color: 0xffe28a,
  emissive: 0xffb428,
  emissiveIntensity: 2.4,
  roughness: 0.3,
  flatShading: true,
});

export class Orb {
  readonly group = new THREE.Group();
  collected = false;
  private mesh: THREE.Mesh;
  private sprite: THREE.Sprite;
  /** Tall light beam so orbs can be spotted from across the island. */
  private beam: THREE.Mesh;
  private base: THREE.Vector3;
  private phase = Math.random() * Math.PI * 2;
  private popT = -1;

  constructor(pos: THREE.Vector3) {
    this.base = pos.clone();
    this.mesh = new THREE.Mesh(orbGeo, orbMat);
    this.sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.85,
      }),
    );
    this.sprite.scale.setScalar(2.2);
    this.beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        map: beamTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        opacity: 0.8,
      }),
    );
    this.beam.position.y = -0.2;
    this.beam.renderOrder = 1;
    this.group.add(this.mesh, this.sprite, this.beam);
    this.group.position.copy(pos);
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  collect(): void {
    this.collected = true;
    this.popT = 0;
  }

  reset(): void {
    this.collected = false;
    this.popT = -1;
    this.group.visible = true;
    this.group.scale.setScalar(1);
    this.group.position.copy(this.base);
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.8;
  }

  update(t: number, dt: number): void {
    if (this.collected) {
      if (this.popT >= 0) {
        this.popT += dt;
        const k = this.popT / 0.18;
        if (k >= 1) {
          this.group.visible = false;
          this.popT = -1;
        } else {
          this.group.scale.setScalar(1 + k * 1.6);
          (this.sprite.material as THREE.SpriteMaterial).opacity = 0.85 * (1 - k);
          (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
          (this.mesh.material as THREE.MeshStandardMaterial).opacity = 1 - k;
        }
      }
      return;
    }
    this.group.position.y = this.base.y + Math.sin(t * 2.1 + this.phase) * 0.22;
    this.mesh.rotation.y = t * 1.6 + this.phase;
    this.mesh.rotation.x = Math.sin(t * 0.9 + this.phase) * 0.3;
    const pulse = 0.85 + Math.sin(t * 3 + this.phase) * 0.12;
    (this.sprite.material as THREE.SpriteMaterial).opacity = pulse * 0.85;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.45 + pulse * 0.25;
  }
}

/**
 * Glowing arrow on the ground beside the robot that always points at the
 * nearest orb still out there — pre-readers just follow it.
 */
export class OrbGuide {
  readonly group = new THREE.Group();
  private arrow: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private yaw = 0;
  private shown = 0;

  constructor() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.62);
    shape.lineTo(0.5, 0.05);
    shape.lineTo(0.2, 0.05);
    shape.lineTo(0.2, -0.45);
    shape.lineTo(-0.2, -0.45);
    shape.lineTo(-0.2, 0.05);
    shape.lineTo(-0.5, 0.05);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2); // lie flat, tip pointing toward -z
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffd24a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.arrow = new THREE.Mesh(geo, this.mat);
    this.arrow.renderOrder = 2;
    this.arrow.scale.setScalar(1.4);
    this.group.add(this.arrow);
  }

  /** Points from `from` toward `target` (or fades out when target is null/close). */
  update(
    t: number,
    dt: number,
    from: THREE.Vector3,
    groundAt: (x: number, z: number) => number,
    target: THREE.Vector3 | null,
  ): void {
    let want = 0;
    if (target) {
      const dx = target.x - from.x;
      const dz = target.z - from.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.8) {
        want = 1;
        const yaw = Math.atan2(-dx, -dz);
        let d = yaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * Math.min(1, dt * 10);
      }
    }
    this.shown += (want - this.shown) * Math.min(1, dt * 6);
    this.group.visible = this.shown > 0.02;
    if (!this.group.visible) return;
    const r = 2.1 + Math.sin(t * 6) * 0.2; // nudge outward, like "this way!"
    const ax = from.x - Math.sin(this.yaw) * r;
    const az = from.z - Math.cos(this.yaw) * r;
    this.group.position.set(ax, Math.max(groundAt(ax, az), from.y - 0.4) + 0.14, az);
    this.group.rotation.y = this.yaw;
    this.mat.opacity = this.shown * (0.75 + Math.sin(t * 6) * 0.2);
  }
}
