/**
 * Build pads — the game's entire shop.
 *
 * Instead of a menu, everything buyable sits in the world as a glowing pad
 * with a floating price plaque and a ghost of what will appear there. Walk
 * onto it and your banked coins pour in until the thing builds itself.
 * Progress is remembered, so a five-year-old can pay for half a swimming pool,
 * wander off, and come back to finish it.
 */
import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

import { BUILDS, type BuildDef } from "./content";
import { makePadDiscTexture } from "./textures";
import { PALETTE as P, hex, lotById } from "./config";

/** How close the manager has to be for a pad to start taking money. */
export const PAD_R = 2.1;
/**
 * How long you must stand on a pad before it starts taking money.
 *
 * Long enough that crossing a pad on your way somewhere never costs a coin —
 * you have to deliberately stop and wait.
 */
const PAD_DWELL = 0.9;
/** Below this fraction of top speed counts as "standing still". */
const DWELL_SPEED = 0.3;
/** Above this you are clearly walking through, and the dwell timer resets. */
const MOVING_SPEED = 0.55;
/** Slowest a purchase can drain, in coins per second. */
const MIN_DRAIN = 45;
/** A full-price purchase takes about this long if you can afford it outright. */
const DRAIN_SECONDS = 2.2;

interface Pad {
  def: BuildDef;
  root: TransformNode;
  disc: Mesh;
  discMat: StandardMaterial;
  plaque: Mesh;
  plaqueTex: DynamicTexture;
  plaqueMat: StandardMaterial;
  ghost: Mesh | null;
  x: number;
  z: number;
  dwell: number;
  /** Set once the dwell is satisfied; cleared on leaving the pad. */
  armed: boolean;
  lastDrawnPaid: number;
}

export class PadManager {
  private scene: Scene;
  private noGlow: (m: Mesh) => void;
  private pads = new Map<string, Pad>();
  private t = 0;
  /** The pad currently taking money, so the HUD can show what's happening. */
  active: Pad | null = null;
  /** Shared across every pad — the disc face never varies. */
  private static discTex: DynamicTexture | null = null;

  constructor(scene: Scene, noGlow: (m: Mesh) => void) {
    this.scene = scene;
    this.noGlow = noGlow;
  }

  /** Where a build's pad lives — the lot centre, or an explicit position. */
  static padPos(def: BuildDef): { x: number; z: number } {
    if (def.pad) return def.pad;
    const lot = lotById(def.lot!);
    return { x: lot.x, z: lot.z };
  }

  /**
   * Create pads for everything now unlocked, and remove pads for anything
   * that has been built. Cheap enough to call whenever the built set changes.
   */
  refresh(built: Set<string>, payProgress: Record<string, number>): void {
    for (const def of BUILDS) {
      const unlocked = def.requires.every((r) => built.has(r));
      const shouldExist = unlocked && !built.has(def.id);
      const existing = this.pads.get(def.id);

      if (shouldExist && !existing) {
        this.pads.set(def.id, this.createPad(def, payProgress[def.id] ?? 0));
      } else if (!shouldExist && existing) {
        existing.root.dispose(false, true);
        this.pads.delete(def.id);
        if (this.active === existing) this.active = null;
      }
    }
  }

