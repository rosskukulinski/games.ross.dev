/**
 * Smoke test for Hole Munchers.
 *
 * Serves the BUILT dist under a subpath (like production), plays a solo game
 * with the built-in autopilot, and — when a local `wrangler dev` is reachable
 * — drives two independent browser contexts through a real networked arena.
 *
 * Usage:
 *   node test/smoke.mjs                 # networked half needs wrangler dev on :8787
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
const PORT = 8098;
const BASE = `http://127.0.0.1:${PORT}/hole-io/`;
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
    if (!rel.startsWith('/hole-io/')) {
      res.writeHead(404).end('not found');
      return;
    }
    rel = rel.slice('/hole-io/'.length) || 'index.html';
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

async function serverReachable() {
  const url = MP.replace(/^ws/, 'http') + '/health';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const body = await res.json();
    return body.ok === true;
  } catch {
    return false;
  }
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
    // --- Solo with bots ----------------------------------------------------
    const solo = await browser.newContext({ viewport: { width: 900, height: 660 } });
    const p1 = await solo.newPage();
    watch(p1, 'solo');
    await p1.goto(BASE, { waitUntil: 'networkidle' });
    await p1.waitForFunction(() => !!window.__game);
    await sleep(600);
    await p1.screenshot({ path: path.join(SHOTS, '01-menu.png') });

    await p1.click('#btn-solo');
    await waitFor(p1, () => window.__game.mode === 'solo', { label: 'solo mode' });
    await waitFor(p1, () => window.__game.snapshot?.phase === 2, { label: 'play phase' });

    const propsAtStart = await p1.evaluate(() => window.__game.propsLeft);
    await p1.evaluate(() => window.__game.setAuto(true));

    await waitFor(p1, () => window.__game.myScore > 0, {
      timeout: 60000,
      label: 'the autopilot to eat something',
    });
    await waitFor(p1, () => window.__game.myScore >= 12, {
      timeout: 90000,
      label: 'the hole to grow a meaningful score',
    });
    await sleep(400);
    await p1.screenshot({ path: path.join(SHOTS, '02-solo-play.png') });

    const soloScore = await p1.evaluate(() => window.__game.myScore);
    const propsLeft = await p1.evaluate(() => window.__game.propsLeft);
    if (propsLeft >= propsAtStart) {
      throw new Error(`props never disappeared (${propsAtStart} -> ${propsLeft})`);
    }
    const myHole = await p1.evaluate(() => {
      const s = window.__game.snapshot;
      return s.holes.find((h) => h.id === window.__game.myId);
    });
    if (!(myHole.r > 11)) throw new Error(`hole never grew (r=${myHole.r})`);
    console.log(
      `✓ solo: score ${soloScore}, radius ${myHole.r.toFixed(1)}, props ${propsAtStart}→${propsLeft}`
    );
    const bots = await p1.evaluate(() => window.__game.roster.filter((r) => r.bot).length);
    if (bots < 4) throw new Error(`expected bots in solo arena, saw ${bots}`);
    console.log(`✓ solo: ${bots} bots sharing the arena`);
    await solo.close();

    // --- Two browsers, one arena -------------------------------------------
    if (!(await serverReachable())) {
      console.log('⚠ no local wrangler dev on :8787 — skipping the networked half');
      return;
    }

    const ctxA = await browser.newContext({ viewport: { width: 900, height: 660 } });
    const ctxB = await browser.newContext({ viewport: { width: 900, height: 660 } });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    watch(a, 'A');
    watch(b, 'B');

    const url = `${BASE}?server=${encodeURIComponent(MP)}`;
    await a.goto(url, { waitUntil: 'networkidle' });
    await a.waitForFunction(() => !!window.__game);
    await a.fill('#name-input', 'Alice');
    await a.click('#btn-host');
    await waitFor(a, () => window.__game.mode === 'online' && window.__game.code?.length === 4, {
      label: 'a room code',
    });
    const code = await a.evaluate(() => window.__game.code);
    console.log(`✓ hosted arena ${code}`);

    // Second device follows the invite link.
    await b.goto(`${url}#${code}`, { waitUntil: 'networkidle' });
    await b.waitForFunction(() => !!window.__game);

    const twoHumans = () => window.__game.roster.filter((r) => !r.bot).length >= 2;
    await waitFor(a, twoHumans, { label: 'A to see two humans' });
    await waitFor(b, twoHumans, { label: 'B to see two humans' });
    const ids = [await a.evaluate(() => window.__game.myId), await b.evaluate(() => window.__game.myId)];
    if (ids[0] === ids[1]) throw new Error(`both players got id ${ids[0]}`);
    console.log(`✓ both connected (ids ${ids.join(' and ')})`);

    await waitFor(a, () => window.__game.snapshot?.phase === 2, { label: 'arena to be live' });
    await a.evaluate(() => window.__game.setAuto(true));

    await waitFor(a, () => window.__game.myScore > 0, {
      timeout: 60000,
      label: 'A to eat something online',
    });
    await sleep(600);

    // Both browsers must agree about A's score — that is the whole point.
    const scoreSeenByA = await a.evaluate(() => window.__game.myScore);
    const scoreSeenByB = await b.evaluate(
      (aId) => window.__game.snapshot.holes.find((h) => h.id === aId)?.score,
      ids[0]
    );
    if (typeof scoreSeenByB !== 'number' || Math.abs(scoreSeenByA - scoreSeenByB) > 6) {
      throw new Error(`scores disagree: A sees ${scoreSeenByA}, B sees ${scoreSeenByB}`);
    }
    console.log(`✓ both browsers agree on A's score (~${scoreSeenByA})`);

    // Both browsers should agree which props are gone (same seed, same events).
    const propsA = await a.evaluate(() => window.__game.propsLeft);
    const propsB = await b.evaluate(() => window.__game.propsLeft);
    if (Math.abs(propsA - propsB) > 4) {
      throw new Error(`prop state disagrees: A has ${propsA}, B has ${propsB}`);
    }
    console.log(`✓ arenas agree on remaining props (${propsA} vs ${propsB})`);

    await a.screenshot({ path: path.join(SHOTS, '03-online-a.png') });
    await b.screenshot({ path: path.join(SHOTS, '04-online-b.png') });

    // --- Disconnect handling -----------------------------------------------
    await ctxB.close();
    await waitFor(a, () => window.__game.roster.filter((r) => !r.bot).length === 1, {
      label: 'A to notice B left',
    });
    console.log('✓ remaining player sees the disconnect');
    await ctxA.close();
  } finally {
    await browser.close();
    server.close();

    if (problems.length) {
      console.error('\n✗ page problems:\n' + problems.join('\n'));
      process.exitCode = 1;
    } else {
      console.log('✓ no console errors, no failed requests');
    }
  }
}

main().catch((err) => {
  console.error('✗ ' + err.message);
  if (problems.length) console.error(problems.join('\n'));
  process.exit(1);
});
