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
  accessLogs: [],
  resellerTransactions: [],
  resellerOrders: []
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
          accessLogs: Array.isArray(parsed.accessLogs) ? parsed.accessLogs : [],
          resellerTransactions: Array.isArray(parsed.resellerTransactions) ? parsed.resellerTransactions : [],
          resellerOrders: Array.isArray(parsed.resellerOrders) ? parsed.resellerOrders : []
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

        CREATE TABLE IF NOT EXISTS reseller_transactions (
          id VARCHAR(64) PRIMARY KEY,
          reseller_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          tipo VARCHAR(50) NOT NULL,
          plano VARCHAR(50) NOT NULL,
          quantidade INT NOT NULL,
          saldo_anterior INT NOT NULL,
          saldo_novo INT NOT NULL,
          valor NUMERIC(10, 2) DEFAULT 0,
          pagamento_id VARCHAR(64),
          cliente_id VARCHAR(64),
          cliente_username VARCHAR(100),
          descricao TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS reseller_orders (
          id VARCHAR(64) PRIMARY KEY,
          reseller_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          plano VARCHAR(50) NOT NULL,
          quantidade INT NOT NULL,
          valor_unitario NUMERIC(10, 2) NOT NULL,
          valor_total NUMERIC(10, 2) NOT NULL,
          mercado_pago_id VARCHAR(100),
          qr_code TEXT,
          qr_code_base64 TEXT,
          status VARCHAR(50) DEFAULT 'PENDING',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          approved_at TIMESTAMPTZ
        );

        -- Garantir migração de colunas na tabela users se já existia
        ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ip VARCHAR(64);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(64);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'user';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reseller_id VARCHAR(64);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ativo';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS creditos_mensal INT DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS creditos_trimestral INT DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS creditos_semestral INT DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS creditos_anual INT DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS link_exclusivo TEXT DEFAULT '';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS nome_loja TEXT DEFAULT '';
      `);

      // Carrega registros existentes no PostgreSQL para a memória
      const [uRes, sRes, pRes, tRes, aRes, rtRes, roRes] = await Promise.all([
        this.pool.query('SELECT * FROM users;'),
        this.pool.query('SELECT * FROM sessions;'),
        this.pool.query('SELECT * FROM pagamentos;'),
        this.pool.query('SELECT * FROM tested_ips;').catch(() => ({ rows: [] })),
        this.pool.query('SELECT * FROM access_logs ORDER BY created_at DESC LIMIT 500;').catch(() => ({ rows: [] })),
        this.pool.query('SELECT * FROM reseller_transactions ORDER BY created_at DESC LIMIT 2000;').catch(() => ({ rows: [] })),
        this.pool.query('SELECT * FROM reseller_orders ORDER BY created_at DESC LIMIT 1000;').catch(() => ({ rows: [] }))
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
          registrationIp: r.registration_ip || null,
          role: r.role || (r.username === 'odonel' ? 'admin' : 'user'),
          resellerId: r.reseller_id || null,
          status: r.status || 'ativo',
          creditosMensal: Number(r.creditos_mensal) || 0,
          creditosTrimestral: Number(r.creditos_trimestral) || 0,
          creditosSemestral: Number(r.creditos_semestral) || 0,
          creditosAnual: Number(r.creditos_anual) || 0,
          linkExclusivo: r.link_exclusivo || '',
          nomeLoja: r.nome_loja || ''
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

        if (rtRes && rtRes.rows.length > 0) {
          this.data.resellerTransactions = rtRes.rows.map(r => ({
            id: r.id,
            resellerId: r.reseller_id,
            tipo: r.tipo,
            plano: r.plano,
            quantidade: r.quantidade,
            saldoAnterior: r.saldo_anterior,
            saldoNovo: r.saldo_novo,
            valor: Number(r.valor) || 0,
            pagamentoId: r.pagamento_id,
            clienteId: r.cliente_id,
            clienteUsername: r.cliente_username,
            descricao: r.descricao,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
          }));
        }

        if (roRes && roRes.rows.length > 0) {
          this.data.resellerOrders = roRes.rows.map(r => ({
            id: r.id,
            resellerId: r.reseller_id,
            plano: r.plano,
            quantidade: r.quantidade,
            valorUnitario: Number(r.valor_unitario),
            valorTotal: Number(r.valor_total),
            mercadoPagoId: r.mercado_pago_id,
            qrCode: r.qr_code,
            qrCodeBase64: r.qr_code_base64,
            status: r.status,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
            approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : null
          }));
        }

        console.log(`✅ PostgreSQL carregado com sucesso: ${uRes.rows.length} usuários, ${sRes.rows.length} sessões, ${pRes.rows.length} pagamentos, ${this.data.testedIps.length} IPs testados, ${this.data.accessLogs.length} acessos recentes, ${(this.data.resellerTransactions || []).length} transações revenda.`);
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
        for (const tx of (this.data.resellerTransactions || [])) {
          await this.pgInsertResellerTransaction(tx);
        }
        for (const ro of (this.data.resellerOrders || [])) {
          await this.pgInsertResellerOrder(ro);
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
        INSERT INTO users (
          id, username, nome, telefone, email, senha_hash, cpf, created_at,
          assinatura_ativa, plano_id, plano_nome, limite_telas, data_assinatura, fim_assinatura,
          trial_used, trial_ip, registration_ip, role, reseller_id, status,
          creditos_mensal, creditos_trimestral, creditos_semestral, creditos_anual,
          link_exclusivo, nome_loja
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          nome = EXCLUDED.nome,
          telefone = EXCLUDED.telefone,
          email = EXCLUDED.email,
          senha_hash = EXCLUDED.senha_hash,
          cpf = EXCLUDED.cpf,
          assinatura_ativa = EXCLUDED.assinatura_ativa,
          plano_id = EXCLUDED.plano_id,
          plano_nome = EXCLUDED.plano_nome,
          limite_telas = EXCLUDED.limite_telas,
          data_assinatura = EXCLUDED.data_assinatura,
          fim_assinatura = EXCLUDED.fim_assinatura,
          trial_used = EXCLUDED.trial_used,
          trial_ip = EXCLUDED.trial_ip,
          registration_ip = EXCLUDED.registration_ip,
          role = EXCLUDED.role,
          reseller_id = EXCLUDED.reseller_id,
          status = EXCLUDED.status,
          creditos_mensal = EXCLUDED.creditos_mensal,
          creditos_trimestral = EXCLUDED.creditos_trimestral,
          creditos_semestral = EXCLUDED.creditos_semestral,
          creditos_anual = EXCLUDED.creditos_anual,
          link_exclusivo = EXCLUDED.link_exclusivo,
          nome_loja = EXCLUDED.nome_loja;
      `, [
        u.id, u.username, u.nome, u.telefone, u.email, u.senhaHash, u.cpf,
        u.createdAt, u.assinaturaAtiva, u.planoId, u.planoNome, u.limiteTelas,
        u.dataAssinatura, u.fimAssinatura, u.trialUsed || false, u.trialIp || null, u.registrationIp || null,
        u.role || (u.username === 'odonel' ? 'admin' : 'user'), u.resellerId || null, u.status || 'ativo',
        Number(u.creditosMensal) || 0, Number(u.creditosTrimestral) || 0,
        Number(u.creditosSemestral) || 0, Number(u.creditosAnual) || 0,
        u.linkExclusivo || '', u.nomeLoja || ''
      ]);
    } catch (err) {
      console.error('Erro pgInsertUser:', err.message);
    }
  }

  async pgInsertResellerTransaction(tx) {
    if (!this.pool) return;
    try {
      await this.pool.query(`
        INSERT INTO reseller_transactions (id, reseller_id, tipo, plano, quantidade, saldo_anterior, saldo_novo, valor, pagamento_id, cliente_id, cliente_username, descricao, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO NOTHING;
      `, [
        tx.id, tx.resellerId, tx.tipo, tx.plano, tx.quantidade,
        tx.saldoAnterior, tx.saldoNovo, tx.valor || 0, tx.pagamentoId || null,
        tx.clienteId || null, tx.clienteUsername || null, tx.descricao || null,
        tx.createdAt || new Date().toISOString()
      ]);
    } catch (err) {
      console.error('Erro pgInsertResellerTransaction:', err.message);
    }
  }

  async pgInsertResellerOrder(o) {
    if (!this.pool) return;
    try {
      await this.pool.query(`
        INSERT INTO reseller_orders (id, reseller_id, plano, quantidade, valor_unitario, valor_total, mercado_pago_id, qr_code, qr_code_base64, status, created_at, approved_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          approved_at = EXCLUDED.approved_at;
      `, [
        o.id, o.resellerId, o.plano, o.quantidade, o.valorUnitario, o.valorTotal,
        o.mercadoPagoId || null, o.qrCode || '', o.qrCodeBase64 || '',
        o.status || 'PENDING', o.createdAt || new Date().toISOString(), o.approvedAt || null
      ]);
    } catch (err) {
      console.error('Erro pgInsertResellerOrder:', err.message);
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

  findUserByCpf(cpf) {
    if (!cpf) return null;
    const clean = String(cpf).replace(/\D/g, '');
    if (!clean) return null;
    return this.data.users.find(u => u.cpf && u.cpf.replace(/\D/g, '') === clean) || null;
  }

  findResellerByLogin(identifier) {
    if (!identifier) return null;
    const clean = String(identifier).trim();
    const cleanDigits = clean.replace(/\D/g, '');
    const lower = clean.toLowerCase();

    return this.data.users.find(u => {
      const isCandidate = u.role === 'reseller' || u.role === 'admin' || (u.username && u.username.toLowerCase() === 'odonel');
      if (!isCandidate) return false;

      // CPF ou CNPJ
      if (cleanDigits && cleanDigits.length >= 11 && u.cpf && u.cpf.replace(/\D/g, '') === cleanDigits) return true;
      // Username
      if (u.username && u.username.toLowerCase() === lower) return true;
      // Email
      if (u.email && u.email.toLowerCase() === lower) return true;
      // Telefone
      if (cleanDigits && cleanDigits.length >= 8 && u.telefone && u.telefone.replace(/\D/g, '') === cleanDigits) return true;

      return false;
    }) || null;
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
      registrationIp: userData.registrationIp ? normalizeIp(userData.registrationIp) : null,
      role: userData.role || 'user',
      resellerId: userData.resellerId || null,
      status: userData.status || 'ativo',
      creditosMensal: Number(userData.creditosMensal) || 0,
      creditosTrimestral: Number(userData.creditosTrimestral) || 0,
      creditosSemestral: Number(userData.creditosSemestral) || 0,
      creditosAnual: Number(userData.creditosAnual) || 0,
      linkExclusivo: userData.linkExclusivo || '',
      nomeLoja: userData.nomeLoja || ''
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

    // Revendedores (lojistas B2B) não são clientes de IPTV e não entram nas métricas de usuários de TV
    const iptvUsers = (this.data.users || []).filter(u => u.role !== 'reseller' && u.planoId !== 'reseller_panel');
    const iptvUserIds = new Set(iptvUsers.map(u => u.id));

    let totalUsers = iptvUsers.length;
    let activeUsers = 0;
    let inactiveUsers = 0;
    let onlineUsersCount = 0;
    let onlineSessionsCount = 0;

    const onlineUserIds = new Set();

    for (const u of iptvUsers) {
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
      if (!iptvUserIds.has(s.userId)) continue; // Apenas sessões de usuários IPTV
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

    // Revendedores ficam exclusivamente na aba de Revenda / B2B e não no rol de assinantes de TV
    return (this.data.users || [])
      .filter(u => u.role !== 'reseller' && u.planoId !== 'reseller_panel')
      .map(u => {
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
        role: u.role || 'user',
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

    // Validação de expiração de teste de 2 horas ou assinatura para clientes comuns
    const user = this.findUserById(session.userId);
    if (user) {
      const username = (user.username || '').toLowerCase().trim();
      const isMaster = username === 'odonel' || user.role === 'admin' || user.isMaster;
      const isReseller = user.role === 'reseller';

      // Usuário Master ou Revendedor B2B não possui expiração de assinatura de streaming
      if (isMaster || isReseller) {
        if (isReseller && user.status === 'bloqueado') {
          session.isActive = false;
          session.terminatedReason = 'RESELLER_BLOCKED';
          session.terminatedAt = new Date().toISOString();
          this.saveLocal();
          this.pgInsertSession(session);
          return {
            valid: false,
            reason: 'RESELLER_BLOCKED',
            message: 'Sua conta de revendedor está bloqueada pela administração Master.'
          };
        }

        session.lastHeartbeat = new Date().toISOString();
        this.saveLocal();
        this.pgInsertSession(session);
        return { valid: true, user };
      }

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

  // ==========================================
  // --- MÓDULO B2B / REVENDA (CINESTREAM) ---
  // ==========================================

  createReseller(resellerData) {
    const cleanCpf = String(resellerData.cpfCnpj || resellerData.cpf || '').replace(/\D/g, '');
    const rawNome = (resellerData.nome || 'Lojista ' + (cleanCpf ? cleanCpf.slice(-4) : 'B2B')).trim();
    const rawUsername = (resellerData.username || ('rev_' + (cleanCpf || Date.now().toString(36)))).trim().toLowerCase();

    const existingUser = this.findUserByUsername(rawUsername);
    if (existingUser) {
      throw new Error(`O usuário @${rawUsername} já existe.`);
    }

    if (cleanCpf) {
      const existingCpf = this.findUserByCpf(cleanCpf);
      if (existingCpf) {
        throw new Error('Já existe uma conta cadastrada com este CPF/CNPJ.');
      }
    }

    const newReseller = {
      id: 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      username: rawUsername,
      nome: rawNome,
      telefone: resellerData.telefone ? String(resellerData.telefone).trim() : '',
      email: resellerData.email ? resellerData.email.trim().toLowerCase() : `${rawUsername}@revenda.cinestream.tv`,
      senhaHash: resellerData.senhaHash,
      cpf: cleanCpf,
      role: 'reseller',
      status: 'ativo',
      createdAt: new Date().toISOString(),
      assinaturaAtiva: true,
      planoId: 'b2b-reseller',
      planoNome: '💼 Painel de Revenda',
      limiteTelas: 1,
      creditosMensal: 0,
      creditosTrimestral: 0,
      creditosSemestral: 0,
      creditosAnual: 0,
      linkExclusivo: resellerData.linkExclusivo || '',
      nomeLoja: resellerData.nomeLoja || ''
    };

    this.data.users.push(newReseller);
    this.saveLocal();
    this.pgInsertUser(newReseller);
    return newReseller;
  }

  getResellerCredits(resellerId) {
    const reseller = this.findUserById(resellerId);
    if (!reseller) return { mensal: 0, trimestral: 0, semestral: 0, anual: 0 };
    return {
      mensal: Number(reseller.creditosMensal) || 0,
      trimestral: Number(reseller.creditosTrimestral) || 0,
      semestral: Number(reseller.creditosSemestral) || 0,
      anual: Number(reseller.creditosAnual) || 0
    };
  }

  addResellerCredits(resellerId, plano, quantidade, options = {}) {
    const reseller = this.findUserById(resellerId);
    if (!reseller) throw new Error('Revendedor não encontrado.');

    const pKey = String(plano).toLowerCase().trim();
    const qtd = parseInt(quantidade, 10);
    if (isNaN(qtd) || qtd <= 0) throw new Error('Quantidade de créditos inválida.');

    const fieldMap = {
      mensal: 'creditosMensal',
      trimestral: 'creditosTrimestral',
      semestral: 'creditosSemestral',
      anual: 'creditosAnual'
    };

    const field = fieldMap[pKey];
    if (!field) throw new Error(`Tipo de plano inválido: ${plano}`);

    const saldoAnterior = Number(reseller[field]) || 0;
    const saldoNovo = saldoAnterior + qtd;
    reseller[field] = saldoNovo;

    const tx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      resellerId: reseller.id,
      tipo: options.tipo || 'COMPRA',
      plano: pKey,
      quantidade: qtd,
      saldoAnterior,
      saldoNovo,
      valor: options.valor !== undefined ? Number(options.valor) : 0,
      pagamentoId: options.pagamentoId || null,
      clienteId: options.clienteId || null,
      clienteUsername: options.clienteUsername || null,
      descricao: options.descricao || `Adição de ${qtd} créditos (${pKey})`,
      createdAt: new Date().toISOString()
    };

    if (!this.data.resellerTransactions) this.data.resellerTransactions = [];
    this.data.resellerTransactions.unshift(tx);

    this.saveLocal();
    this.pgInsertUser(reseller);
    this.pgInsertResellerTransaction(tx);

    return { reseller, tx, saldoNovo };
  }

  consumeResellerCredits(resellerId, plano, quantidade, options = {}) {
    const reseller = this.findUserById(resellerId);
    if (!reseller) throw new Error('Revendedor não encontrado.');

    const pKey = String(plano).toLowerCase().trim();
    const qtd = parseInt(quantidade, 10);
    if (isNaN(qtd) || qtd <= 0) throw new Error('Quantidade de créditos inválida.');

    const fieldMap = {
      mensal: 'creditosMensal',
      trimestral: 'creditosTrimestral',
      semestral: 'creditosSemestral',
      anual: 'creditosAnual'
    };

    const field = fieldMap[pKey];
    if (!field) throw new Error(`Tipo de plano inválido: ${plano}`);

    const saldoAnterior = Number(reseller[field]) || 0;
    if (saldoAnterior < qtd) {
      throw new Error(`Saldo insuficiente de créditos ${pKey}. Disponível: ${saldoAnterior}, Necessário: ${qtd}. Faça uma recarga.`);
    }

    const saldoNovo = saldoAnterior - qtd;
    reseller[field] = saldoNovo;

    const tx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      resellerId: reseller.id,
      tipo: options.tipo || 'CONSUMO_CLIENTE',
      plano: pKey,
      quantidade: -qtd,
      saldoAnterior,
      saldoNovo,
      valor: 0,
      pagamentoId: null,
      clienteId: options.clienteId || null,
      clienteUsername: options.clienteUsername || null,
      descricao: options.descricao || `Liberação de ${qtd} tela(s) no plano ${pKey} para @${options.clienteUsername || ''}`,
      createdAt: new Date().toISOString()
    };

    if (!this.data.resellerTransactions) this.data.resellerTransactions = [];
    this.data.resellerTransactions.unshift(tx);

    this.saveLocal();
    this.pgInsertUser(reseller);
    this.pgInsertResellerTransaction(tx);

    return { reseller, tx, saldoNovo };
  }

  createClientByReseller(resellerId, clientData) {
    const reseller = this.findUserById(resellerId);
    if (!reseller) throw new Error('Revendedor não encontrado.');

    const { username, senhaHash, planoKey = 'mensal', telas = 1, nome, telefone, email } = clientData;
    const cleanUsername = String(username || '').trim().replace(/\s+/g, '').toLowerCase();

    if (!cleanUsername) throw new Error('O nome de usuário do cliente é obrigatório.');
    if (cleanUsername.length < 3) throw new Error('O nome de usuário deve conter no mínimo 3 caracteres.');

    const existing = this.findUserByUsername(cleanUsername);
    if (existing) {
      throw new Error(`O usuário @${cleanUsername} já está cadastrado no sistema. Escolha outro.`);
    }

    const screenCount = Math.max(1, parseInt(telas, 10) || 1);
    const pKey = String(planoKey).toLowerCase().trim();

    const planDurations = {
      mensal: 30,
      trimestral: 90,
      semestral: 180,
      anual: 365
    };

    const planNames = {
      mensal: 'Mensal (30 dias)',
      trimestral: 'Trimestral (90 dias)',
      semestral: 'Semestral (180 dias)',
      anual: 'Anual (365 dias)'
    };

    const duracaoDias = planDurations[pKey] || 30;
    const planoNome = planNames[pKey] || 'Mensal';

    // 1. Debita créditos do revendedor (1 crédito por tela)
    const { saldoNovo, tx } = this.consumeResellerCredits(resellerId, pKey, screenCount, {
      clienteUsername: cleanUsername,
      descricao: `Criação de cliente @${cleanUsername} (${planoNome}, ${screenCount} tela(s))`
    });

    // 2. Calcula data de expiração (agora + vigência)
    const now = new Date();
    const fimAssinatura = new Date(now.getTime() + (duracaoDias * 24 * 60 * 60 * 1000));

    const newClient = {
      id: 'usr_cli_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      username: cleanUsername,
      nome: nome ? String(nome).trim() : cleanUsername,
      telefone: telefone ? String(telefone).trim() : '',
      email: email ? email.trim().toLowerCase() : `${cleanUsername}@cliente.topcanais.tv`,
      senhaHash,
      cpf: '',
      role: 'user',
      resellerId: reseller.id,
      createdAt: now.toISOString(),
      assinaturaAtiva: true,
      planoId: `revenda-${pKey}-${screenCount}telas`,
      planoNome: `${planoNome} (${screenCount} ${screenCount > 1 ? 'Telas' : 'Tela'})`,
      limiteTelas: screenCount,
      dataAssinatura: now.toISOString(),
      fimAssinatura: fimAssinatura.toISOString(),
      trialUsed: true,
      trialIp: null,
      registrationIp: null
    };

    // Atualiza o ID do cliente na transação de débito
    tx.clienteId = newClient.id;

    this.data.users.push(newClient);
    this.saveLocal();
    this.pgInsertUser(newClient);

    return { client: newClient, saldoRestante: saldoNovo, tx };
  }

  renewClientByReseller(resellerId, clientId, options = {}) {
    const reseller = this.findUserById(resellerId);
    if (!reseller) throw new Error('Revendedor não encontrado.');

    const client = this.findUserById(clientId);
    if (!client) throw new Error('Cliente não encontrado.');

    const isMaster = (reseller.username || '').toLowerCase() === 'odonel' || reseller.role === 'admin';
    if (!isMaster && client.resellerId !== reseller.id) {
      throw new Error('Acesso negado: este cliente pertence a outro revendedor.');
    }

    const { planoKey = 'mensal', telas = 1 } = options;
    const screenCount = Math.max(1, parseInt(telas, 10) || client.limiteTelas || 1);
    const pKey = String(planoKey).toLowerCase().trim();

    const planDurations = {
      mensal: 30,
      trimestral: 90,
      semestral: 180,
      anual: 365
    };

    const planNames = {
      mensal: 'Mensal (30 dias)',
      trimestral: 'Trimestral (90 dias)',
      semestral: 'Semestral (180 dias)',
      anual: 'Anual (365 dias)'
    };

    const duracaoDias = planDurations[pKey] || 30;
    const planoNome = planNames[pKey] || 'Mensal';

    // 1. Debita créditos do revendedor
    const { saldoNovo, tx } = this.consumeResellerCredits(resellerId, pKey, screenCount, {
      clienteId: client.id,
      clienteUsername: client.username,
      tipo: 'RENOVACAO_CLIENTE',
      descricao: `Renovação de assinatura de @${client.username} (${planoNome}, ${screenCount} tela(s))`
    });

    // 2. Se assinatura ainda estiver ativa, soma ao vencimento atual; caso contrário, conta a partir de agora
    const now = new Date();
    const currentEnd = client.fimAssinatura ? new Date(client.fimAssinatura) : null;
    const baseDate = (client.assinaturaAtiva && currentEnd && currentEnd > now) ? currentEnd : now;
    const novoFim = new Date(baseDate.getTime() + (duracaoDias * 24 * 60 * 60 * 1000));

    client.assinaturaAtiva = true;
    client.planoId = `revenda-${pKey}-${screenCount}telas`;
    client.planoNome = `${planoNome} (${screenCount} ${screenCount > 1 ? 'Telas' : 'Tela'})`;
    client.limiteTelas = screenCount;
    client.fimAssinatura = novoFim.toISOString();
    if (!client.dataAssinatura) client.dataAssinatura = now.toISOString();

    this.saveLocal();
    this.pgInsertUser(client);

    return { client, saldoRestante: saldoNovo, tx };
  }

  getClientsByReseller(resellerId) {
    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

    return this.data.users
      .filter(u => u.resellerId === resellerId)
      .map(u => {
        const end = u.fimAssinatura ? new Date(u.fimAssinatura).getTime() : null;
        const isSubActive = u.assinaturaAtiva && (!end || end > now);

        // Sessões ativas
        const userSessions = (this.data.sessions || [])
          .filter(s => s.userId === u.id && s.isActive)
          .map(s => {
            const hb = new Date(s.lastHeartbeat || s.createdAt).getTime();
            return {
              id: s.id,
              deviceInfo: s.deviceInfo,
              isOnline: (now - hb) <= ONLINE_THRESHOLD_MS
            };
          });

        const isOnline = userSessions.some(s => s.isOnline);

        let status = 'inativo';
        let expiresInText = 'Sem plano ativo';
        let daysRemaining = 0;

        if (isSubActive && end) {
          const diffMs = end - now;
          daysRemaining = Math.max(0, Math.floor(diffMs / (24 * 3600 * 1000)));
          const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / 3600000);

          if (daysRemaining > 5) {
            status = 'ativo';
            expiresInText = `Vence em ${daysRemaining} dias (${new Date(end).toLocaleDateString('pt-BR')})`;
          } else if (daysRemaining >= 1) {
            status = 'vencendo';
            expiresInText = `⚠️ Vence em ${daysRemaining}d ${hours}h`;
          } else {
            status = 'vencendo';
            expiresInText = `⚠️ Vence hoje em ${hours}h`;
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
          createdAt: u.createdAt,
          assinaturaAtiva: isSubActive,
          planoId: u.planoId,
          planoNome: u.planoNome,
          limiteTelas: u.limiteTelas || 1,
          dataAssinatura: u.dataAssinatura,
          fimAssinatura: u.fimAssinatura,
          resellerId: u.resellerId,
          isOnline,
          status,
          expiresInText,
          daysRemaining,
          activeSessionsCount: userSessions.length
        };
      });
  }

  getResellerTransactions(resellerId, limit = 100) {
    return (this.data.resellerTransactions || [])
      .filter(tx => tx.resellerId === resellerId)
      .slice(0, limit);
  }

  getResellerOrders(resellerId, limit = 50) {
    return (this.data.resellerOrders || [])
      .filter(o => o.resellerId === resellerId)
      .slice(0, limit);
  }

  createResellerOrder(orderData) {
    const newOrder = {
      id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      resellerId: orderData.resellerId,
      plano: orderData.plano,
      quantidade: parseInt(orderData.quantidade, 10),
      valorUnitario: Number(orderData.valorUnitario),
      valorTotal: Number(orderData.valorTotal),
      mercadoPagoId: orderData.mercadoPagoId ? String(orderData.mercadoPagoId) : null,
      qrCode: orderData.qrCode || '',
      qrCodeBase64: orderData.qrCodeBase64 || '',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      approvedAt: null
    };

    if (!this.data.resellerOrders) this.data.resellerOrders = [];
    this.data.resellerOrders.unshift(newOrder);

    this.saveLocal();
    this.pgInsertResellerOrder(newOrder);
    return newOrder;
  }

  findResellerOrderById(id) {
    return (this.data.resellerOrders || []).find(o => o.id === id) || null;
  }

  findResellerOrderByMpId(mpId) {
    if (!mpId) return null;
    return (this.data.resellerOrders || []).find(o => o.mercadoPagoId === String(mpId)) || null;
  }

  updateResellerOrder(id, updates) {
    const order = this.findResellerOrderById(id);
    if (!order) return null;
    Object.assign(order, updates);
    this.saveLocal();
    this.pgInsertResellerOrder(order);
    return order;
  }

  approveResellerOrder(orderId) {
    const order = this.findResellerOrderById(orderId) || this.findResellerOrderByMpId(orderId);
    if (!order) throw new Error('Pedido não encontrado.');
    if (order.status === 'APPROVED') {
      return { order, alreadyApproved: true };
    }

    order.status = 'APPROVED';
    order.approvedAt = new Date().toISOString();

    // Incrementa os créditos na carteira do revendedor
    const result = this.addResellerCredits(order.resellerId, order.plano, order.quantidade, {
      tipo: 'COMPRA',
      valor: order.valorTotal,
      pagamentoId: order.id,
      descricao: `Compra aprovada: ${order.quantidade} créditos (${order.plano}) - Total R$ ${order.valorTotal.toFixed(2)}`
    });

    this.saveLocal();
    this.pgInsertResellerOrder(order);

    return { order, result };
  }

  // --- Métodos de Gestão Master de Revendedores ---

  getAllResellers() {
    return this.data.users
      .filter(u => u.role === 'reseller')
      .map(r => {
        const clients = (this.data.users || []).filter(u => u.resellerId === r.id);
        const activeClients = clients.filter(c => c.assinaturaAtiva && (!c.fimAssinatura || new Date(c.fimAssinatura) > new Date()));

        const orders = (this.data.resellerOrders || []).filter(o => o.resellerId === r.id && o.status === 'APPROVED');
        const totalSpent = orders.reduce((sum, o) => sum + (Number(o.valorTotal) || 0), 0);

        return {
          id: r.id,
          username: r.username,
          nome: r.nome,
          telefone: r.telefone,
          email: r.email,
          cpf: r.cpf,
          status: r.status || 'ativo',
          createdAt: r.createdAt,
          creditos: {
            mensal: Number(r.creditosMensal) || 0,
            trimestral: Number(r.creditosTrimestral) || 0,
            semestral: Number(r.creditosSemestral) || 0,
            anual: Number(r.creditosAnual) || 0
          },
          totalClients: clients.length,
          activeClients: activeClients.length,
          totalSpent,
          linkExclusivo: r.linkExclusivo || '',
          nomeLoja: r.nomeLoja || ''
        };
      });
  }

  updateResellerProfile(resellerId, updates = {}) {
    const reseller = this.findUserById(resellerId);
    if (!reseller) throw new Error('Revendedor não encontrado.');

    if (updates.linkExclusivo !== undefined || updates.linkSlug !== undefined) {
      const raw = String(updates.linkSlug || updates.linkExclusivo || '').trim();
      const cleanSlug = raw
        .replace(/^https?:\/\/[^\/]+\/?/i, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
      reseller.linkSlug = cleanSlug;
      reseller.linkExclusivo = cleanSlug ? `https://topcanais.logistadigital.com.br/${cleanSlug}` : '';
    }

    if (updates.nomeLoja !== undefined) {
      reseller.nomeLoja = String(updates.nomeLoja || '').trim();
    }

    if (updates.nome !== undefined && updates.nome.trim()) {
      reseller.nome = String(updates.nome).trim();
    }

    if (updates.telefone !== undefined) {
      reseller.telefone = String(updates.telefone).trim();
    }

    this.saveLocal();
    this.pgInsertUser(reseller);
    return reseller;
  }

  getAllResellerClients(filterResellerId = null) {
    let clients = (this.data.users || []).filter(u => u.resellerId);
    if (filterResellerId) {
      clients = clients.filter(u => u.resellerId === filterResellerId);
    }

    const now = Date.now();
    return clients.map(u => {
      const reseller = this.findUserById(u.resellerId);
      const end = u.fimAssinatura ? new Date(u.fimAssinatura).getTime() : null;
      const isSubActive = u.assinaturaAtiva && (!end || end > now);

      return {
        id: u.id,
        username: u.username,
        nome: u.nome,
        telefone: u.telefone,
        email: u.email,
        createdAt: u.createdAt,
        assinaturaAtiva: isSubActive,
        planoId: u.planoId,
        planoNome: u.planoNome,
        limiteTelas: u.limiteTelas || 1,
        fimAssinatura: u.fimAssinatura,
        resellerId: u.resellerId,
        resellerNome: reseller ? (reseller.nome || reseller.username) : 'Desconhecido',
        resellerTelefone: reseller ? reseller.telefone : ''
      };
    });
  }

  adjustResellerCredits(resellerId, options = {}) {
    const reseller = this.findUserById(resellerId);
    if (!reseller) throw new Error('Revendedor não encontrado.');

    const { plano, delta, motivo = 'Ajuste manual efetuado pelo Master Odonel', masterUsername = 'odonel' } = options;
    const pKey = String(plano).toLowerCase().trim();
    const d = parseInt(delta, 10);
    if (isNaN(d) || d === 0) throw new Error('Informe um valor de alteração de créditos diferente de zero.');

    const fieldMap = {
      mensal: 'creditosMensal',
      trimestral: 'creditosTrimestral',
      semestral: 'creditosSemestral',
      anual: 'creditosAnual'
    };

    const field = fieldMap[pKey];
    if (!field) throw new Error(`Tipo de plano inválido: ${plano}`);

    const saldoAnterior = Number(reseller[field]) || 0;
    const saldoNovo = Math.max(0, saldoAnterior + d);
    reseller[field] = saldoNovo;

    const tx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      resellerId: reseller.id,
      tipo: d >= 0 ? 'AJUSTE_MASTER_CREDITO' : 'AJUSTE_MASTER_DEBITO',
      plano: pKey,
      quantidade: d,
      saldoAnterior,
      saldoNovo,
      valor: 0,
      pagamentoId: null,
      clienteId: null,
      clienteUsername: null,
      descricao: `[Master @${masterUsername}] ${motivo} (${d > 0 ? '+' : ''}${d} ${pKey})`,
      createdAt: new Date().toISOString()
    };

    if (!this.data.resellerTransactions) this.data.resellerTransactions = [];
    this.data.resellerTransactions.unshift(tx);

    this.saveLocal();
    this.pgInsertUser(reseller);
    this.pgInsertResellerTransaction(tx);

    return { reseller, tx, saldoNovo };
  }

  updateResellerStatus(resellerId, status) {
    const reseller = this.findUserById(resellerId);
    if (!reseller) throw new Error('Revendedor não encontrado.');

    reseller.status = status; // 'ativo' | 'bloqueado' | 'inativo'

    if (status === 'bloqueado') {
      this.terminateUserSessions(resellerId, 'Sua conta de revendedor foi bloqueada pelo administrador Master.');
    }

    this.saveLocal();
    this.pgInsertUser(reseller);
    return reseller;
  }

  deleteReseller(resellerId) {
    const idx = (this.data.users || []).findIndex(u => u.id === resellerId);
    if (idx === -1) throw new Error('Revendedor não encontrado.');

    const [deleted] = this.data.users.splice(idx, 1);
    this.terminateUserSessions(resellerId, 'Conta de revendedor removida.');

    this.saveLocal();
    if (this.pool) {
      this.pool.query('DELETE FROM users WHERE id = $1;', [resellerId]).catch(() => {});
    }
    return deleted;
  }

  getAllResellerTransactions(limit = 300) {
    return (this.data.resellerTransactions || []).slice(0, limit);
  }

  getAllResellerOrders(limit = 200) {
    return (this.data.resellerOrders || []).slice(0, limit);
  }
}

export const db = new Database();
