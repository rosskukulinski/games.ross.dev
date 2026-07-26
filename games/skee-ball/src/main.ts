// Side-effect imports required by the tree-shaken @babylonjs/core build
import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Layers/effectLayerSceneComponent";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Materials/Textures/Loaders/index";

import { Engine } from "@babylonjs/core/Engines/engine";
import { Game } from "./game";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;

const engine = new Engine(canvas, true, {
  adaptToDeviceRatio: true,
  antialias: true,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
  stencil: true,
});

const game = new Game(engine);

// debug/testing hook (used by the automated smoke test)
(window as unknown as { __game: Game }).__game = game;

let last = performance.now();
engine.runRenderLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.06);
  last = now;
  game.update(dt);
  game.scene.render();
});

window.addEventListener("resize", () => {
  engine.resize();
  game.onResize();
});

document.addEventListener("visibilitychange", () => {
  game.onVisibilityChange(document.hidden);
  if (document.hidden) {
    engine.stopRenderLoop();
  } else {
    last = performance.now();
    engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.06);
      last = now;
      game.update(dt);
      game.scene.render();
    });
  }
});
