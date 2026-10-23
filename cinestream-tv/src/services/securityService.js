// Security & Anti-Inspection Protection Service
// Protege código-fonte, listas M3U/M3U8 e elementos contra inspeção (F12, DevTools, Ctrl+U, etc.)
// Usuários Master (como 'odonel' ou 'admin') possuem acesso liberado para depuração.

import { getAuthUser } from './authService';

// Guarda referências nativas do console para restauração caso o usuário seja Master
const nativeConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
  dir: console.dir.bind(console),
  table: console.table.bind(console),
  clear: console.clear.bind(console)
};

let currentSecurityUser = null;
let devToolsOpen = false;
let devToolsInterval = null;
let isInitialized = false;

/**
 * Verifica se um usuário possui privilégios de Master/Admin
 */
export function isMasterUser(user = null) {
  const u = user || currentSecurityUser || getAuthUser();
  if (!u) return false;

  const username = (u.username || '').toLowerCase().trim();
  const email = (u.email || '').toLowerCase().trim();
  const role = (u.role || '').toLowerCase().trim();

  // Usuário 'odonel' e roles de administrador têm liberação total
  return (
    username === 'odonel' ||
    email.startsWith('odonel') ||
    role === 'admin' ||
    role === 'master' ||
    u.isMaster === true
  );
}

/**
 * Silencia ou restaura o console dependendo do papel do usuário
 */
function applyConsoleSecurity(isMaster) {
  if (isMaster) {
    // Restaura métodos nativos completos para o usuário Master
    console.log = nativeConsole.log;
    console.warn = nativeConsole.warn;
    console.info = nativeConsole.info;
    console.error = nativeConsole.error;
    console.debug = nativeConsole.debug;
    console.dir = nativeConsole.dir;
    console.table = nativeConsole.table;
    console.clear = nativeConsole.clear;
    nativeConsole.log('👑 [Security] Modo Master ativo: Ferramentas de inspeção e depuração liberadas.');
  } else {
    // Silencia o console para não exibir URLs, tokens ou segmentos M3U
    const noop = () => {};
    console.log = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    console.dir = noop;
    console.table = noop;
    // error pode ser silencioso ou apenas registrar mensagem genérica sem stack trace
    console.error = noop;
    try {
      nativeConsole.clear();
    } catch (_) {}
  }
}

/**
 * Notifica a aplicação sobre mudança no estado das ferramentas de desenvolvedor
 */
function setDevToolsState(isOpen) {
  if (devToolsOpen !== isOpen) {
    devToolsOpen = isOpen;
    window.dispatchEvent(new CustomEvent('cinestream_devtools_alert', {
      detail: { isOpen, isMaster: isMasterUser() }
    }));
  }
}

/**
 * Intercepta teclas de inspeção de código (F12, Ctrl+Shift+I, etc.)
 */
function handleKeyDown(e) {
  if (isMasterUser()) return; // Usuário master tem permissão livre

  const key = e.key || '';
  const keyCode = e.keyCode || e.which;
  const isCtrl = e.ctrlKey || e.metaKey;
  const isShift = e.shiftKey;

  // F12
  if (key === 'F12' || keyCode === 123) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  // Ctrl + Shift + I (Inspecionar Elemento)
  if (isCtrl && isShift && (key === 'I' || key === 'i' || keyCode === 73)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  // Ctrl + Shift + J (Console DevTools)
  if (isCtrl && isShift && (key === 'J' || key === 'j' || keyCode === 74)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  // Ctrl + Shift + C (Inspecionar Elemento no DOM)
  if (isCtrl && isShift && (key === 'C' || key === 'c' || keyCode === 67)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  // Ctrl + Shift + K (Console no Firefox)
  if (isCtrl && isShift && (key === 'K' || key === 'k' || keyCode === 75)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  // Ctrl + Shift + E (Aba Network no Firefox)
  if (isCtrl && isShift && (key === 'E' || key === 'e' || keyCode === 69)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  // Ctrl + Shift + S (Depurador Firefox)
  if (isCtrl && isShift && (key === 'S' || key === 's' || keyCode === 83)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  // Ctrl + U (Ver Código Fonte da Página / View Source)
  if (isCtrl && (key === 'U' || key === 'u' || keyCode === 85)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }

  // Ctrl + S (Salvar Página Localmente)
  if (isCtrl && (key === 'S' || key === 's' || keyCode === 83)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }
}

/**
 * Bloqueia o menu de contexto (botão direito) para não-masters
 */
function handleContextMenu(e) {
  if (isMasterUser()) return; // Liberado para master
  e.preventDefault();
  e.stopPropagation();
  return false;
}

/**
 * Monitor ativo de detecção de DevTools
 */
function startDevToolsMonitor() {
  if (devToolsInterval) clearInterval(devToolsInterval);

  devToolsInterval = setInterval(() => {
    if (isMasterUser()) {
      if (devToolsOpen) setDevToolsState(false);
      return;
    }

    // 1. Verificação por discrepância de tamanho de tela (quando DevTools está acoplado)
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;

    let isDevOpen = widthDiff || heightDiff;

    // 2. Verificação de performance através de breakpoint evaluation
    if (!isDevOpen) {
      const startTime = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const duration = performance.now() - startTime;
      if (duration > 100) {
        isDevOpen = true;
      }
    }

    setDevToolsState(isDevOpen);
  }, 600);
}

/**
 * Inicializa os ouvintes e regras de proteção do aplicativo
 */
export function initSecurityProtection(initialUser = null) {
  if (isInitialized) {
    updateSecurityUser(initialUser);
    return;
  }

  currentSecurityUser = initialUser || getAuthUser();
  const isMaster = isMasterUser(currentSecurityUser);

  applyConsoleSecurity(isMaster);

  // Escuta teclas de atalho com captura prioritária
  window.addEventListener('keydown', handleKeyDown, true);

  // Escuta clique direito com captura prioritária
  window.addEventListener('contextmenu', handleContextMenu, true);

  // Inicia o monitor de DevTools
  startDevToolsMonitor();

  // Escuta alterações de autenticação
  window.addEventListener('cinestream_auth_changed', (e) => {
    updateSecurityUser(e.detail?.user || null);
  });

  isInitialized = true;
}

/**
 * Atualiza o usuário autenticado na segurança (quando loga, desloga ou troca de conta)
 */
export function updateSecurityUser(user) {
  currentSecurityUser = user;
  const isMaster = isMasterUser(user);
  applyConsoleSecurity(isMaster);
  if (isMaster) {
    setDevToolsState(false);
  }
}
