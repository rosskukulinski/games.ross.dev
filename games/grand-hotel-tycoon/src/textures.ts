/**
 * Every texture in the game is painted here with a 2D canvas and handed to
 * Babylon as a DynamicTexture. No image files, no network requests.
 */
import type { Scene } from "@babylonjs/core/scene";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PALETTE as P } from "./config";

function make(scene: Scene, name: string, size: number): { t: DynamicTexture; c: CanvasRenderingContext2D } {
  const t = new DynamicTexture(name, { width: size, height: size }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;
  return { t, c };
}

/** Deterministic value noise so builds look identical run to run. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --------------------------------------------------------------------- sky */

/** Vertical gradient with a few soft clouds, mapped onto a sky dome. */
export function makeSkyTexture(scene: Scene): DynamicTexture {
  const w = 1024;
  const h = 512;
  const t = new DynamicTexture("skyTex", { width: w, height: h }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;

  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, P.skyTop);
  g.addColorStop(0.52, P.skyMid);
  g.addColorStop(0.88, P.skyLow);
  g.addColorStop(1, "#fdf6e4");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);

  // sun bloom near the horizon
  const sun = c.createRadialGradient(w * 0.74, h * 0.66, 0, w * 0.74, h * 0.66, h * 0.5);
  sun.addColorStop(0, "rgba(255,248,214,0.85)");
  sun.addColorStop(0.35, "rgba(255,236,180,0.28)");
  sun.addColorStop(1, "rgba(255,236,180,0)");
  c.fillStyle = sun;
  c.fillRect(0, 0, w, h);

  // puffy clouds: overlapping soft circles
  const rnd = mulberry(7);
  for (let i = 0; i < 16; i++) {
    const cx = rnd() * w;
    const cy = h * (0.18 + rnd() * 0.42);
    const scale = 22 + rnd() * 46;
    const alpha = 0.3 + rnd() * 0.45;
    for (let b = 0; b < 7; b++) {
      const bx = cx + (rnd() - 0.5) * scale * 3.2;
      const by = cy + (rnd() - 0.5) * scale * 0.7;
      const br = scale * (0.5 + rnd() * 0.7);
      const cg = c.createRadialGradient(bx, by - br * 0.2, 0, bx, by, br);
      cg.addColorStop(0, `rgba(255,255,255,${alpha})`);
      cg.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.5})`);
      cg.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = cg;
      c.beginPath();
      c.arc(bx, by, br, 0, Math.PI * 2);
      c.fill();
    }
  }

  t.update();
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  t.wrapV = Texture.CLAMP_ADDRESSMODE;
  return t;
}

/* ------------------------------------------------------------------ ground */

/** Tileable lawn: base green, mown stripes, scattered blades and clover. */
export function makeGrassTexture(scene: Scene): DynamicTexture {
  const size = 512;
  const { t, c } = make(scene, "grassTex", size);

  c.fillStyle = P.grass;
  c.fillRect(0, 0, size, size);

  // mown stripes
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) continue;
    c.fillStyle = "rgba(255,255,255,0.05)";
    c.fillRect(0, (i * size) / 8, size, size / 8);
  }

  const rnd = mulberry(21);
  // blades
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = 3 + rnd() * 6;
    c.strokeStyle = rnd() < 0.5 ? "rgba(79,154,69,0.55)" : "rgba(140,209,120,0.5)";
    c.lineWidth = 1 + rnd();
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (rnd() - 0.5) * 3, y - len);
    c.stroke();
  }
  // clover / flower dots
  for (let i = 0; i < 90; i++) {
    c.fillStyle = rnd() < 0.6 ? "rgba(255,255,255,0.5)" : "rgba(255,222,120,0.55)";
    c.beginPath();
    c.arc(rnd() * size, rnd() * size, 1.4 + rnd() * 1.6, 0, Math.PI * 2);
    c.fill();
  }

  t.update();
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/** Tileable paving: warm sandstone slabs with grouting and speckle. */
export function makePathTexture(scene: Scene): DynamicTexture {
  const size = 512;
  const { t, c } = make(scene, "pathTex", size);
  const cell = size / 4;

  c.fillStyle = P.pathEdge;
  c.fillRect(0, 0, size, size);

  const rnd = mulberry(5);
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 === 0 ? 0 : cell / 2;
    for (let col = -1; col < 5; col++) {
      const x = col * cell + offset + 3;
      const y = row * cell + 3;
      const w = cell - 6;
      const h = cell - 6;
      const shade = 0.9 + rnd() * 0.2;
      c.fillStyle = shadeHex(P.path, shade);
      roundRect(c, x, y, w, h, 5);
      c.fill();
      // top-edge highlight
      c.fillStyle = "rgba(255,255,255,0.22)";
      roundRect(c, x, y, w, 4, 3);
      c.fill();
    }
  }
  // speckle
  for (let i = 0; i < 1400; i++) {
    c.fillStyle = rnd() < 0.5 ? "rgba(160,130,90,0.14)" : "rgba(255,255,255,0.14)";
    c.fillRect(rnd() * size, rnd() * size, 1.5, 1.5);
  }

  t.update();
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/** Sand for the pool surround. */
export function makeSandTexture(scene: Scene): DynamicTexture {
  const size = 256;
  const { t, c } = make(scene, "sandTex", size);
  c.fillStyle = P.sand;
  c.fillRect(0, 0, size, size);
  const rnd = mulberry(99);
  for (let i = 0; i < 3000; i++) {
    const v = rnd();
    c.fillStyle = v < 0.5 ? "rgba(214,188,140,0.4)" : "rgba(255,250,232,0.45)";
    c.fillRect(rnd() * size, rnd() * size, 1.6, 1.6);
  }
  t.update();
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/* ----------------------------------------------------------------- building */

/** Stucco wall with a subtle trowel texture. */
export function makeWallTexture(scene: Scene): DynamicTexture {
  const size = 256;
  const { t, c } = make(scene, "wallTex", size);
  c.fillStyle = P.wall;
  c.fillRect(0, 0, size, size);
  const rnd = mulberry(33);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    c.strokeStyle = rnd() < 0.5 ? "rgba(226,205,175,0.35)" : "rgba(255,255,255,0.4)";
    c.lineWidth = 1 + rnd() * 2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 6);
    c.stroke();
  }
  t.update();
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/** Terracotta barrel-tile roof, tiling along U. */
export function makeRoofTexture(scene: Scene): DynamicTexture {
  const size = 256;
  const { t, c } = make(scene, "roofTex", size);
  c.fillStyle = P.roofDark;
  c.fillRect(0, 0, size, size);

  const cols = 8;
  const w = size / cols;
  for (let i = 0; i < cols; i++) {
    const x = i * w;
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, P.roofDark);
    g.addColorStop(0.35, P.roof);
    g.addColorStop(0.6, "#f2a07c");
    g.addColorStop(1, P.roofDark);
    c.fillStyle = g;
    c.fillRect(x + 1, 0, w - 2, size);
  }
  // horizontal tile courses
  for (let y = 0; y < size; y += size / 6) {
    c.fillStyle = "rgba(120,50,30,0.28)";
    c.fillRect(0, y, size, 3);
    c.fillStyle = "rgba(255,220,190,0.16)";
    c.fillRect(0, y + 3, size, 2);
  }
  t.update();
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/**
 * A whole guest-room facade in one texture: door, two windows, a number plate
 * and a little awning. Saves a dozen meshes per room.
 */
export function makeFacadeTexture(scene: Scene, roomNumber: number): DynamicTexture {
  const w = 512;
  const h = 256;
  const t = new DynamicTexture(`facade${roomNumber}`, { width: w, height: h }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;

  // stucco base
  c.fillStyle = P.wall;
  c.fillRect(0, 0, w, h);
  const rnd = mulberry(roomNumber * 977 + 3);
  for (let i = 0; i < 700; i++) {
    c.strokeStyle = rnd() < 0.5 ? "rgba(226,205,175,0.3)" : "rgba(255,255,255,0.35)";
    c.lineWidth = 1 + rnd() * 2;
    const x = rnd() * w;
    const y = rnd() * h;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (rnd() - 0.5) * 12, y + (rnd() - 0.5) * 5);
    c.stroke();
  }

  // baseboard shadow
  const bs = c.createLinearGradient(0, h - 40, 0, h);
  bs.addColorStop(0, "rgba(150,120,90,0)");
  bs.addColorStop(1, "rgba(150,120,90,0.3)");
  c.fillStyle = bs;
  c.fillRect(0, h - 40, w, 40);

  // ---- door
  const dw = 92;
  const dx = w / 2 - dw / 2;
  const dy = 76;
  const dh = h - dy - 12;
  c.fillStyle = "rgba(90,70,50,0.28)";
  roundRect(c, dx - 5, dy - 5, dw + 10, dh + 6, 8);
  c.fill();
  const dg = c.createLinearGradient(dx, dy, dx + dw, dy);
  dg.addColorStop(0, "#4a7a92");
  dg.addColorStop(0.4, P.door);
  dg.addColorStop(1, "#3f6b81");
  c.fillStyle = dg;
  roundRect(c, dx, dy, dw, dh, 6);
  c.fill();
  // door panels
  c.strokeStyle = "rgba(255,255,255,0.22)";
  c.lineWidth = 3;
  roundRect(c, dx + 12, dy + 14, dw - 24, dh * 0.4, 4);
  c.stroke();
  roundRect(c, dx + 12, dy + dh * 0.5, dw - 24, dh * 0.36, 4);
  c.stroke();
  // handle
  c.fillStyle = P.coin;
  c.beginPath();
  c.arc(dx + dw - 17, dy + dh * 0.55, 5.5, 0, Math.PI * 2);
  c.fill();

  // ---- number plate above the door
  c.fillStyle = "#fffaf0";
  roundRect(c, w / 2 - 34, 22, 68, 42, 9);
  c.fill();
  c.strokeStyle = P.roof;
  c.lineWidth = 4;
  roundRect(c, w / 2 - 34, 22, 68, 42, 9);
  c.stroke();
  c.fillStyle = P.ink;
  c.font = "bold 32px ui-rounded, system-ui, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(String(roomNumber), w / 2, 45);

  // ---- windows
  for (const wx of [w * 0.16, w * 0.84]) {
    const ww = 108;
    const wh = 96;
    const wy = 84;
    c.fillStyle = "rgba(90,70,50,0.25)";
    roundRect(c, wx - ww / 2 - 5, wy - 5, ww + 10, wh + 10, 8);
    c.fill();
    const wg = c.createLinearGradient(wx - ww / 2, wy, wx + ww / 2, wy + wh);
    wg.addColorStop(0, "#dff2fb");
    wg.addColorStop(0.45, P.windowDark);
    wg.addColorStop(1, "#7fb4cc");
    c.fillStyle = wg;
    roundRect(c, wx - ww / 2, wy, ww, wh, 5);
    c.fill();
    // diagonal glass glint
    c.save();
    c.beginPath();
    roundRect(c, wx - ww / 2, wy, ww, wh, 5);
    c.clip();
    c.fillStyle = "rgba(255,255,255,0.4)";
    c.beginPath();
    c.moveTo(wx - ww / 2, wy + wh);
    c.lineTo(wx - ww / 2 + 40, wy + wh);
    c.lineTo(wx + ww / 2, wy - 10);
    c.lineTo(wx + ww / 2 - 40, wy - 10);
    c.closePath();
    c.fill();
    c.restore();
    // frame
    c.strokeStyle = "#fffaf0";
    c.lineWidth = 7;
    roundRect(c, wx - ww / 2, wy, ww, wh, 5);
    c.stroke();
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(wx, wy);
    c.lineTo(wx, wy + wh);
    c.moveTo(wx - ww / 2, wy + wh / 2);
    c.lineTo(wx + ww / 2, wy + wh / 2);
    c.stroke();
    // window box with flowers
    c.fillStyle = P.trunk;
    roundRect(c, wx - ww / 2 - 4, wy + wh, ww + 8, 16, 4);
    c.fill();
    for (let i = 0; i < 7; i++) {
      const fx = wx - ww / 2 + 8 + i * ((ww - 12) / 6);
      c.fillStyle = i % 2 ? "#ff7fa8" : "#ffd23b";
      c.beginPath();
      c.arc(fx, wy + wh - 1, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = P.leafDark;
      c.beginPath();
      c.arc(fx - 4, wy + wh + 4, 4, 0, Math.PI * 2);
      c.fill();
    }
  }

  t.update();
  return t;
}

/**
 * The back of a bungalow. Half the buildings face away from the camera, and
 * a blank stucco wall reads as an unfinished box — so the rear gets windows,
 * a vent and a downpipe of its own.
 */
export function makeRearTexture(scene: Scene, seed: number): DynamicTexture {
  const w = 512;
  const h = 256;
  const t = new DynamicTexture(`rear${seed}`, { width: w, height: h }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;

  c.fillStyle = P.wall;
  c.fillRect(0, 0, w, h);
  const rnd = mulberry(seed * 313 + 11);
  for (let i = 0; i < 700; i++) {
    c.strokeStyle = rnd() < 0.5 ? "rgba(226,205,175,0.3)" : "rgba(255,255,255,0.35)";
    c.lineWidth = 1 + rnd() * 2;
    const x = rnd() * w;
    const y = rnd() * h;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (rnd() - 0.5) * 12, y + (rnd() - 0.5) * 5);
    c.stroke();
  }

  const bs = c.createLinearGradient(0, h - 40, 0, h);
  bs.addColorStop(0, "rgba(150,120,90,0)");
  bs.addColorStop(1, "rgba(150,120,90,0.3)");
  c.fillStyle = bs;
  c.fillRect(0, h - 40, w, 40);

  // two small high windows
  for (const wx of [w * 0.3, w * 0.7]) {
    const ww = 84;
    const wh = 72;
    const wy = 62;
    c.fillStyle = "rgba(90,70,50,0.24)";
    roundRect(c, wx - ww / 2 - 4, wy - 4, ww + 8, wh + 8, 7);
    c.fill();
    const wg = c.createLinearGradient(wx - ww / 2, wy, wx + ww / 2, wy + wh);
    wg.addColorStop(0, "#dff2fb");
    wg.addColorStop(0.5, P.windowDark);
    wg.addColorStop(1, "#7fb4cc");
    c.fillStyle = wg;
    roundRect(c, wx - ww / 2, wy, ww, wh, 5);
    c.fill();
    c.strokeStyle = "#fffaf0";
    c.lineWidth = 6;
    roundRect(c, wx - ww / 2, wy, ww, wh, 5);
    c.stroke();
    c.beginPath();
    c.moveTo(wx, wy);
    c.lineTo(wx, wy + wh);
    c.lineWidth = 4;
    c.stroke();
  }

  // downpipe
  c.fillStyle = "#d8c6a8";
  c.fillRect(w * 0.5 - 7, 40, 14, h - 52);
  c.fillStyle = "rgba(255,255,255,0.4)";
  c.fillRect(w * 0.5 - 7, 40, 5, h - 52);
  for (const y of [70, 150, 210]) {
    c.fillStyle = "#c0ac8c";
    c.fillRect(w * 0.5 - 11, y, 22, 8);
  }

  // little wall vent
  c.fillStyle = "#b9a68a";
  roundRect(c, w * 0.12, h * 0.62, 46, 34, 6);
  c.fill();
  c.strokeStyle = "#8f7f68";
  c.lineWidth = 4;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(w * 0.12 + 6, h * 0.62 + 9 + i * 9);
    c.lineTo(w * 0.12 + 40, h * 0.62 + 9 + i * 9);
    c.stroke();
  }

  t.update();
  return t;
}

/** Free-standing roof sign, so the hotel reads as a hotel from any angle. */
export function makeHotelSignTexture(scene: Scene): DynamicTexture {
  const w = 1024;
  const h = 256;
  const t = new DynamicTexture("hotelSign", { width: w, height: h }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;
  c.clearRect(0, 0, w, h);

  c.fillStyle = "rgba(23,56,74,0.25)";
  roundRect(c, 18, 26, w - 36, h - 46, 26);
  c.fill();
  c.fillStyle = P.roof;
  roundRect(c, 12, 18, w - 36, h - 46, 26);
  c.fill();
  c.strokeStyle = "#fffaf0";
  c.lineWidth = 10;
  roundRect(c, 12, 18, w - 36, h - 46, 26);
  c.stroke();

  c.fillStyle = P.star;
  c.font = "bold 88px ui-rounded, system-ui, -apple-system, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("GRAND HOTEL", (w - 24) / 2 + 12, h / 2 + 2);

  // a row of little bulbs along the bottom edge
  for (let i = 0; i < 14; i++) {
    c.beginPath();
    c.arc(50 + i * ((w - 120) / 13), h - 40, 9, 0, Math.PI * 2);
    c.fillStyle = i % 2 ? "#fff6cf" : P.coin;
    c.fill();
  }

  t.update();
  t.hasAlpha = true;
  return t;
}

/** The lobby's big glazed front, with GRAND HOTEL lettering. */
export function makeLobbyFacadeTexture(scene: Scene): DynamicTexture {
  const w = 1024;
  const h = 384;
  const t = new DynamicTexture("lobbyFacade", { width: w, height: h }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;

  c.fillStyle = P.wall;
  c.fillRect(0, 0, w, h);
  const rnd = mulberry(451);
  for (let i = 0; i < 1200; i++) {
    c.strokeStyle = rnd() < 0.5 ? "rgba(226,205,175,0.28)" : "rgba(255,255,255,0.33)";
    c.lineWidth = 1 + rnd() * 2;
    const x = rnd() * w;
    const y = rnd() * h;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 6);
    c.stroke();
  }

  // glass curtain wall
  const gy = 120;
  const gh = h - gy - 16;
  const panels = 7;
  const pw = (w - 80) / panels;
  for (let i = 0; i < panels; i++) {
    const x = 40 + i * pw;
    const g = c.createLinearGradient(x, gy, x + pw, gy + gh);
    g.addColorStop(0, "#e6f7ff");
    g.addColorStop(0.4, "#a9d8ea");
    g.addColorStop(0.75, "#6ea9c4");
    g.addColorStop(1, "#c9ebf7");
    c.fillStyle = g;
    c.fillRect(x + 4, gy + 4, pw - 8, gh - 8);
    // warm interior glow behind the glass
    const warm = c.createRadialGradient(x + pw / 2, gy + gh * 0.75, 0, x + pw / 2, gy + gh * 0.75, pw * 0.7);
    warm.addColorStop(0, "rgba(255,214,140,0.55)");
    warm.addColorStop(1, "rgba(255,214,140,0)");
    c.fillStyle = warm;
    c.fillRect(x + 4, gy + 4, pw - 8, gh - 8);
    c.strokeStyle = "#fffaf0";
    c.lineWidth = 9;
    c.strokeRect(x + 4, gy + 4, pw - 8, gh - 8);
  }

  // sign band
  c.fillStyle = P.roof;
  roundRect(c, 60, 22, w - 120, 78, 14);
  c.fill();
  c.fillStyle = "rgba(0,0,0,0.14)";
  roundRect(c, 60, 74, w - 120, 26, 14);
  c.fill();
  c.fillStyle = P.star;
  c.font = "bold 52px ui-rounded, system-ui, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("GRAND HOTEL", w / 2, 60);

  t.update();
  return t;
}

/* -------------------------------------------------------------------- water */

/**
 * Pool water: layered caustic ribbons. Scrolled in two directions at slightly
 * different rates at runtime, which reads convincingly as moving water.
 */
export function makeWaterTexture(scene: Scene): DynamicTexture {
  const size = 512;
  const { t, c } = make(scene, "waterTex", size);

  const g = c.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, P.water);
  g.addColorStop(0.5, "#43d3ef");
  g.addColorStop(1, P.waterDeep);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);

  // caustic net: two crossing sine families
  c.globalCompositeOperation = "lighter";
  for (let pass = 0; pass < 2; pass++) {
    const rot = pass === 0 ? 0.5 : -0.7;
    c.save();
    c.translate(size / 2, size / 2);
    c.rotate(rot);
    c.translate(-size / 2, -size / 2);
    for (let i = -6; i < 20; i++) {
      c.beginPath();
      for (let x = -size; x <= size * 2; x += 6) {
        const y =
          i * 34 +
          Math.sin(x * 0.021 + i * 0.9) * 13 +
          Math.sin(x * 0.052 + i * 2.1) * 6;
        if (x === -size) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.strokeStyle = `rgba(232,251,255,${0.1 + (i % 3) * 0.035})`;
      c.lineWidth = 3 + (i % 4);
      c.stroke();
    }
    c.restore();
  }
  c.globalCompositeOperation = "source-over";

  // sparkle dots
  const rnd = mulberry(1234);
  for (let i = 0; i < 260; i++) {
    c.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.4})`;
    c.beginPath();
    c.arc(rnd() * size, rnd() * size, 1 + rnd() * 2.4, 0, Math.PI * 2);
    c.fill();
  }

  t.update();
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/* ------------------------------------------------------------------ sprites */

