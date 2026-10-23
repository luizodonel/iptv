import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_DATA = {
  users: [],
  sessions: [],
  pagamentos: []
};

// Configuração do pool de conexão com PostgreSQL
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://iptvusuario:QgO0Un4PlKNLWRXUwJng5nJBDodBEXHjFH9RYnDPH2gIaYqZoM1fGyM59bhhmvws@dh9buqsx9ote6ny5nuxon7ob:5432/postgres';

class Database {
  constructor() {
    this.data = this.loadLocal();
    this.pool = null;
    this.initPostgres();
  }

  loadLocal() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Erro ao ler database.json local:', err.message);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  saveLocal(dataToSave = this.data) {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Erro ao salvar database.json local:', err.message);
    }
  }

  async initPostgres() {
    if (!DATABASE_URL) return;

    try {
      this.pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      });

      // Criação das tabelas
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          nome VARCHAR(255),
          telefone VARCHAR(50),
          email VARCHAR(255),
          senha_hash TEXT NOT NULL,
          cpf VARCHAR(30),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          assinatura_ativa BOOLEAN DEFAULT FALSE,
          plano_id VARCHAR(50),
          plano_nome VARCHAR(100),
          limite_telas INT DEFAULT 1,
          data_assinatura TIMESTAMPTZ,
          fim_assinatura TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          device_id VARCHAR(100),
          device_info VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE,
          terminated_reason VARCHAR(100),
          terminated_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS pagamentos (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          mercado_pago_id VARCHAR(100),
          plano_id VARCHAR(50),
          valor NUMERIC(10, 2),
          status VARCHAR(50) DEFAULT 'PENDING',
          qr_code TEXT,
          qr_code_base64 TEXT,
          data_criacao TIMESTAMPTZ DEFAULT NOW(),
          data_confirmacao TIMESTAMPTZ
        );
      `);

      // Carrega registros existentes no PostgreSQL para a memória
      const [uRes, sRes, pRes] = await Promise.all([
        this.pool.query('SELECT * FROM users;'),
        this.pool.query('SELECT * FROM sessions;'),
        this.pool.query('SELECT * FROM pagamentos;')
      ]);

      if (uRes.rows.length > 0) {
        this.data.users = uRes.rows.map(r => ({
          id: r.id,
          username: r.username,
          nome: r.nome,
          telefone: r.telefone,
          email: r.email,
          senhaHash: r.senha_hash,
          cpf: r.cpf,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          assinaturaAtiva: r.assinatura_ativa,
          planoId: r.plano_id,
          planoNome: r.plano_nome,
          limiteTelas: r.limite_telas || 1,
          dataAssinatura: r.data_assinatura ? new Date(r.data_assinatura).toISOString() : null,
          fimAssinatura: r.fim_assinatura ? new Date(r.fim_assinatura).toISOString() : null
        }));

        this.data.sessions = sRes.rows.map(r => ({
          id: r.id,
          userId: r.user_id,
          deviceId: r.device_id,
          deviceInfo: r.device_info,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          lastHeartbeat: r.last_heartbeat ? new Date(r.last_heartbeat).toISOString() : new Date().toISOString(),
          isActive: r.is_active,
          terminatedReason: r.terminated_reason,
          terminatedAt: r.terminated_at ? new Date(r.terminated_at).toISOString() : null
        }));

        this.data.pagamentos = pRes.rows.map(r => ({
          id: r.id,
          userId: r.user_id,
          mercadoPagoId: r.mercado_pago_id,
          planoId: r.plano_id,
          valor: Number(r.valor),
          status: r.status,
          qrCode: r.qr_code,
          qrCodeBase64: r.qr_code_base64,
          dataCriacao: r.data_criacao ? new Date(r.data_criacao).toISOString() : new Date().toISOString(),
          dataConfirmacao: r.data_confirmacao ? new Date(r.data_confirmacao).toISOString() : null
        }));
        console.log(`✅ PostgreSQL carregado com sucesso: ${uRes.rows.length} usuários, ${sRes.rows.length} sessões, ${pRes.rows.length} pagamentos.`);
      } else if (this.data.users.length > 0) {
        // Se o PostgreSQL estiver vazio, migra dados locais para o banco
        console.log('🔄 Migrando dados locais para o PostgreSQL...');
        for (const u of this.data.users) {
          await this.pgInsertUser(u);
        }
        for (const s of this.data.sessions) {
          await this.pgInsertSession(s);
        }
        for (const p of this.data.pagamentos) {
          await this.pgInsertPagamento(p);
        }
      }

      this.saveLocal();
    } catch (err) {
      console.error('⚠️ Aviso: Conexão direta com PostgreSQL falhou, mantendo cache local:', err.message);
    }
  }

  // --- Operações assíncronas no PostgreSQL ---
  async pgInsertUser(u) {
    if (!this.pool) return;
    try {
      await this.pool.query(`
        INSERT INTO users (id, username, nome, telefone, email, senha_hash, cpf, created_at, assinatura_ativa, plano_id, plano_nome, limite_telas, data_assinatura, fim_assinatura)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          nome = EXCLUDED.nome,
          telefone = EXCLUDED.telefone,
          email = EXCLUDED.email,
          assinatura_ativa = EXCLUDED.assinatura_ativa,
          plano_id = EXCLUDED.plano_id,
          plano_nome = EXCLUDED.plano_nome,
          limite_telas = EXCLUDED.limite_telas,
          data_assinatura = EXCLUDED.data_assinatura,
          fim_assinatura = EXCLUDED.fim_assinatura;
      `, [
        u.id, u.username, u.nome, u.telefone, u.email, u.senhaHash, u.cpf,
        u.createdAt, u.assinaturaAtiva, u.planoId, u.planoNome, u.limiteTelas,
        u.dataAssinatura, u.fimAssinatura
      ]);
    } catch (err) {
      console.error('Erro pgInsertUser:', err.message);
    }
  }

  async pgInsertSession(s) {
    if (!this.pool) return;
    try {
      await this.pool.query(`
        INSERT INTO sessions (id, user_id, device_id, device_info, created_at, last_heartbeat, is_active, terminated_reason, terminated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          last_heartbeat = EXCLUDED.last_heartbeat,
          is_active = EXCLUDED.is_active,
          terminated_reason = EXCLUDED.terminated_reason,
          terminated_at = EXCLUDED.terminated_at;
      `, [
        s.id, s.userId, s.deviceId, s.deviceInfo, s.createdAt, s.lastHeartbeat,
        s.isActive, s.terminatedReason, s.terminatedAt
      ]);
    } catch (err) {
      console.error('Erro pgInsertSession:', err.message);
    }
  }

  async pgInsertPagamento(p) {
    if (!this.pool) return;
    try {
      await this.pool.query(`
        INSERT INTO pagamentos (id, user_id, mercado_pago_id, plano_id, valor, status, qr_code, qr_code_base64, data_criacao, data_confirmacao)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          data_confirmacao = EXCLUDED.data_confirmacao;
      `, [
        p.id, p.userId, p.mercadoPagoId, p.planoId, p.valor, p.status,
        p.qrCode, p.qrCodeBase64, p.dataCriacao, p.dataConfirmacao
      ]);
    } catch (err) {
      console.error('Erro pgInsertPagamento:', err.message);
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
    const email = userData.email ? userData.email.trim().toLowerCase() : `${cleanUsername}@topcanais.tv`;

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
    this.saveLocal();
    this.pgInsertUser(newUser);
    return newUser;
  }

  updateUser(id, updates) {
    const user = this.findUserById(id);
    if (!user) return null;
    Object.assign(user, updates);
    this.saveLocal();
    this.pgInsertUser(user);
    return user;
  }

  updateUserSubscription(id, plano) {
    const user = this.findUserById(id);
    if (!user || !plano) return null;

    const dataAssinatura = new Date();
    const fimAssinatura = new Date();
    fimAssinatura.setDate(fimAssinatura.getDate() + (plano.duracaoDias || 30));

    user.assinaturaAtiva = true;
    user.planoId = plano.id;
    user.planoNome = plano.nome;
    user.limiteTelas = plano.telas || 1;
    user.dataAssinatura = dataAssinatura.toISOString();
    user.fimAssinatura = fimAssinatura.toISOString();

    this.saveLocal();
    this.pgInsertUser(user);
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
    const active = this.getActiveSessions(userId);

    active.forEach(s => {
      if (s.deviceId === deviceId) {
        s.isActive = false;
        s.terminatedReason = 'SAME_DEVICE_RELOGIN';
        this.pgInsertSession(s);
      }
    });

    const remainingActive = this.getActiveSessions(userId);

    if (remainingActive.length >= maxScreens) {
      remainingActive.sort((a, b) => new Date(a.lastHeartbeat || a.createdAt) - new Date(b.lastHeartbeat || b.createdAt));
      const sessionsToKickCount = (remainingActive.length - maxScreens) + 1;
      for (let i = 0; i < sessionsToKickCount; i++) {
        if (remainingActive[i]) {
          remainingActive[i].isActive = false;
          remainingActive[i].terminatedReason = 'LOGGED_IN_ANOTHER_DEVICE';
          remainingActive[i].terminatedAt = new Date().toISOString();
          this.pgInsertSession(remainingActive[i]);
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
      terminatedReason: null,
      terminatedAt: null
    };

    this.data.sessions.push(newSession);
    this.saveLocal();
    this.pgInsertSession(newSession);
    return newSession;
  }

  heartbeatSession(sessionId) {
    const session = this.findSession(sessionId);
    if (!session) return { valid: false, reason: 'SESSION_NOT_FOUND' };
    if (!session.isActive) {
      return { valid: false, reason: session.terminatedReason || 'LOGGED_IN_ANOTHER_DEVICE' };
    }
    session.lastHeartbeat = new Date().toISOString();
    this.saveLocal();
    this.pgInsertSession(session);
    return { valid: true };
  }

  terminateSession(sessionId) {
    const session = this.findSession(sessionId);
    if (session) {
      session.isActive = false;
      session.terminatedReason = 'LOGGED_OUT';
      session.terminatedAt = new Date().toISOString();
      this.saveLocal();
      this.pgInsertSession(session);
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
    this.saveLocal();
    this.pgInsertPagamento(novoPagamento);
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
    this.saveLocal();
    this.pgInsertPagamento(pagamento);
    return pagamento;
  }
}

export const db = new Database();
