#!/usr/bin/env node
/**
 * Downloads the site's Google Fonts as local woff2 files and writes the
 * matching @font-face CSS, so nothing on the page reaches for the network.
 *
 * Run with `node scripts/fetch-fonts.js` after changing a family below. The
 * downloaded fonts are committed, so the build never needs this.
 */

const fs = require('fs');
const path = require('path');

// Google serves modern woff2 only to browser user agents.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ROOT = path.join(__dirname, '..');

// Which subsets we keep. Latin + latin-ext covers English plus accented names.
const KEEP = new Set(['latin', 'latin-ext']);

const FAMILIES = {
  fredoka: { query: 'Fredoka:wght@400;600;700', name: 'Fredoka' },
  bangers: { query: 'Bangers', name: 'Bangers' },
  'patrick-hand': { query: 'Patrick+Hand', name: 'Patrick Hand' },
};

// slug -> destination dirs (css file dir; woff2 go in <dir>/fonts)
const TARGETS = [
  { dir: path.join(ROOT, 'landing'), families: ['fredoka'] },
  { dir: path.join(ROOT, 'games/sir-name-alot/public'), families: ['fredoka', 'bangers'] },
  { dir: path.join(ROOT, 'games/guess-the-drawing/css'), families: ['patrick-hand'] },
];

async function getCss(query) {
  const url = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

// Parse the CSS into { subset, weight, style, url } records.
function parseFaces(css) {
  const faces = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const subset = m[1];
    const body = m[2];
    const weight = (body.match(/font-weight:\s*([^;]+);/) || [])[1]?.trim() || '400';
    const style = (body.match(/font-style:\s*([^;]+);/) || [])[1]?.trim() || 'normal';
    const src = (body.match(/url\(([^)]+)\)/) || [])[1];
    const range = (body.match(/unicode-range:\s*([^;]+);/) || [])[1]?.trim();
    if (src) faces.push({ subset, weight, style, url: src, range });
  }
  return faces;
}

(async () => {
  const cssByFamily = {};
  const bytesByFamily = {};

  for (const [slug, { query, name }] of Object.entries(FAMILIES)) {
    const css = await getCss(query);
    const faces = parseFaces(css).filter((f) => KEEP.has(f.subset));
    if (!faces.length) throw new Error(`no kept faces for ${slug}`);

    const rules = [];
    const files = {};
    for (const f of faces) {
      const file = `${slug}-${f.weight}-${f.subset}.woff2`;
      const res = await fetch(f.url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`${f.url} -> ${res.status}`);
      files[file] = Buffer.from(await res.arrayBuffer());
      rules.push(
        `@font-face {\n` +
          `  font-family: '${name}';\n` +
          `  font-style: ${f.style};\n` +
          `  font-weight: ${f.weight};\n` +
          `  font-display: swap;\n` +
          `  src: url('./fonts/${file}') format('woff2');\n` +
          `  unicode-range: ${f.range};\n` +
          `}`
      );
    }
    cssByFamily[slug] = rules.join('\n');
    bytesByFamily[slug] = files;
    console.log(`${slug}: ${faces.length} faces, ${Object.values(files).reduce((a, b) => a + b.length, 0)} bytes`);
  }

  for (const { dir, families } of TARGETS) {
    const fontsDir = path.join(dir, 'fonts');
    fs.mkdirSync(fontsDir, { recursive: true });
    const parts = [
      '/* Self-hosted Google Fonts — keeps the site working with no network. */',
      '/* Regenerate with scripts/fetch-fonts.js if a family changes. */',
      '',
    ];
    for (const slug of families) {
      parts.push(cssByFamily[slug]);
      for (const [file, buf] of Object.entries(bytesByFamily[slug])) {
        fs.writeFileSync(path.join(fontsDir, file), buf);
      }
    }
    fs.writeFileSync(path.join(dir, 'fonts.css'), parts.join('\n') + '\n');
    console.log(`wrote ${path.relative(ROOT, dir)}/fonts.css (${families.join(', ')})`);
  }
})();
