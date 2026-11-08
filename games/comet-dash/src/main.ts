// Side-effect imports required by tree-shaken @babylonjs/core builds
import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Layers/effectLayerSceneComponent";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";

import { Engine } from "@babylonjs/core/Engines/engine";
import { Game } from "./game";
import { setupInput } from "./input";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;

const engine = new Engine(canvas, true, {
  adaptToDeviceRatio: true,
  // iPhones report a 3x pixel ratio; rendering the glow + post pipeline at
  // that resolution is what drags them down to a crawl. 2x looks the same.
  limitDeviceRatio: 2,
  antialias: true,
  powerPreference: "high-performance",
});

const game = new Game(engine);

// debug/testing hook (used by the automated smoke test)
(window as unknown as { __game: Game }).__game = game;

setupInput({
  onLeft: () => game.handleLeft(),
  onRight: () => game.handleRight(),
  onJump: () => game.handleJump(),
  onAny: () => game.handleAny(),
});

engine.runRenderLoop(() => {
  game.scene.render();
});

window.addEventListener("resize", () => engine.resize());

document.addEventListener("visibilitychange", () => {
  game.onVisibilityChange(document.hidden);
  if (document.hidden) {
    engine.stopRenderLoop();
  } else {
    engine.runRenderLoop(() => game.scene.render());
  }
});
