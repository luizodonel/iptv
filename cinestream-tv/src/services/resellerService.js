// Client service for CineStream B2B / Revenda Module
import { getAuthToken } from './authService.js';

export const RESELLER_PLANS = {
  mensal: {
    id: 'mensal',
    nome: 'Plano Mensal',
    duracaoDias: 30,
    preco: 12.50,
    preco10: 10.00,
    preco50: 8.00,
    custoMes: 12.50,
    compraMinima: 5,
    badge: '30 dias',
    descricao: '1 crédito = 1 tela com vigência de 30 dias (Mínimo 5 un).'
  },
  trimestral: {
    id: 'trimestral',
    nome: 'Plano Trimestral',
    duracaoDias: 90,
    preco: 28.00,
    preco10: 24.00,
    preco50: 20.00,
    custoMes: 9.33,
    compraMinima: 5,
    badge: '90 dias (3 meses)',
    descricao: '1 crédito = 1 tela com vigência de 90 dias (Mínimo 5 un).'
  },
  semestral: {
    id: 'semestral',
    nome: 'Plano Semestral',
    duracaoDias: 180,
    preco: 48.00,
    preco10: 42.00,
    preco50: 36.00,
    custoMes: 8.00,
    compraMinima: 1,
    badge: '180 dias (6 meses)',
    descricao: '1 crédito = 1 tela com vigência de 180 dias.'
  },
  anual: {
    id: 'anual',
    nome: 'Plano Anual',
    duracaoDias: 365,
    preco: 80.00,
    preco10: 72.00,
    preco50: 60.00,
    custoMes: 6.67,
    compraMinima: 1,
    badge: '365 dias (1 ano)',
    descricao: '1 crédito = 1 tela com vigência de 1 ano completo.'
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
 * Validação de CPF brasileiro
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
 * Validação de CNPJ brasileiro
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

export function isValidCpfOrCnpj(val) {
  const clean = String(val || '').replace(/\D/g, '');
  if (clean.length === 11) return isValidCpf(clean);
  if (clean.length === 14) return isValidCnpj(clean);
  return false;
}

export function formatCpfCnpj(val) {
  const clean = String(val || '').replace(/\D/g, '');
  if (clean.length <= 11) {
    return clean
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
      .slice(0, 14);
  }
  return clean
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
    .slice(0, 18);
}

export function formatPhone(val) {
  const clean = String(val || '').replace(/\D/g, '');
  if (clean.length <= 10) {
    return clean
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/^(\(\d{2}\)\s\d{4})(\d)/, '$1-$2')
      .slice(0, 14);
  }
  return clean
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/^(\(\d{2}\)\s\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
}

// --- Funções de API de Revenda ---

function getHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export async function resellerRegister(payload) {
  const res = await fetch('/api/reseller/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar lojista.');
  return data;
}

export async function resellerLogin(payload) {
  const res = await fetch('/api/reseller/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao realizar login.');
  return data;
}

export async function getResellerMe() {
  const res = await fetch('/api/reseller/me', {
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao obter dados do revendedor.');
  return data;
}

export async function updateResellerProfile(payload) {
  const res = await fetch('/api/reseller/profile', {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao salvar configurações do lojista.');
  return data;
}

export async function buyResellerCredits(plano, quantidade) {
  const res = await fetch('/api/reseller/credits/buy', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ plano, quantidade })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao gerar Pix de créditos.');
  return data;
}

export async function checkResellerOrderStatus(orderId) {
  const res = await fetch(`/api/reseller/credits/order-status/${orderId}`, {
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao consultar pedido.');
  return data;
}

export async function simulateApproveCreditsOrder(orderId) {
  const res = await fetch('/api/reseller/credits/simulate-approve', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ orderId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao simular aprovação.');
  return data;
}

export async function getResellerClients() {
  const res = await fetch('/api/reseller/clients', {
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar clientes.');
  return data.clients || [];
}

export async function createResellerClient(payload) {
  const res = await fetch('/api/reseller/clients', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao criar cliente.');
  return data;
}

export async function renewResellerClient(clientId, plano, telas) {
  const res = await fetch('/api/reseller/clients/renew', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ clientId, plano, telas })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao renovar cliente.');
  return data;
}

export async function resetResellerClientPassword(clientId, newPassword) {
  const res = await fetch('/api/reseller/clients/reset-password', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ clientId, newPassword })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha.');
  return data;
}

export async function kickResellerClient(clientId) {
  const res = await fetch('/api/reseller/clients/kick', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ clientId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao derrubar sessão.');
  return data;
}

export async function getResellerTransactions() {
  const res = await fetch('/api/reseller/transactions', {
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar transações.');
  return data.transactions || [];
}

export async function getResellerOrders() {
  const res = await fetch('/api/reseller/orders', {
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar pedidos.');
  return data.orders || [];
}

// --- Funções Master para Gestão de Revendedores ---

export async function getMasterResellers() {
  const res = await fetch('/api/master/resellers', {
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar revendedores.');
  return data.resellers || [];
}

export async function updateMasterResellerStatus(resellerId, status) {
  const res = await fetch('/api/master/resellers/status', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ resellerId, status })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao alterar status.');
  return data;
}

export async function adjustMasterResellerCredits(resellerId, plano, delta, motivo) {
  const res = await fetch('/api/master/resellers/adjust-credits', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ resellerId, plano, delta, motivo })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao ajustar créditos.');
  return data;
}

export async function resetMasterResellerPassword(resellerId, newPassword) {
  const res = await fetch('/api/master/resellers/reset-password', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ resellerId, newPassword })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao redefinir senha.');
  return data;
}

export async function deleteMasterReseller(resellerId) {
  const res = await fetch(`/api/master/resellers/${resellerId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao excluir revendedor.');
  return data;
}

export async function getMasterResellerClients(resellerId = null) {
  const url = resellerId 
    ? `/api/master/resellers/clients?resellerId=${encodeURIComponent(resellerId)}`
    : '/api/master/resellers/clients';
  const res = await fetch(url, {
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar clientes de revenda.');
  return data.clients || [];
}

export async function getMasterResellerTransactions() {
  const res = await fetch('/api/master/resellers/transactions', {
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar transações globais.');
  return data.transactions || [];
}

export async function getMasterResellerOrders() {
  const res = await fetch('/api/master/resellers/orders', {
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar pedidos de revenda.');
  return data.orders || [];
}
