/**
 * Smoke test + screenshot loop. Serves dist/ under a subpath (like production)
 * and drives the built game with the window.__game debug hook.
 *
 * Headless SwiftShader is far slower than a GPU, so every wait polls game
 * state — never wall-clock timing.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const BASE = '/pinball/';
const PORT = 5188;
const SHOTS = path.resolve('shots');
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith(BASE)) { res.writeHead(404); res.end('nope'); return; }
  p = p.slice(BASE.length) || 'index.html';
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const errors = [];
const failed = [];
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => failed.push(`${r.url()} — ${r.failure()?.errorText}`));

await page.goto(`http://localhost:${PORT}${BASE}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });

const state = () => page.evaluate(() => window.__game.state());
// Poll game state rather than sleeping — SwiftShader dilates frame time.
async function until(pred, label, timeout = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await state();
    if (pred(s)) return s;
    await page.waitForTimeout(120);
  }
  throw new Error(`timeout waiting for ${label}: ${JSON.stringify(await state())}`);
}
const shot = async (name) => {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  console.log(`  shot: ${name}.png`);
};

const results = [];
const check = (ok, msg) => { results.push([ok, msg]); console.log(`  ${ok ? 'PASS' : 'FAIL'} ${msg}`); };

console.log('start screen');
await page.waitForTimeout(1200);
await shot('01-start');
check((await state()).state === 'start', 'boots to start screen');

console.log('launch');
await page.evaluate(() => window.__game.start());
await until((s) => s.state === 'launch', 'plunger ready');
await page.waitForTimeout(600);
await shot('02-plunger');
await page.evaluate(() => window.__game.launch(1));
await until((s) => s.state === 'play', 'ball in play');
check(true, 'ball launches');

// Let it run around the table for a while, flipping now and then.
console.log('gameplay');
for (let i = 0; i < 26; i++) {
  await page.waitForTimeout(280);
  const s = await state();
  if (s.state === 'launch') await page.evaluate(() => window.__game.launch(0.95));
  if (s.state === 'gameover') break;
  await page.evaluate(() => { window.__game.flip(-1, true); window.__game.flip(1, true); });
  await page.waitForTimeout(90);
  await page.evaluate(() => { window.__game.flip(-1, false); window.__game.flip(1, false); });
  if (i === 6) await shot('03-play');
}
const mid = await state();
check(mid.score > 0, `score increased (${mid.score})`);
await shot('04-play-late');

// Force some big-ticket effects for a look at the juice.
console.log('effects');
await page.evaluate(() => window.__game.place(402, 300, 60, 300));
await until((s) => s.score > mid.score, 'saucer / table scoring', 25000).catch(() => {});
await page.waitForTimeout(400);
await shot('05-effects');

// Flipper close-up
await page.evaluate(() => window.__game.place(330, 1150, 0, 240));
await page.waitForTimeout(500);
await page.evaluate(() => window.__game.flip(-1, true));
await page.waitForTimeout(160);
await shot('06-flippers');
await page.evaluate(() => window.__game.flip(-1, false));

// Drain out the rest of the game so the game-over screen gets a look too.
console.log('game over screen');
for (let i = 0; i < 40; i++) {
  const s = await state();
  if (s.state === 'gameover') break;
  await page.evaluate(() => { window.__game.place(402, 1400, 0, 700); window.__game.sim(2.5); });
  const s2 = await state();
  if (s2.state === 'launch') await page.evaluate(() => window.__game.launch(0.9));
  await page.evaluate(() => window.__game.sim(1.2));
}
const over = await state();
check(over.state === 'gameover', `reaches game over (score ${over.score})`);
await page.waitForTimeout(900);
await shot('07-gameover');

const end = await state();
check(end.ballsInPlay >= 0, 'ball bookkeeping sane');
check(errors.length === 0, `zero console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
check(failed.length === 0, `zero failed requests${failed.length ? `: ${failed.join(' | ')}` : ''}`);

await browser.close();
server.close();

const bad = results.filter(([ok]) => !ok);
console.log(bad.length ? `\n${bad.length} FAILURES` : '\nAll checks passed');
process.exit(bad.length ? 1 : 0);