  private createPad(def: BuildDef, paid: number): Pad {
    const { x, z } = PadManager.padPos(def);
    const root = new TransformNode(`pad_${def.id}`, this.scene);

    // ------------------------------------------------------- glowing disc
    // The disc must sit clearly proud of the rim; at equal top heights the two
    // z-fought and the larger white rim won, flattening the pad to a blank
    // white ellipse.
    const disc = CreateCylinder(`padDisc_${def.id}`, { diameter: PAD_R * 2, height: 0.1, tessellation: 30 }, this.scene);
    disc.position.set(x, 0.09, z);
    disc.isPickable = false;
    disc.parent = root;
    const discMat = new StandardMaterial(`padDiscMat_${def.id}`, this.scene);
    discMat.diffuseColor = hex("#ffffff");
    if (!PadManager.discTex) PadManager.discTex = makePadDiscTexture(this.scene);
    discMat.diffuseTexture = PadManager.discTex;
    // kept deliberately dim: this is the only mesh here the glow layer sees,
    // and at the old emissive level it bloomed into a featureless white blob
    discMat.emissiveColor = hex("#12545f");
    discMat.specularColor = Color3.Black();
    discMat.alpha = 0.9;
    disc.material = discMat;

    // a raised rim so the pad reads as a thing to stand on, not a decal
    const rim = CreateCylinder(`padRim_${def.id}`, { diameter: PAD_R * 2 + 0.55, height: 0.08, tessellation: 30 }, this.scene);
    rim.position.set(x, 0.025, z);
    rim.isPickable = false;
    rim.parent = root;
    const rimMat = new StandardMaterial(`padRimMat_${def.id}`, this.scene);
    rimMat.diffuseColor = hex("#fffbf3");
    rimMat.specularColor = Color3.Black();
    rim.material = rimMat;
    this.noGlow(rim);

    // ---------------------------------------------------------- ghost body
    let ghost: Mesh | null = null;
    if (def.lot) {
      const size = ghostSize(def);
      ghost = CreateBox(`padGhost_${def.id}`, size, this.scene);
      ghost.position.set(x, size.height / 2 + 0.1, z);
      ghost.isPickable = false;
      ghost.parent = root;
      const gm = new StandardMaterial(`padGhostMat_${def.id}`, this.scene);
      gm.diffuseColor = hex("#dcfaff");
      gm.emissiveColor = hex("#2f7f92");
      gm.specularColor = Color3.Black();
      // Opacity is driven entirely by mesh.visibility below. Setting a low
      // material alpha as well multiplied the two and made the ghost vanish.
      gm.alpha = 1;
      gm.backFaceCulling = false;
      ghost.material = gm;
      this.noGlow(ghost);
    }

    // -------------------------------------------------------- price plaque
    const plaque = CreatePlane(`padSign_${def.id}`, { width: 2.5, height: 2.5 }, this.scene);
    plaque.position.set(x, (ghost ? ghostSize(def).height : 0) + 3.1, z);
    plaque.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plaque.isPickable = false;
    plaque.parent = root;

    const plaqueTex = new DynamicTexture(`padSignTex_${def.id}`, { width: 256, height: 256 }, this.scene, true);
    plaqueTex.hasAlpha = true;
    const plaqueMat = new StandardMaterial(`padSignMat_${def.id}`, this.scene);
    plaqueMat.diffuseTexture = plaqueTex;
    plaqueMat.useAlphaFromDiffuseTexture = true;
    plaqueMat.disableLighting = true;
    plaqueMat.emissiveColor = Color3.White();
    plaque.material = plaqueMat;
    this.noGlow(plaque);

    const pad: Pad = {
      def,
      root,
      disc,
      discMat,
      plaque,
      plaqueTex,
      plaqueMat,
      ghost,
      x,
      z,
      dwell: 0,
      armed: false,
      lastDrawnPaid: -1,
    };
    drawPlaque(pad, paid);
    return pad;
  }

  /** Nearest pad the player could still buy, for the guide arrow and hints. */
  nearest(px: number, pz: number): { def: BuildDef; x: number; z: number; dist: number } | null {
    let best: { def: BuildDef; x: number; z: number; dist: number } | null = null;
    for (const pad of this.pads.values()) {
      const d = Math.hypot(pad.x - px, pad.z - pz);
      if (!best || d < best.dist) best = { def: pad.def, x: pad.x, z: pad.z, dist: d };
    }
    return best;
  }

  has(id: string): boolean {
    return this.pads.has(id);
  }

  get count(): number {
    return this.pads.size;
  }

