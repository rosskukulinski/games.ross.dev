import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { World } from './world.ts';
import { Player } from './player.ts';
import { Orb } from './orbs.ts';
import { Particles } from './particles.ts';
import { GameAudio } from './audio.ts';
import { Input } from './input.ts';

const ROUND_SECONDS = 90;
const TOTAL_ORBS = 10;
const BEST_KEY = 'robot-rally-best-time';
const SPAWN = new THREE.Vector3(0, 1, 2);

type GameState = 'loading' | 'start' | 'playing' | 'won' | 'timeup';

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */
const $ = (id: string) => document.getElementById(id)!;
const app = $('app');
const hud = $('hud');
const orbCountEl = $('orb-count');
const timerEl = $('timer');
const bestEl = $('best');
const muteBtn = $('mute-btn');
const startScreen = $('start-screen');
const endScreen = $('end-screen');
const endTitle = $('end-title');
const endSub = $('end-sub');
const endStats = $('end-stats');
const playBtn = $('play-btn') as HTMLButtonElement;
const againBtn = $('again-btn') as HTMLButtonElement;
const loadingNote = $('loading-note');
const popups = $('popups');

/* ------------------------------------------------------------------ */
/* Renderer / scene / camera                                           */
/* ------------------------------------------------------------------ */
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Soft neutral reflections for the robot's PBR materials
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.15;
pmrem.dispose();
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  900,
);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.4, // strength (subtle; mostly the emissive orbs)
  0.4, // radius
  1.1, // threshold in HDR space — only emissive things (orbs) bloom
);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const fxaa = new ShaderPass(FXAAShader);
const useFxaa = Math.min(window.devicePixelRatio, 2) < 1.75;
if (useFxaa) composer.addPass(fxaa);

function layout(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  const pr = renderer.getPixelRatio();
  fxaa.material.uniforms['resolution'].value.set(1 / (w * pr), 1 / (h * pr));
}
window.addEventListener('resize', layout);
layout();

/* ------------------------------------------------------------------ */
/* Game objects                                                        */
/* ------------------------------------------------------------------ */
const world = new World(scene);
const particles = new Particles();
scene.add(particles.group);
const audio = new GameAudio();
const input = new Input();
input.onGesture = () => audio.ensure();

const orbs: Orb[] = world.orbSpots.slice(0, TOTAL_ORBS).map((p) => new Orb(p));
for (const orb of orbs) scene.add(orb.group);

let player: Player | null = null;
let state: GameState = 'loading';
let collected = 0;
let timeLeft = ROUND_SECONDS;
let elapsed = 0;
let paused = false;
let startOrbit = 0;

const camPos = new THREE.Vector3(0, 14, 34);
const camLook = new THREE.Vector3(0, 2, 0);
camera.position.copy(camPos);
camera.lookAt(camLook);

/* ------------------------------------------------------------------ */
/* HUD helpers                                                         */
/* ------------------------------------------------------------------ */
function fmtTime(s: number): string {
  return `${Math.ceil(s)}`;
}

function fmtBest(v: number | null): string {
  if (v === null) return 'Best: --';
  return `Best: ${v.toFixed(1)}s`;
}

