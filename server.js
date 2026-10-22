import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST_DIR = fs.existsSync(path.resolve(__dirname, 'dist'))
  ? path.resolve(__dirname, 'dist')
  : path.resolve(__dirname, 'cinestream-tv', 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.mp4': 'video/mp4'
};

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/**
 * Reescreve o manifesto M3U8 para que todas as URLs relativas ou absolutas
 * (sub-playlists, chaves de criptografia e segmentos .ts) passem pelo /api/proxy
 */
function rewriteM3U8(content, baseUrl, proxyBase) {
  const lines = content.split(/\r?\n/);
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Linha de diretiva/tag HLS
    if (trimmed.startsWith('#')) {
      // Reescreve tags com URI="...", como #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA
      return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
        try {
          const abs = new URL(uri, baseUrl).href;
          return `URI="${proxyBase}?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(baseUrl)}"`;
        } catch {
          return match;
        }
      });
    }

    // Linha de segmento de vídeo ou sub-playlist
    try {
      const abs = new URL(trimmed, baseUrl).href;
      return `${proxyBase}?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(baseUrl)}`;
    } catch {
      return line;
    }
  }).join('\n');
}

/**
 * Executa o proxy de stream HLS e segmentos
 */
async function handleProxy(req, res, targetUrl, customReferer, customUa) {
  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing url parameter' }));
    return;
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid target URL' }));
    return;
  }

  const reqHeaders = {
    'User-Agent': customUa || DEFAULT_UA,
    'Accept': '*/*'
  };

  if (customReferer) {
    reqHeaders['Referer'] = customReferer;
  } else {
    reqHeaders['Referer'] = parsedTarget.origin + '/';
    reqHeaders['Origin'] = parsedTarget.origin;
  }

  // Encaminha Range se cliente pediu (seek de VOD)
  if (req.headers['range']) {
    reqHeaders['Range'] = req.headers['range'];
  }

  let upstreamRes;
  try {
    upstreamRes = await fetch(targetUrl, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: reqHeaders,
      redirect: 'follow'
    });
  } catch (primaryErr) {
    console.warn(`Upstream direto falhou para ${targetUrl}: ${primaryErr.message}. Tentando fallback secundário...`);
    // Fallback secundário usando o proxy do saimo-tv caso o servidor bloqueie nosso IP
    if (!targetUrl.includes('pages.dev')) {
      try {
        const fallbackUrl = `https://saimo-tv.pages.dev/api/proxy?url=${encodeURIComponent(targetUrl)}${customReferer ? `&referer=${encodeURIComponent(customReferer)}` : ''}`;
        upstreamRes = await fetch(fallbackUrl, {
          method: req.method === 'HEAD' ? 'HEAD' : 'GET',
          headers: { 'User-Agent': customUa || DEFAULT_UA },
          redirect: 'follow'
        });
      } catch (fallbackErr) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy upstream failed', details: primaryErr.message }));
        return;
      }
    } else {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy upstream failed', details: primaryErr.message }));
      return;
    }
  }

  // Verifica se o upstream retornou erro impeditivo
  if (!upstreamRes.ok && upstreamRes.status >= 400 && upstreamRes.status !== 404) {
    // Tenta fallback se status for 403 / 502 / 503
    if (!targetUrl.includes('pages.dev')) {
      try {
        const fallbackUrl = `https://saimo-tv.pages.dev/api/proxy?url=${encodeURIComponent(targetUrl)}${customReferer ? `&referer=${encodeURIComponent(customReferer)}` : ''}`;
        const fbRes = await fetch(fallbackUrl, {
          method: req.method === 'HEAD' ? 'HEAD' : 'GET',
          headers: { 'User-Agent': customUa || DEFAULT_UA },
          redirect: 'follow'
        });
        if (fbRes.ok) {
          upstreamRes = fbRes;
        }
      } catch (_) {}
    }
  }

  const finalUrl = upstreamRes.url || targetUrl;
  const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
  const isM3U8 = contentType.includes('mpegurl') || 
                 contentType.includes('m3u8') || 
                 parsedTarget.pathname.endsWith('.m3u8') ||
                 parsedTarget.pathname.endsWith('.txt') ||
                 targetUrl.includes('.m3u8');

  if (isM3U8) {
    const text = await upstreamRes.text();
    // Se o texto parecer manifesto HLS, reescreve
    if (text.includes('#EXTM3U') || text.includes('#EXT-X-')) {
      const rewritten = rewriteM3U8(text, finalUrl, '/api/proxy');
      res.writeHead(upstreamRes.status, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      res.end(rewritten);
      return;
    }
  }

  // Streaming binário direto (segmentos .ts, mp4, etc.)
  const responseHeaders = {
    'Content-Type': contentType || 'video/mp2t',
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  };

  const cl = upstreamRes.headers.get('content-length');
  if (cl) responseHeaders['Content-Length'] = cl;

  const cr = upstreamRes.headers.get('content-range');
  if (cr) responseHeaders['Content-Range'] = cr;

  const ar = upstreamRes.headers.get('accept-ranges');
  if (ar) responseHeaders['Accept-Ranges'] = ar;

  res.writeHead(upstreamRes.status, responseHeaders);

  if (!upstreamRes.body) {
    res.end();
    return;
  }

  const reader = upstreamRes.body.getReader();
  req.on('close', () => {
    try { reader.cancel(); } catch (_) {}
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch (_) {
    // Client cancelou ou upstream encerrou
  } finally {
    res.end();
  }
}

/**
 * Servidor de arquivos estáticos com suporte a SPA fallback
 */
function serveStatic(req, res, pathname) {
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: serve dist/index.html
      filePath = path.join(DIST_DIR, 'index.html');
      fs.stat(filePath, (err2, stats2) => {
        if (err2 || !stats2.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
        streamFile(req, res, filePath, '.html', stats2);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    streamFile(req, res, filePath, ext, stats);
  });
}

function streamFile(req, res, filePath, ext, stats) {
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const isAsset = filePath.includes(path.sep + 'assets' + path.sep);
  const cacheControl = isAsset 
    ? 'public, max-age=604800, immutable' 
    : 'no-cache, must-revalidate';

  const acceptEncoding = req.headers['accept-encoding'] || '';
  const canGzip = /\bgzip\b/.test(acceptEncoding) && stats.size > 1024 && (
    contentType.startsWith('text/') || 
    contentType.includes('javascript') || 
    contentType.includes('json') || 
    contentType.includes('xml')
  );

  const rawStream = fs.createReadStream(filePath);

  if (canGzip) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Encoding': 'gzip',
      'Cache-Control': cacheControl
    });
    const gzip = zlib.createGzip({ level: 6 });
    pipeline(rawStream, gzip, res, () => {});
  } else {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': cacheControl
    });
    pipeline(rawStream, res, () => {});
  }
}