  /**
   * Drain coins from whichever pad the manager is standing on.
   *
   * `spend` should remove coins from the bank and return how much it actually
   * managed to take, so a pad can never overdraw. Returns the id of anything
   * that finished building this frame.
   */
  update(
    dt: number,
    px: number,
    pz: number,
    /** Manager speed as a fraction of top speed. */
    pSpeed01: number,
    payProgress: Record<string, number>,
    spend: (amount: number) => number,
    onDrain: (pad: { x: number; z: number }, progress: number) => void,
  ): string | null {
    this.t += dt;
    let completed: string | null = null;
    this.active = null;

    for (const pad of this.pads.values()) {
      const paid = payProgress[pad.def.id] ?? 0;
      const near = Math.hypot(pad.x - px, pad.z - pz) <= PAD_R;

      if (!near) {
        pad.dwell = 0;
        pad.armed = false;
      } else if (!pad.armed) {
        // Only count time spent standing still. Strolling across a pad used to
        // start draining immediately, which felt like being pickpocketed.
        if (pSpeed01 < DWELL_SPEED) pad.dwell += dt;
        else if (pSpeed01 > MOVING_SPEED) pad.dwell = 0;
        if (pad.dwell >= PAD_DWELL) pad.armed = true;
      }

      // ---------------------------------------------------------- draining
      if (near && pad.armed && paid < pad.def.cost && !completed) {
        const rate = Math.max(MIN_DRAIN, pad.def.cost / DRAIN_SECONDS);
        const want = Math.min(rate * dt, pad.def.cost - paid);
        const got = spend(want);
        if (got > 0) {
          const now = paid + got;
          payProgress[pad.def.id] = now;
          this.active = pad;
          onDrain(pad, now / pad.def.cost);
          if (now >= pad.def.cost - 0.001) {
            completed = pad.def.id;
            delete payProgress[pad.def.id];
          }
        }
      }

      // ------------------------------------------------------- presentation
      const progress = Math.min(1, (payProgress[pad.def.id] ?? 0) / pad.def.cost);
      if (Math.abs(progress - pad.lastDrawnPaid) > 0.015) {
        drawPlaque(pad, payProgress[pad.def.id] ?? 0);
      }

      // The disc winds up while you dwell, so the wait reads as the pad
      // charging rather than as nothing happening.
      const wind = pad.armed ? 1 : Math.min(1, pad.dwell / PAD_DWELL);
      const pulse = 0.5 + Math.sin(this.t * (3.4 + wind * 9) + pad.x * 0.4) * 0.5;
      const lift = near ? 1 : 0;
      pad.discMat.emissiveColor = hex(near ? P.padReady : P.padGlow).scale(
        0.3 + pulse * 0.16 + lift * 0.2 + wind * 0.25,
      );
      pad.disc.scaling.setAll(1 + pulse * 0.03 + lift * 0.06 + wind * 0.05);
      pad.plaque.position.y =
        (pad.ghost ? ghostSize(pad.def).height : 0) + 3.1 + Math.sin(this.t * 2 + pad.x) * 0.13;
      const ps = (near ? 1.14 : 1) + Math.sin(this.t * 2.6 + pad.z) * 0.03;
      pad.plaque.scaling.setAll(ps);

      if (pad.ghost) {
        pad.ghost.visibility = 0.3 + progress * 0.4 + pulse * 0.06;
        pad.ghost.scaling.y = 0.35 + progress * 0.65;
        pad.ghost.position.y = (ghostSize(pad.def).height * pad.ghost.scaling.y) / 2 + 0.1;
      }
    }

    return completed;
  }

  dispose(id: string): void {
    const p = this.pads.get(id);
    if (!p) return;
    p.root.dispose(false, true);
    this.pads.delete(id);
    if (this.active === p) this.active = null;
  }
}

/* ------------------------------------------------------------------------- */

function ghostSize(def: BuildDef): { width: number; height: number; depth: number } {
  if (def.kind === "room") return { width: 5.6, height: 4.4, depth: 4.5 };
  switch (def.id) {
    case "pool":
      return { width: 14, height: 1.2, depth: 9 };
    case "restaurant":
      return { width: 9, height: 5.2, depth: 6 };
    case "gym":
      return { width: 8.5, height: 5, depth: 5.5 };
    case "spa":
      return { width: 7, height: 4.6, depth: 5 };
    default:
      return { width: 6, height: 4.2, depth: 4.5 };
  }
}

