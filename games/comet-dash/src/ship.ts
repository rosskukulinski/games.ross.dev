import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Constants } from "@babylonjs/core/Engines/constants";
import { makeFlareTexture } from "./fx";
import { PALETTE, hex } from "./config";

export interface Ship {
  root: TransformNode;
  /** Invisible mesh at the engine nozzle — particle emitter anchor. */
  engineAnchor: Mesh;
  /** All visible meshes (to hide on explosion). */
  meshes: Mesh[];
  /** World-space glow disc projected on the track under the ship. */
  glowPool: Mesh;
  engineLight: PointLight;
  glowLight: PointLight;
}

/**
 * Procedural low-poly hover-ship: hexagonal dart fuselage, swept wings with
 * neon edge strips, twin engine nacelles with glowing exhaust cones.
 */
export function buildShip(scene: Scene): Ship {
  const root = new TransformNode("shipRoot", scene);
  const meshes: Mesh[] = [];

  // NOTE: with no environment texture, high metallic values render washed-out
  // gray under direct lights — keep metallic modest so base colors read.
  const hullMat = new PBRMetallicRoughnessMaterial("hullMat", scene);
  hullMat.baseColor = hex(PALETTE.hull);
  hullMat.metallic = 0.3;
  hullMat.roughness = 0.42;

  const darkMat = new PBRMetallicRoughnessMaterial("darkMat", scene);
  darkMat.baseColor = hex(PALETTE.hullDark);
  darkMat.metallic = 0.45;
  darkMat.roughness = 0.5;

  const neonCyan = new PBRMetallicRoughnessMaterial("neonCyan", scene);
  neonCyan.baseColor = new Color3(0.02, 0.09, 0.1);
  neonCyan.metallic = 0.1;
  neonCyan.roughness = 0.6;
  neonCyan.emissiveColor = hex(PALETTE.cyan);

  const neonMagenta = new PBRMetallicRoughnessMaterial("neonMagenta", scene);
  neonMagenta.baseColor = new Color3(0.1, 0.02, 0.08);
  neonMagenta.metallic = 0.1;
  neonMagenta.roughness = 0.6;
  neonMagenta.emissiveColor = hex(PALETTE.magenta);

  const engineMat = new PBRMetallicRoughnessMaterial("engineMat", scene);
  engineMat.baseColor = new Color3(0.1, 0.04, 0.01);
  engineMat.metallic = 0.0;
  engineMat.roughness = 0.5;
  engineMat.emissiveColor = hex(PALETTE.orange).scale(1.25);

  const canopyMat = new PBRMetallicRoughnessMaterial("canopyMat", scene);
  canopyMat.baseColor = new Color3(0.02, 0.05, 0.1);
  canopyMat.metallic = 0.9;
  canopyMat.roughness = 0.12;
  canopyMat.emissiveColor = new Color3(0.12, 0.5, 0.62);

  const add = (m: Mesh, mat: PBRMetallicRoughnessMaterial, flat = true): Mesh => {
    m.material = mat;
    if (flat) m.convertToFlatShadedMesh();
    m.parent = root;
    meshes.push(m);
    return m;
  };

  // --- fuselage: hexagonal dart, nose pointing +z ---
  const fuselage = CreateCylinder("fuselage", {
    height: 3.4,
    diameterTop: 0.16,
    diameterBottom: 1.15,
    tessellation: 6,
  }, scene);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.scaling.y = 0.55; // flatten (after rotation this squashes vertically)
  fuselage.bakeCurrentTransformIntoVertices();
  fuselage.position.z = 0.35;
  add(fuselage, hullMat);

  // tail block
  const tail = CreateCylinder("tail", {
    height: 0.7,
    diameterTop: 1.15,
    diameterBottom: 0.85,
    tessellation: 6,
  }, scene);
  tail.rotation.x = Math.PI / 2;
  tail.scaling.y = 0.55;
  tail.bakeCurrentTransformIntoVertices();
  tail.position.z = -1.7;
  add(tail, darkMat);

  // --- canopy ---
  const canopy = CreateSphere("canopy", { diameter: 0.6, segments: 6 }, scene);
  canopy.scaling.set(0.72, 0.5, 1.5);
  canopy.bakeCurrentTransformIntoVertices();
  canopy.position.set(0, 0.32, 0.35);
  add(canopy, canopyMat);

  // --- swept wings ---
  for (const side of [-1, 1]) {
    const wing = CreateBox(`wing${side}`, { width: 2.1, height: 0.09, depth: 1.25 }, scene);
    // taper + sweep via simple shear-ish rotation
    wing.rotation.y = side * 0.42;
    wing.bakeCurrentTransformIntoVertices();
    wing.position.set(side * 1.25, -0.05, -0.9);
    add(wing, hullMat);

    // neon wing-edge strip
    const strip = CreateBox(`strip${side}`, { width: 0.14, height: 0.12, depth: 1.05 }, scene);
    strip.rotation.y = side * 0.42;
    strip.bakeCurrentTransformIntoVertices();
    strip.position.set(side * 2.18, -0.05, -1.28);
    add(strip, neonCyan);

    // winglet fin
    const fin = CreateBox(`fin${side}`, { width: 0.08, height: 0.55, depth: 0.7 }, scene);
    fin.position.set(side * 2.14, 0.24, -1.3);
    fin.rotation.z = -side * 0.25;
    add(fin, darkMat);

    // engine nacelle + glowing exhaust cone
    const nacelle = CreateCylinder(`nacelle${side}`, {
      height: 1.15,
      diameter: 0.42,
      tessellation: 8,
    }, scene);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.bakeCurrentTransformIntoVertices();
    nacelle.position.set(side * 0.72, -0.12, -1.35);
    add(nacelle, darkMat);

    const exhaust = CreateCylinder(`exhaust${side}`, {
      height: 0.3,
      diameterTop: 0.34,
      diameterBottom: 0.16,
      tessellation: 8,
    }, scene);
    exhaust.rotation.x = -Math.PI / 2;
    exhaust.bakeCurrentTransformIntoVertices();
    exhaust.position.set(side * 0.72, -0.12, -1.98);
    add(exhaust, engineMat, false);
  }

  // central engine
  const coreExhaust = CreateCylinder("coreExhaust", {
    height: 0.34,
    diameterTop: 0.5,
    diameterBottom: 0.2,
    tessellation: 8,
  }, scene);
  coreExhaust.rotation.x = -Math.PI / 2;
  coreExhaust.bakeCurrentTransformIntoVertices();
  coreExhaust.position.set(0, 0.02, -2.1);
  add(coreExhaust, engineMat, false);

  // dorsal fin with magenta trailing edge
  const dorsal = CreateBox("dorsal", { width: 0.08, height: 0.6, depth: 0.9 }, scene);
  dorsal.position.set(0, 0.5, -1.35);
  dorsal.rotation.x = -0.28;
  add(dorsal, darkMat);

  const dorsalEdge = CreateBox("dorsalEdge", { width: 0.1, height: 0.55, depth: 0.1 }, scene);
  dorsalEdge.position.set(0, 0.52, -1.72);
  dorsalEdge.rotation.x = -0.28;
  add(dorsalEdge, neonMagenta);

  // nose light strip
  const noseStrip = CreateBox("noseStrip", { width: 0.5, height: 0.06, depth: 0.9 }, scene);
  noseStrip.position.set(0, -0.28, 1.2);
  add(noseStrip, neonCyan);

  // glowing spine line along the fuselage top
  const spine = CreateBox("spine", { width: 0.07, height: 0.05, depth: 2.2 }, scene);
  spine.position.set(0, 0.24, -0.55);
  spine.rotation.x = 0.06;
  add(spine, neonCyan);

  // --- invisible engine anchor for the particle trail ---
  const engineAnchor = CreateBox("engineAnchor", { size: 0.05 }, scene);
  engineAnchor.isVisible = false;
  engineAnchor.parent = root;
  engineAnchor.position.set(0, -0.05, -2.1);

  // hover light pool on the track surface (world-space, follows ship x)
  const glowPool = CreatePlane("glowPool", { size: 4.6 }, scene);
  glowPool.rotation.x = Math.PI / 2;
  glowPool.position.set(0, 0.06, -0.3);
  const poolMat = new StandardMaterial("glowPoolMat", scene);
  const poolTex = makeFlareTexture(scene, "60,215,255");
  poolMat.emissiveTexture = poolTex;
  poolMat.opacityTexture = poolTex;
  poolMat.disableLighting = true;
  poolMat.alphaMode = Constants.ALPHA_ADD;
  glowPool.material = poolMat;
  glowPool.isPickable = false;
  meshes.push(glowPool);

  // warm engine glow + cool underglow lights that travel with the ship
  const engineLight = new PointLight("engineLight", new Vector3(0, 0.1, -2.6), scene);
  engineLight.diffuse = hex(PALETTE.orange);
  engineLight.intensity = 11;
  engineLight.range = 14;
  engineLight.parent = root;

  const glowLight = new PointLight("underGlow", new Vector3(0, 1.6, 1.5), scene);
  glowLight.diffuse = hex(PALETTE.cyan);
  glowLight.intensity = 9;
  glowLight.range = 18;
  glowLight.parent = root;

  return { root, engineAnchor, meshes, glowPool, engineLight, glowLight };
}
