import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { db } from './db.js';
import { 
  PLANS, 
  hashPassword, 
  verifyPassword, 
  generateToken, 
  verifyToken, 
  sanitizeUser, 
  isUserSubscriptionActive 
} from './authService.js';
import { mercadoPagoService } from './mercadoPagoService.js';

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
    sendJson(res, 200, { plans: Object.values(PLANS) });
    return;
  }

  // --- Cadastro de Usuário ---
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

      const senhaHash = hashPassword(senha);
      const user = db.createUser({ 
        username: cleanUsername, 
        nome: nome || cleanUsername, 
        telefone: cleanTelefone, 
        email, 
        senhaHash, 
        cpf 
      });

      // Cria a sessão com limite de 1 tela por padrão (até assinar plano de 2 telas)
      const session = db.createSession(user.id, deviceId, deviceInfo, user.limiteTelas || 1);
      const token = generateToken({ userId: user.id, sessionId: session.id });

      sendJson(res, 201, {
        token,
        sessionId: session.id,
        user: sanitizeUser(user),
        message: 'Cadastro realizado com sucesso!'
      });
    } catch (err) {
      console.error('Erro no cadastro:', err);
      sendJson(res, 500, { error: 'Erro ao processar cadastro: ' + err.message });
    }
    return;
  }

  // --- Login de Usuário (por Nome de Usuário ou E-mail) com Limite de Telas ---
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

      // Regra de telas simultâneas:
      // Se plano tem 1 tela: desconecta qualquer outro dispositivo logado.
      // Se plano tem 2 telas: se já houver 2 telas, desconecta a mais antiga.
      const maxScreens = user.limiteTelas || 1;
      const session = db.createSession(user.id, deviceId, deviceInfo, maxScreens);
      const token = generateToken({ userId: user.id, sessionId: session.id });

      sendJson(res, 200, {
        token,
        sessionId: session.id,
        user: sanitizeUser(user),
        message: 'Login realizado com sucesso!'
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

  // --- Heartbeat de Sessão (Monitor de Desconexão por limite de telas) ---
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
        sendJson(res, 403, { 
          error: 'SESSION_TERMINATED', 
          reason: check.reason === 'LOGGED_IN_ANOTHER_DEVICE'
            ? 'Sua conta atingiu o limite de telas simultâneas e foi conectada em outro dispositivo.'
            : 'Sua sessão foi encerrada.'
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
      const { planId } = body;
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
