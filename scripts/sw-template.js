/**
 * Service worker template. `scripts/build-all.js` fills in the placeholders
 * below with the real build hash and file list and writes the result to
 * dist/sw.js — do not edit dist/sw.js directly. Keep the placeholder tokens
 * out of comments and strings; the build substitutes them by name.
 *
 * Strategy: cache-first for everything. The whole site is static and every
 * Vite asset filename is content-hashed, so a cache hit is always correct for
 * the build that produced this worker. A new deploy changes __VERSION__, which
 * changes these bytes, which is what makes the browser install a fresh worker
 * and drop the previous cache.
 */

const VERSION = '__VERSION__';
const CACHE = `arcade-${VERSION}`;

// [path, byteLength] for every file in the build, used for download progress.
const ASSETS = __ASSETS__;

// Cached during install so the arcade opens instantly even if the full
// download is still running. Everything else is fetched after activation.
const SHELL = __SHELL__;

const ASSET_PATHS = ASSETS.map(([path]) => path);
const TOTAL_BYTES = ASSETS.reduce((sum, [, bytes]) => sum + bytes, 0);

/**
 * Safari rejects a navigation response whose `redirected` flag is set, with
 * "Response served by service worker has redirections" — so a redirect that
 * was followed on the way into the cache breaks the page offline. Rebuilding
 * the response drops the flag. Cache.addAll gives no chance to do this, which
 * is why precaching is written out by hand below.
 */
async function withoutRedirectFlag(response) {
  if (!response.redirected) return response;
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function fetchAndCache(cache, path) {
  // reload bypasses the HTTP cache so a precache always stores fresh bytes.
  const response = await fetch(new Request(path, { cache: 'reload' }));
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
  await cache.put(path, await withoutRedirectFlag(response));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Tolerate individual failures. A worker that cannot finish installing
      // can never replace a broken one already serving this site, and the
      // background precache refetches whatever is missing anyway.
      await Promise.allSettled(SHELL.map((path) => fetchAndCache(cache, path)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

// --- Precaching the full library ---

let precaching = null;

async function broadcast(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage(message);
}

async function cachedBytes(cache) {
  const cached = new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
  let bytes = 0;
  let count = 0;
  for (const [path, size] of ASSETS) {
    if (cached.has(new URL(path, self.registration.scope).pathname)) {
      bytes += size;
      count++;
    }
  }
  return { bytes, count, cached };
}

async function precacheAll() {
  const cache = await caches.open(CACHE);
  let { bytes, count, cached } = await cachedBytes(cache);

  const pending = ASSETS.filter(
    ([path]) => !cached.has(new URL(path, self.registration.scope).pathname)
  );
  const failed = [];

  await broadcast({
    type: 'precache-progress',
    done: count,
    total: ASSETS.length,
    bytes,
    totalBytes: TOTAL_BYTES,
  });

  // Sequential with a small amount of overlap: enough to keep the connection
  // busy without opening dozens of requests for multi-megabyte song files.
  const CONCURRENCY = 4;
  let index = 0;

  async function worker() {
    while (index < pending.length) {
      const [path, size] = pending[index++];
      try {
        await fetchAndCache(cache, path);
        bytes += size;
      } catch (err) {
        failed.push(path);
      }
      count++;
      await broadcast({
        type: 'precache-progress',
        done: count,
        total: ASSETS.length,
        bytes,
        totalBytes: TOTAL_BYTES,
      });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await broadcast({ type: 'precache-complete', failed: failed.length, total: ASSETS.length });
  precaching = null;
}

self.addEventListener('message', (event) => {
  if (event.data === 'precache') {
    if (!precaching) precaching = precacheAll();
    event.waitUntil(precaching);
  } else if (event.data === 'status') {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        const { bytes, count } = await cachedBytes(cache);
        await broadcast({
          type: 'precache-progress',
          done: count,
          total: ASSETS.length,
          bytes,
          totalBytes: TOTAL_BYTES,
        });
      })()
    );
  }
});

// --- Serving ---

/**
 * Safari requests audio and video with a Range header and refuses a plain 200
 * in reply, which would silently break the K-Pop songs offline. The Cache API
 * ignores Range on lookup and hands back the whole file, so slice it here.
 */
async function rangeResponse(request, cached) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  if (!match) return cached;

  const buffer = await cached.arrayBuffer();
  const size = buffer.byteLength;
  let start = match[1] === '' ? null : parseInt(match[1], 10);
  let end = match[2] === '' ? null : parseInt(match[2], 10);

  if (start === null) {
    // Suffix form, `bytes=-500`: the final N bytes.
    start = Math.max(0, size - (end || 0));
    end = size - 1;
  } else if (end === null || end >= size) {
    end = size - 1;
  }

  if (start >= size || start > end) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': `bytes */${size}` },
    });
  }

  const slice = buffer.slice(start, end + 1);
  const headers = new Headers(cached.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(slice.byteLength));
  headers.set('Accept-Ranges', 'bytes');

  return new Response(slice, { status: 206, statusText: 'Partial Content', headers });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Always let the worker itself come from the network so updates are noticed.
  if (url.pathname.endsWith('/sw.js')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      let cached = await cache.match(request, { ignoreSearch: true });

      // Pages are cached under their directory URL (/phase-10/), so map the
      // other spellings of the same page onto it.
      if (!cached && request.mode === 'navigate') {
        const directory = url.pathname.replace(/index\.html$/, '');
        cached = await cache.match(directory.endsWith('/') ? directory : `${directory}/`);
      }

      if (cached) {
        if (request.headers.has('range')) return rangeResponse(request, cached);
        // Never hand a navigation a redirected response: the browser rejects
        // it outright and the page dies. Free when the flag is not set.
        return request.mode === 'navigate' ? withoutRedirectFlag(cached) : cached;
      }

      try {
        const response = await fetch(request);
        // Opportunistically keep anything the precache list missed. Only whole
        // responses: the Cache API rejects the 206 that a range request gets.
        if (response.status === 200 && response.type === 'basic') {
          const storable = await withoutRedirectFlag(response);
          cache.put(request, storable.clone());
          return storable;
        }
        return response;
      } catch (err) {
        // Offline and not cached. For a page navigation, fall back to the
        // game's own index.html, then to the arcade landing page, so the user
        // lands somewhere real instead of Safari's error screen.
        if (request.mode === 'navigate') {
          const segments = url.pathname.split('/').filter(Boolean);
          if (segments.length) {
            const gameHome = await cache.match(`${self.registration.scope}${segments[0]}/`);
            if (gameHome) return gameHome;
          }
          const home = await cache.match(self.registration.scope);
          if (home) return home;
        }
        // Scores are inherently online-only, so /api/* is never cached and is
        // expected to fail here. Answer with the same shape the server sends
        // when it has no database, which every caller already handles, rather
        // than a network error that surfaces in the console as a broken page.
        if (url.pathname.startsWith('/api/')) {
          return new Response(
            JSON.stringify({ error: 'offline', message: 'The arcade is offline — scores are unavailable.' }),
            { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } }
          );
        }
        throw err;
      }
    })()
  );
});
