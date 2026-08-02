#!/usr/bin/env node
/**
 * Checks that dist/ really plays offline.
 *
 *   node scripts/verify-offline.js
 *
 * Serves dist/ through a server that imitates Cloudflare Pages (including the
 * 308 from /index.html to /), lets the service worker precache, then kills the
 * server so nothing can possibly come from the network, and loads every game.
 *
 * The Pages-like redirects matter: a plain static server does not redirect
 * /index.html, which hides the "Response served by service worker has
 * redirections" failure that Safari — and only Safari — raises.
 *
 * Needs Playwright's Chromium (`npx playwright install chromium`).
 */

const { spawn } = require('child_process');
const { execSync } = require('child_process');
const path = require('path');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {}
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return require(path.join(globalRoot, 'playwright'));
  } catch {}
  console.error('❌ Playwright not found. Install it with:\n   npm i -g playwright && npx playwright install chromium');
  process.exit(1);
}

const { chromium } = loadPlaywright();

const PORT = Number(process.env.PORT || 8130);
const BASE = `http://localhost:${PORT}`;
const GAMES = require('./games-list.js');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'pages-server.js')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  await wait(1000);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const external = new Set();
  context.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(BASE) && !url.startsWith('data:') && !url.startsWith('blob:')) external.add(url);
  });

  const failures = [];

  console.log('→ precaching');
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  // The download is opt-in, so a real visitor's click is what starts it.
  await page.click('#offline-save');
  await page.waitForFunction(
    () => document.querySelector('#offline-status')?.classList.contains('is-done'),
    null,
    { timeout: 300000 }
  );

  const { name, entries } = await page.evaluate(async () => {
    const names = await caches.keys();
    return { name: names[0], entries: (await (await caches.open(names[0])).keys()).length };
  });
  console.log(`   cache "${name}": ${entries} entries`);

  // Safari refuses to serve a navigation response whose redirect flag is set.
  // Chromium happily serves it, so assert the invariant rather than trusting
  // that the page loaded here.
  const redirected = await page.evaluate(async () => {
    const cache = await caches.open((await caches.keys())[0]);
    const bad = [];
    for (const request of await cache.keys()) {
      const res = await cache.match(request);
      if (res && res.redirected) bad.push(new URL(request.url).pathname);
    }
    return bad;
  });
  if (redirected.length) {
    failures.push('redirect flags');
    console.log(`❌ ${redirected.length} cached response(s) carry a redirect flag — Safari will refuse these:`);
    for (const p of redirected.slice(0, 6)) console.log(`     ${p}`);
  } else {
    console.log('✅ no cached response carries a redirect flag');
  }

  console.log('\n→ killing the server: only the cache can answer now');
  server.kill('SIGKILL');
  await wait(1000);

  const reachable = await page.evaluate(async () => {
    try {
      await fetch(`/not-cached-${Date.now()}`, { cache: 'no-store' });
      return true;
    } catch {
      return false;
    }
  });
  if (reachable) {
    failures.push('server still up');
    console.log('❌ the origin still answers — the rest of this run proves nothing');
  } else {
    console.log('   origin is down\n');
  }

  for (const label of ['', ...GAMES]) {
    const url = `${BASE}/${label}${label ? '/' : ''}`;
    const testPage = await context.newPage();
    const problems = [];
    testPage.on('requestfailed', (r) => problems.push(`${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
    testPage.on('pageerror', (e) => problems.push(String(e).split('\n')[0]));

    let detail;
    try {
      const res = await testPage.goto(url, { waitUntil: 'load', timeout: 20000 });
      await testPage.waitForTimeout(1500);
      detail = `${res.status()} "${await testPage.title()}"`;
    } catch (err) {
      problems.push(String(err).split('\n')[0]);
      detail = 'did not load';
    }

    const ok = problems.length === 0 && detail.startsWith('200');
    if (!ok) failures.push(label || 'landing');
    console.log(`${ok ? '✅' : '❌'} ${(label || 'landing').padEnd(22)} ${detail}${problems.length ? ` — ${problems[0]}` : ''}`);
    await testPage.close();
  }

  // Safari asks for media with a Range header and rejects a plain 200.
  const range = await page.evaluate(async () => {
    const res = await fetch('/kpop-rythm-tap/songs/golden.mp3', { headers: { Range: 'bytes=0-99' } });
    return { status: res.status, bytes: (await res.arrayBuffer()).byteLength };
  });
  const rangeOk = range.status === 206 && range.bytes === 100;
  if (!rangeOk) failures.push('range request');
  console.log(`${rangeOk ? '✅' : '❌'} range request on cached audio: ${JSON.stringify(range)}`);

  if (external.size) {
    failures.push('external requests');
    console.log('❌ requests left the origin (these break offline):');
    for (const url of external) console.log(`     ${url}`);
  } else {
    console.log('✅ nothing reaches off-origin');
  }

  await browser.close();

  console.log(failures.length ? `\n💥 failed: ${failures.join(', ')}` : '\n🎉 offline verified');
  process.exit(failures.length ? 1 : 0);
})();
