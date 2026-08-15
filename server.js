const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const REMOTE_URL = 'https://vibe-proxy-gqv4.onrender.com/v1/chat/completions';
const API_TOKEN = process.env.API_TOKEN || 'sk-vibe-summer-2026';

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function serveStaticFile(res, requestPath) {
  const safePath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        sendJson(res, 404, { error: 'Not found' });
      } else {
        sendJson(res, 500, { error: 'Unable to read file' });
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
}

async function proxyChatCompletions(req, res) {
  let data = '';

  req.on('data', chunk => {
    data += chunk;
  });

  req.on('end', async () => {
    try {
      const body = data ? JSON.parse(data) : {};
      const upstream = await fetch(REMOTE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_TOKEN}`
        },
        body: JSON.stringify(body)
      });

      const text = await upstream.text();
      const responseHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-store'
      };

      if (!upstream.ok) {
        res.writeHead(upstream.status || 500, responseHeaders);
        res.end(text || JSON.stringify({ error: 'Upstream request failed' }));
        return;
      }

      res.writeHead(200, responseHeaders);
      res.end(text);
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Proxy error' });
    }
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const isChatEndpoint = url.pathname === '/api/chat/completions';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  if (isChatEndpoint) {
    if (req.method === 'GET' || req.method === 'HEAD') {
      sendJson(res, 200, {
        ok: true,
        service: 'nexus-chat-proxy',
        method: req.method,
        message: 'Proxy is healthy. POST requests are used for model calls.'
      });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    await proxyChatCompletions(req, res);
    return;
  }

  serveStaticFile(res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Nexus running on http://localhost:${PORT}`);
});