/** Soft round flare for particles (additive). */
export function makeFlareTexture(scene: Scene): DynamicTexture {
  const size = 128;
  const { t, c } = make(scene, "flareTex", size);
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.72)");
  g.addColorStop(0.55, "rgba(255,255,255,0.2)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  t.update();
  t.hasAlpha = true;
  return t;
}

/** Coin sprite for the money particles. */
export function makeCoinTexture(scene: Scene): DynamicTexture {
  const size = 128;
  const { t, c } = make(scene, "coinTex", size);
  c.clearRect(0, 0, size, size);
  const r = size * 0.42;
  const g = c.createRadialGradient(size * 0.4, size * 0.36, r * 0.1, size / 2, size / 2, r);
  g.addColorStop(0, "#fff4c2");
  g.addColorStop(0.5, P.coin);
  g.addColorStop(1, P.coinDark);
  c.fillStyle = g;
  c.beginPath();
  c.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.75)";
  c.lineWidth = 5;
  c.beginPath();
  c.arc(size / 2, size / 2, r * 0.76, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = "rgba(160,110,10,0.55)";
  c.font = `bold ${size * 0.42}px ui-rounded, system-ui, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("$", size / 2, size / 2 + 2);
  t.update();
  t.hasAlpha = true;
  return t;
}

/** Star sprite for the rating burst / confetti. */
export function makeStarTexture(scene: Scene): DynamicTexture {
  const size = 128;
  const { t, c } = make(scene, "starTex", size);
  c.clearRect(0, 0, size, size);
  c.fillStyle = P.star;
  c.beginPath();
  const cx = size / 2;
  const cy = size / 2;
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? size * 0.46 : size * 0.2;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.85)";
  c.lineWidth = 4;
  c.stroke();
  t.update();
  t.hasAlpha = true;
  return t;
}

/**
 * Mood bubble sheet: one row of 4 faces (happy, neutral, grumpy, key).
 * Applied as a billboarded plane above a guest with UV offsets.
 */
export function makeMoodTexture(scene: Scene): DynamicTexture {
  const cell = 128;
  const w = cell * 4;
  const t = new DynamicTexture("moodTex", { width: w, height: cell }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;
  c.clearRect(0, 0, w, cell);

  const drawBubble = (ox: number, fill: string) => {
    c.save();
    c.translate(ox, 0);
    c.fillStyle = "rgba(23,56,74,0.18)";
    roundRect(c, 12, 16, cell - 24, cell - 34, 22);
    c.fill();
    c.fillStyle = fill;
    roundRect(c, 10, 10, cell - 24, cell - 34, 22);
    c.fill();
    // tail
    c.beginPath();
    c.moveTo(cell / 2 - 12, cell - 26);
    c.lineTo(cell / 2, cell - 8);
    c.lineTo(cell / 2 + 12, cell - 26);
    c.closePath();
    c.fill();
    c.restore();
  };

  const face = (ox: number, mouth: "smile" | "flat" | "frown") => {
    c.save();
    c.translate(ox, 0);
    c.fillStyle = "#17384a";
    c.beginPath();
    c.arc(cell * 0.36, cell * 0.4, 7, 0, Math.PI * 2);
    c.arc(cell * 0.62, cell * 0.4, 7, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#17384a";
    c.lineWidth = 7;
    c.lineCap = "round";
    c.beginPath();
    if (mouth === "smile") c.arc(cell * 0.49, cell * 0.5, 20, 0.25 * Math.PI, 0.75 * Math.PI);
    else if (mouth === "flat") {
      c.moveTo(cell * 0.36, cell * 0.62);
      c.lineTo(cell * 0.62, cell * 0.62);
    } else c.arc(cell * 0.49, cell * 0.78, 20, 1.25 * Math.PI, 1.75 * Math.PI);
    c.stroke();
    c.restore();
  };

  drawBubble(0, "#9ce88a");
  face(0, "smile");
  drawBubble(cell, "#ffe08a");
  face(cell, "flat");
  drawBubble(cell * 2, "#ff9d8a");
  face(cell * 2, "frown");

  // key icon (guest is checked in and heading to their room)
  drawBubble(cell * 3, "#bfe4ff");
  c.save();
  c.translate(cell * 3, 0);
  c.fillStyle = P.coin;
  c.strokeStyle = P.coinDark;
  c.lineWidth = 4;
  c.beginPath();
  c.arc(cell * 0.38, cell * 0.44, 16, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = "#bfe4ff";
  c.beginPath();
  c.arc(cell * 0.38, cell * 0.44, 6, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = P.coin;
  c.fillRect(cell * 0.46, cell * 0.38, 34, 11);
  c.fillRect(cell * 0.68, cell * 0.49, 9, 12);
  c.fillRect(cell * 0.55, cell * 0.49, 9, 9);
  c.restore();

  t.update();
  t.hasAlpha = true;
  return t;
}

/**
 * Room status sheet: 4 cells, in the order of the room lifecycle —
 * free (green bed), reserved (blue walker), occupied (amber zzz),
 * dirty (orange broom). Floated over each bungalow so a non-reader can see
 * at a glance which room needs them.
 *
 * Reserved gets its own cell deliberately: showing the sleeping zzz while the
 * guest is still walking to the door reads as a lie.
 */
export function makeRoomIconTexture(scene: Scene): DynamicTexture {
  const cell = 128;
  const w = cell * 4;
  const t = new DynamicTexture("roomIcon", { width: w, height: cell }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;
  c.clearRect(0, 0, w, cell);

  const disc = (ox: number, fill: string) => {
    c.fillStyle = "rgba(23,56,74,0.2)";
    c.beginPath();
    c.arc(ox + cell / 2, cell / 2 + 5, 50, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = fill;
    c.beginPath();
    c.arc(ox + cell / 2, cell / 2, 50, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = 6;
    c.stroke();
  };

  // ---- free: a little bed
  disc(0, "#7ede6b");
  c.fillStyle = "#ffffff";
  roundRect(c, 30, 62, 68, 22, 6);
  c.fill();
  c.fillStyle = "#17384a";
  roundRect(c, 26, 52, 20, 20, 5);
  c.fill(); // pillow-end headboard
  c.fillStyle = "#ffffff";
  roundRect(c, 32, 56, 14, 12, 4);
  c.fill();
  c.fillStyle = "#17384a";
  c.fillRect(28, 84, 6, 12);
  c.fillRect(94, 84, 6, 12);

  // ---- reserved: a walker, i.e. "someone is on their way here"
  disc(cell, "#7fd4f5");
  c.save();
  c.translate(cell + cell / 2, cell / 2);
  c.fillStyle = "#17384a";
  c.beginPath();
  c.arc(0, -30, 11, 0, Math.PI * 2); // head
  c.fill();
  c.strokeStyle = "#17384a";
  c.lineWidth = 9;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  c.moveTo(0, -16);
  c.lineTo(-2, 10); // torso
  c.stroke();
  c.beginPath();
  c.moveTo(-2, 10); // striding legs
  c.lineTo(-18, 34);
  c.moveTo(-2, 10);
  c.lineTo(16, 32);
  c.stroke();
  c.beginPath();
  c.moveTo(-1, -8); // swinging arms
  c.lineTo(-19, 2);
  c.moveTo(-1, -8);
  c.lineTo(17, -2);
  c.stroke();
  c.restore();

  // ---- occupied: zzz
  disc(cell * 2, "#ffcf5c");
  c.fillStyle = "#17384a";
  c.font = "bold 40px ui-rounded, system-ui, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("z", cell * 2 + 46, 76);
  c.font = "bold 52px ui-rounded, system-ui, sans-serif";
  c.fillText("z", cell * 2 + 76, 58);

  // ---- dirty: a broom
  disc(cell * 3, "#ff9a5e");
  c.save();
  c.translate(cell * 3 + cell / 2, cell / 2);
  c.rotate(-0.4);
  c.strokeStyle = "#8a6242";
  c.lineWidth = 9;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(0, -38);
  c.lineTo(0, 8);
  c.stroke();
  c.fillStyle = "#17384a";
  c.beginPath();
  c.moveTo(-20, 8);
  c.lineTo(20, 8);
  c.lineTo(26, 40);
  c.lineTo(-26, 40);
  c.closePath();
  c.fill();
  c.strokeStyle = "#ffe9c9";
  c.lineWidth = 4;
  for (let i = -2; i <= 2; i++) {
    c.beginPath();
    c.moveTo(i * 9, 12);
    c.lineTo(i * 11, 38);
    c.stroke();
  }
  c.restore();

  t.update();
  t.hasAlpha = true;
  return t;
}

/**
 * A single palm frond on transparent background. Flat untextured quads read as
 * green chevrons from the iso camera; a proper leaf silhouette with a rib and
 * cut edges reads as foliage.
 */
export function makeFrondTexture(scene: Scene, color: string, dark: string): DynamicTexture {
  const w = 128;
  const h = 384;
  const t = new DynamicTexture("frondTex", { width: w, height: h }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;
  c.clearRect(0, 0, w, h);

  const midX = w / 2;
  // leaf blade: widest a third of the way down, tapering to a point
  const blade = (side: 1 | -1, fill: string) => {
    c.beginPath();
    c.moveTo(midX, h - 6);
    for (let i = 0; i <= 20; i++) {
      const p = i / 20;
      const y = h - 6 - p * (h - 20);
      const width = Math.sin(Math.pow(p, 0.55) * Math.PI) * (w * 0.46);
      c.lineTo(midX + side * width, y);
    }
    c.lineTo(midX, 12);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  };
  blade(1, color);
  blade(-1, dark);

  // cut the leaflet notches out of both edges
  c.globalCompositeOperation = "destination-out";
  c.lineWidth = 5;
  c.strokeStyle = "#000";
  for (let i = 1; i < 22; i++) {
    const p = i / 22;
    const y = h - 6 - p * (h - 20);
    const width = Math.sin(Math.pow(p, 0.55) * Math.PI) * (w * 0.46);
    for (const side of [1, -1]) {
      c.beginPath();
      c.moveTo(midX + side * width * 0.28, y + 8);
      c.lineTo(midX + side * width * 1.05, y - 6);
      c.stroke();
    }
  }
  c.globalCompositeOperation = "source-over";

  // central rib
  c.strokeStyle = dark;
  c.lineWidth = 7;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(midX, h - 8);
  c.lineTo(midX, 14);
  c.stroke();

  t.update();
  t.hasAlpha = true;
  return t;
}

/** Diagonal candy stripe, tiled along the water slide flume. */
export function makeStripeTexture(scene: Scene, a: string, b: string): DynamicTexture {
  const size = 128;
  const { t, c } = make(scene, "stripeTex", size);
  c.fillStyle = a;
  c.fillRect(0, 0, size, size);
  c.fillStyle = b;
  for (let i = -size; i < size * 2; i += 34) {
    c.save();
    c.translate(i, 0);
    c.rotate(0.5);
    c.fillRect(0, -size, 17, size * 3);
    c.restore();
  }
  // glossy highlight band
  const g = c.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, "rgba(255,255,255,0.34)");
  g.addColorStop(0.45, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(0,0,0,0.16)");
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  t.update();
  t.wrapU = Texture.WRAP_ADDRESSMODE;
  t.wrapV = Texture.WRAP_ADDRESSMODE;
  return t;
}

/**
 * The face of a build pad: concentric rings and inward chevrons.
 *
 * A flat-coloured disc was washing out to a blank white ellipse under the key
 * light. Internal contrast means the pad still reads as "stand here" no matter
 * how brightly it's lit.
 */
export function makePadDiscTexture(scene: Scene): DynamicTexture {
  const S = 256;
  const { t, c } = make(scene, "padDisc", S);
  const cx = S / 2;

  c.clearRect(0, 0, S, S);
  c.fillStyle = "#5fdcf0";
  c.beginPath();
  c.arc(cx, cx, S * 0.49, 0, Math.PI * 2);
  c.fill();

  // rings
  for (const [r, col] of [
    [0.42, "rgba(255,255,255,0.55)"],
    [0.33, "rgba(20,110,130,0.3)"],
    [0.23, "rgba(255,255,255,0.5)"],
  ] as const) {
    c.strokeStyle = col;
    c.lineWidth = S * 0.035;
    c.beginPath();
    c.arc(cx, cx, S * r, 0, Math.PI * 2);
    c.stroke();
  }

  // four chevrons pointing at the centre
  c.strokeStyle = "#ffffff";
  c.lineWidth = S * 0.045;
  c.lineCap = "round";
  c.lineJoin = "round";
  for (let i = 0; i < 4; i++) {
    c.save();
    c.translate(cx, cx);
    c.rotate((i / 4) * Math.PI * 2);
    c.beginPath();
    c.moveTo(-S * 0.075, -S * 0.4);
    c.lineTo(0, -S * 0.31);
    c.lineTo(S * 0.075, -S * 0.4);
    c.stroke();
    c.restore();
  }

  // bright centre spot
  const g = c.createRadialGradient(cx, cx, 0, cx, cx, S * 0.2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.beginPath();
  c.arc(cx, cx, S * 0.2, 0, Math.PI * 2);
  c.fill();

  t.update();
  return t;
}

export type SignKind = "checkin" | "bath" | "food" | "gym" | "spa";

/** High-contrast pictogram signs, so a non-reader can navigate the resort. */
export function makeSignTexture(scene: Scene, kind: SignKind): DynamicTexture {
  const w = 512;
  const h = 320;
  const t = new DynamicTexture(`sign_${kind}`, { width: w, height: h }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;
  c.clearRect(0, 0, w, h);

  // plaque
  c.fillStyle = "rgba(23,56,74,0.22)";
  roundRect(c, 26, 30, w - 52, h - 52, 30);
  c.fill();
  c.fillStyle = "#fffaf0";
  roundRect(c, 20, 20, w - 52, h - 52, 30);
  c.fill();
  c.strokeStyle = P.roof;
  c.lineWidth = 12;
  roundRect(c, 20, 20, w - 52, h - 52, 30);
  c.stroke();

  const cx = (w - 32) / 2 + 20;
  const cy = (h - 32) / 2 + 20;
  c.strokeStyle = P.ink;
  c.fillStyle = P.ink;
  c.lineWidth = 14;
  c.lineCap = "round";
  c.lineJoin = "round";

  switch (kind) {
    case "checkin": {
      // service bell
      c.beginPath();
      c.arc(cx, cy + 18, 62, Math.PI, 0);
      c.fill();
      c.fillRect(cx - 82, cy + 18, 164, 18);
      c.beginPath();
      c.arc(cx, cy - 52, 13, 0, Math.PI * 2);
      c.fill();
      // an arrow pointing at it
      c.strokeStyle = P.roof;
      c.beginPath();
      c.moveTo(cx + 120, cy + 60);
      c.lineTo(cx + 120, cy - 20);
      c.moveTo(cx + 100, cy);
      c.lineTo(cx + 120, cy - 22);
      c.lineTo(cx + 140, cy);
      c.stroke();
      break;
    }
    case "bath": {
      // shower head + droplets
      c.beginPath();
      c.moveTo(cx - 70, cy - 70);
      c.lineTo(cx + 40, cy - 70);
      c.stroke();
      c.beginPath();
      c.moveTo(cx + 40, cy - 70);
      c.lineTo(cx + 40, cy - 40);
      c.stroke();
      c.beginPath();
      c.ellipse(cx + 40, cy - 26, 46, 20, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#2fc3e3";
      for (let i = -2; i <= 2; i++) {
        for (let j = 0; j < 3; j++) {
          c.beginPath();
          c.arc(cx + 40 + i * 20, cy + 14 + j * 30 + (i % 2) * 12, 8, 0, Math.PI * 2);
          c.fill();
        }
      }
      break;
    }
    case "food": {
      // fork and knife
      c.lineWidth = 12;
      c.beginPath();
      c.moveTo(cx - 60, cy - 76);
      c.lineTo(cx - 60, cy + 80);
      c.moveTo(cx - 88, cy - 76);
      c.lineTo(cx - 88, cy - 16);
      c.moveTo(cx - 32, cy - 76);
      c.lineTo(cx - 32, cy - 16);
      c.moveTo(cx - 88, cy - 16);
      c.lineTo(cx - 32, cy - 16);
      c.stroke();
      c.beginPath();
      c.moveTo(cx + 62, cy + 80);
      c.lineTo(cx + 62, cy - 20);
      c.stroke();
      c.beginPath();
      c.moveTo(cx + 62, cy - 20);
      c.quadraticCurveTo(cx + 96, cy - 46, cx + 62, cy - 80);
      c.fill();
      break;
    }
    case "gym": {
      // dumbbell
      c.fillRect(cx - 24, cy - 16, 48, 32);
      c.fillRect(cx - 74, cy - 44, 34, 88);
      c.fillRect(cx + 40, cy - 44, 34, 88);
      c.fillRect(cx - 100, cy - 26, 22, 52);
      c.fillRect(cx + 78, cy - 26, 22, 52);
      break;
    }
    case "spa": {
      // bubbly tub
      c.beginPath();
      c.moveTo(cx - 92, cy - 6);
      c.lineTo(cx + 92, cy - 6);
      c.lineTo(cx + 70, cy + 72);
      c.lineTo(cx - 70, cy + 72);
      c.closePath();
      c.fill();
      c.fillStyle = "#2fc3e3";
      const bubbles: [number, number, number][] = [
        [-52, -46, 18],
        [-8, -68, 24],
        [40, -40, 15],
        [12, -22, 11],
      ];
      for (const [bx, by, br] of bubbles) {
        c.beginPath();
        c.arc(cx + bx, cy + by, br, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
  }

  t.update();
  t.hasAlpha = true;
  return t;
}

/* ------------------------------------------------------------------ helpers */

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function shadeHex(hexColor: string, mul: number): string {
  const n = parseInt(hexColor.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * mul));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * mul));
  const b = Math.min(255, Math.round((n & 255) * mul));
  return `rgb(${r},${g},${b})`;
}
