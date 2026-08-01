/**
 * Static server that mimics Cloudflare Pages' URL normalization — notably the
 * 308 from /index.html to /, which is what broke the service worker in Safari
 * and which plain `http-server` does not do.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = require('path').join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT || 8124);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.map': 'application/json',
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);

    // Pages canonicalizes /index.html -> / (this is the 308 that bit us).
    if (pathname.endsWith('/index.html')) {
      res.writeHead(308, { Location: pathname.slice(0, -'index.html'.length) + url.search });
      return res.end();
    }

    let filePath = path.join(ROOT, pathname);

    // ...and /dir -> /dir/
    if (!pathname.endsWith('/') && fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      res.writeHead(308, { Location: `${pathname}/${url.search}` });
      return res.end();
    }

    if (pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');

    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }

    const size = fs.statSync(filePath).size;
    const type = TYPES[path.extname(filePath)] || 'application/octet-stream';
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');

    if (range) {
      const start = range[1] === '' ? size - Number(range[2]) : Number(range[1]);
      const end = range[2] === '' || range[1] === '' ? size - 1 : Number(range[2]);
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': end - start + 1,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      });
      return fs.createReadStream(filePath, { start, end }).pipe(res);
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  })
  .listen(PORT, () => console.log(`pages-like server on http://localhost:${PORT}`));
