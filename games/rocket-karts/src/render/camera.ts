/**
 * Chase camera with lag, a boost FOV kick, and shake. Also drives the slow
 * orbit used behind the menus.
 */
import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { lerpAngle } from '../shared/track.ts';

export interface CameraTarget {
  x: number;
  z: number;
  heading: number;
  speed: number;
  boostTime: number;
  spinTime: number;
}

const BASE_FOV = 0.95;

export class ChaseCamera {
  private yaw = 0;
  private pos = new Vector3(0, 6, -12);
  private fov = BASE_FOV;
  private shakePower = 0;
  private snapNext = true;
  private orbitAngle = 0;

  constructor(private readonly camera: UniversalCamera) {}

  /** Cut straight to the next target instead of easing there. */
  snap(): void {
    this.snapNext = true;
  }

  shake(power: number): void {
    this.shakePower = Math.min(1.2, this.shakePower + power);
  }

  follow(t: CameraTarget, dt: number): void {
    const speedFrac = Math.min(1.4, Math.abs(t.speed) / 30);
    const behind = 6.4 + speedFrac * 1.4;
    const height = 3.1 + speedFrac * 0.3;
    // Look where the kart is going, not where a spin has pointed its nose.
    const wantYaw = t.heading;
    this.yaw = this.snapNext ? wantYaw : lerpAngle(this.yaw, wantYaw, 1 - Math.exp(-(t.spinTime > 0 ? 1.8 : 5.5) * dt));
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const target = new Vector3(t.x - fx * behind, height, t.z - fz * behind);
    if (this.snapNext) {
      this.pos.copyFrom(target);
      this.snapNext = false;
    } else {
      const k = 1 - Math.exp(-12 * dt);
      this.pos.x += (target.x - this.pos.x) * k;
      this.pos.y += (target.y - this.pos.y) * k;
      this.pos.z += (target.z - this.pos.z) * k;
    }
    const wantFov = BASE_FOV + (t.boostTime > 0 ? 0.16 : 0) + speedFrac * 0.05;
    this.fov += (wantFov - this.fov) * Math.min(1, 6 * dt);
    this.camera.fov = this.fov;

    let sx = 0;
    let sy = 0;
    if (this.shakePower > 0) {
      sx = (Math.random() - 0.5) * this.shakePower * 0.5;
      sy = (Math.random() - 0.5) * this.shakePower * 0.35;
      this.shakePower = Math.max(0, this.shakePower - dt * 3);
    }
    this.camera.position.set(this.pos.x + sx, this.pos.y + sy, this.pos.z);
    this.camera.setTarget(new Vector3(t.x + fx * 4.5 + sx, 1.3 + sy, t.z + fz * 4.5));
  }

  /** Lazy cinematic orbit around a point, for the menus. */
  orbit(cx: number, cz: number, dt: number, radius = 26): void {
    this.orbitAngle += dt * 0.12;
    const x = cx + Math.cos(this.orbitAngle) * radius;
    const z = cz + Math.sin(this.orbitAngle) * radius;
    const target = new Vector3(x, 9, z);
    if (this.snapNext) {
      this.pos.copyFrom(target);
      this.snapNext = false;
    } else {
      this.pos.x += (target.x - this.pos.x) * Math.min(1, 2 * dt);
      this.pos.y += (target.y - this.pos.y) * Math.min(1, 2 * dt);
      this.pos.z += (target.z - this.pos.z) * Math.min(1, 2 * dt);
    }
    this.fov += (BASE_FOV - this.fov) * Math.min(1, 2 * dt);
    this.camera.fov = this.fov;
    this.camera.position.copyFrom(this.pos);
    this.camera.setTarget(new Vector3(cx, 1.5, cz));
    this.yaw = Math.atan2(cx - this.pos.x, cz - this.pos.z);
  }
}
