import type { Scene } from "@babylonjs/core/scene";
import { Scene as SceneClass } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import {
  PALETTE, hex, SEGMENT_COUNT, SEGMENT_LENGTH, TRACK_WIDTH, FOG_START, FOG_END,
} from "./config";

export interface TrackSegment {
  root: TransformNode;
  pylons: Mesh[];
}

export interface World {
  segments: TrackSegment[];
  skysphere: Mesh;
  materials: {
    track: PBRMetallicRoughnessMaterial;
    rail: PBRMetallicRoughnessMaterial;
    laneLine: PBRMetallicRoughnessMaterial;
    crossBar: PBRMetallicRoughnessMaterial;
    pylonCyan: PBRMetallicRoughnessMaterial;
    pylonMagenta: PBRMetallicRoughnessMaterial;
    dark: PBRMetallicRoughnessMaterial;
  };
}

/** Nebula + starfield painted onto a canvas, wrapped on a giant sky sphere. */
function makeSkyTexture(scene: Scene): DynamicTexture {
  const w = 2048;
  const hgt = 1024;
  const tex = new DynamicTexture("sky", { width: w, height: hgt }, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;

  // deep-space vertical gradient
  const grad = ctx.createLinearGradient(0, 0, 0, hgt);
  grad.addColorStop(0, "#04010d");
  grad.addColorStop(0.42, "#12082e");
  grad.addColorStop(0.58, "#1d0f45");
  grad.addColorStop(0.72, "#12082e");
  grad.addColorStop(1, "#04010d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, hgt);

  // nebula blobs
  const blobs: Array<[number, number, number, string]> = [
    [w * 0.22, hgt * 0.48, 340, "106,48,180"],
    [w * 0.36, hgt * 0.55, 220, "255,63,216"],
    [w * 0.62, hgt * 0.45, 380, "40,90,200"],
    [w * 0.74, hgt * 0.58, 200, "55,242,255"],
    [w * 0.88, hgt * 0.5, 260, "150,60,200"],
    [w * 0.08, hgt * 0.6, 240, "255,120,80"],
  ];
  for (const [x, y, r, rgb] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},0.16)`);
    g.addColorStop(0.55, `rgba(${rgb},0.07)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // stars
  for (let i = 0; i < 1300; i++) {
    const x = Math.random() * w;
    const y = Math.random() * hgt;
    const r = Math.random() * 1.5 + 0.3;
    const a = Math.random() * 0.8 + 0.2;
    const tint = Math.random();
    const color = tint < 0.75 ? "255,255,255" : tint < 0.88 ? "160,220,255" : "255,190,230";
    ctx.fillStyle = `rgba(${color},${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // a few bright stars with cross flares
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * w;
    const y = Math.random() * hgt;
    const r = Math.random() * 8 + 4;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.3, "rgba(200,230,255,0.35)");
    g.addColorStop(1, "rgba(200,230,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  tex.update(false);
  return tex;
}

/** Banded gas-giant texture for the backdrop planet. */
function makePlanetTexture(scene: Scene, bands: string[]): DynamicTexture {
  const size = 512;
  const tex = new DynamicTexture("planet", size, scene, true);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  bands.forEach((c, i) => grad.addColorStop(i / (bands.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // horizontal band noise
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * size;
    const alpha = Math.random() * 0.08;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(0, y, size, Math.random() * 6 + 1);
  }
  tex.update(false);
  return tex;
}

export function buildWorld(scene: Scene): World {
  // --- atmosphere ---
  scene.clearColor = hex(PALETTE.bgClear).toColor4(1);
  scene.fogMode = SceneClass.FOGMODE_LINEAR;
  scene.fogStart = FOG_START;
  scene.fogEnd = FOG_END;
  scene.fogColor = hex(PALETTE.fog);
  scene.ambientColor = new Color3(0.12, 0.1, 0.25);

  // --- lights ---
  const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, -0.3), scene);
  hemi.intensity = 0.38;
  hemi.diffuse = new Color3(0.5, 0.55, 1.0);
  hemi.groundColor = new Color3(0.22, 0.07, 0.32);

  const key = new DirectionalLight("key", new Vector3(-0.45, -0.7, 0.4), scene);
  key.intensity = 1.0;
  key.diffuse = new Color3(0.8, 0.78, 1.0);

  const rim = new DirectionalLight("rim", new Vector3(0.5, -0.25, -0.8), scene);
  rim.intensity = 0.9;
  rim.diffuse = hex(PALETTE.magenta).scale(0.7);

  // --- sky sphere ---
  const skysphere = CreateSphere("sky", { diameter: 900, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const skyMat = new StandardMaterial("skyMat", scene);
  skyMat.emissiveTexture = makeSkyTexture(scene);
  skyMat.diffuseColor = Color3.Black();
  skyMat.specularColor = Color3.Black();
  skyMat.disableLighting = true;
  skyMat.backFaceCulling = false;
  skysphere.material = skyMat;
  skysphere.applyFog = false;
  skysphere.isPickable = false;
  skysphere.infiniteDistance = true;

  // --- backdrop planets (outside the fog) ---
  const planet = CreateSphere("planet", { diameter: 60, segments: 24 }, scene);
  const planetMat = new StandardMaterial("planetMat", scene);
  planetMat.emissiveTexture = makePlanetTexture(scene, ["#6a3fd0", "#b44fd8", "#ff6fb0", "#7a3fb0", "#3a2070"]);
  planetMat.diffuseColor = Color3.Black();
  planetMat.specularColor = Color3.Black();
  planetMat.disableLighting = true;
  planet.material = planetMat;
  planet.position.set(-95, 55, 330);
  planet.rotation.z = 0.35;
  planet.applyFog = false;

  const ring = CreateTorus("planetRing", { diameter: 105, thickness: 12, tessellation: 48 }, scene);
  ring.scaling.y = 0.06;
  const ringMat = new StandardMaterial("ringMat", scene);
  ringMat.emissiveColor = new Color3(0.65, 0.5, 0.9);
  ringMat.diffuseColor = Color3.Black();
  ringMat.specularColor = Color3.Black();
  ringMat.disableLighting = true;
  ringMat.alpha = 0.55;
  ring.material = ringMat;
  ring.position.copyFrom(planet.position);
  ring.rotation.set(0.5, 0, 0.35);
  ring.applyFog = false;

  const moon = CreateSphere("moon", { diameter: 18, segments: 16 }, scene);
  const moonMat = new StandardMaterial("moonMat", scene);
  moonMat.emissiveTexture = makePlanetTexture(scene, ["#1a6a80", "#37f2ff", "#1a4a80", "#0a2a50"]);
  moonMat.diffuseColor = Color3.Black();
  moonMat.specularColor = Color3.Black();
  moonMat.disableLighting = true;
  moon.material = moonMat;
  moon.position.set(70, 38, 300);
  moon.applyFog = false;

  // --- track materials ---
  const track = new PBRMetallicRoughnessMaterial("trackMat", scene);
  track.baseColor = hex(PALETTE.trackBase);
  track.metallic = 0.85;
  track.roughness = 0.38;

  const dark = new PBRMetallicRoughnessMaterial("darkTrimMat", scene);
  dark.baseColor = new Color3(0.03, 0.03, 0.09);
  dark.metallic = 0.9;
  dark.roughness = 0.5;

  const rail = new PBRMetallicRoughnessMaterial("railMat", scene);
  rail.baseColor = new Color3(0.02, 0.08, 0.09);
  rail.metallic = 0.2;
  rail.roughness = 0.5;
  rail.emissiveColor = hex(PALETTE.cyan).scale(0.9);

  const laneLine = new PBRMetallicRoughnessMaterial("laneLineMat", scene);
  laneLine.baseColor = new Color3(0.04, 0.03, 0.1);
  laneLine.metallic = 0.2;
  laneLine.roughness = 0.6;
  laneLine.emissiveColor = hex(PALETTE.violet).scale(0.55);

  const crossBar = new PBRMetallicRoughnessMaterial("crossBarMat", scene);
  crossBar.baseColor = new Color3(0.08, 0.02, 0.07);
  crossBar.metallic = 0.2;
  crossBar.roughness = 0.6;
  crossBar.emissiveColor = hex(PALETTE.magenta).scale(0.55);

  const pylonCyan = new PBRMetallicRoughnessMaterial("pylonCyanMat", scene);
  pylonCyan.baseColor = new Color3(0.02, 0.06, 0.08);
  pylonCyan.metallic = 0.2;
  pylonCyan.roughness = 0.5;
  pylonCyan.emissiveColor = hex(PALETTE.cyan).scale(0.8);

  const pylonMagenta = new PBRMetallicRoughnessMaterial("pylonMagentaMat", scene);
  pylonMagenta.baseColor = new Color3(0.07, 0.02, 0.06);
  pylonMagenta.metallic = 0.2;
  pylonMagenta.roughness = 0.5;
  pylonMagenta.emissiveColor = hex(PALETTE.magenta).scale(0.8);

  // --- track segments (recycled as the world scrolls) ---
  const segments: TrackSegment[] = [];
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    segments.push(buildSegment(scene, i, { track, dark, rail, laneLine, crossBar, pylonCyan, pylonMagenta }));
    segments[i].root.position.z = i * SEGMENT_LENGTH - SEGMENT_LENGTH;
  }

  return {
    segments,
    skysphere,
    materials: { track, rail, laneLine, crossBar, pylonCyan, pylonMagenta, dark },
  };
}

interface SegMats {
  track: PBRMetallicRoughnessMaterial;
  dark: PBRMetallicRoughnessMaterial;
  rail: PBRMetallicRoughnessMaterial;
  laneLine: PBRMetallicRoughnessMaterial;
  crossBar: PBRMetallicRoughnessMaterial;
  pylonCyan: PBRMetallicRoughnessMaterial;
  pylonMagenta: PBRMetallicRoughnessMaterial;
}

function buildSegment(scene: Scene, index: number, mats: SegMats): TrackSegment {
  const root = new TransformNode(`seg${index}`, scene);

  // floor plate
  const plate = CreateBox(`plate${index}`, { width: TRACK_WIDTH, height: 0.6, depth: SEGMENT_LENGTH - 0.15 }, scene);
  plate.position.y = -0.3;
  plate.material = mats.track;
  plate.parent = root;

  // outer curbs
  for (const side of [-1, 1]) {
    const curb = CreateBox(`curb${index}${side}`, { width: 0.8, height: 0.85, depth: SEGMENT_LENGTH - 0.15 }, scene);
    curb.position.set(side * (TRACK_WIDTH / 2 + 0.4), -0.18, 0);
    curb.material = mats.dark;
    curb.parent = root;

    // glowing rail on top of the curb
    const railMesh = CreateBox(`rail${index}${side}`, { width: 0.22, height: 0.22, depth: SEGMENT_LENGTH - 0.15 }, scene);
    railMesh.position.set(side * (TRACK_WIDTH / 2 + 0.4), 0.36, 0);
    railMesh.material = mats.rail;
    railMesh.parent = root;
  }

  // lane divider lines
  for (const x of [-1.5, 1.5]) {
    const line = CreateBox(`line${index}${x}`, { width: 0.1, height: 0.05, depth: SEGMENT_LENGTH - 2 }, scene);
    line.position.set(x, 0.03, 0);
    line.material = mats.laneLine;
    line.parent = root;
  }

  // magenta cross light-bar at the segment seam (sells speed)
  const bar = CreateBox(`bar${index}`, { width: TRACK_WIDTH - 1, height: 0.06, depth: 0.35 }, scene);
  bar.position.set(0, 0.035, -SEGMENT_LENGTH / 2 + 1);
  bar.material = mats.crossBar;
  bar.parent = root;

  // side pylons floating off-track for parallax
  const pylons: Mesh[] = [];
  for (const side of [-1, 1]) {
    const h = 2.5 + ((index * 7 + (side + 1) * 3) % 5);
    const pylon = CreateBox(`pylon${index}${side}`, { width: 0.35, height: h, depth: 0.35 }, scene);
    pylon.position.set(side * (TRACK_WIDTH / 2 + 4.5 + (index % 3)), h / 2 - 1.5, (index % 2) * 9 - 4);
    pylon.material = (index + (side === 1 ? 1 : 0)) % 2 === 0 ? mats.pylonCyan : mats.pylonMagenta;
    pylon.parent = root;
    pylons.push(pylon);
  }

  return { root, pylons };
}
