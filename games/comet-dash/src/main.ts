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
  antialias: true,
  powerPreference: "high-performance",
});

const game = new Game(engine);

// debug/testing hook (used by the automated smoke test and play-tests).
// The Game itself, plus read-only getters: state, score, best, alive, lane,
// runTime, restartReady — see Game.
(window as unknown as { __game: Game }).__game = game;

setupInput({
  onLeft: () => game.handleLeft(),
  onRight: () => game.handleRight(),
  onJump: () => game.handleJump(),
  onTap: (x, y) => game.handleTap(x, y),
  onAny: (source) => game.handleAny(source),
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
