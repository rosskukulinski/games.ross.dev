// Side-effect imports required by tree-shaken @babylonjs/core builds.
import '@babylonjs/core/Layers/effectLayerSceneComponent';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
import '@babylonjs/core/Meshes/thinInstanceMesh';

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Theme } from '../shared/tracks.ts';

export const hex = (c: string): Color3 => Color3.FromHexString(c);

export interface Rig {
  engine: Engine;
  scene: Scene;
  camera: UniversalCamera;
  glow: GlowLayer;
  sun: DirectionalLight;
  hemi: HemisphericLight;
  sky: Mesh;
  pipeline: DefaultRenderingPipeline | null;
}

export function createRig(canvas: HTMLCanvasElement): Rig {
  const engine = new Engine(canvas, true, {
    adaptToDeviceRatio: false,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  // Cap the render resolution: tablets have big pixel ratios and small GPUs.
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.6, 0.85, 1, 1);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 140;
  scene.fogEnd = 420;

  const camera = new UniversalCamera('cam', new Vector3(0, 6, -14), scene);
  camera.fov = 0.95;
  camera.minZ = 0.3;
  camera.maxZ = 1400;
  camera.inertia = 0;

  const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.1), scene);
  hemi.intensity = 0.85;
  const sun = new DirectionalLight('sun', new Vector3(-0.45, -1, 0.35), scene);
  sun.intensity = 0.95;

  const glow = new GlowLayer('glow', scene, { mainTextureRatio: 0.5 });
  glow.intensity = 0.7;
  glow.blurKernelSize = 32;

  const sky = CreateSphere('sky', { diameter: 1800, segments: 16, sideOrientation: 1 }, scene);
  sky.infiniteDistance = true;
  sky.applyFog = false;
  sky.isPickable = false;
  const skyMat = new StandardMaterial('skyMat', scene);
  skyMat.disableLighting = true;
  skyMat.backFaceCulling = false;
  skyMat.fogEnabled = false;
  sky.material = skyMat;

  let pipeline: DefaultRenderingPipeline | null = null;
  try {
    pipeline = new DefaultRenderingPipeline('pp', false, scene, [camera]);
    pipeline.fxaaEnabled = true;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.contrast = 1.14;
    pipeline.imageProcessing.exposure = 1.04;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 1.2;
    pipeline.imageProcessing.vignetteColor = new Color4(0.02, 0.0, 0.08, 0);
    pipeline.chromaticAberrationEnabled = true;
    pipeline.chromaticAberration.aberrationAmount = 0;
  } catch {
    // Post-processing is optional — the GlowLayer alone still reads well.
  }

  return { engine, scene, camera, glow, sun, hemi, sky, pipeline };
}

/** Paint a sky (gradient, sun or stars, clouds) onto the sky sphere. */
function makeSkyTexture(scene: Scene, theme: Theme, rand: () => number): DynamicTexture {
  const w = 1024;
  const h = 512;
  // invertY=false so canvas row 0 lands at v=0, which is the sphere's top pole.
  const tex = new DynamicTexture('sky', { width: w, height: h }, scene, false, undefined, undefined, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  // The sphere's equator (v = 0.5) sits at eye level, so keep the deep blue
  // down to about 20 degrees above the horizon or the sky reads as white.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, theme.skyTop);
  grad.addColorStop(0.3, theme.skyTop);
  grad.addColorStop(0.46, theme.skyHorizon);
  grad.addColorStop(0.5, theme.skyBottom);
  grad.addColorStop(0.56, theme.skyBottom);
  grad.addColorStop(1, theme.skyHorizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (theme.night) {
    for (let i = 0; i < 900; i++) {
      const x = rand() * w;
      const y = rand() * h * 0.5;
      void y;
      const r = rand() * 1.4 + 0.3;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + rand() * 0.65})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // moon
    const mx = w * 0.72;
    const my = h * 0.28;
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, 70);
    g.addColorStop(0, 'rgba(255,250,220,1)');
    g.addColorStop(0.28, 'rgba(255,250,220,0.95)');
    g.addColorStop(0.32, 'rgba(255,230,200,0.25)');
    g.addColorStop(1, 'rgba(255,230,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(mx - 80, my - 80, 160, 160);
  } else {
    // sun
    const sx = w * 0.3;
    const sy = h * 0.3;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 120);
    g.addColorStop(0, 'rgba(255,255,235,1)');
    g.addColorStop(0.2, 'rgba(255,250,210,0.95)');
    g.addColorStop(0.28, 'rgba(255,240,180,0.35)');
    g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - 130, sy - 130, 260, 260);

    // puffy clouds along a band above the horizon
    for (let i = 0; i < 26; i++) {
      const cx = rand() * w;
      const cy = h * (0.3 + rand() * 0.14);
      const scale = 0.6 + rand() * 1.1;
      const alpha = 0.55 + rand() * 0.4;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      for (let j = 0; j < 6; j++) {
        const ox = (j - 2.5) * 22 * scale;
        const oy = (rand() - 0.5) * 12 * scale;
        const r = (16 + rand() * 14) * scale;
        ctx.beginPath();
        ctx.ellipse(cx + ox, cy + oy, r * 1.3, r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // flat base
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10 * scale, 70 * scale, 12 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  tex.update(false);
  return tex;
}

export function applyTheme(rig: Rig, theme: Theme, rand: () => number): void {
  const { scene, sky, sun, hemi } = rig;
  const mat = sky.material as StandardMaterial;
  mat.emissiveTexture?.dispose();
  const tex = makeSkyTexture(scene, theme, rand);
  // Babylon ADDS the emissive texture to emissiveColor, so the colour must be
  // black or the whole sky saturates to white.
  mat.emissiveTexture = tex;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.emissiveColor = Color3.Black();

  scene.clearColor = Color4.FromColor3(hex(theme.fog), 1);
  scene.fogColor = hex(theme.fog);
  scene.fogStart = theme.night ? 90 : 150;
  scene.fogEnd = theme.night ? 320 : 460;

  sun.diffuse = hex(theme.sun);
  sun.intensity = theme.night ? 0.8 : 0.95;
  hemi.diffuse = hex(theme.ambientUp);
  hemi.groundColor = hex(theme.ambientDown);
  hemi.intensity = theme.night ? 1.0 : 0.85;
  rig.glow.intensity = theme.night ? 1.0 : 0.65;
}
