#!/usr/bin/env node
/**
 * Generates the PWA app icons into landing/icons/app/.
 *
 * Rasterizes an arcade joystick on the site's purple→pink gradient. Written
 * against zlib only so it runs anywhere `npm run build` does — no image
 * dependencies. Re-run with `node scripts/generate-icons.js` after editing the
 * shapes below; the output is committed, so the build never needs it.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'landing', 'icons', 'app');

// Site palette, from landing/styles.css.
const PURPLE = [124, 58, 237];
const PINK = [236, 72, 153];
const WHITE = [255, 255, 255];
const GOLD = [255, 209, 102];

const SS = 4; // supersampling factor per axis

// --- Coverage functions. All take/return unit coordinates (0..1). ---

function circleCoverage(px, py, cx, cy, r) {
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r ? 1 : 0;
}

function roundedRectCoverage(px, py, x, y, w, h, r) {
  const x0 = x - w / 2;
  const y0 = y - h / 2;
  if (px < x0 || px > x0 + w || py < y0 || py > y0 + h) return 0;
  const rad = Math.min(r, w / 2, h / 2);
  // Distance to the inner rect the corners are rounded around.
  const dx = Math.max(x0 + rad - px, 0, px - (x0 + w - rad));
  const dy = Math.max(y0 + rad - py, 0, py - (y0 + h - rad));
  return dx * dx + dy * dy <= rad * rad ? 1 : 0;
}

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * Colour of the icon at unit point (px, py), or null for transparent.
 * `inset` shrinks the artwork toward the centre so maskable icons keep their
 * content inside the safe zone; `bleed` fills the corners instead of rounding
 * them (iOS and Android apply their own mask).
 */
function sample(px, py, { inset, bleed }) {
  // Background: rounded square with a 135° gradient.
  const bgCoverage = bleed ? 1 : roundedRectCoverage(px, py, 0.5, 0.5, 1, 1, 0.22);
  if (!bgCoverage) return null;
  const background = lerp(PURPLE, PINK, Math.min(1, Math.max(0, (px + py) / 2)));

  // Artwork coordinates, scaled about the centre.
  const ax = (px - 0.5) / inset + 0.5;
  const ay = (py - 0.5) / inset + 0.5;

  // Joystick base, then the two buttons punched into it.
  if (roundedRectCoverage(ax, ay, 0.5, 0.73, 0.56, 0.2, 0.09)) {
    if (circleCoverage(ax, ay, 0.29, 0.73, 0.042)) return PINK;
    if (circleCoverage(ax, ay, 0.71, 0.73, 0.042)) return PURPLE;
    return WHITE;
  }

  // Ball sits on top of the stick, so test it first.
  if (circleCoverage(ax, ay, 0.5, 0.35, 0.145)) {
    // Off-centre highlight so the ball reads as spherical.
    return circleCoverage(ax, ay, 0.455, 0.305, 0.045) ? WHITE : GOLD;
  }
  if (roundedRectCoverage(ax, ay, 0.5, 0.53, 0.11, 0.3, 0.055)) return WHITE;

  return background;
}

// --- PNG encoding ---

function encodePng(width, height, rgba) {
  // One filter byte (0 = None) per scanline, then the row's pixels.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // bytes 10-12: deflate compression, adaptive filtering, no interlace — all 0.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

// --- Render ---

function render(size, opts) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size;
          const py = (y + (sy + 0.5) / SS) / size;
          const c = sample(px, py, opts);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 255;
          }
        }
      }
      const samples = SS * SS;
      const i = (y * size + x) * 4;
      if (a > 0) {
        // Average over covered samples only, so edges don't darken toward black.
        const covered = a / 255;
        rgba[i] = Math.round(r / covered);
        rgba[i + 1] = Math.round(g / covered);
        rgba[i + 2] = Math.round(b / covered);
      }
      rgba[i + 3] = Math.round(a / samples);
    }
  }
  return encodePng(size, size, rgba);
}

const OUTPUTS = [
  { file: 'icon-192.png', size: 192, inset: 1, bleed: false },
  { file: 'icon-512.png', size: 512, inset: 1, bleed: false },
  // Maskable: full bleed, artwork inside the 80% safe zone.
  { file: 'icon-maskable-512.png', size: 512, inset: 0.78, bleed: true },
  // iOS applies its own squircle mask and does not support transparency.
  { file: 'apple-touch-icon.png', size: 180, inset: 0.88, bleed: true },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size, inset, bleed } of OUTPUTS) {
  const png = render(size, { inset, bleed });
  fs.writeFileSync(path.join(OUT_DIR, file), png);
  console.log(`✅ ${file} (${size}×${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}