function loadBest(): number | null {
  const raw = localStorage.getItem(BEST_KEY);
  if (!raw) return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

function updateHud(): void {
  orbCountEl.innerHTML = `${collected}&thinsp;/&thinsp;${TOTAL_ORBS}`;
  timerEl.textContent = fmtTime(timeLeft);
  timerEl.classList.toggle('low', timeLeft <= 15 && state === 'playing');
  bestEl.textContent = fmtBest(loadBest());
}

function scorePopup(worldPos: THREE.Vector3, text: string): void {
  const v = worldPos.clone().project(camera);
  if (v.z > 1) return;
  const el = document.createElement('div');
  el.className = 'popup';
  el.textContent = text;
  el.style.left = `${((v.x + 1) / 2) * window.innerWidth}px`;
  el.style.top = `${((1 - v.y) / 2) * window.innerHeight}px`;
  popups.appendChild(el);
  window.setTimeout(() => el.remove(), 950);
}

/* ------------------------------------------------------------------ */
/* Game flow                                                           */
/* ------------------------------------------------------------------ */
function startRound(): void {
  collected = 0;
  timeLeft = ROUND_SECONDS;
  elapsed = 0;
  for (const orb of orbs) orb.reset();
  if (player) {
    player.frozen = false;
    player.reset(new THREE.Vector3(SPAWN.x, world.heightAt(SPAWN.x, SPAWN.z) + 0.1, SPAWN.z));
  }
  state = 'playing';
  startScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  updateHud();
}

function endRound(won: boolean): void {
  state = won ? 'won' : 'timeup';
  if (player) {
    player.frozen = true;
    player.play(won ? 'Dance' : 'ThumbsUp', 0.3);
  }
  if (won) {
    audio.fanfare();
    particles.fireworks(player ? player.root.position.clone() : new THREE.Vector3());
    const time = elapsed;
    const best = loadBest();
    const isBest = best === null || time < best;
    if (isBest) localStorage.setItem(BEST_KEY, time.toFixed(1));
    endTitle.textContent = 'You Win!';
    endSub.textContent = 'Every orb collected — great flying, robot!';
    endStats.innerHTML =
      `<span>Your time: ${time.toFixed(1)}s</span>` +
      (isBest
        ? `<span class="new-best">NEW BEST TIME!</span>`
        : `<span>Best: ${(best as number).toFixed(1)}s</span>`);
  } else {
    audio.timeUp();
    endTitle.textContent = "Time's Up!";
    endSub.textContent = 'Nice try! Ready for another rally?';
    endStats.innerHTML = `<span>Orbs collected: ${collected} / ${TOTAL_ORBS}</span>`;
  }
  window.setTimeout(() => endScreen.classList.remove('hidden'), won ? 1500 : 600);
  updateHud();
}

function collectOrb(orb: Orb): void {
  orb.collect();
  collected += 1;
  audio.collect(collected);
  particles.orbPop(orb.position.clone());
  scorePopup(orb.position, `+1`);
  orbCountEl.classList.remove('bump');
  void (orbCountEl as HTMLElement).offsetWidth; // restart animation
  orbCountEl.classList.add('bump');
  updateHud();
  if (collected >= TOTAL_ORBS) endRound(true);
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */
playBtn.addEventListener('click', () => {
  audio.ensure();
  if (state === 'start') startRound();
});
againBtn.addEventListener('click', () => {
  audio.ensure();
  startRound();
});
muteBtn.addEventListener('click', () => {
  audio.ensure();
  audio.setMuted(!audio.muted);
  ($('snd-on') as HTMLElement).style.display = audio.muted ? 'none' : 'block';
  ($('snd-off') as HTMLElement).style.display = audio.muted ? 'block' : 'none';
});

document.addEventListener('visibilitychange', () => {
  paused = document.hidden;
});

/* ------------------------------------------------------------------ */
/* Load the robot                                                      */
/* ------------------------------------------------------------------ */
playBtn.disabled = true;
Player.load({
  onJump: () => audio.jump(),
  onLand: (pos, impact) => {
    particles.dust(pos);
    if (impact > 6) audio.land();
  },
  onPad: (pad) => {
    audio.boing();
    particles.dust(pad.center().add(new THREE.Vector3(0, 0.1, 0)));
  },
  onFootstep: (alt) => audio.footstep(alt),
})
  .then((p) => {
    player = p;
    p.reset(new THREE.Vector3(SPAWN.x, world.heightAt(SPAWN.x, SPAWN.z) + 0.1, SPAWN.z));
    p.frozen = true;
    scene.add(p.root);
    p.gesture('Wave');
    state = 'start';
    playBtn.disabled = false;
    loadingNote.textContent = 'ready!';
  })
  .catch((err) => {
    loadingNote.textContent = 'Could not load the robot — please refresh.';
    console.error(err);
  });

updateHud();

/* ------------------------------------------------------------------ */
/* Main loop                                                           */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let t = 0;

/* Tiny debug handle for smoke tests */
Object.defineProperty(window, '__rr', {
  value: {
    get state() { return state; },
    get timeLeft() { return timeLeft; },
    get collected() { return collected; },
    get playerPos() { return player ? player.root.position.toArray() : null; },
  },
});

function tick(): void {
  requestAnimationFrame(tick);
  const rawDt = clock.getDelta();
  if (paused) return;
  const dt = Math.min(rawDt, 0.05);
  t += dt;

  world.update(t, dt);
  particles.update(dt);
  for (const orb of orbs) orb.update(t, dt);

  if (player) {
    const move = state === 'playing' ? input.move() : { x: 0, y: 0 };
    const jump = state === 'playing' ? input.consumeJump() : (input.consumeJump(), false);
    // camera-relative: forward = away from camera toward player
    const camForwardYaw = Math.atan2(
      player.root.position.x - camera.position.x,
      player.root.position.z - camera.position.z,
    );
    player.update(dt, move, jump, camForwardYaw, world);

    if (state === 'playing') {
      timeLeft -= dt;
      elapsed += dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        endRound(false);
      }
      timerEl.textContent = fmtTime(timeLeft);
      timerEl.classList.toggle('low', timeLeft <= 15);

      // Orb pickup
      for (const orb of orbs) {
        if (!orb.collected && orb.position.distanceTo(player.root.position.clone().setY(orb.position.y)) < 1.35) {
          const dy = Math.abs(orb.position.y - (player.root.position.y + 0.9));
          if (dy < 1.6) collectOrb(orb);
        }
      }
    }

    /* Camera */
    if (state === 'start') {
      startOrbit += dt * 0.08;
      const r = 30;
      camPos.set(Math.sin(startOrbit) * r, 12, Math.cos(startOrbit) * r);
      camLook.lerp(new THREE.Vector3(0, 1.5, 0), Math.min(1, dt * 3));
      camera.position.lerp(camPos, Math.min(1, dt * 1.5));
      camera.lookAt(camLook);
    } else {
      const target = player.root.position;
      const desired = new THREE.Vector3(target.x, target.y + 4.1, target.z + 7.6);
      camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
      camLook.lerp(
        new THREE.Vector3(target.x, target.y + 1.5, target.z),
        1 - Math.exp(-dt * 6),
      );
      camera.lookAt(camLook);
    }

    /* Keep the sun shadow frustum roughly over the action */
    world.sun.target.position.set(0, 0, 0);
  }

  composer.render();
}

tick();
