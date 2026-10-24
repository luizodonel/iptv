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

export function normalizeIp(rawIp) {
  if (!rawIp) return '127.0.0.1';
  let clean = String(rawIp).trim();
  if (clean.startsWith('::ffff:')) {
    clean = clean.slice(7);
  }
  if (clean === '::1') {
    clean = '127.0.0.1';
  }
  return clean;
}

const DEFAULT_DATA = {
  users: [],
  sessions: [],
  pagamentos: [],
  testedIps: [],
  accessLogs: []
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
        const parsed = JSON.parse(raw);
        return {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
          pagamentos: Array.isArray(parsed.pagamentos) ? parsed.pagamentos : [],
          testedIps: Array.isArray(parsed.testedIps) ? parsed.testedIps : [],
          accessLogs: Array.isArray(parsed.accessLogs) ? parsed.accessLogs : []
        };
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
          fim_assinatura TIMESTAMPTZ,
          trial_used BOOLEAN DEFAULT FALSE,
          trial_ip VARCHAR(64),
          registration_ip VARCHAR(64)
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

        CREATE TABLE IF NOT EXISTS access_logs (
          id VARCHAR(64) PRIMARY KEY,
          ip VARCHAR(64) NOT NULL,
          user_id VARCHAR(64),
          username VARCHAR(100),
          device_type VARCHAR(50),
          device_model VARCHAR(100),
          browser VARCHAR(50),
          os VARCHAR(50),
          user_agent TEXT,
          path VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS tested_ips (
          ip VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64),
          username VARCHAR(100),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Garantir migração de colunas na tabela users se já existia
        ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ip VARCHAR(64);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(64);
      `);

      // Carrega registros existentes no PostgreSQL para a memória
      const [uRes, sRes, pRes, tRes, aRes] = await Promise.all([
        this.pool.query('SELECT * FROM users;'),
        this.pool.query('SELECT * FROM sessions;'),
        this.pool.query('SELECT * FROM pagamentos;'),
        this.pool.query('SELECT * FROM tested_ips;').catch(() => ({ rows: [] })),
        this.pool.query('SELECT * FROM access_logs ORDER BY created_at DESC LIMIT 500;').catch(() => ({ rows: [] }))
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
          fimAssinatura: r.fim_assinatura ? new Date(r.fim_assinatura).toISOString() : null,
          trialUsed: Boolean(r.trial_used),
          trialIp: r.trial_ip || null,
          registrationIp: r.registration_ip || null
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

        if (tRes && tRes.rows.length > 0) {
          this.data.testedIps = tRes.rows.map(r => ({
            ip: normalizeIp(r.ip),
            userId: r.user_id,
            username: r.username,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
          }));
        }

        if (aRes && aRes.rows.length > 0) {
          this.data.accessLogs = aRes.rows.map(r => ({
            id: r.id,
            ip: normalizeIp(r.ip),
            userId: r.user_id,
            username: r.username,
            deviceType: r.device_type,
            deviceModel: r.device_model,
            browser: r.browser,
            os: r.os,
            userAgent: r.user_agent,
            path: r.path,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
          }));
        }

        console.log(`✅ PostgreSQL carregado com sucesso: ${uRes.rows.length} usuários, ${sRes.rows.length} sessões, ${pRes.rows.length} pagamentos, ${this.data.testedIps.length} IPs testados, ${this.data.accessLogs.length} acessos recentes.`);
      } else if (this.data.users.length > 0) {
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
        for (const t of this.data.testedIps) {
          await this.pgInsertTestedIp(t);
        }
        for (const a of this.data.accessLogs) {
          await this.pgInsertAccessLog(a);
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
        INSERT INTO users (id, username, nome, telefone, email, senha_hash, cpf, created_at, assinatura_ativa, plano_id, plano_nome, limite_telas, data_assinatura, fim_assinatura, trial_used, trial_ip, registration_ip)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          nome = EXCLUDED.nome,
          telefone = EXCLUDED.telefone,
          email = EXCLUDED.email,
          senha_hash = EXCLUDED.senha_hash,
          assinatura_ativa = EXCLUDED.assinatura_ativa,
          plano_id = EXCLUDED.plano_id,
          plano_nome = EXCLUDED.plano_nome,
          limite_telas = EXCLUDED.limite_telas,
          data_assinatura = EXCLUDED.data_assinatura,
          fim_assinatura = EXCLUDED.fim_assinatura,
          trial_used = EXCLUDED.trial_used,
          trial_ip = EXCLUDED.trial_ip,
          registration_ip = EXCLUDED.registration_ip;
      `, [
        u.id, u.username, u.nome, u.telefone, u.email, u.senhaHash, u.cpf,
        u.createdAt, u.assinaturaAtiva, u.planoId, u.planoNome, u.limiteTelas,
        u.dataAssinatura, u.fimAssinatura, u.trialUsed || false, u.trialIp || null, u.registrationIp || null
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

  async pgInsertTestedIp(record) {
    if (!this.pool) return;
    try {
      await this.pool.query(`
        INSERT INTO tested_ips (ip, user_id, username, created_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (ip) DO NOTHING;
      `, [record.ip, record.userId, record.username, record.createdAt]);
    } catch (err) {
      console.error('Erro pgInsertTestedIp:', err.message);
    }
  }

  async pgInsertAccessLog(log) {
    if (!this.pool) return;
    try {
      await this.pool.query(`
        INSERT INTO access_logs (id, ip, user_id, username, device_type, device_model, browser, os, user_agent, path, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
      `, [
        log.id, log.ip, log.userId, log.username, log.deviceType,
        log.deviceModel, log.browser, log.os, log.userAgent,
        log.path, log.createdAt
      ]);
    } catch (err) {
      console.error('Erro pgInsertAccessLog:', err.message);
    }
  }

  // --- Controle de IP e Teste Grátis de 2 Horas ---
  hasIpUsedTest(rawIp) {
    if (!rawIp) return false;
    const cleanIp = normalizeIp(rawIp);
    if (!cleanIp) return false;

    // 1. Checa na lista de IPs testados
    const inTested = (this.data.testedIps || []).some(entry => {
      const eIp = typeof entry === 'string' ? entry : entry.ip;
      return normalizeIp(eIp) === cleanIp;
    });
    if (inTested) return true;

    // 2. Checa se algum usuário cadastrado já consumiu o teste por este IP
    const inUsers = (this.data.users || []).some(u => {
      if (!u.trialUsed && u.planoId !== 'teste-2h') return false;
      return normalizeIp(u.trialIp) === cleanIp || normalizeIp(u.registrationIp) === cleanIp;
    });
    if (inUsers) return true;

    return false;
  }

  recordTestedIp(rawIp, userId, username) {
    if (!rawIp) return;
    const cleanIp = normalizeIp(rawIp);
    if (!this.data.testedIps) this.data.testedIps = [];

    const existing = this.data.testedIps.find(e => {
      const eIp = typeof e === 'string' ? e : e.ip;
      return normalizeIp(eIp) === cleanIp;
    });

    if (!existing) {
      const record = {
        ip: cleanIp,
        userId: userId || null,
        username: username || null,
        createdAt: new Date().toISOString()
      };
      this.data.testedIps.push(record);
      this.saveLocal();
      this.pgInsertTestedIp(record);
    }
  }

  // --- Registro e Consulta de Acessos (Auditoria de Visitantes) ---
  recordAccess(data) {
    if (!this.data.accessLogs) this.data.accessLogs = [];
    const cleanIp = normalizeIp(data.ip);

    const logEntry = {
      id: 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      ip: cleanIp,
      userId: data.userId || null,
      username: data.username || null,
      deviceType: data.deviceType || 'Desconhecido',
      deviceModel: data.deviceModel || 'Desconhecido',
      browser: data.browser || 'Desconhecido',
      os: data.os || 'Desconhecido',
      userAgent: (data.userAgent || '').slice(0, 500),
      path: data.path || '/',
      createdAt: new Date().toISOString()
    };

    // Mantém no máximo 5000 acessos em memória/json
    this.data.accessLogs.unshift(logEntry);
    if (this.data.accessLogs.length > 5000) {
      this.data.accessLogs = this.data.accessLogs.slice(0, 5000);
    }

    this.saveLocal();
    this.pgInsertAccessLog(logEntry);
    return logEntry;
  }

  getAccessLogs(limit = 100) {
    return (this.data.accessLogs || []).slice(0, limit);
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
      assinaturaAtiva: userData.assinaturaAtiva !== undefined ? Boolean(userData.assinaturaAtiva) : false,
      planoId: userData.planoId || null,
      planoNome: userData.planoNome || null,
      limiteTelas: userData.limiteTelas || 1,
      dataAssinatura: userData.dataAssinatura || null,
      fimAssinatura: userData.fimAssinatura || null,
      trialUsed: Boolean(userData.trialUsed),
      trialIp: userData.trialIp ? normalizeIp(userData.trialIp) : null,
      registrationIp: userData.registrationIp ? normalizeIp(userData.registrationIp) : null
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

  ensureMasterUser(hashPasswordFn) {
    const existing = this.findUserByUsername('odonel');
    if (!existing) {
      const senhaHash = hashPasswordFn ? hashPasswordFn('odonel2026') : null;
      if (!senhaHash) return null;

      const masterUser = {
        id: 'usr_master_odonel',
        username: 'odonel',
        nome: 'Master Odonel',
        telefone: '(61) 98226-1155',
        email: 'odonel@topcanais.tv',
        senhaHash,
        cpf: '',
        createdAt: new Date().toISOString(),
        assinaturaAtiva: true,
        planoId: 'vitalicio',
        planoNome: '👑 Master Vitalício',
        limiteTelas: 999,
        dataAssinatura: new Date().toISOString(),
        fimAssinatura: null,
        trialUsed: true,
        trialIp: null,
        registrationIp: null
      };

      this.data.users.unshift(masterUser);
      this.saveLocal();
      this.pgInsertUser(masterUser);
      console.log('👑 Usuário Master [odonel] inicializado com sucesso.');
      return masterUser;
    } else {
      if (!existing.assinaturaAtiva || existing.planoId !== 'vitalicio') {
        existing.assinaturaAtiva = true;
        existing.planoId = 'vitalicio';
        existing.planoNome = '👑 Master Vitalício';
        existing.limiteTelas = 999;
        this.saveLocal();
        this.pgInsertUser(existing);
      }
      return existing;
    }
  }

  // --- Painel Master: Métodos de Controle e Auditoria ---
  getMasterStats() {
    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutos

    let totalUsers = this.data.users.length;
    let activeUsers = 0;
    let inactiveUsers = 0;
    let onlineUsersCount = 0;
    let onlineSessionsCount = 0;

    const onlineUserIds = new Set();

    for (const u of this.data.users) {
      const username = (u.username || '').toLowerCase().trim();
      const isMaster = username === 'odonel' || u.role === 'admin' || u.isMaster;
      const end = u.fimAssinatura ? new Date(u.fimAssinatura).getTime() : null;
      const isSubActive = isMaster || (u.assinaturaAtiva && (!end || end > now));

      if (isSubActive) {
        activeUsers++;
      } else {
        inactiveUsers++;
      }
    }

    for (const s of (this.data.sessions || [])) {
      if (!s.isActive) continue;
      const hbTime = new Date(s.lastHeartbeat || s.createdAt).getTime();
      if ((now - hbTime) <= ONLINE_THRESHOLD_MS) {
        onlineSessionsCount++;
        onlineUserIds.add(s.userId);
      }
    }

    onlineUsersCount = onlineUserIds.size;

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      onlineUsersCount,
      onlineSessionsCount,
      totalLogs: (this.data.accessLogs || []).length,
      testedIpsCount: (this.data.testedIps || []).length
    };
  }

  getMasterUsers() {
    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

    return this.data.users.map(u => {
      const username = (u.username || '').toLowerCase().trim();
      const isMaster = username === 'odonel' || u.role === 'admin' || u.isMaster;
      const end = u.fimAssinatura ? new Date(u.fimAssinatura).getTime() : null;
      const isSubActive = isMaster || (u.assinaturaAtiva && (!end || end > now));

      // Busca sessões ativas do usuário
      const userSessions = (this.data.sessions || [])
        .filter(s => s.userId === u.id && s.isActive)
        .map(s => {
          const hbTime = new Date(s.lastHeartbeat || s.createdAt).getTime();
          const isSessionOnline = (now - hbTime) <= ONLINE_THRESHOLD_MS;
          return {
            id: s.id,
            deviceId: s.deviceId,
            deviceInfo: s.deviceInfo,
            createdAt: s.createdAt,
            lastHeartbeat: s.lastHeartbeat,
            isOnline: isSessionOnline,
            secondsSinceHeartbeat: Math.max(0, Math.floor((now - hbTime) / 1000))
          };
        });

      const isUserOnline = userSessions.some(s => s.isOnline);

      let status = 'inativo';
      let expiresInText = 'Inativo / Sem Plano';

      if (isMaster) {
        status = 'vitalicio';
        expiresInText = '👑 Vitalício Permanente';
      } else if (u.planoId === 'teste-2h') {
        if (isSubActive && end) {
          status = 'trial';
          const remMin = Math.max(0, Math.floor((end - now) / 60000));
          expiresInText = `⏱️ Teste: ${remMin} min restantes`;
        } else {
          status = 'expirado';
          expiresInText = '⏱️ Teste Expirado';
        }
      } else if (isSubActive) {
        status = 'ativo';
        if (end) {
          const diffMs = end - now;
          const days = Math.floor(diffMs / (24 * 3600 * 1000));
          const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / 3600000);
          if (days > 0) {
            expiresInText = `Expira em ${days}d ${hours}h (${new Date(end).toLocaleDateString('pt-BR')})`;
          } else {
            expiresInText = `Expira hoje em ${hours}h`;
          }
        } else {
          expiresInText = 'Ativo (Sem data limite)';
        }
      } else if (end && now >= end) {
        status = 'expirado';
        expiresInText = `Expirou em ${new Date(end).toLocaleDateString('pt-BR')}`;
      }

      return {
        id: u.id,
        username: u.username,
        nome: u.nome,
        telefone: u.telefone,
        email: u.email,
        cpf: u.cpf,
        createdAt: u.createdAt,
        assinaturaAtiva: isSubActive,
        planoId: u.planoId,
        planoNome: isMaster ? '👑 Master Vitalício' : (u.planoNome || 'Sem Plano'),
        limiteTelas: isMaster ? 999 : (u.limiteTelas || 1),
        dataAssinatura: u.dataAssinatura,
        fimAssinatura: u.fimAssinatura,
        trialUsed: Boolean(u.trialUsed),
        registrationIp: u.registrationIp,
        isMaster,
        isOnline: isUserOnline,
        status,
        expiresInText,
        activeSessions: userSessions,
        activeSessionsCount: userSessions.length
      };
    });
  }

  setMasterUserStatus(userId, options = {}) {
    const user = this.findUserById(userId);
    if (!user) return null;

    const {
      active,
      durationHours,
      durationDays,
      expireDate,
      planoId,
      planoNome,
      limiteTelas,
      kickSessions = true
    } = options;

    const now = new Date();

    if (active) {
      user.assinaturaAtiva = true;
      user.dataAssinatura = now.toISOString();

      if (expireDate) {
        user.fimAssinatura = new Date(expireDate).toISOString();
      } else if (durationHours) {
        user.fimAssinatura = new Date(now.getTime() + (Number(durationHours) * 3600 * 1000)).toISOString();
      } else if (durationDays) {
        user.fimAssinatura = new Date(now.getTime() + (Number(durationDays) * 24 * 3600 * 1000)).toISOString();
      } else if (planoId === 'vitalicio') {
        user.fimAssinatura = null;
      } else {
        // Padrão: 30 dias se não informado
        user.fimAssinatura = new Date(now.getTime() + (30 * 24 * 3600 * 1000)).toISOString();
      }

      if (planoId) user.planoId = planoId;
      if (planoNome) user.planoNome = planoNome;
      if (limiteTelas) user.limiteTelas = Number(limiteTelas);

      if (planoId && planoId !== 'teste-2h') {
        user.trialUsed = true;
      }
    } else {
      user.assinaturaAtiva = false;
      user.fimAssinatura = now.toISOString();

      if (kickSessions) {
        this.terminateUserSessions(userId, 'Sua assinatura foi inativada pelo usuário Master.');
      }
    }

    this.saveLocal();
    this.pgInsertUser(user);
    return user;
  }

  setMasterUserPassword(userId, senhaHash, kickSessions = true) {
    const user = this.findUserById(userId);
    if (!user) return null;

    user.senhaHash = senhaHash;

    if (kickSessions) {
      this.terminateUserSessions(userId, 'Sua senha foi redefinida pelo usuário Master Odonel. Faça login novamente.');
    }

    this.saveLocal();
    this.pgInsertUser(user);
    return user;
  }

  terminateUserSessions(userId, reason = 'Sessão derrubada pelo usuário Master.') {
    const active = this.getActiveSessions(userId);
    const nowIso = new Date().toISOString();
    active.forEach(s => {
      s.isActive = false;
      s.terminatedReason = reason;
      s.terminatedAt = nowIso;
      this.pgInsertSession(s);
    });
    this.saveLocal();
    return active.length;
  }

  terminateSessionById(sessionId, reason = 'Sessão derrubada pelo usuário Master.') {
    const session = this.findSession(sessionId);
    if (!session) return false;
    session.isActive = false;
    session.terminatedReason = reason;
    session.terminatedAt = new Date().toISOString();
    this.saveLocal();
    this.pgInsertSession(session);
    return true;
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

    // Validação automática de expiração de teste de 2 horas ou assinatura
    const user = this.findUserById(session.userId);
    if (user) {
      const username = (user.username || '').toLowerCase().trim();
      const isMaster = username === 'odonel' || user.role === 'admin' || user.isMaster;
      
      if (!isMaster) {
        const now = new Date();
        const end = user.fimAssinatura ? new Date(user.fimAssinatura) : null;
        const isExpired = !user.assinaturaAtiva || !end || now >= end;

        if (isExpired) {
          session.isActive = false;
          session.terminatedReason = user.planoId === 'teste-2h' ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED';
          session.terminatedAt = now.toISOString();
          user.assinaturaAtiva = false;

          this.saveLocal();
          this.pgInsertSession(session);
          this.pgInsertUser(user);

          return { 
            valid: false, 
            reason: session.terminatedReason,
            isTrialExpired: user.planoId === 'teste-2h',
            message: user.planoId === 'teste-2h'
              ? 'Seu período de teste gratuito de 2 horas encerrou. Para continuar assistindo, assine um de nossos planos!'
              : 'Sua assinatura expirou. Renove seu plano para continuar assistindo.'
          };
        }
      }
    }

    session.lastHeartbeat = new Date().toISOString();
    this.saveLocal();
    this.pgInsertSession(session);
    return { valid: true };
  }

  terminateSession(sessionId, reason = 'LOGGED_OUT') {
    const session = this.findSession(sessionId);
    if (session) {
      session.isActive = false;
      session.terminatedReason = reason;
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
