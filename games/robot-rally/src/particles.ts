import * as THREE from 'three';

interface BurstOpts {
  count: number;
  colors: number[];
  speed: number;
  upBias?: number;
  gravity?: number;
  size?: number;
  life?: number;
  additive?: boolean;
  spread?: number;
}

interface Burst {
  points: THREE.Points;
  vel: Float32Array;
  age: number;
  life: number;
  gravity: number;
  mat: THREE.PointsMaterial;
}

function makeDotTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Pool-free particle bursts built on THREE.Points; cheap and cheerful. */
export class Particles {
  readonly group = new THREE.Group();
  private bursts: Burst[] = [];
  private tex = makeDotTexture();

  burst(pos: THREE.Vector3, opts: BurstOpts): void {
    const n = opts.count;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const col = new THREE.Color();
    const spread = opts.spread ?? 0.15;
    for (let i = 0; i < n; i++) {
      positions[i * 3] = pos.x + (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * spread;
      positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * spread;
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5 + (opts.upBias ?? 0.35),
        Math.random() - 0.5,
      ).normalize();
      const sp = opts.speed * (0.4 + Math.random() * 0.8);
      vel[i * 3] = dir.x * sp;
      vel[i * 3 + 1] = dir.y * sp;
      vel[i * 3 + 2] = dir.z * sp;
      col.setHex(opts.colors[Math.floor(Math.random() * opts.colors.length)]);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: opts.size ?? 0.22,
      map: this.tex,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.group.add(points);
    this.bursts.push({
      points,
      vel,
      age: 0,
      life: opts.life ?? 0.8,
      gravity: opts.gravity ?? 9,
      mat,
    });
  }

  /** Sparkly pop when an orb is collected. */
  orbPop(pos: THREE.Vector3): void {
    this.burst(pos, {
      count: 26,
      colors: [0xffe28a, 0xffd75e, 0xfff6cf, 0xffab4a],
      speed: 4.5,
      size: 0.28,
      life: 0.7,
      gravity: 5,
      additive: true,
    });
  }

  /** Dust puff on landing. */
  dust(pos: THREE.Vector3): void {
    this.burst(pos, {
      count: 10,
      colors: [0xd8cbb2, 0xcfc2a8, 0xe8dcc4],
      speed: 1.6,
      upBias: 0.5,
      size: 0.3,
      life: 0.55,
      gravity: 2.5,
    });
  }

  /** Win celebration: several firework bursts above the island. */
  fireworks(center: THREE.Vector3): void {
    const palette = [0xff6f9c, 0xffd75e, 0x7be0ff, 0xa2ff8a, 0xd7a2ff, 0xffffff];
    for (let i = 0; i < 7; i++) {
      const p = center
        .clone()
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 16,
            5 + Math.random() * 6,
            (Math.random() - 0.5) * 16,
          ),
        );
      window.setTimeout(() => {
        this.burst(p, {
          count: 60,
          colors: palette,
          speed: 6,
          upBias: 0.05,
          size: 0.3,
          life: 1.4,
          gravity: 4,
          additive: true,
        });
      }, i * 320);
    }
  }

  update(dt: number): void {
    for (let b = this.bursts.length - 1; b >= 0; b--) {
      const burst = this.bursts[b];
      burst.age += dt;
      if (burst.age >= burst.life) {
        this.group.remove(burst.points);
        burst.points.geometry.dispose();
        burst.mat.dispose();
        this.bursts.splice(b, 1);
        continue;
      }
      const attr = burst.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const vel = burst.vel;
      for (let i = 0; i < vel.length; i += 3) {
        vel[i + 1] -= burst.gravity * dt;
        arr[i] += vel[i] * dt;
        arr[i + 1] += vel[i + 1] * dt;
        arr[i + 2] += vel[i + 2] * dt;
      }
      attr.needsUpdate = true;
      burst.mat.opacity = 1 - Math.pow(burst.age / burst.life, 2);
    }
  }
}
