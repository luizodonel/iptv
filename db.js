import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Garante que o diretório de dados existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_DATA = {
  users: [],
  sessions: [],
  pagamentos: []
};

class Database {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Erro ao ler database.json, iniciando novo:', err.message);
    }
    this.save(DEFAULT_DATA);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  save(dataToSave = this.data) {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Erro ao salvar database.json:', err.message);
    }
  }

  // --- Usuários ---
  findUserByUsername(username) {
    if (!username) return null;
    const clean = username.trim().toLowerCase();
    return this.data.users.find(u => (u.username && u.username.toLowerCase() === clean)) || null;
  }

  findUserByEmail(email) {
    if (!email) return null;
    return this.data.users.find(u => (u.email && u.email.toLowerCase() === email.trim().toLowerCase())) || null;
  }

  findUserByLogin(login) {
    if (!login) return null;
    const clean = login.trim().toLowerCase();
    return this.data.users.find(u => 
      (u.username && u.username.toLowerCase() === clean) || 
      (u.email && u.email.toLowerCase() === clean)
    ) || null;
  }

  findUserById(id) {
    if (!id) return null;
    return this.data.users.find(u => u.id === id) || null;
  }

  createUser(userData) {
    const rawUsername = (userData.username || userData.nome || '').trim();
    const cleanUsername = rawUsername.replace(/\s+/g, '').toLowerCase();
    const email = userData.email ? userData.email.trim().toLowerCase() : `${cleanUsername}@oninha.tv`;

    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      username: cleanUsername,
      nome: userData.nome ? userData.nome.trim() : rawUsername,
      telefone: userData.telefone ? userData.telefone.trim() : '',
      email,
      senhaHash: userData.senhaHash,
      cpf: userData.cpf ? userData.cpf.replace(/\D/g, '') : '',
      createdAt: new Date().toISOString(),
      assinaturaAtiva: false,
      planoId: null,
      planoNome: null,
      limiteTelas: 1,
      dataAssinatura: null,
      fimAssinatura: null
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  updateUser(id, updates) {
    const user = this.findUserById(id);
    if (!user) return null;
    Object.assign(user, updates);
    this.save();
    return user;
  }

  // --- Sessões & Controle de Telas Simultâneas ---
  getActiveSessions(userId) {
    return this.data.sessions.filter(s => s.userId === userId && s.isActive);
  }

  findSession(sessionId) {
    return this.data.sessions.find(s => s.id === sessionId) || null;
  }

  createSession(userId, deviceId, deviceInfo, maxScreens = 1) {
    // Busca sessões ativas atuais
    const active = this.getActiveSessions(userId);

    // Se a mesma máquina/deviceId já tinha uma sessão ativa, desativa a anterior
    active.forEach(s => {
      if (s.deviceId === deviceId) {
        s.isActive = false;
        s.terminatedReason = 'SAME_DEVICE_RELOGIN';
      }
    });

    // Filtra as sessões ainda ativas
    const remainingActive = this.getActiveSessions(userId);

    // Se atingiu o limite de telas simultâneas do plano (ex: 1 tela ou 2 telas)
    // Desconecta a(s) sessão(ões) mais antiga(s) para dar lugar à nova!
    if (remainingActive.length >= maxScreens) {
      // Ordena por lastHeartbeat ascendente (a mais antiga primeiro)
      remainingActive.sort((a, b) => new Date(a.lastHeartbeat || a.createdAt) - new Date(b.lastHeartbeat || b.createdAt));
      const sessionsToKickCount = (remainingActive.length - maxScreens) + 1;
      for (let i = 0; i < sessionsToKickCount; i++) {
        if (remainingActive[i]) {
          remainingActive[i].isActive = false;
          remainingActive[i].terminatedReason = 'LOGGED_IN_ANOTHER_DEVICE';
          remainingActive[i].terminatedAt = new Date().toISOString();
        }
      }
    }

    const newSession = {
      id: 'ses_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      userId,
      deviceId: deviceId || 'dev_' + Math.random().toString(36).substring(2, 8),
      deviceInfo: deviceInfo || 'Navegador Web',
      createdAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      isActive: true,
      terminatedReason: null
    };

    this.data.sessions.push(newSession);
    this.save();
    return newSession;
  }

  heartbeatSession(sessionId) {
    const session = this.findSession(sessionId);
    if (!session) return { valid: false, reason: 'SESSION_NOT_FOUND' };
    if (!session.isActive) {
      return { valid: false, reason: session.terminatedReason || 'LOGGED_IN_ANOTHER_DEVICE' };
    }
    session.lastHeartbeat = new Date().toISOString();
    this.save();
    return { valid: true };
  }

  terminateSession(sessionId) {
    const session = this.findSession(sessionId);
    if (session) {
      session.isActive = false;
      session.terminatedReason = 'LOGGED_OUT';
      session.terminatedAt = new Date().toISOString();
      this.save();
    }
  }

  // --- Pagamentos ---
  createPagamento(pagamentoData) {
    const novoPagamento = {
      id: 'pag_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      userId: pagamentoData.userId,
      mercadoPagoId: pagamentoData.mercadoPagoId ? String(pagamentoData.mercadoPagoId) : null,
      planoId: pagamentoData.planoId,
      valor: pagamentoData.valor,
      status: pagamentoData.status || 'PENDING',
      qrCode: pagamentoData.qrCode || '',
      qrCodeBase64: pagamentoData.qrCodeBase64 || '',
      dataCriacao: new Date().toISOString(),
      dataConfirmacao: null
    };
    this.data.pagamentos.push(novoPagamento);
    this.save();
    return novoPagamento;
  }

  findPagamentoById(id) {
    return this.data.pagamentos.find(p => p.id === id) || null;
  }

  findPagamentoByMercadoPagoId(mpId) {
    if (!mpId) return null;
    return this.data.pagamentos.find(p => p.mercadoPagoId === String(mpId)) || null;
  }

  updatePagamento(id, updates) {
    const pagamento = this.findPagamentoById(id);
    if (!pagamento) return null;
    Object.assign(pagamento, updates);
    this.save();
    return pagamento;
  }
}

export const db = new Database();