/** Colour-code the plaque by what sort of thing it is. */
function kindColor(def: BuildDef): string {
  switch (def.kind) {
    case "room":
      return P.roof;
    case "amenity":
      return P.water;
    case "staff":
      return "#7a6ce0";
    case "decor":
      return "#e05fa8";
    case "plot":
      return "#5fae50";
    default:
      return P.coinDark;
  }
}

/**
 * Paint a pad's floating sign: a pictogram for what it is, the price, and a
 * progress bar that fills as you pay. Deliberately wordless.
 */
function drawPlaque(pad: Pad, paid: number): void {
  const def = pad.def;
  const S = 256;
  const c = pad.plaqueTex.getContext() as unknown as CanvasRenderingContext2D;
  const progress = Math.min(1, paid / def.cost);
  pad.lastDrawnPaid = progress;
  c.clearRect(0, 0, S, S);

  const accent = kindColor(def);

  // ---- rounded plaque with a drop shadow and a little tail
  rr(c, 20, 22, S - 40, S - 76, 28);
  c.fillStyle = "rgba(23,56,74,0.3)";
  c.fill();
  rr(c, 16, 14, S - 40, S - 76, 28);
  c.fillStyle = "#fffbf3";
  c.fill();
  c.strokeStyle = accent;
  c.lineWidth = 10;
  c.stroke();
  c.beginPath();
  c.moveTo(S / 2 - 16, S - 62);
  c.lineTo(S / 2, S - 30);
  c.lineTo(S / 2 + 16, S - 62);
  c.closePath();
  c.fillStyle = "#fffbf3";
  c.fill();

  // ---- pictogram
  c.save();
  c.translate(S / 2, 82);
  c.fillStyle = accent;
  c.strokeStyle = accent;
  c.lineWidth = 11;
  c.lineCap = "round";
  c.lineJoin = "round";
  drawGlyph(c, def);
  c.restore();

  // ---- price row: coin + number
  const priceText = String(def.cost);
  c.font = "bold 46px ui-rounded, system-ui, -apple-system, sans-serif";
  c.textAlign = "left";
  c.textBaseline = "middle";
  const tw = c.measureText(priceText).width;
  const total = tw + 42;
  const startX = S / 2 - total / 2;

  c.beginPath();
  c.arc(startX + 15, 150, 15, 0, Math.PI * 2);
  c.fillStyle = P.coin;
  c.fill();
  c.strokeStyle = P.coinDark;
  c.lineWidth = 4;
  c.stroke();

  c.fillStyle = P.ink;
  c.fillText(priceText, startX + 42, 152);

  // ---- payment progress
  const barY = 180;
  rr(c, 40, barY, S - 80, 20, 10);
  c.fillStyle = "rgba(23,56,74,0.16)";
  c.fill();
  if (progress > 0.002) {
    rr(c, 40, barY, Math.max(20, (S - 80) * progress), 20, 10);
    c.fillStyle = P.padReady;
    c.fill();
  }

  pad.plaqueTex.update();
}

