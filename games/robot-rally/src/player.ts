import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { World } from './world.ts';

const GRAVITY = 26;
const RUN_SPEED = 7.2;
const ACCEL = 34;
const JUMP_VEL = 10.5;
const PAD_VEL = 16.5;

export interface PlayerEvents {
  onJump: () => void;
  onLand: (pos: THREE.Vector3, impact: number) => void;
  onPad: (pad: { center(): THREE.Vector3; trigger(): void }) => void;
  onFootstep: (alt: boolean) => void;
}

export class Player {
  readonly root = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  grounded = true;
  frozen = false; // start screen / win screen

  private model!: THREE.Group;
  private baseScale = 1;
  private mixer!: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = '';
  private targetYaw = 0;
  private squash = 1;
  private squashVel = 0;
  private stepTimer = 0;
  private stepAlt = false;
  private events: PlayerEvents;
  private groundVel = new THREE.Vector3();

  private constructor(events: PlayerEvents) {
    this.events = events;
  }

  static async load(events: PlayerEvents): Promise<Player> {
    const p = new Player(events);
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}RobotExpressive.glb`);
    p.model = gltf.scene;

    // Normalize height to ~1.75 world units
    const bbox = new THREE.Box3().setFromObject(p.model);
    const height = bbox.max.y - bbox.min.y;
    const scale = 1.75 / height;
    p.baseScale = scale;
    p.model.scale.setScalar(scale);

    p.model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = false;
      }
    });
    p.root.add(p.model);

    p.mixer = new THREE.AnimationMixer(p.model);
    for (const clip of gltf.animations) {
      const action = p.mixer.clipAction(clip);
      if (['Jump', 'Wave', 'ThumbsUp', 'Yes', 'No', 'Punch'].includes(clip.name)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      p.actions.set(clip.name, action);
    }
    p.play('Idle', 0);
    return p;
  }

  play(name: string, fade = 0.22): void {
    if (this.current === name) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.actions.get(this.current);
    next.reset().fadeIn(fade).play();
    if (prev) prev.fadeOut(fade);
    this.current = name;
  }

  /** One-shot gesture (Wave etc.); falls back to Idle when done. */
  gesture(name: string): void {
    this.play(name, 0.2);
    const action = this.actions.get(name);
    if (!action) return;
    const onDone = (e: { action: THREE.AnimationAction }) => {
      if (e.action === action) {
        this.mixer.removeEventListener('finished', onDone);
        if (this.current === name) this.play('Idle');
      }
    };
    this.mixer.addEventListener('finished', onDone);
  }

  reset(spawn: THREE.Vector3): void {
    this.root.position.copy(spawn);
    this.velocity.set(0, 0, 0);
    this.grounded = true;
    this.targetYaw = Math.PI; // face the camera-ish on spawn? no — face away
    this.root.rotation.y = this.targetYaw;
    this.play('Idle');
  }

  update(
    dt: number,
    move: { x: number; y: number },
    jumpQueued: boolean,
    camYaw: number,
    world: World,
  ): void {
    if (this.frozen) {
      this.mixer.update(dt);
      return;
    }

    /* --- Horizontal movement (camera-relative) --- */
    const fwd = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw)); // camera forward on XZ
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const wish = new THREE.Vector3()
      .addScaledVector(fwd, move.y)
      .addScaledVector(right, move.x);
    const wishLen = Math.min(wish.length(), 1);
    if (wishLen > 0.001) wish.normalize();

    const targetVX = wish.x * RUN_SPEED * wishLen + this.groundVel.x;
    const targetVZ = wish.z * RUN_SPEED * wishLen + this.groundVel.z;
    const blend = 1 - Math.exp((-ACCEL * dt) / RUN_SPEED);
    this.velocity.x += (targetVX - this.velocity.x) * blend;
    this.velocity.z += (targetVZ - this.velocity.z) * blend;

    /* --- Jumping --- */
    if (jumpQueued && this.grounded) {
      this.velocity.y = JUMP_VEL;
      this.grounded = false;
      this.squashVel = 4.5; // stretch
      this.play('Jump', 0.08);
      this.events.onJump();
    }

    this.velocity.y -= GRAVITY * dt;
    this.root.position.addScaledVector(this.velocity, dt);

    /* --- Ground resolution --- */
    const px = this.root.position.x;
    const pz = this.root.position.z;
    let groundY = world.heightAt(px, pz);
    this.groundVel.set(0, 0, 0);

    for (const s of world.statics) {
      if (Math.abs(px - s.x) <= s.halfX && Math.abs(pz - s.z) <= s.halfZ) {
        if (this.root.position.y >= s.top - 0.6 && s.top > groundY) groundY = s.top;
      }
    }
    let carrier: THREE.Vector3 | null = null;
    for (const m of world.movers) {
      const mp = m.group.position;
      if (Math.abs(px - mp.x) <= m.halfX && Math.abs(pz - mp.z) <= m.halfZ) {
        if (this.root.position.y >= m.top - 0.6 && m.top > groundY) {
          groundY = m.top;
          carrier = m.velocity;
        }
      }
    }

    /* Jump pads: bounce when falling onto the cap */
    if (this.velocity.y <= 0.5) {
      for (const pad of world.pads) {
        const c = pad.center();
        if (
          Math.hypot(px - c.x, pz - c.z) < pad.radius &&
          this.root.position.y <= c.y + 0.35 &&
          this.root.position.y > c.y - 1.2
        ) {
          this.root.position.y = c.y + 0.05;
          this.velocity.y = PAD_VEL;
          this.grounded = false;
          this.squashVel = 7;
          pad.trigger();
          this.play('Jump', 0.06);
          this.events.onPad(pad);
        }
      }
    }

    const wasAirborne = !this.grounded;
    if (this.root.position.y <= groundY && this.velocity.y <= 0) {
      const impact = -this.velocity.y;
      this.root.position.y = groundY;
      this.velocity.y = 0;
      this.grounded = true;
      if (carrier) {
        this.groundVel.copy(carrier);
        this.root.position.x += carrier.x * dt;
        this.root.position.z += carrier.z * dt;
      }
      if (wasAirborne && impact > 3) {
        this.squashVel = -impact * 0.55;
        this.events.onLand(this.root.position.clone(), impact);
      }
    } else if (this.root.position.y > groundY + 0.08) {
      this.grounded = false;
    }

    /* Fell off the island: respawn gently */
    if (this.root.position.y < -24) {
      this.root.position.set(0, world.heightAt(0, 2) + 0.5, 2);
      this.velocity.set(0, 0, 0);
    }

    /* --- Facing --- */
    const hSpeed = Math.hypot(this.velocity.x - this.groundVel.x, this.velocity.z - this.groundVel.z);
    if (wishLen > 0.1) {
      this.targetYaw = Math.atan2(wish.x, wish.z);
    }
    let dYaw = this.targetYaw - this.root.rotation.y;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    this.root.rotation.y += dYaw * Math.min(1, dt * 12);

    /* --- Animation state --- */
    if (this.grounded) {
      if (hSpeed > 4) this.play('Running');
      else if (hSpeed > 0.8) this.play('Walking');
      else this.play('Idle');
    } else if (this.current !== 'Jump') {
      this.play('Jump', 0.15);
    }

    /* --- Footsteps --- */
    if (this.grounded && hSpeed > 3) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.26;
        this.stepAlt = !this.stepAlt;
        this.events.onFootstep(this.stepAlt);
      }
    } else {
      this.stepTimer = 0;
    }

    /* --- Squash & stretch juice --- */
    const K = 120;
    const D = 12;
    this.squashVel += (1 - this.squash) * K * dt - this.squashVel * D * dt;
    this.squash += this.squashVel * dt * 0.28;
    this.squash = THREE.MathUtils.clamp(this.squash, 0.72, 1.25);
    const inv = 1 / Math.sqrt(this.squash);
    this.model.scale.set(
      this.baseScale * inv,
      this.baseScale * this.squash,
      this.baseScale * inv,
    );

    /* Slight run lean */
    this.model.rotation.x = THREE.MathUtils.lerp(
      this.model.rotation.x,
      this.grounded ? hSpeed * 0.014 : 0,
      Math.min(1, dt * 8),
    );

    this.mixer.update(dt);
  }
}
