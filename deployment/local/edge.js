'use strict';

/**
 * Local edge server for the POTHIK production build.
 *
 * Serves frontend/dist with history fallback and proxies the API paths to the
 * backend, mirroring deployment/nginx/pothik.conf on port 80.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : path.join(ROOT, 'frontend', 'dist');
const API = new URL(process.env.API_TARGET || 'http://127.0.0.1:5001');
const PORT = Number(process.env.EDGE_PORT || 80);
const HOST = process.env.EDGE_HOST || '127.0.0.1';

const API_PREFIXES = ['/api', '/uploads', '/api-docs', '/openapi.json', '/health'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

function isApiPath(pathname) {
  return API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function sendText(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(body);
}

function proxy(req, res) {
  const clientIp = req.socket.remoteAddress || '';
  const headers = {
    ...req.headers,
    host: API.host,
    'x-forwarded-proto': 'http',
    'x-forwarded-for': req.headers['x-forwarded-for']
      ? `${req.headers['x-forwarded-for']}, ${clientIp}`
      : clientIp,
  };

  const upstream = http.request(
    {
      hostname: API.hostname,
      port: API.port,
      path: req.url,
      method: req.method,
      headers,
      timeout: 60000,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );

  upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
  upstream.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    res.end(JSON.stringify({ success: false, message: 'API unavailable', error: err.message }));
  });

  req.pipe(upstream);
}

function sendFile(req, res, filePath) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (err) {
    sendText(res, 404, 'Not found\n');
    return;
  }
  if (!stat.isFile()) {
    sendText(res, 404, 'Not found\n');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  if (filePath.startsWith(`${path.join(DIST, 'assets')}${path.sep}`)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (path.basename(filePath) === 'index.html') {
    res.setHeader('Cache-Control', 'no-store');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }

  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

function serveStatic(req, res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (err) {
    sendText(res, 400, 'Bad request\n');
    return;
  }

  const candidate = path.join(DIST, decoded);
  if (candidate !== DIST && !candidate.startsWith(`${DIST}${path.sep}`)) {
    sendText(res, 404, 'Not found\n');
    return;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    sendFile(req, res, candidate);
    return;
  }
  if (path.extname(decoded)) {
    sendText(res, 404, 'Not found\n');
    return;
  }

  const indexFile = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexFile)) {
    sendText(res, 503, 'Frontend build not found\n');
    return;
  }
  sendFile(req, res, indexFile);
}

const server = http.createServer((req, res) => {
  securityHeaders(res);

  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch (err) {
    sendText(res, 400, 'Bad request\n');
    return;
  }

  if (pathname === '/nginx-health') {
    sendText(res, 200, 'ok\n');
    return;
  }

  if (isApiPath(pathname)) {
    proxy(req, res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    sendText(res, 405, 'Method not allowed\n');
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`edge listening on http://${HOST}:${PORT} -> api ${API.origin}, dist ${DIST}`);
});
