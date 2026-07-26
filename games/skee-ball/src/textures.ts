import type { Scene } from "@babylonjs/core/scene";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import {
  RING_RADII,
  RING_POINTS,
  RING_COLORS,
  POCKET_U,
  POCKET_V,
  POCKET_R,
  POCKET_COLOR,
  BOARD_HALF_W,
  BOARD_TOP_V,
  BOARD_BOT_V,
} from "./config";

type Ctx2D = CanvasRenderingContext2D;

function ctxOf(tex: DynamicTexture): Ctx2D {
  return tex.getContext() as unknown as Ctx2D;
}

/** Soft radial flare sprite for particles / bokeh dots. */
export function makeFlareTexture(scene: Scene, tint = "255,255,255"): DynamicTexture {
  const size = 128;
  const tex = new DynamicTexture("flare", size, scene, false);
  const ctx = ctxOf(tex);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${tint},1)`);
  g.addColorStop(0.3, `rgba(${tint},0.7)`);
  g.addColorStop(0.65, `rgba(${tint},0.2)`);
  g.addColorStop(1, `rgba(${tint},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

/** Procedural warm wood-plank texture. Grain runs along canvas X. */
export function makeWoodTexture(
  scene: Scene,
  name: string,
  plankRows = 5,
  light = "#dca960",
  mid = "#b8803a",
  dark = "#7c5320"
): DynamicTexture {
  const W = 1024;
  const H = 512;
  const tex = new DynamicTexture(name, { width: W, height: H }, scene, true);
  const ctx = ctxOf(tex);

  ctx.fillStyle = mid;
  ctx.fillRect(0, 0, W, H);

  const rowH = H / plankRows;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (let r = 0; r < plankRows; r++) {
    const y0 = r * rowH;
    // per-plank base tint
    const t = 0.35 + rnd() * 0.5;
    ctx.fillStyle = blend(mid, light, t * 0.5);
    ctx.fillRect(0, y0, W, rowH);

    // long grain streaks
    for (let i = 0; i < 26; i++) {
      const gy = y0 + rnd() * rowH;
      const amp = 1.5 + rnd() * 3.5;
      const alpha = 0.05 + rnd() * 0.12;
      ctx.strokeStyle = rnd() > 0.4 ? hexA(dark, alpha) : hexA(light, alpha);
      ctx.lineWidth = 0.8 + rnd() * 2.2;
      ctx.beginPath();
      const phase = rnd() * 10;
      for (let x = 0; x <= W; x += 16) {
        const yy = gy + Math.sin(x * 0.012 + phase) * amp + Math.sin(x * 0.05 + phase * 2) * 0.8;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // occasional knot
    if (rnd() > 0.45) {
      const kx = rnd() * W;
      const ky = y0 + rowH * (0.3 + rnd() * 0.4);
      const kr = 4 + rnd() * 7;
      const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr * 2.4);
      g.addColorStop(0, hexA(dark, 0.55));
      g.addColorStop(0.5, hexA(dark, 0.22));
      g.addColorStop(1, hexA(dark, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(kx, ky, kr * 2.6, kr, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // plank seam
    ctx.fillStyle = hexA("#2b1a08", 0.65);
    ctx.fillRect(0, y0 + rowH - 2, W, 2);
    // butt joints
    const joints = 1 + Math.floor(rnd() * 2);
    for (let j = 0; j < joints; j++) {
      const jx = rnd() * W;
      ctx.fillRect(jx, y0, 2, rowH);
    }
  }

  // soft sheen band down the middle (polished lane)
  const sheen = ctx.createLinearGradient(0, 0, 0, H);
  sheen.addColorStop(0, "rgba(255,235,200,0)");
  sheen.addColorStop(0.5, "rgba(255,235,200,0.10)");
  sheen.addColorStop(1, "rgba(255,235,200,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  tex.update();
  return tex;
}

/** Cream skee-ball with a subtle band so spin reads. */
export function makeBallTexture(scene: Scene): DynamicTexture {
  const S = 256;
  const tex = new DynamicTexture("ballTex", S, scene, true);
  const ctx = ctxOf(tex);
  ctx.fillStyle = "#efe3cd";
  ctx.fillRect(0, 0, S, S);
  // faint mottling
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    ctx.fillStyle = `rgba(160,130,90,${0.03 + Math.random() * 0.05})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + Math.random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // two seam bands (equator-ish) so rotation is visible
  ctx.fillStyle = "rgba(146,96,44,0.8)";
  ctx.fillRect(0, S * 0.3, S, 7);
  ctx.fillRect(0, S * 0.66, S, 7);
  ctx.fillStyle = "rgba(146,96,44,0.35)";
  ctx.fillRect(0, S * 0.31, S, 14);
  ctx.fillRect(0, S * 0.67, S, 14);
  tex.update();
  return tex;
}

/**
 * The scoring board face: felt background, colored ring zones, numbers and the
 * 100-pockets. Painted in board (u, v) space; the quad's UVs map u -> canvas x
 * and v -> canvas y (DynamicTexture is invertY by default, so v up = canvas up).
 */
export function makeBoardTexture(scene: Scene): DynamicTexture {
  const S = 1024;
  const tex = new DynamicTexture("boardTex", S, scene, true);
  const ctx = ctxOf(tex);

  const bw = BOARD_HALF_W * 2;
  const bh = BOARD_TOP_V - BOARD_BOT_V;
  const sx = S / bw;
  const sy = S / bh;
  // board-space (u,v) -> canvas px. v up => canvas y down.
  const px = (u: number) => (u + BOARD_HALF_W) * sx;
  const py = (v: number) => (BOARD_TOP_V - v) * sy;

  // felt background with vignette
  ctx.fillStyle = "#0b0e22";
  ctx.fillRect(0, 0, S, S);
  const vg = ctx.createRadialGradient(S / 2, S / 2, S * 0.15, S / 2, S / 2, S * 0.75);
  vg.addColorStop(0, "rgba(50,60,110,0.35)");
  vg.addColorStop(1, "rgba(0,0,10,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, S, S);

  // fine speckle
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    ctx.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
  }

  const ringFills = ["#5a4708", "#5a2f07", "#3d0b4c", "#062f57", "#064a25"];

  const drawEllipse = (u: number, v: number, r: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(px(u), py(v), r * sx, r * sy, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // ring zones, outermost first, each with a bright painted edge
  for (let i = RING_RADII.length - 1; i >= 0; i--) {
    drawEllipse(0, 0, RING_RADII[i], ringFills[i]);
    ctx.save();
    ctx.strokeStyle = RING_COLORS[i];
    ctx.lineWidth = 9;
    ctx.shadowColor = RING_COLORS[i];
    ctx.shadowBlur = 26;
    ctx.beginPath();
    ctx.ellipse(px(0), py(0), RING_RADII[i] * sx, RING_RADII[i] * sy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // dark bullseye hole illusion
  const holeG = ctx.createRadialGradient(px(0), py(0), 2, px(0), py(0), RING_RADII[0] * sx);
  holeG.addColorStop(0, "rgba(0,0,0,0.9)");
  holeG.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = holeG;
  ctx.beginPath();
  ctx.ellipse(px(0), py(0), RING_RADII[0] * sx, RING_RADII[0] * sy, 0, 0, Math.PI * 2);
  ctx.fill();

  // numbers along the lower axis
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = (txt: string, u: number, v: number, size: number, color: string) => {
    ctx.font = `900 ${size}px Verdana, Arial, sans-serif`;
    ctx.save();
    ctx.translate(px(u), py(v));
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  };

  label("50", 0, 0, 58, RING_COLORS[0]);
  for (let i = 1; i < RING_RADII.length; i++) {
    const mid = (RING_RADII[i - 1] + RING_RADII[i]) / 2;
    label(String(RING_POINTS[i]), 0, -mid, 56, RING_COLORS[i]);
    label(String(RING_POINTS[i]), 0, mid, 56, RING_COLORS[i]);
  }

  // 100 pockets
  for (const s of [-1, 1]) {
    drawEllipse(s * POCKET_U, POCKET_V, POCKET_R + 0.012, "#1c0713");
    const g = ctx.createRadialGradient(
      px(s * POCKET_U),
      py(POCKET_V),
      2,
      px(s * POCKET_U),
      py(POCKET_V),
      POCKET_R * sx
    );
    g.addColorStop(0, "#000000");
    g.addColorStop(0.75, "#0c020a");
    g.addColorStop(1, "#38101f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(px(s * POCKET_U), py(POCKET_V), POCKET_R * sx, POCKET_R * sy, 0, 0, Math.PI * 2);
    ctx.fill();
    label("100", s * POCKET_U, POCKET_V - POCKET_R - 0.06, 44, POCKET_COLOR);
  }

  tex.update();
  return tex;
}

/** Marquee sign face: dark panel + glowing SKEE-BALL lettering. */
export function makeMarqueeTexture(scene: Scene): DynamicTexture {
  const W = 1024;
  const H = 288;
  const tex = new DynamicTexture("marqueeTex", { width: W, height: H }, scene, true);
  const ctx = ctxOf(tex);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1c0f33");
  bg.addColorStop(0.5, "#2a1547");
  bg.addColorStop(1, "#160a28");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 128px 'Arial Black', Arial, sans-serif";

  // layered neon glow
  for (const [blur, color, alpha] of [
    [46, "#ff3fd8", 0.9],
    [24, "#ffd54a", 0.9],
    [8, "#fff6d8", 1],
  ] as const) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur as number;
    ctx.globalAlpha = alpha as number;
    ctx.fillStyle = blur === 8 ? "#fff3c8" : color;
    ctx.fillText("SKEE·BALL", W / 2, H / 2 + 6);
    ctx.restore();
  }

  tex.update();
  return tex;
}

/** Text sprite texture for floating score popups. */
export function makePopupTexture(scene: Scene, text: string, color: string): DynamicTexture {
  const W = 512;
  const H = 192;
  const tex = new DynamicTexture("popup-" + text, { width: W, height: H }, scene, true);
  const ctx = ctxOf(tex);
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = text.length > 6 ? 72 : 104;
  ctx.font = `900 ${size}px 'Arial Black', Arial, sans-serif`;
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.strokeText(text, W / 2, H / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, H / 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `900 ${size * 0.94}px 'Arial Black', Arial, sans-serif`;
  ctx.fillText(text, W / 2, H / 2 - 3);
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

/** Dark arcade-carpet floor texture. */
export function makeCarpetTexture(scene: Scene): DynamicTexture {
  const S = 512;
  const tex = new DynamicTexture("carpet", S, scene, true);
  const ctx = ctxOf(tex);
  ctx.fillStyle = "#0c0918";
  ctx.fillRect(0, 0, S, S);
  const cols = ["#1b1038", "#251348", "#0f1d3a", "#301048"];
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = cols[i % cols.length];
    ctx.globalAlpha = 0.25 + Math.random() * 0.4;
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 2 + Math.random() * 6;
    ctx.beginPath();
    if (Math.random() > 0.5) {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    } else {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.lineTo(x - r, y + r);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  tex.update();
  return tex;
}

// ---- helpers ----

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function blend(hexA_: string, hexB: string, t: number): string {
  const a = parseInt(hexA_.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return `rgb(${r},${g},${bl})`;
}
