/**
 * Smoke test for Air Hockey.
 *
 * Serves the BUILT dist under a subpath (like production) and drives two
 * independent browser contexts through a real networked match against a
 * locally running `wrangler dev`, then plays a solo match against the bot.
 *
 * Usage:
 *   node test/smoke.mjs                 # expects wrangler dev on :8787
 *   MP=ws://127.0.0.1:8787 node test/smoke.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, '..', 'dist');
const SHOTS = path.join(HERE, 'screenshots');
const PORT = 8099;
const BASE = `http://127.0.0.1:${PORT}/air-hockey/`;
const MP = process.env.MP || 'ws://127.0.0.1:8787';

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
};

function serve() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (!rel.startsWith('/air-hockey/')) {
      res.writeHead(404).end('not found');
      return;
    }
    rel = rel.slice('/air-hockey/'.length) || 'index.html';
    const file = path.join(DIST, rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
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
  page.on('requestfailed', (req) => {
    problems.push(`[${label}] failed request: ${req.url()} (${req.failure()?.errorText})`);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Drive a paddle like a player would: sit behind the puck when it is in your
 * half so contact sends it upfield, otherwise fall back to defend. Chasing
 * directly onto the puck just smothers it.
 */
const STRIKE = () => {
  const g = window.__game;
  const s = g.snapshot;
  if (!s) return;
  const mine = g.side;
  const own = mine === 0;
  const inMyHalf = own ? s.puck.y > 160 * 0.45 : s.puck.y < 160 * 0.55;
  if (inMyHalf) {
    g.setTarget(s.puck.x, s.puck.y + (own ? 11 : -11));
  } else {
    g.setTarget(50, own ? 140 : 20);
  }
};

async function waitFor(page, predicate, { timeout = 30000, label = 'condition' } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await page.evaluate(predicate)) return;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve();
  // The preinstalled Chromium may not match this playwright build's expected
  // revision, so point at it directly.
  const executablePath = fs.existsSync('/opt/pw-browsers/chromium')
    ? '/opt/pw-browsers/chromium'
    : undefined;
  const browser = await chromium.launch({ executablePath });

  try {
    // --- Solo vs bot -------------------------------------------------------
    const solo = await browser.newContext({ viewport: { width: 820, height: 1000 } });
    const p1 = await solo.newPage();
    watch(p1, 'solo');
    await p1.goto(BASE, { waitUntil: 'networkidle' });
    await p1.waitForFunction(() => !!window.__game);
    await sleep(600);
    await p1.screenshot({ path: path.join(SHOTS, '01-menu.png') });

    await p1.click('#btn-solo');
    await waitFor(p1, () => window.__game.mode === 'solo', { label: 'solo mode' });
    await waitFor(p1, () => window.__game.snapshot?.phase === 2, { label: 'solo play phase' });

    // Play properly so the bot actually has a game to play.
    const chase = setInterval(() => {
      p1.evaluate(STRIKE).catch(() => {});
    }, 60);

    await waitFor(p1, () => (window.__game.snapshot?.scores ?? [0, 0]).some((v) => v > 0), {
      timeout: 60000,
      label: 'a goal in solo mode',
    });
    await p1.screenshot({ path: path.join(SHOTS, '02-solo-play.png') });
    clearInterval(chase);
    const soloScores = await p1.evaluate(() => window.__game.snapshot.scores);
    console.log(`✓ solo: scored ${soloScores.join('–')}`);
    await solo.close();

    // --- Two browsers, one table -------------------------------------------
    const ctxA = await browser.newContext({ viewport: { width: 820, height: 1000 } });
    const ctxB = await browser.newContext({ viewport: { width: 820, height: 1000 } });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    watch(a, 'A');
    watch(b, 'B');

    const url = `${BASE}?server=${encodeURIComponent(MP)}`;
    await a.goto(url, { waitUntil: 'networkidle' });
    await a.waitForFunction(() => !!window.__game);

    await a.click('#btn-friend');
    await a.click('#btn-host');
    await waitFor(a, () => window.__game.code?.length === 4, { label: 'a room code' });
    const code = await a.evaluate(() => window.__game.code);
    console.log(`✓ hosted room ${code}`);
    await sleep(600); // let the panel finish its entrance animation
    await a.screenshot({ path: path.join(SHOTS, '03-room-code.png') });

    // Second device follows the invite link.
    await b.goto(`${url}#${code}`, { waitUntil: 'networkidle' });
    await b.waitForFunction(() => !!window.__game);

    await waitFor(a, () => window.__game.opponentPresent === true, { label: 'player 2 to join' });
    await waitFor(b, () => window.__game.opponentPresent === true, { label: 'player 1 visible' });
    const sides = [await a.evaluate(() => window.__game.side), await b.evaluate(() => window.__game.side)];
    if (sides[0] === sides[1]) throw new Error(`both players got side ${sides[0]}`);
    console.log(`✓ both connected (sides ${sides.join(' and ')})`);

    await waitFor(a, () => window.__game.snapshot?.phase === 2, { label: 'match to start' });

    // A plays properly; B parks in a corner so goals actually happen.
    const drive = setInterval(() => {
      a.evaluate(STRIKE).catch(() => {});
      // B hides in a corner so goals actually happen.
      b.evaluate(() => window.__game.setTarget(12, 12)).catch(() => {});
    }, 60);

    await waitFor(a, () => (window.__game.snapshot?.scores ?? [0, 0]).some((v) => v > 0), {
      timeout: 60000,
      label: 'a goal in the networked match',
    });

    // Both browsers must agree about the score — that is the whole point.
    await sleep(600);
    const scoreA = await a.evaluate(() => window.__game.snapshot.scores);
    const scoreB = await b.evaluate(() => window.__game.snapshot.scores);
    if (scoreA.join() !== scoreB.join()) {
      throw new Error(`scores disagree: A saw ${scoreA} but B saw ${scoreB}`);
    }
    console.log(`✓ both browsers agree on the score: ${scoreA.join('–')}`);

    // Puck positions should agree closely too (allowing for interpolation).
    const puckA = await a.evaluate(() => window.__game.snapshot.puck);
    const puckB = await b.evaluate(() => window.__game.snapshot.puck);
    const drift = Math.hypot(puckA.x - puckB.x, puckA.y - puckB.y);
    if (drift > 25) throw new Error(`puck drifted ${drift.toFixed(1)} units between browsers`);
    console.log(`✓ puck agrees within ${drift.toFixed(1)} units`);

    await a.screenshot({ path: path.join(SHOTS, '04-online-a.png') });
    await b.screenshot({ path: path.join(SHOTS, '05-online-b.png') });
    clearInterval(drive);

    // --- Disconnect handling -----------------------------------------------
    await ctxB.close();
    await waitFor(a, () => window.__game.opponentPresent === false, {
      label: 'A to notice B left',
    });
    console.log('✓ remaining player sees the disconnect');
    await sleep(600);
    await a.screenshot({ path: path.join(SHOTS, '06-opponent-left.png') });

    await ctxA.close();

    if (problems.length) {
      console.error('\n✗ page problems:\n' + problems.join('\n'));
      process.exitCode = 1;
    } else {
      console.log('\n✓ no console errors, no failed requests');
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('✗ ' + err.message);
  console.error(problems.join('\n'));
  process.exit(1);
});
