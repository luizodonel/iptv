import crypto from 'node:crypto';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'oninha-tv-super-secret-key-2026-xyz987';

export const PLANS = {
  'tela1-mensal': {
    id: 'tela1-mensal',
    nome: 'Plano 1 Tela (Mensal)',
    telas: 1,
    duracaoDias: 30,
    valor: 14.90,
    descricao: 'Acesso completo a todos os canais, filmes e séries em 1 tela simultânea por 30 dias.'
  },
  'tela2-mensal': {
    id: 'tela2-mensal',
    nome: 'Plano 2 Telas (Mensal)',
    telas: 2,
    duracaoDias: 30,
    valor: 19.90,
    descricao: 'Acesso completo para até 2 telas simultâneas por 30 dias. Ideal para compartilhar!'
  },
  'tela1-anual': {
    id: 'tela1-anual',
    nome: 'Plano 1 Tela (Anual)',
    telas: 1,
    duracaoDias: 365,
    valor: 120.00,
    descricao: '1 ano completo de acesso em 1 tela simultânea com o melhor custo-benefício.'
  },
  'tela2-anual': {
    id: 'tela2-anual',
    nome: 'Plano 2 Telas (Anual)',
    telas: 2,
    duracaoDias: 365,
    valor: 180.00,
    descricao: '1 ano completo para até 2 telas simultâneas. Economia máxima para a família!'
  }
};

/**
 * Cria hash de senha seguro usando scrypt nativo
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Valida a senha contra o hash armazenado
 */
export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
}

/**
 * Gera token de sessão assinado HMAC-SHA256
 */
export function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 dias de expiração
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verifica e decodifica o token
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  
  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expirado
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verifica se a assinatura do usuário ainda está válida (não expirada)
 */
export function isUserSubscriptionActive(user) {
  if (!user || !user.assinaturaAtiva || !user.fimAssinatura) return false;
  const now = new Date();
  const end = new Date(user.fimAssinatura);
  return now < end;
}

/**
 * Sanitiza o objeto de usuário removendo dados confidenciais
 */
export function sanitizeUser(user) {
  if (!user) return null;
  const { senhaHash, ...safe } = user;
  safe.assinaturaAtiva = isUserSubscriptionActive(user);
  return safe;
}