/** Simple vector pictograms — no font dependency, readable at any size. */
function drawGlyph(c: CanvasRenderingContext2D, def: BuildDef): void {
  if (def.glyph === "icecream") {
    // cone
    c.beginPath();
    c.moveTo(-22, 6);
    c.lineTo(22, 6);
    c.lineTo(0, 56);
    c.closePath();
    c.fill();
    // waffle criss-cross
    c.save();
    c.beginPath();
    c.moveTo(-22, 6);
    c.lineTo(22, 6);
    c.lineTo(0, 56);
    c.closePath();
    c.clip();
    c.strokeStyle = "#fffbf3";
    c.lineWidth = 4;
    for (let i = -3; i <= 3; i++) {
      c.beginPath();
      c.moveTo(-30 + i * 12, -10);
      c.lineTo(20 + i * 12, 60);
      c.moveTo(30 + i * 12, -10);
      c.lineTo(-20 + i * 12, 60);
      c.stroke();
    }
    c.restore();
    // three scoops
    c.fillStyle = "#ff9ec4";
    c.beginPath();
    c.arc(-11, -6, 17, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#a8e6b0";
    c.beginPath();
    c.arc(12, -8, 17, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fff3c4";
    c.beginPath();
    c.arc(0, -28, 18, 0, Math.PI * 2);
    c.fill();
    // cherry
    c.fillStyle = "#e83a5a";
    c.beginPath();
    c.arc(0, -50, 8, 0, Math.PI * 2);
    c.fill();
    return;
  }
  switch (def.kind) {
    case "room": {
      // bed
      c.fillRect(-46, 6, 92, 20);
      c.fillRect(-52, 22, 12, 22);
      c.fillRect(40, 22, 12, 22);
      c.fillRect(-46, -14, 26, 22); // headboard
      c.beginPath();
      c.moveTo(-20, 6);
      c.lineTo(46, 6);
      c.lineTo(46, -6);
      c.quadraticCurveTo(13, -22, -20, -6);
      c.closePath();
      c.fill();
      break;
    }
    case "staff": {
      // person with a cap
      c.beginPath();
      c.arc(0, -18, 20, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(-34, 46);
      c.quadraticCurveTo(-34, 6, 0, 6);
      c.quadraticCurveTo(34, 6, 34, 46);
      c.closePath();
      c.fill();
      c.fillRect(-28, -40, 56, 10);
      break;
    }
    case "plot": {
      // fence posts + a rightwards arrow
      for (const x of [-44, -20]) {
        c.fillRect(x, -20, 10, 60);
      }
      c.fillRect(-52, -6, 42, 9);
      c.beginPath();
      c.moveTo(4, 12);
      c.lineTo(40, 12);
      c.stroke();
      c.beginPath();
      c.moveTo(26, -4);
      c.lineTo(44, 12);
      c.lineTo(26, 28);
      c.stroke();
      break;
    }
    case "perk": {
      // star
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? 44 : 19;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r + 8;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.closePath();
      c.fill();
      break;
    }
    case "decor": {
      // flower
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        c.beginPath();
        c.ellipse(Math.cos(a) * 24, Math.sin(a) * 24 + 6, 16, 11, a, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = P.coin;
      c.beginPath();
      c.arc(0, 6, 13, 0, Math.PI * 2);
      c.fill();
      break;
    }
    default: {
      // amenity — water droplet with a ripple
      if (def.id === "pool" || def.id === "slide" || def.id === "spa") {
        c.beginPath();
        c.moveTo(0, -42);
        c.quadraticCurveTo(34, -2, 22, 20);
        c.quadraticCurveTo(0, 44, -22, 20);
        c.quadraticCurveTo(-34, -2, 0, -42);
        c.fill();
      } else if (def.id === "restaurant") {
        c.lineWidth = 10;
        c.beginPath();
        c.moveTo(-26, -34);
        c.lineTo(-26, 44);
        c.moveTo(-42, -34);
        c.lineTo(-42, -4);
        c.moveTo(-10, -34);
        c.lineTo(-10, -4);
        c.moveTo(-42, -4);
        c.lineTo(-10, -4);
        c.stroke();
        c.beginPath();
        c.moveTo(30, 44);
        c.lineTo(30, -6);
        c.stroke();
        c.beginPath();
        c.moveTo(30, -6);
        c.quadraticCurveTo(52, -22, 30, -38);
        c.fill();
        break;
      } else {
        // generic building
        c.fillRect(-40, -4, 80, 46);
        c.beginPath();
        c.moveTo(-50, -4);
        c.lineTo(0, -40);
        c.lineTo(50, -4);
        c.closePath();
        c.fill();
      }
      break;
    }
  }
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}
