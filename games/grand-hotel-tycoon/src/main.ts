// Side-effect imports required by the tree-shaken @babylonjs/core build.
// Without these the corresponding features silently do nothing — no error,
// just missing shadows / glow / particles.
import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Layers/effectLayerSceneComponent";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Particles/webgl2ParticleSystem";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Materials/Textures/Loaders/index";
// pointer input paths call into picking, which needs Ray's side effect
import "@babylonjs/core/Culling/ray";
// every guest, staff member, coin pile and floatie is a mesh instance
import "@babylonjs/core/Meshes/instancedMesh";

import { Engine } from "@babylonjs/core/Engines/engine";
import { Game } from "./game";
import { audio } from "./audio";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;

const engine = new Engine(canvas, true, {
  adaptToDeviceRatio: true,
  antialias: true,
  powerPreference: "high-performance",
  stencil: true,
});

const game = new Game(engine);

// debug/testing hook — a purpose-built facade, not the raw instance
(window as unknown as { __game: unknown }).__game = {
  game,
  engine,
  state: () => game.debugState(),
  start: () => game.start(),
  pause: (p: boolean) => game.setPaused(p),
  /** Teleport the manager, so tests don't have to drive a joystick. */
  goto: (x: number, z: number) => game.debugGoto(x, z),
  give: (n: number) => game.debugGive(n),
  buy: (id: string) => game.debugBuy(id),
  /** Advance the simulation without waiting on frames. */
  sim: (seconds: number) => game.debugSim(seconds),
  layout: () => game.debugLayoutIssues(),
};

let last = performance.now();
const frame = (): void => {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.06);
  last = now;
  game.update(dt);
  game.scene.render();
};

engine.runRenderLoop(frame);

/* ------------------------------------------------------------------------ */
/* graphics resilience                                                        */
/*                                                                            */
/* If the WebGL context dies, the canvas goes transparent and the page's own  */
/* sky-blue background shows through — which is indistinguishable from the    */
/* game rendering correctly, while the DOM HUD carries on updating. That is a */
/* genuinely baffling failure, so it gets detected and surfaced.              */
/* ------------------------------------------------------------------------ */

const gfxError = document.getElementById("gfx-error")!;
const gfxMsg = document.getElementById("gfx-error-msg")!;
let gfxDown = false;

function reportGraphicsDown(reason: string): void {
  if (gfxDown) return;
  gfxDown = true;
  game.persist();
  game.setPaused(true);
  gfxMsg.innerHTML = `${reason}<br>Your hotel is safe. Reload to carry on.`;
  gfxError.classList.remove("hidden");
}

function graphicsRecovered(): void {
  if (!gfxDown) return;
  gfxDown = false;
  gfxError.classList.add("hidden");
  syncCanvasSize();
}

canvas.addEventListener(
  "webglcontextlost",
  (e) => {
    // preventDefault is what allows the browser to hand the context back
    e.preventDefault();
    reportGraphicsDown(
      "Your browser stopped the 3D view — usually because too many tabs were using it at once.",
    );
  },
  false,
);

canvas.addEventListener("webglcontextrestored", () => {
  engine.resize(true);
  graphicsRecovered();
});

document.getElementById("gfx-reload")?.addEventListener("click", () => window.location.reload());

// Belt and braces: the lost-context event can be missed if the GPU process
// dies outright, so poll the context directly too.
window.setInterval(() => {
  if (document.hidden) return;
  const gl = (engine as unknown as { _gl?: WebGLRenderingContext })._gl;
  if (gl?.isContextLost?.()) {
    reportGraphicsDown("The 3D view was shut down by your device's graphics driver.");
  }
}, 2000);

/**
 * Re-sync the backing store to the window. `resize(true)` forces it even when
 * Babylon thinks nothing changed, and the hardware scaling level is recomputed
 * so that dragging the window to a monitor with a different pixel ratio
 * doesn't leave a stale or zero-sized buffer.
 */
function syncCanvasSize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  engine.setHardwareScalingLevel(1 / dpr);
  engine.resize(true);
  game.onResize();
}

window.addEventListener("resize", syncCanvasSize);

document.addEventListener("visibilitychange", () => {
  game.onVisibilityChange(document.hidden);
  if (document.hidden) {
    engine.stopRenderLoop();
  } else {
    // reset the clock or the first frame back gets one enormous dt
    last = performance.now();
    // the window may have been resized, or moved to another monitor, while
    // we were hidden and not listening
    syncCanvasSize();
    engine.runRenderLoop(frame);
  }
});

// last-ditch save if the tab is closed outright
window.addEventListener("pagehide", () => game.persist());
window.addEventListener("beforeunload", () => game.persist());

// any first interaction anywhere unlocks the audio context
const unlockOnce = (): void => {
  audio.unlock();
  window.removeEventListener("pointerdown", unlockOnce);
  window.removeEventListener("keydown", unlockOnce);
};
window.addEventListener("pointerdown", unlockOnce);
window.addEventListener("keydown", unlockOnce);
