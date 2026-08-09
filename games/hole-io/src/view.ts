/**
 * All rendering, in Three.js: a gently tilted camera following your hole over
 * a low-poly 3D world. Three map themes (city park, moon base, pirate
 * islands) share one simulation — the theme only changes what the ten prop
 * size-tiers look like and how the ground is painted.
 *
 * Everything is procedural: props are merged low-poly primitives with vertex
 * colors (one body mesh + one emissive "glow" mesh each), the ground is a
 * canvas-painted plane, and particles are a single shader-driven Points
 * cloud. No asset files.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  type Phase,
  type Prop,
  type ThemeName,
  HOLE_BASE_R,
  PROP_KINDS,
  WORLD_H,
  WORLD_W,
  generateProps,
  mulberry32,
} from './shared/rules';

/** Rim colors, assigned per player in roster order. */
export const PLAYER_COLORS = [
  0x00e5ff, // you — electric cyan
  0xff5d73, // coral
  0xffb703, // amber
  0x9ef01a, // lime
  0xb388ff, // violet
  0xff8fab, // pink
  0x2dd4bf, // mint
  0xff7b00, // orange
];

export interface RenderHole {
  id: number;
  x: number;
  y: number;
  r: number;
  score: number;
  alive: boolean;
  invuln: boolean;
  name: string;
  color: number;
  isMe: boolean;
  leader: boolean;
}

export interface RenderState {
  holes: RenderHole[];
  phase: Phase;
  timer: number;
}

const DEATH_TIME = 0.55;
const SPAWN_TIME = 0.45;
const SINK_TIME = 0.6;

// --- Small geometry helpers ------------------------------------------------

const box = (w: number, h: number, d: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 10): THREE.BufferGeometry =>
  new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r: number, h: number, seg = 10): THREE.BufferGeometry => new THREE.ConeGeometry(r, h, seg);
const sph = (r: number, seg = 8): THREE.BufferGeometry => new THREE.SphereGeometry(r, seg, Math.max(5, seg - 2));
const ico = (r: number): THREE.BufferGeometry => new THREE.IcosahedronGeometry(r, 0);
const disc = (r: number, seg = 24): THREE.BufferGeometry => {
  const g = new THREE.CircleGeometry(r, seg);
  g.rotateX(-Math.PI / 2);
  return g;
};

interface PlaceOpts {
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

/** Collects colored, positioned parts and merges them into 1–2 geometries. */
class Parts {
  private body: THREE.BufferGeometry[] = [];
  private glow: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, o: PlaceOpts = {}): void {
    this.body.push(this.prep(geo, color, 1, x, y, z, o));
  }

  /** HDR-colored part rendered unlit — this is what the bloom pass catches. */
  addGlow(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, o: PlaceOpts = {}, hdr = 2.2): void {
    this.glow.push(this.prep(geo, color, hdr, x, y, z, o));
  }

  private prep(
    geo: THREE.BufferGeometry,
    color: number,
    hdr: number,
    x: number,
    y: number,
    z: number,
    o: PlaceOpts
  ): THREE.BufferGeometry {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r * hdr;
      arr[i * 3 + 1] = c.g * hdr;
      arr[i * 3 + 2] = c.b * hdr;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    const m = new THREE.Matrix4()
      .makeTranslation(x, y, z)
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0)))
      .multiply(new THREE.Matrix4().makeScale(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    g.applyMatrix4(m);
    return g;
  }

  build(): { body: THREE.BufferGeometry; glow: THREE.BufferGeometry | null } {
    return {
      body: mergeGeometries(this.body),
      glow: this.glow.length ? mergeGeometries(this.glow) : null,
    };
  }
}

interface KindTemplate {
  body: THREE.BufferGeometry;
  glow: THREE.BufferGeometry | null;
  /** 'bob' makes the prop float gently (boats, whales). */
  anim?: 'bob';
}

// --- Themes ----------------------------------------------------------------

interface ThemeDef {
  bg: number;
  baseGround: number;
  shadow: number;
  wall: number;
  hemiSky: number;
  hemiGround: number;
  sun: number;
  dust: number;
  paint(ctx: CanvasRenderingContext2D, px: number, props: Prop[], rng: () => number): void;
  build(tier: number, parts: Parts): 'bob' | undefined;
}

/** Which pirate tiers sit on water (everything else gets an island). */
const PIRATE_WATER_TIERS = new Set([5, 8, 9]);

