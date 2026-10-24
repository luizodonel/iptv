import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Crown,
  Users,
  Radio,
  FileText,
  Search,
  X,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Smartphone,
  Tv,
  Monitor,
  Tablet,
  AlertTriangle,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  LogOut,
  Power,
  Shield,
  Zap,
  Filter,
  ArrowRight,
  ExternalLink,
  SlidersHorizontal,
  Info
} from 'lucide-react';

import {
  fetchMasterStats,
  fetchMasterUsers,
  updateMasterUserStatus,
  kickMasterSession,
  fetchMasterLogs
} from '../services/authService';

import { isMasterUser } from '../services/securityService';

export default function MasterPanelModal({ isOpen, onClose, currentUser }) {
  // Controle de abas: 'users' | 'online' | 'logs'
  const [activeTab, setActiveTab] = useState('users');

  // Dados do backend
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Filtros de Usuários
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('todos'); // 'todos' | 'ativos' | 'inativos' | 'online' | 'trial'

  // Filtros de Logs
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState('all'); // 'all' | 'logged' | 'anonymous'

  // Modal / Bottom Sheet para Definir Período de Ativação
  const [selectedUserForPeriod, setSelectedUserForPeriod] = useState(null);
  const [periodPreset, setPeriodPreset] = useState('30d'); // '2h' | '24h' | '7d' | '30d' | '90d' | '180d' | '365d' | 'vitalicio' | 'custom'
  const [customDateTime, setCustomDateTime] = useState('');
  const [selectedScreens, setSelectedScreens] = useState(1);
  const [kickCurrentSessions, setKickCurrentSessions] = useState(true);
  const [savingPeriod, setSavingPeriod] = useState(false);

  // Modal de Confirmação para Derrubar Sessão
  const [kickModalData, setKickModalData] = useState(null); // { userId, sessionId, userName, deviceInfo }
  const [kickingSession, setKickingSession] = useState(false);

  // Auto-refresh a cada 25 segundos se o painel estiver aberto
  useEffect(() => {
    if (!isOpen) return;

    loadAllData(false);

    const interval = setInterval(() => {
      loadAllData(true);
    }, 25000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Prevenir scroll do body quando modal está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Carrega todos os dados do painel Master
  const loadAllData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setErrorMsg('');

    try {
      const [statsData, usersData, logsData] = await Promise.all([
        fetchMasterStats().catch(() => null),
        fetchMasterUsers().catch(() => []),
        fetchMasterLogs(300).catch(() => [])
      ]);

      if (statsData) setStats(statsData);
      if (usersData) setUsers(usersData);
      if (logsData) setLogs(logsData);
    } catch (err) {
      console.error('Erro ao carregar dados do painel master:', err);
      setErrorMsg(err.message || 'Erro ao carregar dados do Master.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3500);
  };

  // 1. Ação de Inativar Usuário
  const handleInactivateUser = async (user) => {
    if (user.username === 'odonel') {
      alert('A conta Master Odonel não pode ser inativada.');
      return;
    }

    const confirmMsg = `Tem certeza que deseja inativar a conta de @${user.username}? As sessões ativas serão desconectadas imediatamente.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await updateMasterUserStatus({
        userId: user.id,
        active: false,
        kickSessions: true
      });
      showToast(`Usuário @${user.username} inativado com sucesso.`);
      loadAllData(true);
    } catch (err) {
      alert('Erro ao inativar usuário: ' + err.message);
    }
  };

  // 2. Abrir Sheet para Ativar / Alterar Período
  const handleOpenPeriodModal = (user) => {
    setSelectedUserForPeriod(user);
    setSelectedScreens(user.limiteTelas || 1);
    setKickCurrentSessions(false);

    // Sugere preset de acordo com plano atual
    if (user.planoId === 'vitalicio') setPeriodPreset('vitalicio');
    else if (user.planoId === 'teste-2h') setPeriodPreset('2h');
    else if (user.planoId === 'tela1-anual' || user.planoId === 'tela2-anual') setPeriodPreset('365d');
    else setPeriodPreset('30d');

    // Inicializa data customizada com data de expiração existente ou 30 dias à frente
    const defaultDate = user.fimAssinatura ? new Date(user.fimAssinatura) : new Date(Date.now() + 30 * 24 * 3600 * 1000);
    setCustomDateTime(defaultDate.toISOString().slice(0, 16));
  };

  // 3. Salvar Ativação e Período
  const handleSavePeriod = async () => {
    if (!selectedUserForPeriod) return;
    setSavingPeriod(true);

    try {
      const payload = {
        userId: selectedUserForPeriod.id,
        active: true,
        limiteTelas: selectedScreens,
        kickSessions: kickCurrentSessions
      };

      if (periodPreset === '2h') {
        payload.durationHours = 2;
        payload.planoId = 'teste-2h';
        payload.planoNome = 'Teste Grátis (2h)';
      } else if (periodPreset === '24h') {
        payload.durationHours = 24;
        payload.planoId = 'tela1-mensal';
        payload.planoNome = 'Acesso 24 Horas (1 Dia)';
      } else if (periodPreset === '7d') {
        payload.durationDays = 7;
        payload.planoId = 'tela1-mensal';
        payload.planoNome = 'Acesso Semanal (7 Dias)';
      } else if (periodPreset === '30d') {
        payload.durationDays = 30;
        payload.planoId = selectedScreens > 1 ? 'tela2-mensal' : 'tela1-mensal';
        payload.planoNome = `Plano ${selectedScreens} Tela${selectedScreens > 1 ? 's' : ''} (30 Dias)`;
      } else if (periodPreset === '90d') {
        payload.durationDays = 90;
        payload.planoId = selectedScreens > 1 ? 'tela2-mensal' : 'tela1-mensal';
        payload.planoNome = `Trimestral ${selectedScreens} Tela${selectedScreens > 1 ? 's' : ''} (90 Dias)`;
      } else if (periodPreset === '180d') {
        payload.durationDays = 180;
        payload.planoId = selectedScreens > 1 ? 'tela2-mensal' : 'tela1-mensal';
        payload.planoNome = `Semestral ${selectedScreens} Tela${selectedScreens > 1 ? 's' : ''} (180 Dias)`;
      } else if (periodPreset === '365d') {
        payload.durationDays = 365;
        payload.planoId = selectedScreens > 1 ? 'tela2-anual' : 'tela1-anual';
        payload.planoNome = `Plano Anual ${selectedScreens} Tela${selectedScreens > 1 ? 's' : ''} (365 Dias)`;
      } else if (periodPreset === 'vitalicio') {
        payload.planoId = 'vitalicio';
        payload.planoNome = '👑 Acesso Vitalício Permanente';
      } else if (periodPreset === 'custom') {
        if (!customDateTime) {
          alert('Selecione a data e hora de expiração.');
          setSavingPeriod(false);
          return;
        }
        payload.expireDate = new Date(customDateTime).toISOString();
        payload.planoId = selectedScreens > 1 ? 'tela2-mensal' : 'tela1-mensal';
        payload.planoNome = `Acesso Personalizado (${selectedScreens} Telas)`;
      }

      await updateMasterUserStatus(payload);
      showToast(`Assinatura de @${selectedUserForPeriod.username} atualizada com sucesso!`);
      setSelectedUserForPeriod(null);
      loadAllData(true);
    } catch (err) {
      alert('Erro ao salvar período: ' + err.message);
    } finally {
      setSavingPeriod(false);
    }
  };

  // 4. Executar Derrubada de Sessão
  const handleConfirmKickSession = async () => {
    if (!kickModalData) return;
    setKickingSession(true);

    try {
      await kickMasterSession({
        sessionId: kickModalData.sessionId,
        userId: kickModalData.userId,
        reason: 'Sua sessão foi derrubada pelo usuário Master Odonel.'
      });

      showToast('Sessão derrubada com sucesso! O dispositivo foi desconectado.');
      setKickModalData(null);
      loadAllData(true);
    } catch (err) {
      alert('Erro ao derrubar sessão: ' + err.message);
    } finally {
      setKickingSession(false);
    }
  };

  // Filtragem de Usuários
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // 1. Filtro de busca de texto
      const q = userSearchQuery.toLowerCase().trim();
      if (q) {
        const matchesName = (u.nome || '').toLowerCase().includes(q);
        const matchesUsername = (u.username || '').toLowerCase().includes(q);
        const matchesPhone = (u.telefone || '').includes(q);
        const matchesEmail = (u.email || '').toLowerCase().includes(q);
        if (!matchesName && !matchesUsername && !matchesPhone && !matchesEmail) {
          return false;
        }
      }

      // 2. Filtro de status
      if (userStatusFilter === 'ativos') return u.assinaturaAtiva;
      if (userStatusFilter === 'inativos') return !u.assinaturaAtiva;
      if (userStatusFilter === 'online') return u.isOnline;
      if (userStatusFilter === 'trial') return u.planoId === 'teste-2h';

      return true;
    });
  }, [users, userSearchQuery, userStatusFilter]);

  // Lista de Usuários Online no momento (com sessões ativas)
  const onlineUsersList = useMemo(() => {
    return users.filter(u => u.isOnline || (u.activeSessions && u.activeSessions.length > 0));
  }, [users]);

  // Filtragem de Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const q = logSearchQuery.toLowerCase().trim();
      if (q) {
        const matchesIp = (l.ip || '').includes(q);
        const matchesUser = (l.username || '').toLowerCase().includes(q);
        const matchesDevice = (l.deviceModel || '').toLowerCase().includes(q) || (l.browser || '').toLowerCase().includes(q);
        const matchesPath = (l.path || '').toLowerCase().includes(q);
        if (!matchesIp && !matchesUser && !matchesDevice && !matchesPath) return false;
      }

      if (logTypeFilter === 'logged') return !!l.username;
      if (logTypeFilter === 'anonymous') return !l.username;

      return true;
    });
  }, [logs, logSearchQuery, logTypeFilter]);

  if (!isOpen) return null;

  // Verificação de permissão do usuário logado
  if (!isMasterUser(currentUser)) {
    return (
      <div className="modal-backdrop fade-in" style={{ zIndex: 99999 }}>
        <div className="master-denied-card glass-card scale-up">
          <AlertTriangle size={48} color="#ef4444" />
          <h2>Acesso Negado</h2>
          <p>Este painel administrativo é restrito exclusivamente ao usuário <strong>Master Odonel</strong>.</p>
          <button className="btn-glow-primary" onClick={onClose}>Voltar para o Início</button>
        </div>
      </div>
    );
  }

  // Helper para renderizar ícone de dispositivo
  const renderDeviceIcon = (devType = '') => {
    const t = String(devType).toLowerCase();
    if (t.includes('tv')) return <Tv size={16} className="text-accent" />;
    if (t.includes('mobile') || t.includes('smartphone') || t.includes('celular')) return <Smartphone size={16} className="text-accent" />;
    if (t.includes('tablet')) return <Tablet size={16} className="text-accent" />;
    return <Monitor size={16} className="text-accent" />;
  };

  return (
    <div className="modal-backdrop fade-in master-panel-backdrop" style={{ zIndex: 99999 }}>
      <div className="master-panel-container glass-card" role="dialog" aria-modal="true">
        
        {/* ==================== TOPO DO PAINEL MASTER (MOBILE-FIRST) ==================== */}
        <header className="master-header">
          <div className="master-header-brand">
            <div className="master-crown-icon-wrap">
              <Crown size={24} className="text-gold pulse-glow" />
            </div>
            <div>
              <div className="master-title-row">
                <h1 className="master-title">Painel Master</h1>
                <span className="master-user-pill">👑 @{currentUser?.username || 'odonel'}</span>
              </div>
              <p className="master-subtitle">Gestão de Usuários, Validades e Conexões ao Vivo</p>
            </div>
          </div>

          <div className="master-header-actions">
            <button
              type="button"
              className={`master-btn-refresh ${refreshing ? 'rotating' : ''}`}
              onClick={() => loadAllData(false)}
              title="Atualizar dados agora"
            >
              <RefreshCw size={18} />
            </button>

            <button
              type="button"
              className="master-btn-close"
              onClick={onClose}
              title="Fechar painel"
            >
              <X size={22} />
            </button>
          </div>
        </header>

        {/* Feedback Toast */}
        {successToast && (
          <div className="master-toast-pill scale-up">
            <CheckCircle2 size={16} color="#10b981" />
            <span>{successToast}</span>
          </div>
        )}

        {/* ==================== RESUMO RÁPIDO DE MÉTRICAS (CARDS MOBILE) ==================== */}
        <div className="master-metrics-grid">
          <div className="metric-card">
            <div className="metric-card-top">
              <Users size={18} className="text-accent" />
              <span className="metric-label">Total Cadastrados</span>
            </div>
            <span className="metric-number">{stats?.totalUsers ?? users.length}</span>
          </div>

          <div className="metric-card metric-online pulse-border">
            <div className="metric-card-top">
              <Radio size={18} className="text-success pulse-glow" />
              <span className="metric-label">Online Agora</span>
            </div>
            <div className="metric-number-row">
              <span className="metric-number text-success">
                {stats?.onlineUsersCount ?? onlineUsersList.filter(u => u.isOnline).length}
              </span>
              <span className="metric-sub-badge">
                {stats?.onlineSessionsCount ?? 0} tela(s)
              </span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-card-top">
              <CheckCircle2 size={18} className="text-success" />
              <span className="metric-label">Assinaturas Ativas</span>
            </div>
            <span className="metric-number text-success">
              {stats?.activeUsers ?? users.filter(u => u.assinaturaAtiva).length}
            </span>
          </div>

          <div className="metric-card">
            <div className="metric-card-top">
              <XCircle size={18} className="text-danger" />
              <span className="metric-label">Inativos / Expirados</span>
            </div>
            <span className="metric-number text-danger">
              {stats?.inactiveUsers ?? users.filter(u => !u.assinaturaAtiva).length}
            </span>
          </div>
        </div>

        {/* ==================== NAVEGAÇÃO DE ABAS ==================== */}
        <nav className="master-nav-tabs">
          <button
            type="button"
            className={`master-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={18} />
            <span>Usuários ({users.length})</span>
          </button>

          <button
            type="button"
            className={`master-tab-btn ${activeTab === 'online' ? 'active' : ''}`}
            onClick={() => setActiveTab('online')}
          >
            <Zap size={18} className={onlineUsersList.some(u => u.isOnline) ? "text-success pulse-glow" : ""} />
            <span>Online Agora ({stats?.onlineUsersCount ?? onlineUsersList.filter(u => u.isOnline).length})</span>
          </button>

          <button
            type="button"
            className={`master-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <FileText size={18} />
            <span>Logs de Acesso ({logs.length})</span>
          </button>
        </nav>

        {/* ==================== ABA 1: GESTÃO DE USUÁRIOS ==================== */}
        {activeTab === 'users' && (
          <div className="master-tab-body">
            {/* Barra de Busca e Filtros Rápidos */}
            <div className="master-search-filters">
              <div className="master-search-input-wrap">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar por nome, @usuário, telefone ou e-mail..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="master-search-input"
                />
                {userSearchQuery && (
                  <button className="search-clear-btn" onClick={() => setUserSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Chips de Filtro */}
              <div className="master-filter-chips">
                <button
                  type="button"
                  className={`chip-btn ${userStatusFilter === 'todos' ? 'active' : ''}`}
                  onClick={() => setUserStatusFilter('todos')}
                >
                  Todos ({users.length})
                </button>
                <button
                  type="button"
                  className={`chip-btn ${userStatusFilter === 'ativos' ? 'active' : ''}`}
                  onClick={() => setUserStatusFilter('ativos')}
                >
                  🟢 Ativos ({users.filter(u => u.assinaturaAtiva).length})
                </button>
                <button
                  type="button"
                  className={`chip-btn ${userStatusFilter === 'inativos' ? 'active' : ''}`}
                  onClick={() => setUserStatusFilter('inativos')}
                >
                  🔴 Inativos ({users.filter(u => !u.assinaturaAtiva).length})
                </button>
                <button
                  type="button"
                  className={`chip-btn ${userStatusFilter === 'online' ? 'active' : ''}`}
                  onClick={() => setUserStatusFilter('online')}
                >
                  ⚡ Online ({users.filter(u => u.isOnline).length})
                </button>
                <button
                  type="button"
                  className={`chip-btn ${userStatusFilter === 'trial' ? 'active' : ''}`}
                  onClick={() => setUserStatusFilter('trial')}
                >
                  ⏱️ Testes ({users.filter(u => u.planoId === 'teste-2h').length})
                </button>
              </div>
            </div>

            {/* Listagem de Cards de Usuários */}
            <div className="master-users-list">
              {loading && users.length === 0 ? (
                <div className="master-loading-state">
                  <div className="player-spinner"></div>
                  <span>Carregando usuários do sistema...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="master-empty-state">
                  <Users size={40} className="text-muted" />
                  <p>Nenhum usuário encontrado com os filtros atuais.</p>
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const initial = (user.username || user.nome || 'U').charAt(0).toUpperCase();
                  const isMasterUserRow = user.username === 'odonel';
                  const cleanPhone = (user.telefone || '').replace(/\D/g, '');

                  return (
                    <div key={user.id} className={`master-user-card glass-panel ${user.isOnline ? 'is-user-online' : ''}`}>
                      {/* Linha Principal do Usuário */}
                      <div className="user-card-header">
                        <div className="user-avatar-wrap">
                          <div className={`user-avatar-circle ${isMasterUserRow ? 'master-avatar' : ''}`}>
                            {initial}
                          </div>
                          {user.isOnline && (
                            <span className="online-dot-indicator" title="Conectado agora" />
                          )}
                        </div>

                        <div className="user-primary-info">
                          <div className="user-name-title-row">
                            <span className="user-handle">@{user.username}</span>
                            {user.nome && user.nome !== user.username && (
                              <span className="user-real-name">({user.nome})</span>
                            )}
                          </div>

                          <div className="user-meta-sub">
                            {user.telefone ? (
                              <a
                                href={`https://wa.me/55${cleanPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="user-whatsapp-link"
                                title="Abrir conversa no WhatsApp"
                              >
                                <MessageCircle size={13} color="#25D366" />
                                <span>{user.telefone}</span>
                              </a>
                            ) : (
                              <span className="text-muted">{user.email || 'Sem contato'}</span>
                            )}
                            <span className="meta-separator">•</span>
                            <span className="text-muted">Cadastro: {new Date(user.createdAt).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="user-badge-col">
                          {isMasterUserRow ? (
                            <span className="status-badge badge-master">👑 Master Vitalício</span>
                          ) : user.assinaturaAtiva ? (
                            <span className="status-badge badge-active">🟢 Ativo</span>
                          ) : user.status === 'expirado' ? (
                            <span className="status-badge badge-expired">⏳ Expirado</span>
                          ) : (
                            <span className="status-badge badge-inactive">🔴 Inativo</span>
                          )}
                        </div>
                      </div>

                      {/* Informações de Plano e Período */}
                      <div className="user-subscription-details">
                        <div className="detail-item">
                          <Layers size={14} className="text-accent" />
                          <span className="detail-label">Plano:</span>
                          <span className="detail-value">{user.planoNome || 'Nenhum'} ({user.limiteTelas} tela{user.limiteTelas > 1 ? 's' : ''})</span>
                        </div>

                        <div className="detail-item">
                          <Clock size={14} className="text-accent" />
                          <span className="detail-label">Validade:</span>
                          <span className={`detail-value ${user.assinaturaAtiva ? 'text-success' : 'text-danger'}`}>
                            {user.expiresInText}
                          </span>
                        </div>
                      </div>

                      {/* Dispositivos Conectados / Sessões Ativas */}
                      {user.activeSessions && user.activeSessions.length > 0 && (
                        <div className="user-active-sessions-box">
                          <div className="sessions-header-row">
                            <span className="sessions-title">
                              <Radio size={13} className="text-success pulse-glow" />
                              <strong>Dispositivos Conectados ({user.activeSessions.length}):</strong>
                            </span>
                          </div>

                          <div className="sessions-list-mini">
                            {user.activeSessions.map((ses) => (
                              <div key={ses.id} className="session-item-row">
                                <div className="session-dev-info">
                                  {renderDeviceIcon(ses.deviceInfo)}
                                  <span className="session-dev-name">{ses.deviceInfo}</span>
                                  {ses.isOnline ? (
                                    <span className="session-online-chip">Online agora</span>
                                  ) : (
                                    <span className="session-offline-chip">Visto há {Math.floor(ses.secondsSinceHeartbeat / 60)}m</span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  className="btn-kick-single"
                                  onClick={() => setKickModalData({
                                    userId: user.id,
                                    sessionId: ses.id,
                                    userName: user.username,
                                    deviceInfo: ses.deviceInfo
                                  })}
                                  title="Derrubar esta sessão agora"
                                >
                                  <Power size={13} />
                                  <span>Derrubar</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Botões de Ações Rápidas (Mobile Touch-Friendly) */}
                      {!isMasterUserRow && (
                        <div className="user-card-actions">
                          {user.assinaturaAtiva ? (
                            <button
                              type="button"
                              className="btn-action-inactivate"
                              onClick={() => handleInactivateUser(user)}
                            >
                              <XCircle size={16} />
                              <span>Inativar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-action-activate"
                              onClick={() => handleOpenPeriodModal(user)}
                            >
                              <CheckCircle2 size={16} />
                              <span>Ativar Usuário</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn-action-period"
                            onClick={() => handleOpenPeriodModal(user)}
                          >
                            <Calendar size={16} />
                            <span>Definir Período</span>
                          </button>

                          {user.activeSessions && user.activeSessions.length > 0 && (
                            <button
                              type="button"
                              className="btn-action-kick"
                              onClick={() => setKickModalData({
                                userId: user.id,
                                userName: user.username,
                                deviceInfo: `${user.activeSessions.length} aparelho(s)`
                              })}
                            >
                              <Power size={16} />
                              <span>Derrubar Sessão</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==================== ABA 2: ONLINE AGORA (TEMPO REAL) ==================== */}
        {activeTab === 'online' && (
          <div className="master-tab-body">
            <div className="online-tab-intro">
              <div className="online-intro-text">
                <h3 className="online-title">
                  <Zap size={20} className="text-success pulse-glow" />
                  Usuários e Aparelhos Conectados Neste Momento
                </h3>
                <p className="online-desc">
                  Monitoramento em tempo real dos aparelhos enviando transmissão e heartbeat nos últimos 2 minutos.
                </p>
              </div>

              <button
                type="button"
                className="btn-outline refresh-mini-btn"
                onClick={() => loadAllData(false)}
              >
                <RefreshCw size={14} className={refreshing ? 'rotating' : ''} />
                <span>Atualizar Agora</span>
              </button>
            </div>

            <div className="master-online-list">
              {onlineUsersList.length === 0 ? (
                <div className="master-empty-state">
                  <Radio size={44} className="text-muted" />
                  <h4>Nenhum usuário conectado ao vivo</h4>
                  <p>No momento não há clientes assistindo ou navegando no sistema.</p>
                </div>
              ) : (
                onlineUsersList.map((user) => {
                  const cleanPhone = (user.telefone || '').replace(/\D/g, '');

                  return (
                    <div key={user.id} className="online-user-card glass-panel">
                      <div className="online-user-top">
                        <div className="user-avatar-circle">
                          {(user.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="online-user-info">
                          <div className="online-username-row">
                            <span className="online-name">@{user.username}</span>
                            {user.isOnline ? (
                              <span className="live-pulse-badge">🟢 Assistindo Agora</span>
                            ) : (
                              <span className="offline-pulse-badge">Ausente</span>
                            )}
                          </div>
                          <span className="online-phone-text">
                            {user.telefone ? (
                              <a
                                href={`https://wa.me/55${cleanPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="user-whatsapp-link"
                              >
                                <MessageCircle size={12} color="#25D366" />
                                {user.telefone}
                              </a>
                            ) : user.email}
                          </span>
                        </div>

                        {user.username !== 'odonel' && (
                          <button
                            type="button"
                            className="btn-danger-kick-all"
                            onClick={() => setKickModalData({
                              userId: user.id,
                              userName: user.username,
                              deviceInfo: 'Todos os aparelhos'
                            })}
                          >
                            <Power size={14} />
                            <span>Derrubar</span>
                          </button>
                        )}
                      </div>

                      {/* Lista de Sessões do Usuário Online */}
                      <div className="online-sessions-grid">
                        {(user.activeSessions || []).map((ses) => (
                          <div key={ses.id} className="online-session-card">
                            <div className="session-card-header">
                              {renderDeviceIcon(ses.deviceInfo)}
                              <span className="ses-dev-name">{ses.deviceInfo}</span>
                            </div>

                            <div className="ses-timing-row">
                              <span className="ses-time-label">Último sinal:</span>
                              <span className="ses-time-val">
                                {ses.secondsSinceHeartbeat < 30 
                                  ? 'Agora mesmo' 
                                  : `Há ${ses.secondsSinceHeartbeat}s`}
                              </span>
                            </div>

                            <button
                              type="button"
                              className="btn-kick-device"
                              onClick={() => setKickModalData({
                                userId: user.id,
                                sessionId: ses.id,
                                userName: user.username,
                                deviceInfo: ses.deviceInfo
                              })}
                            >
                              <Power size={12} />
                              <span>Desconectar Aparelho</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==================== ABA 3: LOGS DE ACESSO AO SISTEMA ==================== */}
        {activeTab === 'logs' && (
          <div className="master-tab-body">
            {/* Barra de Busca de Logs */}
            <div className="master-search-filters">
              <div className="master-search-input-wrap">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar logs por IP, @usuário, dispositivo ou rota..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="master-search-input"
                />
                {logSearchQuery && (
                  <button className="search-clear-btn" onClick={() => setLogSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="master-filter-chips">
                <button
                  type="button"
                  className={`chip-btn ${logTypeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setLogTypeFilter('all')}
                >
                  Todos ({logs.length})
                </button>
                <button
                  type="button"
                  className={`chip-btn ${logTypeFilter === 'logged' ? 'active' : ''}`}
                  onClick={() => setLogTypeFilter('logged')}
                >
                  👤 Logados ({logs.filter(l => l.username).length})
                </button>
                <button
                  type="button"
                  className={`chip-btn ${logTypeFilter === 'anonymous' ? 'active' : ''}`}
                  onClick={() => setLogTypeFilter('anonymous')}
                >
                  🌐 Visitantes Anônimos ({logs.filter(l => !l.username).length})
                </button>
              </div>
            </div>

            {/* Listagem de Logs (Mobile Responsive Cards) */}
            <div className="master-logs-list">
              {filteredLogs.length === 0 ? (
                <div className="master-empty-state">
                  <FileText size={40} className="text-muted" />
                  <p>Nenhum log de acesso encontrado.</p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const logDate = new Date(log.createdAt);
                  const formattedDate = logDate.toLocaleDateString('pt-BR');
                  const formattedTime = logDate.toLocaleTimeString('pt-BR');

                  return (
                    <div key={log.id} className="master-log-item glass-panel">
                      <div className="log-item-top">
                        <div className="log-user-badge">
                          {log.username ? (
                            <span className="log-user-name">@{log.username}</span>
                          ) : (
                            <span className="log-anon-name">Visitante</span>
                          )}
                        </div>

                        <div className="log-timestamp">
                          <Clock size={12} />
                          <span>{formattedDate} às {formattedTime}</span>
                        </div>
                      </div>

                      <div className="log-item-details">
                        <div className="log-detail-row">
                          <span className="log-label">IP:</span>
                          <span className="log-val font-mono">{log.ip}</span>
                          <span className="meta-separator">•</span>
                          <span className="log-label">Página:</span>
                          <span className="log-val-path">{log.path || '/'}</span>
                        </div>

                        <div className="log-detail-row">
                          {renderDeviceIcon(log.deviceType)}
                          <span className="log-val">{log.deviceModel || 'Computador'}</span>
                          <span className="meta-separator">•</span>
                          <span className="log-val">{log.browser} ({log.os})</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==================== MODAL / BOTTOM SHEET: DEFINIR PERÍODO ==================== */}
        {selectedUserForPeriod && (
          <div className="sub-modal-backdrop fade-in" style={{ zIndex: 100000 }}>
            <div className="period-modal-card glass-card scale-up">
              <div className="period-modal-header">
                <div className="period-header-title">
                  <Calendar size={22} className="text-accent" />
                  <div>
                    <h3>Definir Período de Ativação</h3>
                    <p>Usuário: <strong>@{selectedUserForPeriod.username}</strong></p>
                  </div>
                </div>
                <button
                  type="button"
                  className="close-sub-modal-btn"
                  onClick={() => setSelectedUserForPeriod(null)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="period-modal-body">
                <label className="period-section-label">Escolha a Duração do Acesso:</label>
                
                {/* Grid de Opções Rápidas */}
                <div className="period-presets-grid">
                  <button
                    type="button"
                    className={`preset-btn ${periodPreset === '2h' ? 'active' : ''}`}
                    onClick={() => setPeriodPreset('2h')}
                  >
                    <span className="preset-title">⏱️ 2 Horas</span>
                    <span className="preset-sub">Degustação / Teste</span>
                  </button>

                  <button
                    type="button"
                    className={`preset-btn ${periodPreset === '24h' ? 'active' : ''}`}
                    onClick={() => setPeriodPreset('24h')}
                  >
                    <span className="preset-title">📅 24 Horas</span>
                    <span className="preset-sub">1 Dia de Acesso</span>
                  </button>

                  <button
                    type="button"
                    className={`preset-btn ${periodPreset === '7d' ? 'active' : ''}`}
                    onClick={() => setPeriodPreset('7d')}
                  >
                    <span className="preset-title">📅 7 Dias</span>
                    <span className="preset-sub">1 Semana</span>
                  </button>

                  <button
                    type="button"
                    className={`preset-btn ${periodPreset === '30d' ? 'active' : ''}`}
                    onClick={() => setPeriodPreset('30d')}
                  >
                    <span className="preset-title">📅 30 Dias</span>
                    <span className="preset-sub">1 Mês (Padrão)</span>
                  </button>

                  <button
                    type="button"
                    className={`preset-btn ${periodPreset === '90d' ? 'active' : ''}`}
                    onClick={() => setPeriodPreset('90d')}
                  >
                    <span className="preset-title">📅 90 Dias</span>
                    <span className="preset-sub">3 Meses (Trimestral)</span>
                  </button>

                  <button
                    type="button"
                    className={`preset-btn ${periodPreset === '180d' ? 'active' : ''}`}
                    onClick={() => setPeriodPreset('180d')}
                  >
                    <span className="preset-title">📅 180 Dias</span>
                    <span className="preset-sub">6 Meses (Semestral)</span>
                  </button>

                  <button
                    type="button"
                    className={`preset-btn ${periodPreset === '365d' ? 'active' : ''}`}
                    onClick={() => setPeriodPreset('365d')}
                  >
                    <span className="preset-title">📅 365 Dias</span>
                    <span className="preset-sub">1 Ano Completo</span>
                  </button>

                  <button
                    type="button"
                    className={`preset-btn gold-preset ${periodPreset === 'vitalicio' ? 'active' : ''}`}
                    onClick={() => setPeriodPreset('vitalicio')}
                  >
                    <span className="preset-title">👑 Vitalício</span>
                    <span className="preset-sub">Sem Expiração</span>
                  </button>

                  <button
                    type="button"
                    className={`preset-btn ${periodPreset === 'custom' ? 'active' : ''}`}
                    onClick={() => setPeriodPreset('custom')}
                  >
                    <span className="preset-title">📅 Personalizado</span>
                    <span className="preset-sub">Data e Hora Específica</span>
                  </button>
                </div>

                {/* Input de Data Personalizada */}
                {periodPreset === 'custom' && (
                  <div className="custom-datetime-wrap">
                    <label>Selecione a Data e Hora de Término:</label>
                    <input
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => setCustomDateTime(e.target.value)}
                      className="custom-datetime-input"
                    />
                  </div>
                )}

                {/* Limite de Telas Simultâneas */}
                <div className="screens-selector-wrap">
                  <label className="period-section-label">Limite de Telas Simultâneas:</label>
                  <div className="screens-btn-group">
                    {[1, 2, 4, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={`screen-pill-btn ${selectedScreens === num ? 'active' : ''}`}
                        onClick={() => setSelectedScreens(num)}
                      >
                        <Tv size={14} />
                        <span>{num} {num === 1 ? 'Tela' : 'Telas'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Checkbox para derrubar sessões atuais */}
                <label className="kick-checkbox-label">
                  <input
                    type="checkbox"
                    checked={kickCurrentSessions}
                    onChange={(e) => setKickCurrentSessions(e.target.checked)}
                  />
                  <span>Desconectar sessões atuais para forçar atualização do plano</span>
                </label>
              </div>

              <div className="period-modal-footer">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setSelectedUserForPeriod(null)}
                  disabled={savingPeriod}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-glow-primary"
                  onClick={handleSavePeriod}
                  disabled={savingPeriod}
                >
                  {savingPeriod ? 'Salvando...' : 'Confirmar e Ativar Acesso'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== MODAL: CONFIRMAR DERRUBADA DE SESSÃO ==================== */}
        {kickModalData && (
          <div className="sub-modal-backdrop fade-in" style={{ zIndex: 100000 }}>
            <div className="kick-confirm-card glass-card scale-up">
              <div className="kick-icon-wrap">
                <Power size={36} color="#ef4444" />
              </div>

              <h3 className="kick-title">Derrubar Sessão de @{kickModalData.userName}?</h3>
              <p className="kick-desc">
                O aparelho <strong>{kickModalData.deviceInfo}</strong> será desconectado imediatamente do sistema.
              </p>

              <div className="kick-actions-row">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setKickModalData(null)}
                  disabled={kickingSession}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-danger-confirm"
                  onClick={handleConfirmKickSession}
                  disabled={kickingSession}
                >
                  {kickingSession ? 'Derrubando...' : 'Sim, Derrubar Agora'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
