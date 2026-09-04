// Screenshot a solo race on every track (start line + mid-race), for eyeballing themes.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, '..', 'dist');
const PORT = 8096;
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/rocket-karts\//, '') || 'index.html';
  const file = path.join(DIST, rel);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const exe = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const track of (process.env.TRACKS || 'sunny,shores,neon').split(',')) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 760 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/rocket-karts/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__game);
  await page.click('#btn-solo');
  await page.click('#btn-kart-next');
  await page.click(`.track-card[data-track="${track}"]`);
  await sleep(800);
  await page.screenshot({ path: path.join(HERE, 'screenshots', `tour-${track}-0-menu.png`) });
  await page.click('#btn-race');
  await page.waitForFunction(() => window.__game.phase === 'countdown');
  await sleep(1000);
  await page.screenshot({ path: path.join(HERE, 'screenshots', `tour-${track}-1-grid.png`) });
  await page.waitForFunction(() => window.__game.phase === 'racing', null, { timeout: 20000 });
  await page.evaluate(() => (window.__game.autopilot = true));
  await sleep(9000);
  await page.screenshot({ path: path.join(HERE, 'screenshots', `tour-${track}-2-race.png`) });
  await sleep(9000);
  await page.screenshot({ path: path.join(HERE, 'screenshots', `tour-${track}-3-race.png`) });
  await page.close();
  console.log('shot', track);
}
await browser.close();
server.close();