const themes: Record<ThemeName, ThemeDef> = {
  // ---- City park at dusk --------------------------------------------------
  city: {
    bg: 0x0e2036,
    baseGround: 0x16344c,
    shadow: 0x1c3c58,
    wall: 0x2dd4bf,
    hemiSky: 0x9fc4ee,
    hemiGround: 0x1c3350,
    sun: 0xfff1d6,
    dust: 0xffd166,
    paint(ctx, px, _props, rng) {
      const k = px / WORLD_W;
      ctx.fillStyle = '#2c5b82';
      ctx.fillRect(0, 0, px, px);
      for (let i = 0; i < 56; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(64,120,163,0.32)' : 'rgba(38,77,110,0.32)';
        ctx.beginPath();
        ctx.arc(rng() * px, rng() * px, (34 + rng() * 80) * k, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = 'rgba(56,105,145,0.28)';
        ctx.fillRect(0, rng() * px, px, (34 + rng() * 40) * k);
      }
      ctx.fillStyle = 'rgba(130,180,220,0.22)';
      for (let x = 100; x < WORLD_W; x += 100) ctx.fillRect(x * k - 1.5, 0, 3, px);
      for (let y = 100; y < WORLD_H; y += 100) ctx.fillRect(0, y * k - 1.5, px, 3);
    },
    build(tier, p) {
      switch (tier) {
        case 0: {
          // Flower bed.
          p.add(disc(4), 0x1f5f3a, 0, 0.1, 0);
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            const x = Math.cos(a) * 1.8;
            const z = Math.sin(a) * 1.8;
            p.add(cyl(0.22, 0.22, 2.4, 5), 0x2e7d4f, x, 1.2, z);
            p.addGlow(sph(1.1, 7), [0xff8fab, 0xfff1f0, 0xc8b6ff][i], x, 2.8, z, {}, 1.5);
          }
          break;
        }
        case 1: // Trash can.
          p.add(cyl(2.6, 2.2, 5.5, 10), 0x2f6f75, 0, 2.75, 0);
          p.add(cyl(2.9, 2.9, 0.9, 10), 0x3f939b, 0, 5.9, 0);
          break;
        case 2: // Traffic cone.
          p.add(box(6, 0.8, 6), 0xd9480f, 0, 0.4, 0);
          p.add(cone(2.6, 6.4, 9), 0xff7b00, 0, 4, 0);
          p.add(cyl(1.8, 2, 1.1, 9), 0xfff4e6, 0, 4.2, 0);
          break;
        case 3: // Fire hydrant.
          p.add(cyl(2.4, 2.7, 5.5, 9), 0xe8384f, 0, 2.75, 0);
          p.add(sph(2, 9), 0xff6b81, 0, 6, 0);
          p.add(cyl(0.9, 0.9, 5.6, 7), 0xc9184a, 0, 3.6, 0, { rz: Math.PI / 2 });
          break;
        case 4: // Bush.
          p.add(sph(4.6, 8), 0x2b8a3e, -2, 3.4, 1, { sy: 0.85 });
          p.add(sph(4, 8), 0x37b24d, 2.6, 3, -1.2, { sy: 0.85 });
          p.add(sph(3.4, 8), 0x2f9e44, 0.4, 4.6, 1.6);
          p.addGlow(sph(0.7, 6), 0xff6b6b, -1.6, 5.6, 1.8, {}, 1.6);
          p.addGlow(sph(0.6, 6), 0xff6b6b, 2.4, 5, -0.4, {}, 1.6);
          break;
        case 5: {
          // Park bench.
          p.add(box(14, 1.1, 4.6), 0x9c6644, 0, 3.6, 0);
          p.add(box(14, 4.4, 1), 0xb08968, 0, 6.4, -2.2, { rx: -0.18 });
          for (const sx of [-5.6, 5.6]) p.add(box(1.2, 3.6, 4), 0x4a3728, sx, 1.8, 0);
          break;
        }
        case 6: {
          // Car.
          p.add(box(9, 3.4, 18), 0x1c7ed6, 0, 3.2, 0);
          p.add(box(7.6, 3, 9.5), 0x4dabf7, 0, 6.2, 0.6);
          p.add(box(7, 2.6, 2.4), 0x14263c, 0, 6.2, -4);
          for (const [wx, wz] of [[-4.4, -5.6], [4.4, -5.6], [-4.4, 5.6], [4.4, 5.6]]) {
            p.add(cyl(1.9, 1.9, 1.6, 10), 0x11151f, wx, 1.9, wz, { rz: Math.PI / 2 });
          }
          p.addGlow(box(1.4, 0.9, 0.5), 0xfff3bf, -2.6, 3.4, -9.1, {}, 2.6);
          p.addGlow(box(1.4, 0.9, 0.5), 0xfff3bf, 2.6, 3.4, -9.1, {}, 2.6);
          break;
        }
        case 7: // Tree.
          p.add(cyl(1.6, 2.2, 9, 7), 0x6f4a2f, 0, 4.5, 0);
          p.add(sph(8.5, 8), 0x2b8a3e, 0, 15, 0, { sy: 1.15 });
          p.add(sph(5, 7), 0x51cf66, -4, 18.5, 2, { sy: 0.9 });
          break;
        case 8: {
          // House with a pitched roof and lit windows.
          p.add(box(26, 13, 22), 0xe8dcc8, 0, 6.5, 0);
          p.add(cyl(0.1, 20, 9, 4), 0xd9480f, 0, 17.5, 0, { ry: Math.PI / 4, sz: 0.85 });
          p.add(box(3.5, 6, 3.5), 0x9c4a3a, 7, 21, -3);
          p.add(box(5, 7, 1), 0x7a5a3a, 0, 3.5, 11.1);
          for (const wx of [-8, 8]) p.addGlow(box(4, 4, 0.5), 0xffd766, wx, 8, 11.2, {}, 2.4);
          p.addGlow(box(0.5, 4, 4), 0xffd766, -13.2, 8, -4, {}, 2.4);
          break;
        }
        case 9: {
          // Office tower.
          p.add(box(24, 42, 24), 0x33436e, 0, 21, 0);
          p.add(box(17, 12, 17), 0x415584, 0, 48, 0);
          p.add(box(4, 5, 4), 0x2b3a61, 6, 56.5, 5);
          for (let f = 0; f < 5; f++) {
            for (const [dx, dz, rot] of [[0, 12.3, 0], [0, -12.3, 0], [12.3, 0, 1], [-12.3, 0, 1]]) {
              p.addGlow(
                box(rot ? 0.5 : 16, 2.2, rot ? 16 : 0.5),
                f % 2 ? 0x9fd8ff : 0xffe4a8,
                dx,
                8 + f * 7.4,
                dz,
                {},
                1.9
              );
            }
          }
          p.addGlow(sph(1.4, 7), 0xff6b6b, 0, 55.5, 0, {}, 3);
          break;
        }
      }
      return undefined;
    },
  },

  // ---- Moon base ----------------------------------------------------------
  moon: {
    bg: 0x131628,
    baseGround: 0x2b2f42,
    shadow: 0x30354a,
    wall: 0xb388ff,
    hemiSky: 0xaab4e8,
    hemiGround: 0x23273c,
    sun: 0xe8ecff,
    dust: 0x9fd8ff,
    paint(ctx, px, _props, rng) {
      const k = px / WORLD_W;
      ctx.fillStyle = '#454a60';
      ctx.fillRect(0, 0, px, px);
      // Craters: shallow, clearly rimmed — anything resembling a dark pit
      // would be mistaken for a player's hole.
      for (let i = 0; i < 40; i++) {
        const x = rng() * px;
        const y = rng() * px;
        const r = (12 + rng() * 34) * k;
        ctx.fillStyle = 'rgba(120,128,158,0.9)';
        ctx.beginPath();
        ctx.arc(x, y, r * 1.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(54,58,78,0.9)';
        ctx.beginPath();
        ctx.arc(x + r * 0.05, y + r * 0.08, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Dust speckles.
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = rng() > 0.5 ? 'rgba(150,156,185,0.5)' : 'rgba(40,44,62,0.5)';
        ctx.fillRect(rng() * px, rng() * px, 2.4, 2.4);
      }
      // A landing pad and painted paths between nothing in particular.
      ctx.strokeStyle = 'rgba(140,150,200,0.28)';
      ctx.lineWidth = 5 * k;
      ctx.setLineDash([18 * k, 14 * k]);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(rng() * px, rng() * px);
        ctx.lineTo(rng() * px, rng() * px);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    },
    build(tier, p) {
      switch (tier) {
        case 0: // Moon rocks.
          p.add(ico(2.6), 0x565c72, -1, 1.6, 0.5, { sy: 0.8 });
          p.add(ico(1.7), 0x6a7188, 2, 1.1, -1);
          break;
        case 1: // Crystal shard.
          p.add(ico(1.9), 0x3a4056, 0, 0.9, 0, { sy: 0.6 });
          p.addGlow(cone(1.5, 6.5, 6), 0x64e8ff, 0, 3.6, 0, { rz: 0.12 }, 2.2);
          break;
        case 2: // Flag.
          p.add(cyl(0.35, 0.35, 11, 6), 0xc8cede, 0, 5.5, 0);
          p.addGlow(box(5, 3.2, 0.3), 0xff5d73, 2.9, 9.2, 0, {}, 1.7);
          p.add(ico(1.6), 0x565c72, 0, 0.9, 0);
          break;
        case 3: // Oxygen tank.
          p.add(cyl(3, 3, 6.5, 12), 0xdfe5f4, 0, 3.9, 0);
          p.add(sph(3, 10), 0xdfe5f4, 0, 7.1, 0, { sy: 0.6 });
          p.addGlow(box(1.6, 1, 1.6), 0x64e8ff, 0, 8, 0, {}, 2);
          p.add(cyl(3.4, 3.4, 1, 12), 0x8f97ad, 0, 0.5, 0);
          break;
        case 4: // Crystal cluster.
          p.addGlow(cone(2.2, 9, 6), 0x64e8ff, 0, 4.5, 0, {}, 2.2);
          p.addGlow(cone(1.6, 6, 6), 0xb388ff, 3, 3, 1.5, { rz: -0.3 }, 2.2);
          p.addGlow(cone(1.4, 5, 6), 0x9ef0d0, -2.8, 2.5, -1, { rz: 0.34 }, 2);
          p.add(ico(3.4), 0x3a4056, 0, 1.4, 0, { sy: 0.5 });
          break;
        case 5: // Solar panel.
          p.add(box(1.4, 5, 1.4), 0x8f97ad, 0, 2.5, 0);
          p.add(box(16, 0.6, 9), 0x2b3a61, 0, 6.5, 0, { rz: 0.32 });
          p.addGlow(box(15, 0.3, 8), 0x4d7dff, 0, 7, 0, { rz: 0.32 }, 1.5);
          break;
        case 6: {
          // Rover.
          p.add(box(9, 3.4, 14), 0xc8cede, 0, 4, 0);
          p.add(box(6.5, 2.6, 6), 0x8f97ad, 0, 7, -2);
          for (const [wx, wz] of [[-4.8, -5], [4.8, -5], [-4.8, 0], [4.8, 0], [-4.8, 5], [4.8, 5]]) {
            p.add(cyl(2, 2, 1.6, 9), 0x22242f, wx, 2, wz, { rz: Math.PI / 2 });
          }
          p.add(cyl(0.3, 0.3, 6, 5), 0xc8cede, 3, 10, -4);
          p.addGlow(sph(0.8, 6), 0xff6b6b, 3, 13.2, -4, {}, 2.6);
          p.addGlow(box(4, 1.4, 0.4), 0x9fd8ff, 0, 7.2, -5.2, {}, 2.2);
          break;
        }
        case 7: // Comms antenna (tall).
          p.add(cyl(0.9, 1.6, 26, 6), 0x8f97ad, 0, 13, 0);
          p.add(cyl(3.4, 3.4, 1.2, 10), 0x565c72, 0, 0.6, 0);
          p.add(cone(4.6, 3, 12), 0xdfe5f4, 0, 27.5, 0, { rx: Math.PI });
          p.addGlow(sph(1.1, 7), 0xff5d73, 0, 30, 0, {}, 3);
          break;
        case 8: {
          // Habitat dome.
          const domeGeo = new THREE.SphereGeometry(16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
          p.add(domeGeo, 0xd4dae8, 0, 0.5, 0);
          p.add(cyl(5, 5, 6, 10), 0x8f97ad, 0, 3, 15, { rx: Math.PI / 2 });
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            p.addGlow(sph(0.9, 6), 0xffe4a8, Math.cos(a) * 12.5, 7, Math.sin(a) * 12.5, {}, 2.2);
          }
          p.addGlow(box(3.6, 3, 0.4), 0x9fd8ff, 0, 6, 15.8, {}, 2);
          break;
        }
        case 9: {
          // Rocket (very tall).
          p.add(cyl(6.4, 7, 34, 12), 0xe8ecf6, 0, 20, 0);
          p.add(cone(6.4, 12, 12), 0xe8384f, 0, 43, 0);
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            p.add(box(1.4, 12, 7), 0xe8384f, Math.cos(a) * 7.6, 6, Math.sin(a) * 7.6, { ry: -a });
          }
          p.add(cyl(4, 5.6, 4, 12), 0x565c72, 0, 2, 0);
          p.addGlow(sph(2.4, 8), 0x9fd8ff, 0, 26, -6.4, {}, 2);
          p.addGlow(cyl(3.4, 3.4, 1, 12), 0xffb35c, 0, 0.6, 0, {}, 2.4);
          break;
        }
      }
      return undefined;
    },
  },

  // ---- Pirate islands -----------------------------------------------------
  pirate: {
    bg: 0x0e2c48,
    baseGround: 0x11486b,
    shadow: 0x14547a,
    wall: 0xffb703,
    hemiSky: 0xa8d8f0,
    hemiGround: 0x14425f,
    sun: 0xfff3d0,
    dust: 0xa5f3fc,
    paint(ctx, px, props, rng) {
      const k = px / WORLD_W;
      ctx.fillStyle = '#1a6690';
      ctx.fillRect(0, 0, px, px);
      // Wave glints.
      ctx.strokeStyle = 'rgba(180,230,255,0.22)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 240; i++) {
        const x = rng() * px;
        const y = rng() * px;
        ctx.beginPath();
        ctx.arc(x, y, 8 + rng() * 14, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      // Islands: shallow water first, then sand, under every land prop.
      const land = props.filter((pr) => !PIRATE_WATER_TIERS.has(pr.kind));
      for (const pr of land) {
        const r = (PROP_KINDS[pr.kind].r * 3 + 30) * k;
        const grad = ctx.createRadialGradient(pr.x * k, pr.y * k, r * 0.2, pr.x * k, pr.y * k, r * 1.6);
        grad.addColorStop(0, 'rgba(64,168,190,0.9)');
        grad.addColorStop(1, 'rgba(64,168,190,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pr.x * k, pr.y * k, r * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const pr of land) {
        const r = (PROP_KINDS[pr.kind].r * 2.6 + 20) * k;
        const grad = ctx.createRadialGradient(pr.x * k, pr.y * k, r * 0.3, pr.x * k, pr.y * k, r);
        grad.addColorStop(0, '#d9b380');
        grad.addColorStop(0.75, '#c9a06b');
        grad.addColorStop(1, 'rgba(201,160,107,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pr.x * k, pr.y * k, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    build(tier, p) {
      switch (tier) {
        case 0: {
          // Starfish.
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            p.add(sph(1.2, 6), 0xff9f5c, Math.cos(a) * 2.2, 0.8, Math.sin(a) * 2.2, { sx: 1.5, sy: 0.6 });
          }
          p.add(sph(1.5, 7), 0xffb703, 0, 1, 0, { sy: 0.6 });
          break;
        }
        case 1: // Seashell.
          p.add(sph(2.6, 9), 0xf6e3d0, 0, 1.6, 0, { sy: 0.65 });
          p.add(sph(1.4, 8), 0xffc9de, 1.4, 2.2, 0.8, { sy: 0.7 });
          break;
        case 2: // Crab.
          p.add(sph(3, 8), 0xe8384f, 0, 2, 0, { sy: 0.65 });
          p.add(sph(1.3, 6), 0xff6b81, -3.4, 1.6, 1.6);
          p.add(sph(1.3, 6), 0xff6b81, 3.4, 1.6, 1.6);
          p.addGlow(sph(0.45, 5), 0xffffff, -1, 3.4, 1.8, {}, 1.6);
          p.addGlow(sph(0.45, 5), 0xffffff, 1, 3.4, 1.8, {}, 1.6);
          break;
        case 3: // Barrel.
          p.add(cyl(2.6, 2.2, 6.4, 11), 0x9c6644, 0, 3.2, 0, { sy: 1 });
          p.add(cyl(2.85, 2.85, 0.7, 11), 0x4a3728, 0, 1.7, 0);
          p.add(cyl(2.85, 2.85, 0.7, 11), 0x4a3728, 0, 4.7, 0);
          break;
        case 4: // Treasure chest.
          p.add(box(7.5, 4, 5.5), 0x8a5a35, 0, 2, 0);
          p.add(cyl(2.75, 2.75, 7.5, 10, ), 0xa06a40, 0, 4, 0, { rz: Math.PI / 2, sx: 0.75 });
          p.add(box(1.6, 5.2, 0.6), 0xd9a441, 0, 2.6, 2.6);
          p.addGlow(sph(1.6, 7), 0xffd766, 0, 4.6, 0, { sy: 0.5 }, 2.4);
          break;
        case 5: // Rowboat (floats).
          p.add(box(5.5, 2.6, 13), 0x9c6644, 0, 1.8, 0);
          p.add(box(4, 2, 11), 0x5c4030, 0, 2.6, 0);
          p.add(box(4.6, 0.7, 1.6), 0xb08968, 0, 2.6, -2);
          p.add(box(4.6, 0.7, 1.6), 0xb08968, 0, 2.6, 2.5);
          return 'bob';
        case 6: {
          // Cannon.
          p.add(cyl(1.7, 2.3, 9, 10), 0x2f3542, 0, 4.6, -1, { rx: -1.1 });
          for (const wx of [-2.6, 2.6]) p.add(cyl(2, 2, 1.2, 10), 0x6f4a2f, wx, 2, 1, { rz: Math.PI / 2 });
          p.add(box(4.4, 2.4, 5), 0x8a5a35, 0, 2.2, 0.6);
          p.addGlow(cyl(1.1, 1.1, 0.5, 9), 0xffb35c, 0, 8.6, -3.05, { rx: -1.1 }, 1.8);
          break;
        }
        case 7: {
          // Palm tree.
          p.add(cyl(1, 1.7, 15, 7), 0x8a5a35, 1, 7.5, 0, { rz: -0.12 });
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            p.add(box(9, 0.5, 2.6), 0x2f9e44, 2 + Math.cos(a) * 4.4, 15.4 - Math.abs(Math.sin(a)) * 1, Math.sin(a) * 4.4, {
              ry: -a,
              rz: 0.3,
            });
          }
          p.add(sph(1, 6), 0x6f4a2f, 1.2, 14.2, 1.2);
          p.add(sph(1, 6), 0x6f4a2f, 2.8, 14, -0.6);
          break;
        }
        case 8: {
          // Pirate ship (tall masts, floats).
          p.add(box(11, 6, 30), 0x6b4226, 0, 4, 0);
          p.add(box(9, 2, 26), 0x8a5a35, 0, 7.5, 0);
          p.add(box(11, 4, 7), 0x8a5a35, 0, 8.5, -12.5);
          p.add(box(1.1, 24, 1.1), 0x4a3728, 0, 20, 3);
          p.add(box(1, 18, 1), 0x4a3728, 0, 17, -8);
          p.add(box(12, 9, 0.6), 0xf1e4c8, 0, 22, 3);
          p.add(box(9, 7, 0.6), 0xf1e4c8, 0, 18.5, -8);
          p.add(box(2.6, 2, 2.6), 0x4a3728, 0, 32.5, 3);
          p.addGlow(box(3, 2.4, 0.4), 0x2f3542, 0, 22, 3.4, {}, 0.6);
          p.addGlow(sph(0.9, 6), 0xffb35c, 0, 10.5, -16.2, {}, 2.6);
          return 'bob';
        }
        case 9: {
          // Whale! (floats)
          p.add(sph(13, 12), 0x30518a, 0, 6, 2, { sx: 0.65, sy: 0.55, sz: 1.15 });
          p.add(sph(10, 10), 0xbcd3e8, 0, 3.2, 3, { sx: 0.6, sy: 0.4, sz: 1.05 });
          p.add(sph(4, 8), 0x30518a, 0, 5, -13, { sx: 0.4, sy: 0.35 });
          p.add(box(5.5, 1.2, 4), 0x274370, -4.4, 6.5, -16, { ry: 0.5, rz: 0.25 });
          p.add(box(5.5, 1.2, 4), 0x274370, 4.4, 6.5, -16, { ry: -0.5, rz: -0.25 });
          p.add(box(3.6, 1, 2.6), 0x274370, -7.5, 5, 4, { rz: 0.35 });
          p.add(box(3.6, 1, 2.6), 0x274370, 7.5, 5, 4, { rz: -0.35 });
          p.addGlow(sph(0.55, 5), 0xffffff, -4.6, 8, 8.6, {}, 1.5);
          p.addGlow(sph(0.55, 5), 0xffffff, 4.6, 8, 8.6, {}, 1.5);
          p.addGlow(cone(1.4, 4.5, 7), 0xa5f3fc, 0, 12.4, 4, {}, 1.4);
          return 'bob';
        }
      }
      return undefined;
    },
  },
};

// --- Particles (one shader-driven Points cloud) ----------------------------

const MAX_PARTICLES = 360;

class ParticleFx {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grav: Float32Array;
  private cursor = 0;
  private geo: THREE.BufferGeometry;

  constructor() {
    this.pos = new Float32Array(MAX_PARTICLES * 3);
    this.col = new Float32Array(MAX_PARTICLES * 3);
    this.size = new Float32Array(MAX_PARTICLES);
    this.alpha = new Float32Array(MAX_PARTICLES);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES).fill(1);
    this.grav = new Float32Array(MAX_PARTICLES);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    // Never let a stale bounding sphere cull the cloud.
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(WORLD_W / 2, 0, WORLD_H / 2), WORLD_W * 2);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (620.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float m = smoothstep(0.5, 0.08, d);
          gl_FragColor = vec4(vColor * m * vAlpha, 1.0);
        }`,
    });
    this.points = new THREE.Points(this.geo, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
  }

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: number,
    size: number,
    life: number,
    grav = 0
  ): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    const c = new THREE.Color(color);
    this.col.set([c.r, c.g, c.b], i * 3);
    this.size[i] = size;
    this.alpha[i] = 1;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = grav;
  }

  burst(x: number, z: number, color: number, count: number, speed: number, size: number, life = 0.7): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.spawn(
        x,
        2 + Math.random() * 4,
        z,
        Math.cos(a) * v,
        speed * (0.5 + Math.random() * 0.9),
        Math.sin(a) * v,
        color,
        size * (0.6 + Math.random() * 0.7),
        life * (0.6 + Math.random() * 0.5),
        320
      );
    }
  }

  implode(x: number, z: number, color: number, count: number, radius: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = radius * (0.8 + Math.random() * 0.6);
      this.spawn(
        x + Math.cos(a) * d,
        2 + Math.random() * 10,
        z + Math.sin(a) * d,
        -Math.cos(a) * d * 2.4,
        -6,
        -Math.sin(a) * d * 2.4,
        color,
        radius * 0.14 * (0.5 + Math.random()),
        0.45,
        0
      );
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.5) this.pos[i * 3 + 1] = 0.5;
      this.alpha[i] = Math.min(1, this.life[i] / this.maxLife[i] / 0.7);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

// --- Floating score popups -------------------------------------------------

interface Popup {
  sprite: THREE.Sprite;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  life: number;
  maxLife: number;
  scale: number;
}

class Popups {
  readonly group = new THREE.Group();
  private pool: Popup[] = [];
  private active: Popup[] = [];

  constructor() {
    for (let i = 0; i < 16; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 96;
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false })
      );
      sprite.visible = false;
      sprite.renderOrder = 30;
      this.group.add(sprite);
      this.pool.push({ sprite, canvas, texture, life: 0, maxLife: 1, scale: 1 });
    }
  }

  spawn(x: number, z: number, text: string, cssColor: string, scale = 1): void {
    const p = this.pool.pop();
    if (!p) return;
    const ctx = p.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 96);
    ctx.font = '800 56px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(6,10,22,0.9)';
    ctx.strokeText(text, 128, 48);
    ctx.fillStyle = cssColor;
    ctx.fillText(text, 128, 48);
    p.texture.needsUpdate = true;
    p.sprite.position.set(x, 14, z);
    p.sprite.visible = true;
    p.life = p.maxLife = 0.9;
    p.scale = scale;
    this.active.push(p);
  }

  update(dt: number, camDist: number): void {
    const base = camDist * 0.085;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        this.active.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      const k = t < 0.3 ? easeOutBack(t / 0.3) : 1;
      p.sprite.scale.set(base * p.scale * k, base * p.scale * k * 0.375, 1);
      p.sprite.position.y += dt * 22;
      const mat = p.sprite.material as THREE.SpriteMaterial;
      mat.opacity = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
    }
  }
}

// --- Hole visuals ----------------------------------------------------------

interface HoleVis {
  root: THREE.Group;
  disc: THREE.Mesh;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  swirl: THREE.Mesh;
  swirlMat: THREE.MeshBasicMaterial;
  halo: THREE.Mesh;
  haloMat: THREE.MeshBasicMaterial;
  shield: THREE.Mesh;
  shieldMat: THREE.MeshBasicMaterial;
  label: THREE.Sprite;
  labelCanvas: HTMLCanvasElement;
  labelTexture: THREE.CanvasTexture;
  labelText: string;
  color: number;
  deathT: number;
  deathR: number;
  eaterId: number;
  spawnT: number;
  lastAlive: boolean;
}

interface Sinking {
  group: THREE.Group;
  eaterId: number;
  t: number;
  maxT: number;
  kindR: number;
  fromX: number;
  fromZ: number;
  baseYaw: number;
  grow: boolean;
}

// --- The view --------------------------------------------------------------

export class View {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;

  private worldGroup = new THREE.Group();
  private holeGroup = new THREE.Group();
  private fx = new ParticleFx();
  private popups = new Popups();

  private bodyMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  private glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  private templates = new Map<string, KindTemplate>();

  private props: Prop[] = [];
  private propGroups = new Map<number, THREE.Group>();
  private animated: { group: THREE.Group; phase: number }[] = [];
  private sinking: Sinking[] = [];
  private holes = new Map<number, HoleVis>();
  private holePositions = new Map<number, { x: number; y: number }>();

  private theme: ThemeName = 'city';


  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;

  private camX = WORLD_W / 2;
  private camZ = WORLD_H / 2;
  private camDist = 500;
  private camInit = false;
  private shakeTime = 0;
  private shakePower = 0;
  private time = 0;
  private dustTimer = 0;

  private ringGeo = new THREE.RingGeometry(0.9, 1.07, 48);
  private discGeo = new THREE.CircleGeometry(1, 48);
  private planeGeo = new THREE.PlaneGeometry(2, 2);
  private swirlTexture: THREE.CanvasTexture;
  private haloTexture: THREE.CanvasTexture;
  private shieldTexture: THREE.CanvasTexture;

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 5, 6000);

    this.ringGeo.rotateX(-Math.PI / 2);
    this.discGeo.rotateX(-Math.PI / 2);
    this.planeGeo.rotateX(-Math.PI / 2);

    this.swirlTexture = new THREE.CanvasTexture(makeSwirlCanvas());
    this.haloTexture = new THREE.CanvasTexture(
      makeRadialCanvas(128, [
        [0, 'rgba(255,255,255,0.55)'],
        [0.55, 'rgba(255,255,255,0.14)'],
        [1, 'rgba(255,255,255,0)'],
      ])
    );
    this.shieldTexture = new THREE.CanvasTexture(makeShieldCanvas());

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 1.2);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.1);
    this.sun.position.set(420, 640, 260);
    this.scene.add(this.hemi, this.sun, this.worldGroup, this.holeGroup, this.fx.points, this.popups.group);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // ACES pushes scene luminance past 1.0, so anything below ~1.05 here
    // would bloom the whole frame (see robot-rally's notes).
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.45, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  // --- Arena construction --------------------------------------------------

  setWorld(seed: number, gone: number[], theme: ThemeName): void {
    // Tear down the previous arena.
    this.worldGroup.traverse((o) => {
      if (o instanceof THREE.Mesh && !(o.geometry as THREE.BufferGeometry).userData.shared) {
        (o.geometry as THREE.BufferGeometry).dispose();
      }
    });
    this.worldGroup.clear();
    for (const vis of this.holes.values()) this.disposeHole(vis);
    this.holes.clear();
    this.holePositions.clear();
    this.propGroups.clear();
    this.animated = [];
    this.sinking = [];
    this.camInit = false;


    this.theme = theme;
    const def = themes[theme];

    this.scene.background = new THREE.Color(def.bg);
    this.scene.fog = new THREE.Fog(def.bg, 900, 2600);
    this.hemi.color.set(def.hemiSky);
    this.hemi.groundColor.set(def.hemiGround);
    this.sun.color.set(def.sun);

    this.props = generateProps(seed);

    // Ground: an oversized dark base plus the painted arena plane.
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: def.baseGround })
    );
    base.position.set(WORLD_W / 2, -0.6, WORLD_H / 2);
    this.worldGroup.add(base);

    const px = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    def.paint(canvas.getContext('2d')!, px, this.props, mulberry32(seed ^ 0x9e3779b9));
    const groundTex = new THREE.CanvasTexture(canvas);
    groundTex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    groundTex.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_W, WORLD_H).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: groundTex })
    );
    ground.position.set(WORLD_W / 2, 0, WORLD_H / 2);
    this.worldGroup.add(ground);

    // Glowing boundary walls — bright enough to catch a little bloom, dim
    // enough not to blow out into white streaks when you drive alongside one.
    const wallMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.wall).multiplyScalar(1.15), toneMapped: false });
    const wallH = 4;
    for (const [x, z, w, d] of [
      [WORLD_W / 2, -4, WORLD_W + 20, 5],
      [WORLD_W / 2, WORLD_H + 4, WORLD_W + 20, 5],
      [-4, WORLD_H / 2, 5, WORLD_H + 20],
      [WORLD_W + 4, WORLD_H / 2, 5, WORLD_H + 20],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      wall.position.set(x, wallH / 2, z);
      this.worldGroup.add(wall);
    }

    // Props.
    const goneSet = new Set(gone);
    const yawRng = mulberry32(seed + 7);
    for (const prop of this.props) {
      const template = this.templateFor(theme, prop.kind);
      const group = new THREE.Group();
      const bodyMesh = new THREE.Mesh(template.body, this.bodyMaterial);
      group.add(bodyMesh);
      if (template.glow) group.add(new THREE.Mesh(template.glow, this.glowMaterial));
      const yaw = yawRng() * Math.PI * 2;
      group.position.set(prop.x, 0, prop.y);
      group.rotation.y = yaw;
      group.userData = { yaw, x: prop.x, z: prop.y };
      group.visible = !goneSet.has(prop.id);
      this.worldGroup.add(group);
      this.propGroups.set(prop.id, group);
      if (template.anim === 'bob') this.animated.push({ group, phase: yawRng() * Math.PI * 2 });
    }
  }

  private templateFor(theme: ThemeName, tier: number): KindTemplate {
    const key = `${theme}:${tier}`;
    let template = this.templates.get(key);
    if (!template) {
      const parts = new Parts();
      // Grounding "stain" shadow baked into the body geometry. Kept small and
      // barely darker than the ground — a big dark disc reads as a hole.
      parts.add(disc(PROP_KINDS[tier].r * 0.8, 20), themes[theme].shadow, 0.8, 0.07, 1);
      const anim = themes[theme].build(tier, parts);
      const { body, glow } = parts.build();
      body.userData.shared = true;
      if (glow) glow.userData.shared = true;
      template = { body, glow, anim };
      this.templates.set(key, template);
    }
    return template;
  }

  /** New round: every prop regrows at once (the server reset them silently). */
  resetProps(): void {
    this.sinking = [];
    for (const group of this.propGroups.values()) {
      const { yaw, x, z } = group.userData as { yaw: number; x: number; z: number };
      group.visible = true;
      group.position.set(x, 0, z);
      group.rotation.set(0, yaw, 0);
      group.scale.setScalar(1);
    }
  }

  // --- Arena events --------------------------------------------------------

  propEaten(propId: number, eaterId: number): void {
    const group = this.propGroups.get(propId);
    if (!group || !group.visible) return;
    this.sinking.push({
      group,
      eaterId,
      t: SINK_TIME,
      maxT: SINK_TIME,
      kindR: PROP_KINDS[this.props[propId].kind].r,
      fromX: group.position.x,
      fromZ: group.position.z,
      baseYaw: group.rotation.y,
      grow: false,
    });
  }

  propRespawned(propId: number): void {
    const group = this.propGroups.get(propId);
    if (!group) return;
    const { yaw, x, z } = group.userData as { yaw: number; x: number; z: number };
    group.visible = true;
    group.position.set(x, 0, z);
    group.rotation.set(0, yaw, 0);
    group.scale.setScalar(0.01);
    this.sinking.push({
      group,
      eaterId: -1,
      t: 0.4,
      maxT: 0.4,
      kindR: 0,
      fromX: x,
      fromZ: z,
      baseYaw: yaw,
      grow: true,
    });
  }

  holeSwallowed(victimId: number, eaterId: number): void {
    const vis = this.holes.get(victimId);
    if (vis) {
      vis.deathT = DEATH_TIME;
      vis.deathR = Math.max(vis.disc.scale.x, HOLE_BASE_R);
      vis.eaterId = eaterId;
    }
    const pos = this.holePositions.get(victimId);
    const eaterVis = this.holes.get(eaterId);
    if (pos) {
      const color = eaterVis ? eaterVis.color : 0xffffff;
      this.fx.implode(pos.x, pos.y, color, 42, vis ? vis.deathR * 1.5 : 40);
      this.fx.burst(pos.x, pos.y, 0xffffff, 16, 130, 7, 0.5);
    }
  }

  holeSpawned(id: number): void {
    const vis = this.holes.get(id);
    if (vis) vis.spawnT = SPAWN_TIME;
  }

  eatFx(propId: number, color: number, pts: number, mine: boolean): void {
    const prop = this.props[propId];
    if (!prop) return;
    const size = PROP_KINDS[prop.kind].r;
    this.fx.burst(prop.x, prop.y, color, Math.min(22, 5 + pts * 2), 60 + size * 4, 3 + size * 0.32);
    if (mine || pts >= 6) {
      this.popups.spawn(prop.x, prop.y, `+${pts}`, mine ? '#ffe066' : '#dfe8ff', mine ? 1 : 0.75);
    }
  }

  shake(power: number): void {
    this.shakePower = Math.max(this.shakePower, power);
    this.shakeTime = Math.max(this.shakeTime, 0.18 + power * 0.12);
  }

  // --- Coordinate mapping --------------------------------------------------

  screenToWorld(x: number, y: number): { x: number; y: number } {
    const ndc = new THREE.Vector2(
      (x / window.innerWidth) * 2 - 1,
      -(y / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit);
    return { x: hit.x, y: hit.z };
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, 0, y).project(this.camera);
    return {
      x: ((v.x + 1) / 2) * window.innerWidth,
      y: ((1 - v.y) / 2) * window.innerHeight,
    };
  }

  // --- Per-frame rendering -------------------------------------------------

  render(state: RenderState | null, focus: { x: number; y: number; r: number }, dt: number): void {
    this.time += dt;

    // Camera: a gently tilted chase view that pulls back as you grow.
    const targetDist = Math.min(940, 300 + focus.r * 9.5);
    if (!this.camInit) {
      this.camDist = targetDist;
      this.camX = focus.x;
      this.camZ = focus.y;
      this.camInit = true;
    }
    this.camDist += (targetDist - this.camDist) * Math.min(1, dt * 2.5);
    this.camX += (focus.x - this.camX) * Math.min(1, dt * 5);
    this.camZ += (focus.y - this.camZ) * Math.min(1, dt * 5);

    // Screen shake.
    let shakeX = 0;
    let shakeZ = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const a = Math.max(0, this.shakeTime) * this.shakePower * 26;
      shakeX = (Math.random() * 2 - 1) * a;
      shakeZ = (Math.random() * 2 - 1) * a;
      if (this.shakeTime <= 0) this.shakePower = 0;
    }

    this.camera.position.set(
      this.camX + shakeX,
      this.camDist * 0.74,
      this.camZ + this.camDist * 0.62 + shakeZ
    );
    this.camera.lookAt(this.camX + shakeX * 0.4, 0, this.camZ + shakeZ * 0.4);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = this.camDist * 1.9;
      this.scene.fog.far = this.camDist * 5.2;
    }

    // Bobbing props (boats, whales).
    for (const a of this.animated) {
      if (!a.group.visible) continue;
      a.group.position.y = Math.sin(this.time * 1.3 + a.phase) * 0.9;
      a.group.rotation.z = Math.sin(this.time * 1.1 + a.phase) * 0.03;
    }

    // Ambient drifting dust / fireflies / sea sparkle.
    this.dustTimer -= dt;
    if (this.dustTimer <= 0) {
      this.dustTimer = 0.12;
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * this.camDist * 1.1;
      this.fx.spawn(
        this.camX + Math.cos(a) * d,
        3 + Math.random() * 26,
        this.camZ + Math.sin(a) * d,
        (Math.random() - 0.5) * 7,
        Math.random() * 2.5,
        (Math.random() - 0.5) * 7,
        themes[this.theme].dust,
        2.4,
        2.5 + Math.random() * 2
      );
    }

    if (state) this.renderHoles(state, dt);
    this.updateSinking(dt);
    this.fx.update(dt);
    this.popups.update(dt, this.camDist);

    this.composer.render();
  }

  private renderHoles(state: RenderState, dt: number): void {
    const seen = new Set<number>();
    for (const hole of state.holes) {
      seen.add(hole.id);
      let vis = this.holes.get(hole.id);
      if (!vis) {
        vis = this.makeHoleVis(hole.color);
        this.holes.set(hole.id, vis);
      }
      this.holePositions.set(hole.id, { x: hole.x, y: hole.y });

      const label = hole.leader ? `👑 ${hole.name}` : hole.name;
      if (vis.labelText !== label) this.drawLabel(vis, label, hole.isMe);

      vis.root.position.set(hole.x, 0, hole.y);

      if (!hole.alive) {
        if (vis.deathT > 0) {
          vis.deathT -= dt;
          const t = Math.max(0, vis.deathT / DEATH_TIME);
          const eater = this.holePositions.get(vis.eaterId);
          if (eater) {
            vis.root.position.set(
              hole.x + (eater.x - hole.x) * (1 - t),
              0,
              hole.y + (eater.y - hole.y) * (1 - t)
            );
          }
          this.sizeHole(vis, vis.deathR * t);
          this.setHoleOpacity(vis, t);
          vis.root.visible = true;
        } else {
          vis.root.visible = false;
        }
        vis.lastAlive = false;
        continue;
      }

      if (!vis.lastAlive) {
        vis.spawnT = SPAWN_TIME;
        vis.lastAlive = true;
      }
      vis.root.visible = true;
      this.setHoleOpacity(vis, 1);

      let r = hole.r;
      if (vis.spawnT > 0) {
        vis.spawnT -= dt;
        r *= easeOutBack(1 - Math.max(0, vis.spawnT) / SPAWN_TIME);
      }
      this.sizeHole(vis, r);

      vis.swirl.rotation.z += dt * (1.4 + 16 / hole.r);
      vis.shield.visible = hole.invuln;
      if (hole.invuln) {
        vis.shieldMat.opacity = 0.45 + 0.35 * Math.sin(performance.now() / 90);
        vis.shield.rotation.z -= dt * 1.6;
      }

      // Labels keep a steady on-screen size.
      const w = this.camDist * 0.16;
      vis.label.scale.set(w, w * 0.25, 1);
      vis.label.position.set(0, 8, -hole.r * 0.3);
    }

    for (const [id, vis] of this.holes) {
      if (!seen.has(id)) {
        this.disposeHole(vis);
        this.holes.delete(id);
        this.holePositions.delete(id);
      }
    }
  }

  private sizeHole(vis: HoleVis, r: number): void {
    const s = Math.max(0.5, r);
    vis.disc.scale.set(s, 1, s);
    vis.ring.scale.set(s * 1.06, 1, s * 1.06);
    vis.halo.scale.set(s * 2.4, 1, s * 2.4);
    vis.swirl.scale.set(s * 0.95, 1, s * 0.95);
    vis.shield.scale.set(s * 1.28, 1, s * 1.28);
  }

  private setHoleOpacity(vis: HoleVis, o: number): void {
    (vis.disc.material as THREE.MeshBasicMaterial).opacity = o;
    vis.ringMat.opacity = o;
    vis.swirlMat.opacity = 0.55 * o;
    vis.haloMat.opacity = 0.3 * o;
    (vis.label.material as THREE.SpriteMaterial).opacity = o;
  }

  private makeHoleVis(color: number): HoleVis {
    const root = new THREE.Group();

    const haloMat = new THREE.MeshBasicMaterial({
      map: this.haloTexture,
      color,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const halo = new THREE.Mesh(this.planeGeo, haloMat);
    halo.position.y = 0.1;
    halo.renderOrder = 4;

    const discMat = new THREE.MeshBasicMaterial({ color: 0x04060e, transparent: true });
    const holeDisc = new THREE.Mesh(this.discGeo, discMat);
    holeDisc.position.y = 0.22;
    holeDisc.renderOrder = 5;

    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(1.55),
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(this.ringGeo, ringMat);
    ring.position.y = 0.3;
    ring.renderOrder = 6;

    const swirlMat = new THREE.MeshBasicMaterial({
      map: this.swirlTexture,
      color,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const swirl = new THREE.Mesh(this.planeGeo, swirlMat);
    swirl.position.y = 0.26;
    swirl.renderOrder = 7;

    const shieldMat = new THREE.MeshBasicMaterial({
      map: this.shieldTexture,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const shield = new THREE.Mesh(this.planeGeo, shieldMat);
    shield.position.y = 0.34;
    shield.visible = false;
    shield.renderOrder = 8;

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 128;
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false, toneMapped: false })
    );
    label.renderOrder = 25;
    label.center.set(0.5, 0);

    root.add(halo, holeDisc, ring, swirl, shield, label);
    this.holeGroup.add(root);
    return {
      root,
      disc: holeDisc,
      ring,
      ringMat,
      swirl,
      swirlMat,
      halo,
      haloMat,
      shield,
      shieldMat,
      label,
      labelCanvas,
      labelTexture,
      labelText: '',
      color,
      deathT: 0,
      deathR: HOLE_BASE_R,
      eaterId: -1,
      spawnT: SPAWN_TIME,
      lastAlive: true,
    };
  }

  private drawLabel(vis: HoleVis, text: string, isMe: boolean): void {
    vis.labelText = text;
    const ctx = vis.labelCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 128);
    ctx.font = '700 52px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(6,10,22,0.85)';
    ctx.strokeText(text, 256, 70);
    ctx.fillStyle = isMe ? '#ffffff' : '#cfe0f5';
    ctx.fillText(text, 256, 70);
    vis.labelTexture.needsUpdate = true;
  }

  private disposeHole(vis: HoleVis): void {
    this.holeGroup.remove(vis.root);
    vis.labelTexture.dispose();
    (vis.disc.material as THREE.Material).dispose();
    vis.ringMat.dispose();
    vis.swirlMat.dispose();
    vis.haloMat.dispose();
    vis.shieldMat.dispose();
    (vis.label.material as THREE.Material).dispose();
  }

  private updateSinking(dt: number): void {
    for (let i = this.sinking.length - 1; i >= 0; i--) {
      const s = this.sinking[i];
      s.t -= dt;
      const done = s.t <= 0;
      const t = Math.max(0, s.t / s.maxT);

      if (s.grow) {
        const k = easeOutBack(1 - t);
        s.group.scale.setScalar(Math.max(0.01, k));
        if (done) {
          s.group.scale.setScalar(1);
          this.sinking.splice(i, 1);
        }
        continue;
      }

      // Tip over and spiral down into the eater.
      const k = 1 - t;
      const eater = this.holePositions.get(s.eaterId);
      if (eater) {
        s.group.position.x = s.fromX + (eater.x - s.fromX) * k * k;
        s.group.position.z = s.fromZ + (eater.y - s.fromZ) * k * k;
      }
      s.group.position.y = -(s.kindR * 2.2 + 6) * k * k;
      s.group.rotation.y = s.baseYaw + k * 5;
      s.group.rotation.x = k * 0.7;
      s.group.scale.setScalar(Math.max(0.01, 1 - k * 0.85));
      if (done) {
        s.group.visible = false;
        s.group.position.y = 0;
        s.group.rotation.set(0, s.baseYaw, 0);
        s.group.scale.setScalar(1);
        this.sinking.splice(i, 1);
      }
    }
  }
}

// --- Canvas texture helpers ------------------------------------------------

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function makeRadialCanvas(size: number, stops: [number, string][]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function makeSwirlCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const angle = arm * ((Math.PI * 2) / 3) + t * 2.4;
      const radius = 14 + t * 100;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  return canvas;
}

function makeShieldCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(0, 0, 108, a0, a0 + Math.PI / 14);
    ctx.stroke();
  }
  return canvas;
}
