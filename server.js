import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { db, normalizeIp } from './db.js';
import { 
  PLANS, 
  RESELLER_PLANS,
  hashPassword, 
  verifyPassword, 
  generateToken, 
  verifyToken, 
  sanitizeUser, 
  isUserSubscriptionActive,
  isValidCpfOrCnpj,
  formatCpfCnpj
} from './authService.js';
import { mercadoPagoService } from './mercadoPagoService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Garante que o usuário Master Odonel exista com acesso permanente ilimitado
db.ensureMasterUser(hashPassword);

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

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limite
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function authenticateUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload || !payload.userId) return null;
  const user = db.findUserById(payload.userId);
  if (!user) return null;
  return { user, payload };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    return normalizeIp(first);
  }
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return normalizeIp(cfIp.trim());
  const realIp = req.headers['x-real-ip'];
  if (realIp) return normalizeIp(realIp.trim());
  const remote = req.socket?.remoteAddress || '';
  return normalizeIp(remote);
}

function parseDevice(ua = '') {
  let deviceType = 'Desktop';
  let deviceModel = 'Computador';
  let browser = 'Navegador Web';
  let os = 'Desconhecido';

  if (!ua) return { deviceType, deviceModel, browser, os };

  // OS
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/iPhone/i.test(ua)) os = 'iOS (iPhone)';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Tizen/i.test(ua)) os = 'Tizen OS';
  else if (/Web0S|WebOS/i.test(ua)) os = 'LG webOS';

  // Device Type & Model
  if (/Tizen/i.test(ua)) {
    deviceType = 'Smart TV';
    deviceModel = 'Samsung Smart TV (Tizen)';
  } else if (/Web0S|WebOS/i.test(ua)) {
    deviceType = 'Smart TV';
    deviceModel = 'LG Smart TV (webOS)';
  } else if (/Android.*TV|AFT|BRAVIA|MiTV|AppleTV|Roku/i.test(ua)) {
    deviceType = 'Smart TV';
    deviceModel = 'Android TV / TV Box';
  } else if (/iPhone/i.test(ua)) {
    deviceType = 'Mobile';
    deviceModel = 'Apple iPhone';
  } else if (/iPad/i.test(ua)) {
    deviceType = 'Tablet';
    deviceModel = 'Apple iPad';
  } else if (/Mobile/i.test(ua) && /Android/i.test(ua)) {
    deviceType = 'Mobile';
    deviceModel = 'Smartphone Android';
  } else if (/Android/i.test(ua)) {
    deviceType = 'Tablet';
    deviceModel = 'Tablet Android';
  } else if (/Windows/i.test(ua)) {
    deviceType = 'Desktop';
    deviceModel = 'PC Windows';
  } else if (/Macintosh|Mac OS/i.test(ua)) {
    deviceType = 'Desktop';
    deviceModel = 'Apple Mac';
  } else if (/Linux/i.test(ua)) {
    deviceType = 'Desktop';
    deviceModel = 'Computador Linux';
  }

  // Browser
  if (/Edg/i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome|CriOS/i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/Opera|OPR/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';

  return { deviceType, deviceModel, browser, os };
}

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
    sendJson(res, 400, { error: 'Missing url parameter' });
    return;
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    sendJson(res, 400, { error: 'Invalid target URL' });
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
    if (!targetUrl.includes('pages.dev')) {
      try {
        const fallbackUrl = `https://saimo-tv.pages.dev/api/proxy?url=${encodeURIComponent(targetUrl)}${customReferer ? `&referer=${encodeURIComponent(customReferer)}` : ''}`;
        upstreamRes = await fetch(fallbackUrl, {
          method: req.method === 'HEAD' ? 'HEAD' : 'GET',
          headers: { 'User-Agent': customUa || DEFAULT_UA },
          redirect: 'follow'
        });
      } catch {
        sendJson(res, 502, { error: 'Proxy upstream failed', details: primaryErr.message });
        return;
      }
    } else {
      sendJson(res, 502, { error: 'Proxy upstream failed', details: primaryErr.message });
      return;
    }
  }

  if (!upstreamRes.ok && upstreamRes.status >= 400 && upstreamRes.status !== 404) {
    if (!targetUrl.includes('pages.dev')) {
      try {
        const fallbackUrl = `https://saimo-tv.pages.dev/api/proxy?url=${encodeURIComponent(targetUrl)}${customReferer ? `&referer=${encodeURIComponent(customReferer)}` : ''}`;
        const fbRes = await fetch(fallbackUrl, {
          method: req.method === 'HEAD' ? 'HEAD' : 'GET',
          headers: { 'User-Agent': customUa || DEFAULT_UA },
          redirect: 'follow'
        });
        if (fbRes.ok) upstreamRes = fbRes;
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
  const isMp4 = parsedTarget.pathname.toLowerCase().endsWith('.mp4') || targetUrl.toLowerCase().includes('.mp4');
  let inferredContentType = contentType;
  if (isMp4 && (!inferredContentType || inferredContentType.includes('octet-stream') || inferredContentType.includes('mp2t'))) {
    inferredContentType = 'video/mp4';
  } else if (!inferredContentType) {
    inferredContentType = isMp4 ? 'video/mp4' : 'video/mp2t';
  }

  const responseHeaders = {
    'Content-Type': inferredContentType,
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
  if (ar) {
    responseHeaders['Accept-Ranges'] = ar;
  } else if (isMp4) {
    responseHeaders['Accept-Ranges'] = 'bytes';
  }

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

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- Endpoints Básicos ---
  if (pathname === '/health' || pathname === '/api/health') {
    sendJson(res, 200, { status: 'ok', uptime: process.uptime() });
    return;
  }

  // --- Planos Disponíveis ---
  if (pathname === '/api/auth/plans' && req.method === 'GET') {
    // Retorna apenas planos comerciais para a tabela de assinaturas (exclui teste interno)
    const commercialPlans = Object.values(PLANS).filter(p => p.id !== 'teste-2h');
    sendJson(res, 200, { plans: commercialPlans });
    return;
  }

  // --- Consulta de Elegibilidade de Teste por IP ---
  if (pathname === '/api/auth/check-ip-trial' && req.method === 'GET') {
    const clientIp = getClientIp(req);
    const hasUsedTest = db.hasIpUsedTest(clientIp);
    sendJson(res, 200, {
      ip: clientIp,
      hasUsedTest,
      canTrial: !hasUsedTest,
      trialDurationHours: 2
    });
    return;
  }

  // --- Rastreamento de Acesso (Salva IP, Horário e Dispositivo no Banco) ---
  if (pathname === '/api/tracking/access' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const auth = authenticateUser(req);
      const clientIp = getClientIp(req);
      const ua = req.headers['user-agent'] || '';
      const dev = parseDevice(ua);

      const log = db.recordAccess({
        ip: clientIp,
        userId: auth?.user?.id || null,
        username: auth?.user?.username || null,
        deviceType: dev.deviceType,
        deviceModel: dev.deviceModel,
        browser: dev.browser,
        os: dev.os,
        userAgent: ua,
        path: body.path || '/'
      });

      sendJson(res, 200, { ok: true, ip: clientIp, logId: log.id });
    } catch (err) {
      sendJson(res, 200, { ok: false, error: err.message });
    }
    return;
  }

  // --- Middleware de Validação Master Odonel ---
  function requireMasterAuth(req, res) {
    const auth = authenticateUser(req);
    if (!auth) {
      sendJson(res, 401, { error: 'Autenticação necessária. Faça login como Master.' });
      return null;
    }
    const username = (auth.user.username || '').toLowerCase().trim();
    const isMaster = username === 'odonel' || auth.user.role === 'admin' || auth.user.isMaster === true;
    if (!isMaster) {
      sendJson(res, 403, { error: 'Acesso negado. Esta funcionalidade é restrita exclusivamente ao usuário Master Odonel.' });
      return null;
    }
    return auth;
  }

  // --- Rotas Exclusivas do Painel Master Odonel ---

  // 1. Estatísticas do Painel Master (Totais, Ativos, Inativos, Online Agora)
  if (pathname === '/api/master/stats' && req.method === 'GET') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;
    const stats = db.getMasterStats();
    sendJson(res, 200, { success: true, stats });
    return;
  }

  // 2. Listagem Completa de Usuários (com Sessões Conectadas e Status de Assinatura)
  if (pathname === '/api/master/users' && req.method === 'GET') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;
    const users = db.getMasterUsers();
    sendJson(res, 200, { success: true, users });
    return;
  }

  // 3. Ativar / Inativar Usuário e Determinar Período de Validade
  if (pathname === '/api/master/users/status' && req.method === 'POST') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;

    try {
      const body = await readJsonBody(req);
      const {
        userId,
        active,
        durationHours,
        durationDays,
        expireDate,
        planoId,
        planoNome,
        limiteTelas,
        kickSessions
      } = body;

      if (!userId) {
        sendJson(res, 400, { error: 'userId é obrigatório.' });
        return;
      }

      const targetUser = db.findUserById(userId);
      if (!targetUser) {
        sendJson(res, 404, { error: 'Usuário não encontrado.' });
        return;
      }

      // Proteção: Nunca inativar a própria conta master 'odonel'
      const targetUsername = (targetUser.username || '').toLowerCase().trim();
      if (targetUsername === 'odonel' && active === false) {
        sendJson(res, 400, { error: 'A conta do Master Odonel não pode ser inativada.' });
        return;
      }

      const updated = db.setMasterUserStatus(userId, {
        active: Boolean(active),
        durationHours,
        durationDays,
        expireDate,
        planoId,
        planoNome,
        limiteTelas,
        kickSessions: kickSessions !== false
      });

      sendJson(res, 200, {
        success: true,
        user: updated,
        message: active 
          ? `Usuário ${updated.username} ativado com sucesso!` 
          : `Usuário ${updated.username} inativado com sucesso!`
      });
    } catch (err) {
      console.error('Erro ao atualizar status do usuário (Master):', err);
      sendJson(res, 500, { error: 'Erro ao processar alteração: ' + err.message });
    }
    return;
  }

  // 4. Redefinir Senha de Usuário pelo Master
  if (pathname === '/api/master/users/reset-password' && req.method === 'POST') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;

    try {
      const body = await readJsonBody(req);
      const { userId, newPassword, kickSessions } = body;

      if (!userId) {
        sendJson(res, 400, { error: 'userId é obrigatório.' });
        return;
      }

      if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
        sendJson(res, 400, { error: 'A nova senha deve ter no mínimo 4 caracteres.' });
        return;
      }

      const targetUser = db.findUserById(userId);
      if (!targetUser) {
        sendJson(res, 404, { error: 'Usuário não encontrado.' });
        return;
      }

      const targetUsername = (targetUser.username || '').toLowerCase().trim();
      const masterUsername = (auth.user.username || '').toLowerCase().trim();

      // Proteção de segurança: Não permitir que outros alterem a conta master 'odonel'
      if (targetUsername === 'odonel' && masterUsername !== 'odonel') {
        sendJson(res, 403, { error: 'Apenas o próprio usuário Master Odonel pode alterar sua própria senha.' });
        return;
      }

      const cleanPassword = newPassword.trim();
      const senhaHash = hashPassword(cleanPassword);

      db.setMasterUserPassword(userId, senhaHash, kickSessions !== false);

      sendJson(res, 200, {
        success: true,
        message: `Senha do usuário @${targetUser.username} redefinida com sucesso!`
      });
    } catch (err) {
      console.error('Erro ao redefinir senha do usuário (Master):', err);
      sendJson(res, 500, { error: 'Erro ao redefinir senha: ' + err.message });
    }
    return;
  }

  // 5. Derrubar Sessão(ões) Ativa(s) de Usuário
  if (pathname === '/api/master/sessions/kick' && req.method === 'POST') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;

    try {
      const body = await readJsonBody(req);
      const { sessionId, userId, reason } = body;
      const customReason = reason || 'Sua sessão foi encerrada pelo usuário Master Odonel.';

      if (sessionId) {
        const ok = db.terminateSessionById(sessionId, customReason);
        sendJson(res, 200, { success: ok, message: 'Sessão derrubada com sucesso.' });
        return;
      }

      if (userId) {
        const count = db.terminateUserSessions(userId, customReason);
        sendJson(res, 200, { success: true, message: `${count} sessão(ões) derrubada(s) com sucesso.` });
        return;
      }

      sendJson(res, 400, { error: 'Informe sessionId ou userId.' });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 5. Consulta de Logs de Auditoria de Acessos
  if (pathname === '/api/master/logs' && req.method === 'GET') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;

    const limit = parseInt(parsedUrl.searchParams.get('limit') || '300', 10);
    const logs = db.getAccessLogs(limit);
    sendJson(res, 200, {
      success: true,
      total: (db.data.accessLogs || []).length,
      logs
    });
    return;
  }

  // --- Middleware de Validação do Revendedor / Lojista (B2B) ---
  function requireResellerAuth(req, res) {
    const auth = authenticateUser(req);
    if (!auth) {
      sendJson(res, 401, { error: 'Autenticação necessária. Faça login no portal do Revendedor.' });
      return null;
    }
    const username = (auth.user.username || '').toLowerCase().trim();
    const isMaster = username === 'odonel' || auth.user.role === 'admin' || auth.user.isMaster === true;
    const isReseller = auth.user.role === 'reseller' || isMaster;

    if (!isReseller) {
      sendJson(res, 403, { error: 'Acesso negado. Esta área é restrita a lojistas e revendedores credenciados.' });
      return null;
    }

    if (!isMaster && auth.user.status === 'bloqueado') {
      sendJson(res, 403, { error: 'Sua conta de revendedor está bloqueada pela administração Master.' });
      return null;
    }

    return auth;
  }

  // --- Rotas de Gestão de Revendedores do Painel Master Odonel ---

  // Listar todos os lojistas/revendedores cadastrados
  if (pathname === '/api/master/resellers' && req.method === 'GET') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;
    const resellers = db.getAllResellers();
    sendJson(res, 200, { success: true, resellers });
    return;
  }

  // Alterar status do lojista (ativo / bloqueado / inativo)
  if (pathname === '/api/master/resellers/status' && req.method === 'POST') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;

    try {
      const body = await readJsonBody(req);
      const { resellerId, status } = body;
      if (!resellerId || !status) {
        sendJson(res, 400, { error: 'resellerId e status são obrigatórios.' });
        return;
      }
      const updated = db.updateResellerStatus(resellerId, status);
      sendJson(res, 200, {
        success: true,
        reseller: sanitizeUser(updated),
        message: `Status do revendedor atualizado para "${status}".`
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // Ajuste manual de créditos pelo Master (adicionar / remover com log de auditoria)
  if (pathname === '/api/master/resellers/adjust-credits' && req.method === 'POST') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;

    try {
      const body = await readJsonBody(req);
      const { resellerId, plano, delta, motivo } = body;
      if (!resellerId || !plano || delta === undefined) {
        sendJson(res, 400, { error: 'resellerId, plano e delta são obrigatórios.' });
        return;
      }

      const result = db.adjustResellerCredits(resellerId, {
        plano,
        delta,
        motivo,
        masterUsername: auth.user.username
      });

      sendJson(res, 200, {
        success: true,
        saldoNovo: result.saldoNovo,
        tx: result.tx,
        message: `Créditos do revendedor ajustados com sucesso! Novo saldo ${plano}: ${result.saldoNovo}`
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // Redefinir senha de revendedor pelo Master
  if (pathname === '/api/master/resellers/reset-password' && req.method === 'POST') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;

    try {
      const body = await readJsonBody(req);
      const { resellerId, newPassword } = body;
      if (!resellerId || !newPassword || newPassword.trim().length < 4) {
        sendJson(res, 400, { error: 'resellerId e newPassword (mínimo 4 caracteres) são obrigatórios.' });
        return;
      }

      const senhaHash = hashPassword(newPassword.trim());
      db.setMasterUserPassword(resellerId, senhaHash, true);
      sendJson(res, 200, { success: true, message: 'Senha do revendedor redefinida com sucesso!' });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // Excluir revendedor pelo Master
  const matchMasterDeleteReseller = pathname.match(/^\/api\/master\/resellers\/([^/]+)$/);
  if (matchMasterDeleteReseller && req.method === 'DELETE') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;

    try {
      const resellerId = matchMasterDeleteReseller[1];
      db.deleteReseller(resellerId);
      sendJson(res, 200, { success: true, message: 'Revendedor excluído com sucesso.' });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // Listar clientes gerados por revendedores (Master)
  if (pathname === '/api/master/resellers/clients' && req.method === 'GET') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;

    const filterResellerId = parsedUrl.searchParams.get('resellerId') || null;
    const clients = db.getAllResellerClients(filterResellerId);
    sendJson(res, 200, { success: true, clients });
    return;
  }

  // Histórico de pedidos de créditos pagos pelos revendedores (Master)
  if (pathname === '/api/master/resellers/orders' && req.method === 'GET') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;

    const orders = db.getAllResellerOrders(200);
    sendJson(res, 200, { success: true, orders });
    return;
  }

  // Extrato global de transações e movimentações de revenda (Master)
  if (pathname === '/api/master/resellers/transactions' && req.method === 'GET') {
    const auth = requireMasterAuth(req, res);
    if (!auth) return;

    const limit = parseInt(parsedUrl.searchParams.get('limit') || '300', 10);
    const transactions = db.getAllResellerTransactions(limit);
    sendJson(res, 200, { success: true, transactions });
    return;
  }

  // ==========================================
  // --- ROTAS DO MÓDULO B2B / REVENDA ---
  // ==========================================

  // 1. Planos e Preços de Créditos
  if (pathname === '/api/reseller/plans' && req.method === 'GET') {
    sendJson(res, 200, { success: true, plans: RESELLER_PLANS });
    return;
  }

  // 2. Cadastro de Lojista / Revendedor (/revenda/cadastro)
  if (pathname === '/api/reseller/register' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { cpfCnpj, telefone, senha, confirmarSenha, nome, email, deviceId, deviceInfo } = body;

      const cleanCpfCnpj = String(cpfCnpj || '').replace(/\D/g, '');
      const cleanTelefone = String(telefone || '').trim();

      if (!cleanCpfCnpj || !cleanTelefone || !senha) {
        sendJson(res, 400, { error: 'CPF ou CNPJ, Telefone/WhatsApp e Senha são obrigatórios.' });
        return;
      }

      if (!isValidCpfOrCnpj(cleanCpfCnpj)) {
        sendJson(res, 400, { error: 'O CPF ou CNPJ informado é inválido. Por favor, confira os números digitados.' });
        return;
      }

      if (confirmarSenha !== undefined && senha !== confirmarSenha) {
        sendJson(res, 400, { error: 'A confirmação de senha não confere com a senha digitada.' });
        return;
      }

      if (senha.length < 6) {
        sendJson(res, 400, { error: 'A senha deve conter no mínimo 6 caracteres.' });
        return;
      }

      const existingCpf = db.findUserByCpf(cleanCpfCnpj);
      if (existingCpf) {
        sendJson(res, 409, { error: 'Este CPF/CNPJ já está cadastrado no sistema.' });
        return;
      }

      const senhaHash = hashPassword(senha);
      const reseller = db.createReseller({
        cpfCnpj: cleanCpfCnpj,
        telefone: cleanTelefone,
        senhaHash,
        nome: nome ? String(nome).trim() : `Lojista ${cleanCpfCnpj.slice(-4)}`,
        email: email ? String(email).trim() : ''
      });

      const session = db.createSession(reseller.id, deviceId, deviceInfo, 10);
      const token = generateToken({ userId: reseller.id, sessionId: session.id });

      sendJson(res, 201, {
        success: true,
        token,
        sessionId: session.id,
        user: sanitizeUser(reseller),
        reseller: sanitizeUser(reseller),
        credits: db.getResellerCredits(reseller.id),
        message: 'Cadastro de lojista realizado com sucesso! Carteira de créditos inicializada zerada.'
      });
    } catch (err) {
      console.error('Erro no cadastro de revendedor:', err);
      sendJson(res, 500, { error: 'Erro ao cadastrar revendedor: ' + err.message });
    }
    return;
  }

  // 3. Login de Lojista / Revendedor (/revenda/login)
  if (pathname === '/api/reseller/login' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const identifier = (body.identifier || body.login || body.cpfCnpj || body.username || '').trim();
      const senha = body.senha;
      const { deviceId, deviceInfo } = body;

      if (!identifier || !senha) {
        sendJson(res, 400, { error: 'CPF/CNPJ e Senha são obrigatórios.' });
        return;
      }

      const user = db.findResellerByLogin(identifier);
      if (!user || !verifyPassword(senha, user.senhaHash)) {
        sendJson(res, 401, { error: 'Identificador (CPF/CNPJ) ou senha incorretos.' });
        return;
      }

      const isMaster = (user.username || '').toLowerCase() === 'odonel' || user.role === 'admin' || user.isMaster;
      if (!isMaster && user.role !== 'reseller') {
        sendJson(res, 403, { error: 'Esta conta não possui perfil de Revendedor/Lojista.' });
        return;
      }

      if (!isMaster && user.status === 'bloqueado') {
        sendJson(res, 403, { error: 'Sua conta de revendedor está bloqueada pela administração Master.' });
        return;
      }

      const session = db.createSession(user.id, deviceId, deviceInfo, isMaster ? 999 : 10);
      const token = generateToken({ userId: user.id, sessionId: session.id });

      sendJson(res, 200, {
        success: true,
        token,
        sessionId: session.id,
        user: sanitizeUser(user),
        reseller: sanitizeUser(user),
        credits: db.getResellerCredits(user.id),
        message: 'Login realizado com sucesso!'
      });
    } catch (err) {
      console.error('Erro no login de revendedor:', err);
      sendJson(res, 500, { error: 'Erro ao processar login: ' + err.message });
    }
    return;
  }

  // 4. Perfil e Saldo de Créditos do Revendedor Atual
  if (pathname === '/api/reseller/me' && req.method === 'GET') {
    const auth = requireResellerAuth(req, res);
    if (!auth) return;

    sendJson(res, 200, {
      success: true,
      reseller: sanitizeUser(auth.user),
      credits: db.getResellerCredits(auth.user.id)
    });
    return;
  }

  // 5. Compra de Créditos pelo Lojista (Checkout PIX)
  if (pathname === '/api/reseller/credits/buy' && req.method === 'POST') {
    const auth = requireResellerAuth(req, res);
    if (!auth) return;

    try {
      const body = await readJsonBody(req);
      const { plano, quantidade } = body;

      const pKey = String(plano || '').toLowerCase().trim();
      const planInfo = RESELLER_PLANS[pKey];
      if (!planInfo) {
        sendJson(res, 400, { error: 'Plano de créditos inválido. Escolha entre mensal, trimestral, semestral ou anual.' });
        return;
      }

      const qtd = parseInt(quantidade, 10);
      if (isNaN(qtd) || qtd <= 0) {
        sendJson(res, 400, { error: 'Informe uma quantidade válida de créditos maior que zero.' });
        return;
      }

      const valorUnitario = planInfo.preco;
      const valorTotal = Number((qtd * valorUnitario).toFixed(2));

      // Criação de cobrança Pix
      const mpResponse = await mercadoPagoService.criarPagamentoCreditosPix(auth.user, planInfo.nome, qtd, valorTotal);
      const mpId = mpResponse.id;
      const td = mpResponse.point_of_interaction?.transaction_data || {};
      const qrCode = td.qr_code || '';
      const qrCodeBase64 = td.qr_code_base64 || '';

      const order = db.createResellerOrder({
        resellerId: auth.user.id,
        plano: pKey,
        quantidade: qtd,
        valorUnitario,
        valorTotal,
        mercadoPagoId: mpId,
        qrCode,
        qrCodeBase64
      });

      sendJson(res, 201, {
        success: true,
        orderId: order.id,
        mercadoPagoId: mpId,
        plano: pKey,
        planoNome: planInfo.nome,
        quantidade: qtd,
        valorUnitario,
        valorTotal,
        qrCode,
        qrCodeBase64,
        status: 'PENDING'
      });
    } catch (err) {
      console.error('Erro ao comprar créditos de revenda:', err);
      sendJson(res, 500, { error: 'Erro ao gerar Pix de créditos: ' + err.message });
    }
    return;
  }

  // 6. Consultar Status do Pedido de Créditos
  const matchResellerOrderStatus = pathname.match(/^\/api\/reseller\/credits\/order-status\/([^/]+)$/);
  if (matchResellerOrderStatus && req.method === 'GET') {
    const auth = requireResellerAuth(req, res);
    if (!auth) return;

    try {
      const orderId = matchResellerOrderStatus[1];
      const order = db.findResellerOrderById(orderId) || db.findResellerOrderByMpId(orderId);

      if (!order) {
        sendJson(res, 404, { error: 'Pedido de créditos não encontrado.' });
        return;
      }

      if (order.status === 'APPROVED') {
        sendJson(res, 200, {
          success: true,
          status: 'APPROVED',
          order,
          credits: db.getResellerCredits(auth.user.id)
        });
        return;
      }

      if (order.mercadoPagoId) {
        const mpStatus = await mercadoPagoService.consultarStatusPagamento(order.mercadoPagoId);
        if (mpStatus && mpStatus.status === 'approved') {
          db.approveResellerOrder(order.id);
          sendJson(res, 200, {
            success: true,
            status: 'APPROVED',
            order,
            credits: db.getResellerCredits(auth.user.id),
            message: 'Pagamento confirmado! Seus créditos foram adicionados com sucesso.'
          });
          return;
        }
      }

      sendJson(res, 200, {
        success: true,
        status: order.status,
        order,
        credits: db.getResellerCredits(auth.user.id)
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 7. Simular Aprovação de Pagamento de Crédito (Demo / Teste Instantâneo)
  if (pathname === '/api/reseller/credits/simulate-approve' && req.method === 'POST') {
    const auth = requireResellerAuth(req, res);
    if (!auth) return;

    try {
      const body = await readJsonBody(req);
      const { orderId } = body;
      const approved = db.approveResellerOrder(orderId);
      sendJson(res, 200, {
        success: true,
        status: 'APPROVED',
        credits: db.getResellerCredits(auth.user.id),
        order: approved.order,
        message: 'Créditos liberados com sucesso!'
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // 8. Listar Clientes Finais Criados pelo Revendedor
  if (pathname === '/api/reseller/clients' && req.method === 'GET') {
    const auth = requireResellerAuth(req, res);
    if (!auth) return;

    const clients = db.getClientsByReseller(auth.user.id);
    sendJson(res, 200, { success: true, clients });
    return;
  }

  // 9. Criar Cliente Final pelo Lojista (Validação e Débito de Créditos)
  if (pathname === '/api/reseller/clients' && req.method === 'POST') {
    const auth = requireResellerAuth(req, res);
    if (!auth) return;

    try {
      const body = await readJsonBody(req);
      const { username, senha, plano, telas, nome, telefone, email } = body;

      const cleanUsername = String(username || '').trim().toLowerCase();
      if (!cleanUsername || !senha) {
        sendJson(res, 400, { error: 'Nome de usuário e Senha do cliente são obrigatórios.' });
        return;
      }

      const pKey = String(plano || 'mensal').toLowerCase().trim();
      const planInfo = RESELLER_PLANS[pKey];
      if (!planInfo) {
        sendJson(res, 400, { error: 'Tipo de plano inválido. Escolha entre Mensal, Trimestral, Semestral ou Anual.' });
        return;
      }

      const screenCount = Math.max(1, parseInt(telas, 10) || 1);
      const credits = db.getResellerCredits(auth.user.id);
      const availableCredits = credits[pKey] || 0;

      // Validação de saldo conforme regra: Saldo Necessário = Quantidade de Telas
      if (availableCredits < screenCount) {
        sendJson(res, 400, {
          error: `Saldo insuficiente de créditos para o plano ${planInfo.nome}. Você possui ${availableCredits} crédito(s), mas precisa de ${screenCount} para liberar ${screenCount} tela(s). Faça uma recarga de créditos.`,
          required: screenCount,
          available: availableCredits,
          plan: pKey
        });
        return;
      }

      const senhaHash = hashPassword(senha);
      const result = db.createClientByReseller(auth.user.id, {
        username: cleanUsername,
        senhaHash,
        planoKey: pKey,
        telas: screenCount,
        nome,
        telefone,
        email
      });

      const client = result.client;
      const dataExp = new Date(client.fimAssinatura).toLocaleDateString('pt-BR');

      const whatsappText = `🌟 *SEU ACESSO CINESTREAM ESTÁ LIBERADO!* 🌟\n\n` +
        `👤 *Usuário:* ${cleanUsername}\n` +
        `🔑 *Senha:* ${senha}\n` +
        `📺 *Telas Simultâneas:* ${screenCount} tela(s)\n` +
        `🗓️ *Validade:* ${dataExp} (${planInfo.nome})\n\n` +
        `🌐 *Acesse agora:* https://topcanais.tv\n\n` +
        `Bom entretenimento! Se precisar de ajuda, conte conosco.`;

      sendJson(res, 201, {
        success: true,
        client: sanitizeUser(client),
        rawPassword: senha,
        saldoRestante: result.saldoRestante,
        whatsappText,
        message: `Cliente @${cleanUsername} criado com sucesso! ${screenCount} crédito(s) ${pKey} debitado(s).`
      });
    } catch (err) {
      console.error('Erro ao criar cliente pelo revendedor:', err);
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // 10. Renovar Assinatura de Cliente pelo Lojista
  if (pathname === '/api/reseller/clients/renew' && req.method === 'POST') {
    const auth = requireResellerAuth(req, res);
    if (!auth) return;

    try {
      const body = await readJsonBody(req);
      const { clientId, plano, telas } = body;
      const result = db.renewClientByReseller(auth.user.id, clientId, {
        planoKey: plano,
        telas
      });

      sendJson(res, 200, {
        success: true,
        client: sanitizeUser(result.client),
        saldoRestante: result.saldoRestante,
        message: `Assinatura de @${result.client.username} renovada com sucesso!`
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // 11. Redefinir Senha do Cliente pelo Lojista
  if (pathname === '/api/reseller/clients/reset-password' && req.method === 'POST') {
    const auth = requireResellerAuth(req, res);
    if (!auth) return;

    try {
      const body = await readJsonBody(req);
      const { clientId, newPassword } = body;

      const client = db.findUserById(clientId);
      if (!client) {
        sendJson(res, 404, { error: 'Cliente não encontrado.' });
        return;
      }

      const isMaster = (auth.user.username || '').toLowerCase() === 'odonel' || auth.user.role === 'admin';
      if (!isMaster && client.resellerId !== auth.user.id) {
        sendJson(res, 403, { error: 'Você não tem permissão para alterar a senha deste cliente.' });
        return;
      }

      if (!newPassword || newPassword.trim().length < 4) {
        sendJson(res, 400, { error: 'A nova senha deve ter no mínimo 4 caracteres.' });
        return;
      }

      const senhaHash = hashPassword(newPassword.trim());
      db.setMasterUserPassword(clientId, senhaHash, true);

      sendJson(res, 200, {
        success: true,
        message: `Senha de @${client.username} alterada com sucesso!`
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 12. Desconectar Sessões Ativas do Cliente pelo Lojista
  if (pathname === '/api/reseller/clients/kick' && req.method === 'POST') {
    const auth = requireResellerAuth(req, res);
    if (!auth) return;

    try {
      const body = await readJsonBody(req);
      const { clientId } = body;

      const client = db.findUserById(clientId);
      if (!client) {
        sendJson(res, 404, { error: 'Cliente não encontrado.' });
        return;
      }

      const isMaster = (auth.user.username || '').toLowerCase() === 'odonel' || auth.user.role === 'admin';
      if (!isMaster && client.resellerId !== auth.user.id) {
        sendJson(res, 403, { error: 'Você não tem permissão para desconectar este cliente.' });
        return;
      }

      const count = db.terminateUserSessions(clientId, 'Sessão encerrada pelo seu revendedor.');
      sendJson(res, 200, {
        success: true,
        message: `${count} sessão(ões) encerrada(s) com sucesso.`
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 13. Extrato de Transações de Créditos do Revendedor
  if (pathname === '/api/reseller/transactions' && req.method === 'GET') {
    const auth = requireResellerAuth(req, res);
    if (!auth) return;

    const transactions = db.getResellerTransactions(auth.user.id);
    sendJson(res, 200, { success: true, transactions });
    return;
  }

  // 14. Histórico de Pedidos de Créditos do Revendedor
  if (pathname === '/api/reseller/orders' && req.method === 'GET') {
    const auth = requireResellerAuth(req, res);
    if (!auth) return;

    const orders = db.getResellerOrders(auth.user.id);
    sendJson(res, 200, { success: true, orders });
    return;
  }

  // --- Consulta Legada de Auditoria de Acessos ---
  if (pathname === '/api/admin/access-logs' && req.method === 'GET') {
    const auth = authenticateUser(req);
    const isMaster = auth && (auth.user.username === 'odonel' || auth.user.role === 'admin' || auth.user.isMaster);
    const secret = parsedUrl.searchParams.get('key');
    if (!isMaster && secret !== 'odonel2026') {
      sendJson(res, 403, { error: 'Acesso restrito ao administrador.' });
      return;
    }

    const limit = parseInt(parsedUrl.searchParams.get('limit') || '150', 10);
    const logs = db.getAccessLogs(limit);
    sendJson(res, 200, {
      total: db.data.accessLogs.length,
      testedIpsCount: db.data.testedIps.length,
      logs
    });
    return;
  }

  // --- Cadastro de Usuário (Com Regra de 1 Teste de 2h por IP) ---
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { username, telefone, senha, confirmarSenha, email, nome, cpf, deviceId, deviceInfo } = body;

      const cleanUsername = (username || '').trim();
      const cleanTelefone = (telefone || '').trim();

      if (!cleanUsername || !cleanTelefone || !senha) {
        sendJson(res, 400, { error: 'Nome de usuário, telefone e senha são obrigatórios.' });
        return;
      }

      if (cleanUsername.length < 3) {
        sendJson(res, 400, { error: 'O nome de usuário deve conter no mínimo 3 caracteres.' });
        return;
      }

      // Validação de formato de nome de usuário (letras, números, underscore, hífen)
      if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        sendJson(res, 400, { error: 'O nome de usuário não pode conter espaços ou caracteres especiais.' });
        return;
      }

      // Validação de confirmação de senha
      if (confirmarSenha !== undefined && senha !== confirmarSenha) {
        sendJson(res, 400, { error: 'A confirmação de senha não coincide com a senha digitada.' });
        return;
      }

      if (senha.length < 6) {
        sendJson(res, 400, { error: 'A senha deve conter no mínimo 6 caracteres.' });
        return;
      }

      // Verificação de unicidade do nome de usuário
      const existingUser = db.findUserByUsername(cleanUsername);
      if (existingUser) {
        sendJson(res, 409, { error: 'Este nome de usuário já está em uso. Por favor, escolha outro.' });
        return;
      }

      if (email) {
        const existingEmail = db.findUserByEmail(email);
        if (existingEmail) {
          sendJson(res, 409, { error: 'Este e-mail já está cadastrado.' });
          return;
        }
      }

      // Regra de IP e Teste Grátis de 2 Horas:
      const clientIp = getClientIp(req);
      const isIpAlreadyTested = db.hasIpUsedTest(clientIp);

      let assinaturaAtiva = false;
      let planoId = null;
      let planoNome = null;
      let dataAssinatura = null;
      let fimAssinatura = null;
      let trialGranted = false;

      if (!isIpAlreadyTested) {
        // Concede 2 horas de teste gratuito (apenas 1 vez por IP e por usuário)
        const now = new Date();
        const expiresAt = new Date(now.getTime() + (2 * 60 * 60 * 1000)); // 2 horas exatas

        assinaturaAtiva = true;
        planoId = 'teste-2h';
        planoNome = 'Teste Grátis (2h)';
        dataAssinatura = now.toISOString();
        fimAssinatura = expiresAt.toISOString();
        trialGranted = true;
      }

      const senhaHash = hashPassword(senha);
      const user = db.createUser({ 
        username: cleanUsername, 
        nome: nome || cleanUsername, 
        telefone: cleanTelefone, 
        email, 
        senhaHash, 
        cpf,
        assinaturaAtiva,
        planoId,
        planoNome,
        limiteTelas: 1,
        dataAssinatura,
        fimAssinatura,
        trialUsed: true,
        trialIp: clientIp,
        registrationIp: clientIp
      });

      // Registra o IP na lista definitiva de IPs testados
      db.recordTestedIp(clientIp, user.id, user.username);

      // Registra auditoria de acesso
      const ua = req.headers['user-agent'] || '';
      const dev = parseDevice(ua);
      db.recordAccess({
        ip: clientIp,
        userId: user.id,
        username: user.username,
        deviceType: dev.deviceType,
        deviceModel: dev.deviceModel,
        browser: dev.browser,
        os: dev.os,
        userAgent: ua,
        path: '/cadastro'
      });

      // Cria a sessão com limite de 1 tela por padrão
      const session = db.createSession(user.id, deviceId, deviceInfo, user.limiteTelas || 1);
      const token = generateToken({ userId: user.id, sessionId: session.id });

      let trialMessage = '';
      if (trialGranted) {
        trialMessage = '🎉 Bem-vindo! Seu teste gratuito de 2 horas foi ativado com sucesso. Aproveite todos os canais ao vivo, filmes e séries!';
      } else {
        trialMessage = 'Conta criada com sucesso! Notamos que este IP já utilizou o teste gratuito de 2 horas. Escolha um de nossos planos para ter acesso aos canais.';
      }

      sendJson(res, 201, {
        token,
        sessionId: session.id,
        user: sanitizeUser(user),
        trialGranted,
        trialMessage,
        message: trialMessage
      });
    } catch (err) {
      console.error('Erro no cadastro:', err);
      sendJson(res, 500, { error: 'Erro ao processar cadastro: ' + err.message });
    }
    return;
  }

  // --- Login de Usuário com Limite de Telas e Validação de Teste Expirado ---
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const login = (body.username || body.login || body.email || '').trim();
      const senha = body.senha;
      const { deviceId, deviceInfo } = body;

      if (!login || !senha) {
        sendJson(res, 400, { error: 'Usuário e senha são obrigatórios.' });
        return;
      }

      const user = db.findUserByLogin(login);
      if (!user || !verifyPassword(senha, user.senhaHash)) {
        sendJson(res, 401, { error: 'Nome de usuário ou senha incorretos.' });
        return;
      }

      // Validação de expiração de teste de 2 horas
      const isSubActive = isUserSubscriptionActive(user);
      const isTrialExpired = (user.planoId === 'teste-2h' && !isSubActive);
      if (isTrialExpired) {
        user.assinaturaAtiva = false;
        db.updateUser(user.id, { assinaturaAtiva: false });
      }

      // Registra acesso do login
      const clientIp = getClientIp(req);
      const ua = req.headers['user-agent'] || '';
      const dev = parseDevice(ua);
      db.recordAccess({
        ip: clientIp,
        userId: user.id,
        username: user.username,
        deviceType: dev.deviceType,
        deviceModel: dev.deviceModel,
        browser: dev.browser,
        os: dev.os,
        userAgent: ua,
        path: '/login'
      });

      const maxScreens = user.limiteTelas || 1;
      const session = db.createSession(user.id, deviceId, deviceInfo, maxScreens);
      const token = generateToken({ userId: user.id, sessionId: session.id });

      let loginNotice = 'Login realizado com sucesso!';
      if (isTrialExpired) {
        loginNotice = 'Seu período de teste gratuito de 2 horas encerrou. Para continuar assistindo, escolha um de nossos planos.';
      }

      sendJson(res, 200, {
        token,
        sessionId: session.id,
        user: sanitizeUser(user),
        trialExpired: isTrialExpired,
        message: loginNotice
      });
    } catch (err) {
      console.error('Erro no login:', err);
      sendJson(res, 500, { error: 'Erro ao processar login: ' + err.message });
    }
    return;
  }

  // --- Obter Usuário Atual (Me) ---
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const auth = authenticateUser(req);
    if (!auth) {
      sendJson(res, 401, { error: 'Não autenticado.' });
      return;
    }
    sendJson(res, 200, { user: sanitizeUser(auth.user) });
    return;
  }

  // --- Heartbeat de Sessão (Monitor de Desconexão por limite de telas ou expiração de teste) ---
  if (pathname === '/api/auth/heartbeat' && req.method === 'POST') {
    const auth = authenticateUser(req);
    if (!auth) {
      sendJson(res, 401, { error: 'UNAUTHORIZED' });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const sessionId = body.sessionId || auth.payload.sessionId;

      const check = db.heartbeatSession(sessionId);
      if (!check.valid) {
        const isTrialExp = check.reason === 'TRIAL_EXPIRED';
        sendJson(res, 403, { 
          error: isTrialExp ? 'TRIAL_EXPIRED' : 'SESSION_TERMINATED', 
          code: check.reason,
          reason: isTrialExp
            ? 'Seu período de teste gratuito de 2 horas encerrou. Para continuar assistindo aos mais de 400 canais, filmes e séries, assine agora um de nossos planos!'
            : (check.reason === 'LOGGED_IN_ANOTHER_DEVICE'
              ? 'Sua conta atingiu o limite de telas simultâneas e foi conectada em outro dispositivo.'
              : 'Sua sessão foi encerrada.'),
          expired: isTrialExp
        });
        return;
      }

      sendJson(res, 200, { 
        status: 'active', 
        user: sanitizeUser(auth.user) 
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // --- Logout ---
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const auth = authenticateUser(req);
      const sessionId = body.sessionId || auth?.payload?.sessionId;
      if (sessionId) db.terminateSession(sessionId);
      sendJson(res, 200, { message: 'Logout efetuado.' });
    } catch {
      sendJson(res, 200, { message: 'Logout efetuado.' });
    }
    return;
  }

  // --- Criar Pagamento Pix no Mercado Pago ---
  if (pathname === '/api/pagamentos/pix' && req.method === 'POST') {
    const auth = authenticateUser(req);
    if (!auth) {
      sendJson(res, 401, { error: 'Você precisa estar logado para assinar um plano.' });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const planId = body.planId || body.planoId;
      const plano = PLANS[planId];

      if (!plano) {
        sendJson(res, 400, { error: 'Plano inválido ou não encontrado.' });
        return;
      }

      const mpResponse = await mercadoPagoService.criarPagamentoPix(auth.user, plano);
      const mpId = mpResponse.id;
      const td = mpResponse.point_of_interaction?.transaction_data || {};
      const qrCode = td.qr_code || '';
      const qrCodeBase64 = td.qr_code_base64 || '';

      const novoPagamento = db.createPagamento({
        userId: auth.user.id,
        mercadoPagoId: mpId,
        planoId: plano.id,
        valor: plano.valor,
        status: 'PENDING',
        qrCode,
        qrCodeBase64
      });

      sendJson(res, 201, {
        paymentId: novoPagamento.id,
        mercadoPagoId: mpId,
        plano,
        valor: plano.valor,
        qrCode,
        qrCodeBase64,
        status: 'PENDING'
      });
    } catch (err) {
      console.error('Erro ao gerar Pix no Mercado Pago:', err);
      sendJson(res, 500, { error: 'Erro ao gerar cobrança Pix: ' + err.message });
    }
    return;
  }

  // --- Consultar Status do Pagamento Pix ---
  const matchStatus = pathname.match(/^\/api\/pagamentos\/status\/([^/]+)$/);
  if (matchStatus && req.method === 'GET') {
    const paymentId = matchStatus[1];
    const pagamento = db.findPagamentoById(paymentId) || db.findPagamentoByMercadoPagoId(paymentId);

    if (!pagamento) {
      sendJson(res, 404, { error: 'Pagamento não encontrado.' });
      return;
    }

    // Se já estiver aprovado no banco, retorna imediatamente
    if (pagamento.status === 'APPROVED') {
      const user = db.findUserById(pagamento.userId);
      sendJson(res, 200, { status: 'APPROVED', user: sanitizeUser(user) });
      return;
    }

    try {
      if (pagamento.mercadoPagoId) {
        const mpStatus = await mercadoPagoService.consultarStatusPagamento(pagamento.mercadoPagoId);
        if (mpStatus && mpStatus.status === 'approved') {
          db.updatePagamento(pagamento.id, {
            status: 'APPROVED',
            dataConfirmacao: new Date().toISOString()
          });

          const plano = PLANS[pagamento.planoId];
          const duracaoDias = plano ? plano.duracaoDias : 30;
          const limiteTelas = plano ? plano.telas : 1;

          const user = db.findUserById(pagamento.userId);
          if (user) {
            const now = new Date();
            // Se já tiver assinatura ativa, adiciona os dias ao fim existente
            const baseDate = (user.assinaturaAtiva && user.fimAssinatura && new Date(user.fimAssinatura) > now)
              ? new Date(user.fimAssinatura)
              : now;
            
            const novoFim = new Date(baseDate.getTime() + (duracaoDias * 24 * 60 * 60 * 1000));

            db.updateUser(user.id, {
              assinaturaAtiva: true,
              planoId: plano ? plano.id : 'tela1-mensal',
              planoNome: plano ? plano.nome : 'Plano 1 Tela',
              limiteTelas,
              dataAssinatura: now.toISOString(),
              fimAssinatura: novoFim.toISOString()
            });

            console.log(`✅ Assinatura ativada com sucesso para ${user.email} (${plano?.nome || 'Plano'}) até ${novoFim.toISOString()}`);
          }

          sendJson(res, 200, { status: 'APPROVED', user: sanitizeUser(user) });
          return;
        }
      }

      sendJson(res, 200, { status: pagamento.status });
    } catch (err) {
      console.warn('Aviso ao consultar Mercado Pago:', err.message);
      sendJson(res, 200, { status: pagamento.status });
    }
    return;
  }

  // --- Webhook Oficial do Mercado Pago ---
  if (pathname === '/api/pagamentos/webhook' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      if (payload && (payload.type === 'payment' || payload.action === 'payment.updated')) {
        const mpId = payload.data?.id || payload.id;
        if (mpId) {
          const mpStatus = await mercadoPagoService.consultarStatusPagamento(mpId);
          if (mpStatus && mpStatus.status === 'approved') {
            const pagamento = db.findPagamentoByMercadoPagoId(mpId);
            if (pagamento && pagamento.status !== 'APPROVED') {
              db.updatePagamento(pagamento.id, {
                status: 'APPROVED',
                dataConfirmacao: new Date().toISOString()
              });

              const plano = PLANS[pagamento.planoId];
              const duracaoDias = plano ? plano.duracaoDias : 30;
              const limiteTelas = plano ? plano.telas : 1;
              const user = db.findUserById(pagamento.userId);

              if (user) {
                const now = new Date();
                const baseDate = (user.assinaturaAtiva && user.fimAssinatura && new Date(user.fimAssinatura) > now)
                  ? new Date(user.fimAssinatura)
                  : now;
                const novoFim = new Date(baseDate.getTime() + (duracaoDias * 24 * 60 * 60 * 1000));

                db.updateUser(user.id, {
                  assinaturaAtiva: true,
                  planoId: plano ? plano.id : 'tela1-mensal',
                  planoNome: plano ? plano.nome : 'Plano 1 Tela',
                  limiteTelas,
                  dataAssinatura: now.toISOString(),
                  fimAssinatura: novoFim.toISOString()
                });
                console.log(`✅ Webhook: Assinatura aprovada para ${user.email}`);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro no webhook:', err.message);
    }
    res.writeHead(200);
    res.end();
    return;
  }

  // --- Endpoint oficial de Proxy HLS ---
  if (pathname === '/api/proxy') {
    const targetUrl = parsedUrl.searchParams.get('url');
    const customReferer = parsedUrl.searchParams.get('referer');
    const customUa = parsedUrl.searchParams.get('ua');
    handleProxy(req, res, targetUrl, customReferer, customUa);
    return;
  }

  // --- Rota legada /stream-proxy/(http|https)/... para compatibilidade ---
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

  // --- Servir arquivos estáticos (SPA React) ---
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`🚀 Top Canais Server rodando na porta ${PORT}`);
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
