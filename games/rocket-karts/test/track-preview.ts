// Draws each track as a PNG (road, shoulders, boxes, pads, checkpoints) for eyeballing layouts.
import { TRACKS } from '../src/shared/tracks.ts';
import { buildTrack, pointAt } from '../src/shared/track.ts';
import { chromium } from 'playwright';
import fs from 'node:fs';
import { launchOptions } from './browser.ts';

const browser = await chromium.launch(launchOptions());
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
for (const def of TRACKS) {
  const g = buildTrack(def);
  const xs = g.samples.map((s) => s.x);
  const zs = g.samples.map((s) => s.z);
  const pad = 30;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minZ = Math.min(...zs) - pad, maxZ = Math.max(...zs) + pad;
  const W = 1000, H = Math.round((W * (maxZ - minZ)) / (maxX - minX));
  const sx = (x: number) => ((x - minX) / (maxX - minX)) * W;
  const sz = (z: number) => H - ((z - minZ) / (maxZ - minZ)) * H;
  const poly = (lat: number) => g.samples.map((s) => `${sx(s.x + s.nx * lat).toFixed(1)},${sz(s.z + s.nz * lat).toFixed(1)}`).join(' ');
  const half = def.width / 2;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#8fd27a"/>`;
  svg += `<polygon points="${poly(half + def.shoulder)}" fill="none" stroke="#c44" stroke-width="2"/>`;
  svg += `<polygon points="${poly(-half - def.shoulder)}" fill="none" stroke="#c44" stroke-width="2"/>`;
  svg += `<polygon points="${poly(half)}" fill="none" stroke="#333" stroke-width="3"/>`;
  svg += `<polygon points="${poly(-half)}" fill="none" stroke="#333" stroke-width="3"/>`;
  svg += `<polygon points="${poly(0)}" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="6 6"/>`;
  for (const p of def.points) svg += `<circle cx="${sx(p[0])}" cy="${sz(p[1])}" r="4" fill="#00f"/>`;
  for (const b of g.boxes) svg += `<rect x="${sx(b.x) - 4}" y="${sz(b.z) - 4}" width="8" height="8" fill="#ff0" stroke="#000"/>`;
  for (const p of g.pads) svg += `<circle cx="${sx(p.x)}" cy="${sz(p.z)}" r="6" fill="#0ff" stroke="#000"/>`;
  g.checkpoints.forEach((s, i) => {
    const a = pointAt(g, s, -half - def.shoulder), b = pointAt(g, s, half + def.shoulder);
    svg += `<line x1="${sx(a.x)}" y1="${sz(a.z)}" x2="${sx(b.x)}" y2="${sz(b.z)}" stroke="${i === 0 ? '#000' : '#fa0'}" stroke-width="${i === 0 ? 4 : 2}"/>`;
  });
  const start = pointAt(g, 0, 0);
  svg += `<circle cx="${sx(start.x)}" cy="${sz(start.z)}" r="7" fill="#f0f"/>`;
  svg += `<text x="10" y="24" font-size="20" font-family="sans-serif">${def.name} — ${g.length.toFixed(0)}u</text></svg>`;
  await page.setViewportSize({ width: W, height: H });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: `test/out/${def.id}.png` });
  console.log(`wrote test/out/${def.id}.png`);
}
await browser.close();
