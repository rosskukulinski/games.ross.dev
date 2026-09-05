/**
 * Smoke test for Rocket Karts.
 *
 * Serves the BUILT dist under a subpath (like production), starts a solo race
 * on autopilot and asserts on game state via window.__game — never on
 * wall-clock timing, because headless SwiftShader is far slower than a GPU.
 *
 *   npm run build && node test/smoke.mjs
 *   MP=ws://127.0.0.1:8787 node test/smoke.mjs   # also runs a 2-browser online race
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, '..', 'dist');
const SHOTS = path.join(HERE, 'screenshots');
const PORT = 8098;
const BASE = `http://127.0.0.1:${PORT}/rocket-karts/`;
const MP = process.env.MP || '';
const TRACK = process.env.TRACK || 'sunny';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

function serve() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (!rel.startsWith('/rocket-karts/')) return res.writeHead(404).end('not found');
    rel = rel.slice('/rocket-karts/'.length) || 'index.html';
    const file = path.join(DIST, rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

const problems = [];
function watch(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`[${label}] console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`[${label}] pageerror: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`[${label}] failed request: ${req.url()} (${req.failure()?.errorText})`));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(page, predicate, { timeout = 30000, label = 'condition', arg, interval = 200 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await page.evaluate(predicate, arg)) return;
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function launchOptions() {
  const candidates = [
    '/opt/pw-browsers/chromium',
    path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return { executablePath: c, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
  return { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch(launchOptions());
  try {
    if (process.env.ONLINE_ONLY) {
      await online(browser);
      return finish();
    }
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 760 } });
    const page = await ctx.newPage();
    watch(page, 'solo');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__game);
    await sleep(1500);
    await page.screenshot({ path: path.join(SHOTS, '01-menu.png') });

    await page.click('#btn-solo');
    await sleep(400);
    await page.screenshot({ path: path.join(SHOTS, '02-karts.png') });
    await page.click('.kart-card[data-kart="sprout"]');
    await page.click('#btn-kart-next');
    await sleep(400);
    await page.click(`.track-card[data-track="${TRACK}"]`);
    await sleep(600);
    await page.screenshot({ path: path.join(SHOTS, '03-tracks.png') });
    await page.click('#btn-race');
    await waitFor(page, () => window.__game.mode === 'solo' && window.__game.phase === 'countdown', { label: 'countdown' });
    await sleep(700);
    console.log('  countdown:', await page.evaluate(() => {
      const n = document.getElementById('countdown');
      const r = n.getBoundingClientRect();
      const cs = getComputedStyle(n);
      return `${n.textContent} rect=${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} display=${cs.display} opacity=${cs.opacity} color=${cs.color} fontSize=${cs.fontSize} z=${cs.zIndex} anim=${cs.animationName}`;
    }));
    await page.screenshot({ path: path.join(SHOTS, '04b-kart-close.png'), clip: { x: 380, y: 380, width: 420, height: 300 } });
    await page.screenshot({ path: path.join(SHOTS, '04-countdown.png') });
    await waitFor(page, () => window.__game.phase === 'racing', { label: 'racing', timeout: 20000 });
    await page.evaluate(() => {
      window.__game.autopilot = true;
    });
    await sleep(2500);
    await page.screenshot({ path: path.join(SHOTS, '05-race.png') });
    console.log('✓ solo race started, kart on autopilot');

    // Progress: our kart must gain distance and cross checkpoints.
    const p0 = await page.evaluate(() => window.__game.local.prog);
    await waitFor(page, () => window.__game.local.next >= 2 || window.__game.local.lap >= 1, { label: 'two checkpoints', timeout: 90000 });
    const p1 = await page.evaluate(() => window.__game.local.prog);
    console.log(`✓ moving along the track (${p0.toFixed(0)} → ${p1.toFixed(0)})`);
    await page.screenshot({ path: path.join(SHOTS, '06-race-later.png') });

    // Items get picked up somewhere in the first lap or so.
    await waitFor(page, () => window.__game.snapshot?.karts.some((k) => k.item) || window.__game.local.item, { label: 'any item pickup', timeout: 90000 });
    console.log('✓ items are being picked up');
    // A taken box must actually vanish from the world for a while.
    await waitFor(page, () => window.__game.boxesVisible < window.__game.boxesTotal, { label: 'a hidden item box', timeout: 60000, interval: 100 });
    console.log('✓ taken item boxes disappear');

    // Warp forward around the loop in small hops (each under the checkpoint
    // window) until the race declares us finished.
    const L = await page.evaluate(() => window.__game.trackLength);
    for (let i = 0; i < 4 * 80; i++) {
      const done = await page.evaluate(() => window.__game.local.finished);
      if (done) break;
      const sent = await page.evaluate((s) => {
        window.__game.teleport(s, 0);
        return window.__game.reports;
      }, ((i * L) / 80) % L);
      // One hop per position report, so the race sees every step.
      await waitFor(page, (n) => window.__game.reports > n, { label: 'a position report', timeout: 5000, arg: sent, interval: 15 }).catch(() => {});
    }
    await waitFor(page, () => window.__game.local.finished === true, { label: 'our kart to finish', timeout: 60000 });
    console.log('✓ finished the race');
    await waitFor(page, () => window.__game.phase === 'finished', { label: 'results', timeout: 60000 });
    await sleep(1200);
    await page.screenshot({ path: path.join(SHOTS, '07-results.png') });
    const places = await page.evaluate(() => window.__game.snapshot.karts.map((k) => k.place).sort().join(','));
    if (places !== '1,2,3,4') throw new Error(`bad final places: ${places}`);
    console.log('✓ results screen with places 1–4');
    await ctx.close();

    if (MP) await online(browser);
    finish();
  } finally {
    await browser.close();
    server.close();
  }
}

function finish() {
  if (problems.length) {
    console.error('\n✗ page problems:\n' + problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('\n✓ no console errors, no failed requests');
  }
}

async function online(browser) {
  {
    {
      const ctxA = await browser.newContext({ viewport: { width: 1000, height: 700 } });
      const ctxB = await browser.newContext({ viewport: { width: 1000, height: 700 } });
      const a = await ctxA.newPage();
      const b = await ctxB.newPage();
      watch(a, 'A');
      watch(b, 'B');
      const url = `${BASE}?server=${encodeURIComponent(MP)}`;
      await a.goto(url, { waitUntil: 'networkidle' });
      await a.waitForFunction(() => !!window.__game);
      await a.click('#btn-friend');
      await a.fill('#name-input', 'Ada');
      await a.click('#btn-host');
      await waitFor(a, () => window.__game.mode === 'online' && window.__game.lobby?.phase === 'lobby', { label: 'host lobby' });
      const code = await a.evaluate(() => window.__game.code);
      console.log(`✓ hosted room ${code}`);
      await sleep(800);
      await a.screenshot({ path: path.join(SHOTS, '08-lobby-host.png') });

      await b.goto(`${url}#${code}`, { waitUntil: 'networkidle' });
      await b.waitForFunction(() => !!window.__game);
      await b.fill('#name-input-join', 'Ben');
      await b.click('#btn-join-go');
      await waitFor(b, () => window.__game.lobby?.players.filter((p) => p.kind === 'human').length === 2, { label: 'B in lobby' });
      await waitFor(a, () => window.__game.lobby?.players.filter((p) => p.kind === 'human').length === 2, { label: 'A sees B' });
      console.log('✓ both in the lobby');
      await b.click('#btn-ready');
      await waitFor(a, () => window.__game.lobby?.players.some((p) => p.ready && !p.host), { label: 'B ready' });
      await sleep(500);
      await a.screenshot({ path: path.join(SHOTS, '09-lobby-ready.png') });
      await a.click('#btn-start');
      await waitFor(a, () => window.__game.phase === 'racing', { label: 'A racing', timeout: 30000 });
      await waitFor(b, () => window.__game.phase === 'racing', { label: 'B racing', timeout: 30000 });
      await a.evaluate(() => (window.__game.autopilot = true));
      await b.evaluate(() => (window.__game.autopilot = true));
      await sleep(4000);
      const slotA = await a.evaluate(() => window.__game.slot);
      const slotB = await b.evaluate(() => window.__game.slot);
      if (slotA === slotB) throw new Error('both players got the same slot');
      // B should see A's kart where A says it is (allowing for interpolation lag)
      const posA = await a.evaluate(() => ({ x: window.__game.local.x, z: window.__game.local.z }));
      const seenByB = await b.evaluate((s) => window.__game.snapshot.karts[s], slotA);
      const drift = Math.hypot(posA.x - seenByB.x, posA.z - seenByB.z);
      if (drift > 12) throw new Error(`A's kart drifted ${drift.toFixed(1)} units between browsers`);
      console.log(`✓ online race running, positions agree within ${drift.toFixed(1)} units`);
      await a.screenshot({ path: path.join(SHOTS, '10-online-a.png') });
      await b.screenshot({ path: path.join(SHOTS, '11-online-b.png') });
      await ctxB.close();
      await waitFor(a, () => window.__game.lobby?.players[1]?.kind === 'bot' || window.__game.lobby?.players.filter((p) => p.kind === 'human').length === 1, { label: 'A notices B left', timeout: 15000 });
      console.log('✓ a dropped driver is handed to the computer');
      await ctxA.close();
    }
  }
}

main().catch((err) => {
  console.error('✗ ' + err.message);
  if (problems.length) console.error(problems.join('\n'));
  process.exit(1);
});