const server = http.createServer((req, res) => {
  // Configuração global de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Endpoint de health check
  if (pathname === '/health' || pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  // Endpoint oficial de Proxy HLS
  if (pathname === '/api/proxy') {
    const targetUrl = parsedUrl.searchParams.get('url');
    const customReferer = parsedUrl.searchParams.get('referer');
    const customUa = parsedUrl.searchParams.get('ua');
    handleProxy(req, res, targetUrl, customReferer, customUa);
    return;
  }

  // Rota legada /stream-proxy/(http|https)/... para compatibilidade
  const legacyMatch = pathname.match(/^\/stream-proxy\/(https?)[/:]+([^/]+)\/?(.*)$/i);
  if (legacyMatch) {
    const proto = legacyMatch[1];
    const host = legacyMatch[2];
    const rest = legacyMatch[3];
    const query = parsedUrl.search || '';
    const targetUrl = `${proto}://${host}/${rest}${query}`;
    handleProxy(req, res, targetUrl, null, null);
    return;
  }

  // Servir arquivos estáticos (SPA React)
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`🚀 Oninha TV Server rodando na porta ${PORT}`);
  console.log(`📁 Diretório estático: ${DIST_DIR}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM recebido, encerrando servidor...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT recebido, encerrando servidor...');
  server.close(() => process.exit(0));
});
