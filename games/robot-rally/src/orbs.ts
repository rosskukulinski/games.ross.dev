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
    this.group.add(this.mesh, this.sprite);
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
  }
}
