import crypto from 'node:crypto';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'top-canais-tv-super-secret-key-2026-xyz987';
const LEGACY_JWT_SECRET = 'oninha-tv-super-secret-key-2026-xyz987';

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
  },
  'teste-2h': {
    id: 'teste-2h',
    nome: 'Teste Grátis (2 Horas)',
    telas: 1,
    duracaoHoras: 2,
    valor: 0.00,
    descricao: '2 horas de degustação gratuita para testar todos os canais ao vivo, filmes e séries.'
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
  let isValid = (signature === expectedSig);
  if (!isValid) {
    const legacySig = crypto.createHmac('sha256', LEGACY_JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    isValid = (signature === legacySig);
  }
  
  if (!isValid) return null;

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
  if (!user) return false;
  const username = (user.username || '').toLowerCase().trim();
  if (username === 'odonel' || user.role === 'admin' || user.isMaster) return true;
  if (!user.assinaturaAtiva || !user.fimAssinatura) return false;
  const now = new Date();
  const end = new Date(user.fimAssinatura);
  return now < end;
}

export const RESELLER_PLANS = {
  mensal: {
    id: 'mensal',
    nome: 'Mensal',
    duracaoDias: 30,
    preco: 12.50,
    preco10: 10.00,
    preco50: 8.00,
    custoMes: 12.50,
    descricao: '1 crédito = 1 tela por 30 dias (R$ 12,50 | R$ 10,00 de 10 a 49 | R$ 8,00 para 50+)'
  },
  trimestral: {
    id: 'trimestral',
    nome: 'Trimestral',
    duracaoDias: 90,
    preco: 28.00,
    preco10: 24.00,
    preco50: 20.00,
    custoMes: 9.33,
    descricao: '1 crédito = 1 tela por 90 dias (R$ 28,00 | R$ 24,00 de 10 a 49 | R$ 20,00 para 50+)'
  },
  semestral: {
    id: 'semestral',
    nome: 'Semestral',
    duracaoDias: 180,
    preco: 48.00,
    preco10: 42.00,
    preco50: 36.00,
    custoMes: 8.00,
    descricao: '1 crédito = 1 tela por 180 dias (R$ 48,00 | R$ 42,00 de 10 a 49 | R$ 36,00 para 50+)'
  },
  anual: {
    id: 'anual',
    nome: 'Anual',
    duracaoDias: 365,
    preco: 80.00,
    preco10: 72.00,
    preco50: 60.00,
    custoMes: 6.67,
    descricao: '1 crédito = 1 tela por 365 dias (R$ 80,00 | R$ 72,00 de 10 a 49 | R$ 60,00 para 50+)'
  }
};

/**
 * Retorna o preço unitário do crédito para o plano conforme a quantidade (faixas de desconto)
 */
export function getResellerUnitPrice(planoKey, quantidade = 1) {
  const pKey = String(planoKey || '').toLowerCase().trim();
  const plan = RESELLER_PLANS[pKey];
  if (!plan) return 0;
  const qtd = Math.max(1, parseInt(quantidade, 10) || 1);
  if (qtd >= 50 && plan.preco50 !== undefined) {
    return plan.preco50;
  }
  if (qtd >= 10 && plan.preco10 !== undefined) {
    return plan.preco10;
  }
  return plan.preco;
}

/**
 * Validação de CPF com cálculo oficial de dígitos verificadores
 */
export function isValidCpf(cpf) {
  const clean = String(cpf || '').replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

/**
 * Validação de CNPJ com cálculo oficial de dígitos verificadores
 */
export function isValidCnpj(cnpj) {
  const clean = String(cnpj || '').replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  let digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;

  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;

  return true;
}

/**
 * Valida se é um CPF (11 dígitos) ou CNPJ (14 dígitos) válido
 */
export function isValidCpfOrCnpj(val) {
  const clean = String(val || '').replace(/\D/g, '');
  if (clean.length === 11) return isValidCpf(clean);
  if (clean.length === 14) return isValidCnpj(clean);
  return false;
}

/**
 * Formata CPF ou CNPJ com pontuação padrão
 */
export function formatCpfCnpj(val) {
  const clean = String(val || '').replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return val;
}

/**
 * Sanitiza o objeto de usuário removendo dados confidenciais
 */
export function sanitizeUser(user) {
  if (!user) return null;
  const { senhaHash, ...safe } = user;
  const username = (user.username || '').toLowerCase().trim();
  const isMaster = username === 'odonel' || user.role === 'admin' || user.isMaster === true;

  if (isMaster) {
    safe.isMaster = true;
    safe.role = 'admin';
    safe.assinaturaAtiva = true;
    safe.planoId = safe.planoId || 'vitalicio';
    safe.planoNome = safe.planoNome || '👑 Master Vitalício';
    safe.limiteTelas = 999;
  } else if (user.role === 'reseller') {
    safe.isMaster = false;
    safe.isReseller = true;
    safe.role = 'reseller';
    safe.status = user.status || 'ativo';
    safe.assinaturaAtiva = true;
    safe.creditos = {
      mensal: Number(user.creditosMensal) || 0,
      trimestral: Number(user.creditosTrimestral) || 0,
      semestral: Number(user.creditosSemestral) || 0,
      anual: Number(user.creditosAnual) || 0
    };
    safe.linkExclusivo = user.linkExclusivo || '';
    safe.nomeLoja = user.nomeLoja || '';
  } else {
    safe.isMaster = false;
    safe.isReseller = false;
    safe.role = user.role || 'user';
    safe.resellerId = user.resellerId || null;
    safe.resellerNomeLoja = user.resellerNomeLoja || null;
    safe.assinaturaAtiva = isUserSubscriptionActive(user);

    if (user.planoId === 'teste-2h') {
      safe.isTrial = true;
      if (safe.assinaturaAtiva && user.fimAssinatura) {
        safe.trialSecondsRemaining = Math.max(0, Math.floor((new Date(user.fimAssinatura).getTime() - Date.now()) / 1000));
        safe.trialExpiresAt = user.fimAssinatura;
      } else {
        safe.trialSecondsRemaining = 0;
        safe.trialExpired = true;
      }
    }
  }

  return safe;
}

