/**
 * Autoplay pacing analysis. Runs the simulation in game time (not wall time)
 * via the debug sim hook, with a naive "flap when the ball is near" player.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const BASE = '/pinball/';
const PORT = 5189;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]).slice(BASE.length) || 'index.html';
  const f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 500, height: 620 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`http://localhost:${PORT}${BASE}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__game);

const games = Number(process.argv[2] ?? 3);
const all = [];
for (let n = 0; n < games; n++) {
  // Fresh page per game so nothing leaks between runs.
  await page.goto(`http://localhost:${PORT}${BASE}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__game);
  all.push(await page.evaluate(async () => {
    const g = window.__game;
    const bins = { top: 0, bumpers: 0, mid: 0, lower: 0, flippers: 0, lane: 0 };
    let samples = 0, still = 0, maxStill = 0, flips = 0;
    const ballLives = [];
    let lastBall = 1, ballStartT = 0, tNow = 0;
    let lastFlipT = -1, flipSide = 0, flipUntil = -1;

    g.start();
    const seen = {};
    // 10 minutes of game time is plenty for a 3-ball game.
    for (let chunk = 0; chunk < 600; chunk++) {
      let done = false;
      g.sim(1, (t) => {
        tNow += 1 / 120;
        const s = g.state();
        seen[s.state] = (seen[s.state] ?? 0) + 1;
        if (s.state === 'gameover') {
          if (flipUntil > 0) { g.flip(flipSide, false); flipUntil = -1; }
          done = true;
          return;
        }
        if (s.state === 'launch') g.launch(0.55 + Math.random() * 0.45);
        if (s.ballNum !== lastBall) {
          ballLives.push(tNow - ballStartT);
          ballStartT = tNow;
          lastBall = s.ballNum;
        }
        const b = s.ball;
        if (!b) return;
        samples++;
        if (b.x > 760) bins.lane++;
        else if (b.y < 520) bins.top++;
        else if (b.y < 790) bins.bumpers++;
        else if (b.y < 1070) bins.mid++;
        else if (b.y < 1230) bins.lower++;
        else bins.flippers++;

        if (Math.hypot(b.vx, b.vy) < 60) { still++; maxStill = Math.max(maxStill, still); }
        else still = 0;

        if (flipUntil > 0 && tNow > flipUntil) { g.flip(flipSide, false); flipUntil = -1; }
        if (flipUntil < 0 && b.y > 1150 && b.y < 1320 && tNow - lastFlipT > 0.18) {
          lastFlipT = tNow;
          flipSide = b.x < 402 ? -1 : 1;
          g.flip(flipSide, true);
          flipUntil = tNow + 0.1;
          flips++;
        }
        void t;
      });
      if (done) break;
    }
    const s = g.state();
    ballLives.push(tNow - ballStartT);
    return { final: s, bins, samples, maxStill: maxStill / 120, ballLives, flips, gameTime: tNow, seen };
  }));
}

for (const [i, r] of all.entries()) {
  const pct = (n) => `${((n / r.samples) * 100).toFixed(0)}%`;
  console.log(`--- game ${i + 1} ---`);
  console.log(`  end: ${r.final.state}  score ${r.final.score.toLocaleString()}  mult ${r.final.multiplier}x  game time ${r.gameTime.toFixed(0)}s`);
  console.log(`  ball lifetimes: ${r.ballLives.map((v) => v.toFixed(0) + 's').join(', ')}`);
  console.log(`  zones: ${Object.entries(r.bins).map(([k, v]) => `${k} ${pct(v)}`).join('  ')}`);
  console.log(`  longest stall: ${r.maxStill.toFixed(1)}s   flips: ${r.flips}`);
  console.log(`  features: ${JSON.stringify(r.final.stats)}`);
}
const scores = all.map((r) => r.final.score);
console.log(`\nscores: ${scores.map((s) => s.toLocaleString()).join(', ')}`);

await browser.close();
server.close();
