// Client-side authentication and payment service

const TOKEN_KEY = 'cinestream_token';
const USER_KEY = 'cinestream_user';
const SESSION_KEY = 'cinestream_session_id';
const DEVICE_KEY = 'cinestream_device_id';

export function getDeviceId() {
  let devId = localStorage.getItem(DEVICE_KEY);
  if (!devId) {
    devId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem(DEVICE_KEY, devId);
  }
  return devId;
}

export function getDeviceInfo() {
  const ua = navigator.userAgent;
  let dev = 'Navegador Web';
  if (/Android/i.test(ua)) dev = 'Dispositivo Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) dev = 'Dispositivo Apple iOS';
  else if (/Windows/i.test(ua)) dev = 'Computador Windows';
  else if (/Macintosh/i.test(ua)) dev = 'Computador Mac';
  else if (/Linux/i.test(ua)) dev = 'Dispositivo Linux';
  return dev;
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function getSessionId() {
  return localStorage.getItem(SESSION_KEY) || null;
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthData(token, user, sessionId) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (sessionId) localStorage.setItem(SESSION_KEY, sessionId);
  window.dispatchEvent(new CustomEvent('cinestream_auth_changed', { detail: { user } }));
}

export function clearAuthData() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent('cinestream_auth_changed', { detail: { user: null } }));
}

export async function fetchPlans() {
  try {
    const res = await fetch('/api/auth/plans');
    if (res.ok) {
      const data = await res.json();
      return data.plans || [];
    }
  } catch (err) {
    console.warn('Erro ao carregar planos:', err);
  }
  return [];
}

export async function registerUser({ username, telefone, senha, confirmarSenha, email, nome, cpf }) {
  const deviceId = getDeviceId();
  const deviceInfo = getDeviceInfo();

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      username, 
      telefone, 
      senha, 
      confirmarSenha, 
      email, 
      nome, 
      cpf, 
      deviceId, 
      deviceInfo 
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao cadastrar usuário.');
  }

  setAuthData(data.token, data.user, data.sessionId);
  return data;
}

export async function loginUser({ username, email, senha }) {
  const deviceId = getDeviceId();
  const deviceInfo = getDeviceInfo();

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      username: username || email, 
      senha, 
      deviceId, 
      deviceInfo 
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao realizar login.');
  }

  setAuthData(data.token, data.user, data.sessionId);
  return data;
}

export async function logoutUser() {
  const token = getAuthToken();
  const sessionId = getSessionId();

  try {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId })
      });
    }
  } catch (_) {}

  clearAuthData();
}

export async function checkHeartbeat() {
  const token = getAuthToken();
  const sessionId = getSessionId();
  if (!token || !sessionId) return null;

  try {
    const res = await fetch('/api/auth/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ sessionId })
    });

    if (res.status === 403 || res.status === 401) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'SESSION_TERMINATED' || res.status === 403) {
        clearAuthData();
        window.dispatchEvent(new CustomEvent('cinestream_session_terminated', { 
          detail: { reason: data.reason || 'Sua conta foi conectada em outro dispositivo.' } 
        }));
        return { terminated: true, reason: data.reason };
      }
    }

    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return { active: true, user: data.user };
      }
    }
  } catch (err) {
    console.warn('Heartbeat check error:', err);
  }
  return null;
}

export async function createPixPayment(planId) {
  const token = getAuthToken();
  if (!token) throw new Error('Você precisa estar logado para assinar.');

  const res = await fetch('/api/pagamentos/pix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ planId })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao gerar Pix no Mercado Pago.');
  }

  return data;
}

export async function checkPixStatus(paymentId) {
  const token = getAuthToken();
  const res = await fetch(`/api/pagamentos/status/${paymentId}`, {
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao consultar status do pagamento.');
  }

  if (data.status === 'APPROVED' && data.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    window.dispatchEvent(new CustomEvent('cinestream_auth_changed', { detail: { user: data.user } }));
  }

  return data;
}
