import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Users,
  CreditCard,
  FileText,
  Search,
  RefreshCw,
  Plus,
  Minus,
  Lock,
  Power,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  TrendingUp,
  X,
  Smartphone,
  Calendar,
  Layers,
  ChevronDown,
  DollarSign
} from 'lucide-react';
import {
  RESELLER_PLANS,
  getMasterResellers,
  updateMasterResellerStatus,
  adjustMasterResellerCredits,
  resetMasterResellerPassword,
  deleteMasterReseller,
  getMasterResellerClients,
  getMasterResellerOrders,
  getMasterResellerTransactions,
  formatCpfCnpj,
  formatPhone
} from '../../services/resellerService';

export default function MasterResellerTab({ onShowToast }) {
  // Sub-abas do Master: 'resellers' | 'clients' | 'finance'
  const [subTab, setSubTab] = useState('resellers');

  // Dados
  const [resellers, setResellers] = useState([]);
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Estados de Carregamento
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResellerFilter, setSelectedResellerFilter] = useState('');

  // Modal de Ajuste Manual de Créditos (Seção 6)
  const [adjustModalReseller, setAdjustModalReseller] = useState(null);
  const [adjustPlan, setAdjustPlan] = useState('mensal');
  const [adjustDelta, setAdjustDelta] = useState(1);
  const [adjustAction, setAdjustAction] = useState('add'); // 'add' | 'remove'
  const [adjustReason, setAdjustReason] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);

  // Modal de Redefinir Senha de Lojista
  const [resetPwReseller, setResetPwReseller] = useState(null);
  const [newResellerPassword, setNewResellerPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const loadAllResellerData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const [resellersData, clientsData, ordersData, txData] = await Promise.all([
        getMasterResellers().catch(() => []),
        getMasterResellerClients().catch(() => []),
        getMasterResellerOrders().catch(() => []),
        getMasterResellerTransactions().catch(() => [])
      ]);

      setResellers(resellersData);
      setClients(clientsData);
      setOrders(ordersData);
      setTransactions(txData);
    } catch (err) {
      console.error('Erro ao carregar dados de revenda para o Master:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllResellerData();
  }, []);

  // Métricas Consolidadas
  const totalRevenue = useMemo(() => {
    return orders
      .filter(o => o.status === 'APPROVED')
      .reduce((sum, o) => sum + (Number(o.valorTotal) || 0), 0);
  }, [orders]);

  const totalCreditsCirculating = useMemo(() => {
    return resellers.reduce((acc, r) => {
      acc.mensal += Number(r.creditos?.mensal) || 0;
      acc.trimestral += Number(r.creditos?.trimestral) || 0;
      acc.semestral += Number(r.creditos?.semestral) || 0;
      acc.anual += Number(r.creditos?.anual) || 0;
      return acc;
    }, { mensal: 0, trimestral: 0, semestral: 0, anual: 0 });
  }, [resellers]);

  // Filtro de Lojistas
  const filteredResellers = useMemo(() => {
    return resellers.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        (r.nome && r.nome.toLowerCase().includes(q)) ||
        (r.username && r.username.toLowerCase().includes(q)) ||
        (r.cpf && r.cpf.includes(q)) ||
        (r.telefone && r.telefone.includes(q))
      );
    });
  }, [resellers, searchQuery]);

  // Filtro de Clientes Finais
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      if (selectedResellerFilter && c.resellerId !== selectedResellerFilter) {
        return false;
      }
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.username.toLowerCase().includes(q) ||
        (c.nome && c.nome.toLowerCase().includes(q)) ||
        (c.resellerNome && c.resellerNome.toLowerCase().includes(q))
      );
    });
  }, [clients, searchQuery, selectedResellerFilter]);

  // Ação: Alterar Status (Bloquear / Ativar)
  const handleToggleStatus = async (r) => {
    const newStatus = r.status === 'bloqueado' ? 'ativo' : 'bloqueado';
    const confirmMsg = newStatus === 'bloqueado'
      ? `Deseja BLOQUEAR o lojista "${r.nome || r.username}"? Suas sessões serão encerradas.`
      : `Deseja ATIVAR novamente o lojista "${r.nome || r.username}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await updateMasterResellerStatus(r.id, newStatus);
      if (onShowToast) onShowToast(`Lojista ${r.nome || r.username} agora está ${newStatus}!`);
      loadAllResellerData(true);
    } catch (err) {
      alert(err.message || 'Erro ao alterar status.');
    }
  };

  // Ação: Ajustar Créditos Manualmente
  const handleSaveCreditAdjust = async (e) => {
    e.preventDefault();
    if (!adjustModalReseller) return;

    const deltaNum = Math.abs(parseInt(adjustDelta, 10) || 1);
    const finalDelta = adjustAction === 'add' ? deltaNum : -deltaNum;

    setSavingAdjust(true);
    try {
      await adjustMasterResellerCredits(
        adjustModalReseller.id,
        adjustPlan,
        finalDelta,
        adjustReason.trim() || 'Ajuste administrativo efetuado pelo Master Odonel'
      );

      if (onShowToast) onShowToast(`Créditos do lojista ${adjustModalReseller.nome || adjustModalReseller.username} ajustados com sucesso!`);
      setAdjustModalReseller(null);
      setAdjustReason('');
      setAdjustDelta(1);
      loadAllResellerData(true);
    } catch (err) {
      alert(err.message || 'Erro ao ajustar créditos.');
    } finally {
      setSavingAdjust(false);
    }
  };

  // Ação: Redefinir Senha do Lojista
  const handleSaveResellerPassword = async (e) => {
    e.preventDefault();
    if (!resetPwReseller || !newResellerPassword.trim()) return;

    setSavingPw(true);
    try {
      await resetMasterResellerPassword(resetPwReseller.id, newResellerPassword.trim());
      if (onShowToast) onShowToast(`Senha do lojista @${resetPwReseller.username} redefinida com sucesso!`);
      setResetPwReseller(null);
      setNewResellerPassword('');
      loadAllResellerData(true);
    } catch (err) {
      alert(err.message || 'Erro ao redefinir senha.');
    } finally {
      setSavingPw(false);
    }
  };

  // Ação: Excluir Lojista
  const handleDeleteReseller = async (r) => {
    if (!window.confirm(`ATENÇÃO: Deseja realmente EXCLUIR permanentemente o lojista "${r.nome || r.username}"?`)) return;

    try {
      await deleteMasterReseller(r.id);
      if (onShowToast) onShowToast(`Lojista "${r.nome || r.username}" excluído com sucesso.`);
      loadAllResellerData(true);
    } catch (err) {
      alert(err.message || 'Erro ao excluir revendedor.');
    }
  };

  return (
    <div className="master-tab-body">
      {/* Cards de Métricas do Ecossistema B2B */}
      <div className="master-metrics-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="metric-card">
          <div className="metric-card-top">
            <Briefcase size={18} className="text-accent" />
            <span className="metric-label">Lojistas / Revendedores</span>
          </div>
          <div className="metric-number-row">
            <span className="metric-number">{resellers.length}</span>
            <span className="metric-sub-badge" style={{ color: '#4ade80' }}>
              {resellers.filter(r => r.status === 'ativo').length} ativos
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <Users size={18} className="text-success" />
            <span className="metric-label">Clientes Criados por Lojistas</span>
          </div>
          <div className="metric-number-row">
            <span className="metric-number text-success">{clients.length}</span>
            <span className="metric-sub-badge" style={{ color: '#f59e0b' }}>
              {clients.filter(c => c.assinaturaAtiva).length} com plano ativo
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <DollarSign size={18} className="text-gold" />
            <span className="metric-label">Faturamento Total em Créditos</span>
          </div>
          <span className="metric-number text-gold" style={{ fontSize: '1.4rem' }}>
            R$ {totalRevenue.toFixed(2).replace('.', ',')}
          </span>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <Layers size={18} className="text-accent" />
            <span className="metric-label">Créditos em Circulação</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
            <div>M: <strong>{totalCreditsCirculating.mensal}</strong> | T: <strong>{totalCreditsCirculating.trimestral}</strong></div>
            <div>S: <strong>{totalCreditsCirculating.semestral}</strong> | A: <strong>{totalCreditsCirculating.anual}</strong></div>
          </div>
        </div>
      </div>

      {/* Navegação entre Sub-abas */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
        <button
          type="button"
          className={`reseller-filter-btn ${subTab === 'resellers' ? 'active' : ''}`}
          onClick={() => { setSubTab('resellers'); setSearchQuery(''); }}
        >
          <Briefcase size={14} style={{ display: 'inline', marginRight: '0.35rem' }} />
          Lojistas Cadastrados ({resellers.length})
        </button>

        <button
          type="button"
          className={`reseller-filter-btn ${subTab === 'clients' ? 'active' : ''}`}
          onClick={() => { setSubTab('clients'); setSearchQuery(''); }}
        >
          <Users size={14} style={{ display: 'inline', marginRight: '0.35rem' }} />
          Clientes de Revenda ({clients.length})
        </button>

        <button
          type="button"
          className={`reseller-filter-btn ${subTab === 'finance' ? 'active' : ''}`}
          onClick={() => { setSubTab('finance'); setSearchQuery(''); }}
        >
          <CreditCard size={14} style={{ display: 'inline', marginRight: '0.35rem' }} />
          Histórico Financeiro & Logs ({orders.length} pedidos, {transactions.length} transações)
        </button>
      </div>

      {/* SUB-ABA 1: LOJISTAS */}
      {subTab === 'resellers' && (
        <div>
          {/* Barra de Busca de Lojista */}
          <div className="master-search-filters">
            <div className="master-search-input-wrap">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Buscar lojista por nome, CPF/CNPJ, usuário ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              className="master-action-btn"
              onClick={() => loadAllResellerData(true)}
              title="Recarregar"
            >
              <RefreshCw size={16} className={refreshing ? 'spin-animation' : ''} />
            </button>
          </div>

          {/* Tabela de Lojistas */}
          <div className="reseller-table-card">
            {filteredResellers.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="reseller-table">
                  <thead>
                    <tr>
                      <th>Lojista / Razão</th>
                      <th>Documento / Contato</th>
                      <th>Status</th>
                      <th>Saldos por Plano (M / T / S / A)</th>
                      <th>Clientes Finais</th>
                      <th>Total Compras</th>
                      <th style={{ textAlign: 'right' }}>Ações de Gestão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResellers.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="reseller-user-badge">
                            <div className="reseller-user-avatar">
                              {(r.nome || r.username).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="reseller-user-name">{r.nome || `@${r.username}`}</div>
                              <div className="reseller-user-sub">@{r.username}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem', color: '#f8fafc' }}>
                            {r.cpf ? formatCpfCnpj(r.cpf) : 'Sem documento'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {r.telefone ? formatPhone(r.telefone) : (r.email || '')}
                          </div>
                        </td>
                        <td>
                          <span className={`reseller-status-pill ${r.status === 'bloqueado' ? 'expirado' : 'ativo'}`}>
                            {r.status || 'ativo'}
                          </span>
                        </td>
                        <td>
                          {/* Saldos de Créditos por Plano (Seção 4) */}
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                              M: <strong style={{ color: '#f59e0b' }}>{r.creditos?.mensal || 0}</strong>
                            </span>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                              T: <strong style={{ color: '#f59e0b' }}>{r.creditos?.trimestral || 0}</strong>
                            </span>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                              S: <strong style={{ color: '#f59e0b' }}>{r.creditos?.semestral || 0}</strong>
                            </span>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                              A: <strong style={{ color: '#f59e0b' }}>{r.creditos?.anual || 0}</strong>
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                            {r.totalClients || 0} clientes
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#4ade80' }}>
                            {r.activeClients || 0} ativos
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, color: '#f59e0b' }}>
                            R$ {(r.totalSpent || 0).toFixed(2).replace('.', ',')}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {/* Ajustar Créditos */}
                            <button
                              className="reseller-action-btn"
                              style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                              onClick={() => {
                                setAdjustModalReseller(r);
                                setAdjustPlan('mensal');
                                setAdjustAction('add');
                                setAdjustDelta(5);
                                setAdjustReason('');
                              }}
                              title="Adicionar ou Remover créditos com log de auditoria"
                            >
                              <Sparkles size={14} />
                              <span>Ajustar Créditos</span>
                            </button>

                            {/* Ver Clientes */}
                            <button
                              className="reseller-action-btn"
                              onClick={() => {
                                setSelectedResellerFilter(r.id);
                                setSubTab('clients');
                              }}
                              title="Visualizar todos os clientes vinculados a este lojista"
                            >
                              <Users size={14} />
                            </button>

                            {/* Bloquear / Desbloquear */}
                            <button
                              className={`reseller-action-btn ${r.status === 'bloqueado' ? '' : 'danger'}`}
                              onClick={() => handleToggleStatus(r)}
                              title={r.status === 'bloqueado' ? 'Desbloquear lojista' : 'Bloquear lojista'}
                            >
                              <Power size={14} />
                            </button>

                            {/* Redefinir Senha */}
                            <button
                              className="reseller-action-btn"
                              onClick={() => {
                                setResetPwReseller(r);
                                setNewResellerPassword('');
                              }}
                              title="Redefinir senha do lojista"
                            >
                              <Lock size={14} />
                            </button>

                            {/* Excluir */}
                            <button
                              className="reseller-action-btn danger"
                              onClick={() => handleDeleteReseller(r)}
                              title="Excluir revendedor"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                <Briefcase size={40} style={{ margin: '0 auto 1rem', color: '#64748b' }} />
                <h3>Nenhum lojista encontrado.</h3>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-ABA 2: CLIENTES DE REVENDA */}
      {subTab === 'clients' && (
        <div>
          <div className="master-search-filters">
            <div className="master-search-input-wrap">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Buscar cliente final ou nome do lojista..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {selectedResellerFilter && (
              <button
                className="reseller-action-btn"
                onClick={() => setSelectedResellerFilter('')}
                style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}
              >
                <X size={14} />
                <span>Limpar filtro de lojista</span>
              </button>
            )}
          </div>

          <div className="reseller-table-card">
            {filteredClients.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="reseller-table">
                  <thead>
                    <tr>
                      <th>Cliente Final</th>
                      <th>Lojista Responsável</th>
                      <th>Plano & Telas</th>
                      <th>Validade</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="reseller-user-badge">
                            <div className="reseller-user-avatar">
                              {(c.nome || c.username).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="reseller-user-name">@{c.username}</div>
                              <div className="reseller-user-sub">{c.nome}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#f59e0b' }}>
                            {c.resellerNome || 'Lojista'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {c.resellerTelefone ? formatPhone(c.resellerTelefone) : ''}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                            {c.planoNome || 'Plano Revenda'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {c.limiteTelas} tela(s)
                          </div>
                        </td>
                        <td>
                          {c.fimAssinatura
                            ? new Date(c.fimAssinatura).toLocaleDateString('pt-BR')
                            : 'Sem data'}
                        </td>
                        <td>
                          <span className={`reseller-status-pill ${c.assinaturaAtiva ? 'ativo' : 'expirado'}`}>
                            {c.assinaturaAtiva ? 'Ativo' : 'Expirado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                <Users size={40} style={{ margin: '0 auto 1rem', color: '#64748b' }} />
                <h3>Nenhum cliente final encontrado com os filtros atuais.</h3>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-ABA 3: FINANCEIRO & AUDITORIA */}
      {subTab === 'finance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Tabela de Compras de Créditos */}
          <div className="reseller-table-card">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', fontWeight: 700, color: '#f8fafc' }}>
              Compras de Pacotes Efetuadas pelos Lojistas ({orders.length})
            </div>
            {orders.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="reseller-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Lojista</th>
                      <th>Plano</th>
                      <th>Quantidade</th>
                      <th>Valor Total</th>
                      <th>Gateway / Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 50).map((o) => {
                      const reseller = resellers.find(r => r.id === o.resellerId);
                      return (
                        <tr key={o.id}>
                          <td>{new Date(o.createdAt).toLocaleString('pt-BR')}</td>
                          <td>
                            <strong>{reseller?.nome || reseller?.username || o.resellerId}</strong>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{o.plano}</td>
                          <td>{o.quantidade} créditos</td>
                          <td style={{ color: '#f59e0b', fontWeight: 800 }}>
                            R$ {Number(o.valorTotal).toFixed(2).replace('.', ',')}
                          </td>
                          <td>
                            <span style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: o.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: o.status === 'APPROVED' ? '#4ade80' : '#fbbf24'
                            }}>
                              {o.status === 'APPROVED' ? '✓ Aprovado Pix' : '⏳ Pendente'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                Nenhum pedido de crédito registrado.
              </div>
            )}
          </div>

          {/* Tabela de Transações e Ajustes */}
          <div className="reseller-table-card">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', fontWeight: 700, color: '#f8fafc' }}>
              Logs de Movimentações e Ajustes Administrativos ({transactions.length})
            </div>
            {transactions.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="reseller-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Plano</th>
                      <th>Qtd.</th>
                      <th>Saldo Resultante</th>
                      <th>Descrição / Auditoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 100).map((t) => (
                      <tr key={t.id}>
                        <td>{new Date(t.createdAt).toLocaleString('pt-BR')}</td>
                        <td>
                          <span style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: t.quantidade > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: t.quantidade > 0 ? '#4ade80' : '#f87171'
                          }}>
                            {t.tipo}
                          </span>
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{t.plano}</td>
                        <td style={{ fontWeight: 800, color: t.quantidade > 0 ? '#4ade80' : '#f87171' }}>
                          {t.quantidade > 0 ? `+${t.quantidade}` : t.quantidade}
                        </td>
                        <td>{t.saldoNovo} un</td>
                        <td style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t.descricao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                Nenhuma transação registrada.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Master: Ajuste Manual de Créditos */}
      {adjustModalReseller && (
        <div className="reseller-modal-overlay">
          <div className="reseller-modal-card" style={{ maxWidth: '480px' }}>
            <button className="reseller-modal-close" onClick={() => setAdjustModalReseller(null)}>
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.5rem' }}>
              Ajuste Manual de Créditos
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.25rem' }}>
              Lojista: <strong>{adjustModalReseller.nome || adjustModalReseller.username}</strong>
            </p>

            <form onSubmit={handleSaveCreditAdjust}>
              {/* Tipo de Operação */}
              <div className="reseller-form-group">
                <label className="reseller-label"><span>Ação</span></label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`reseller-filter-btn ${adjustAction === 'add' ? 'active' : ''}`}
                    style={{ flex: 1, padding: '0.65rem' }}
                    onClick={() => setAdjustAction('add')}
                  >
                    + Adicionar Créditos
                  </button>
                  <button
                    type="button"
                    className={`reseller-filter-btn ${adjustAction === 'remove' ? 'active' : ''}`}
                    style={{ flex: 1, padding: '0.65rem' }}
                    onClick={() => setAdjustAction('remove')}
                  >
                    - Remover Créditos
                  </button>
                </div>
              </div>

              {/* Plano */}
              <div className="reseller-form-group">
                <label className="reseller-label"><span>Tipo de Plano</span></label>
                <select
                  className="reseller-input"
                  style={{ paddingLeft: '1rem' }}
                  value={adjustPlan}
                  onChange={(e) => setAdjustPlan(e.target.value)}
                >
                  <option value="mensal">Mensal (30 dias) - Saldo atual: {adjustModalReseller.creditos?.mensal || 0}</option>
                  <option value="trimestral">Trimestral (90 dias) - Saldo atual: {adjustModalReseller.creditos?.trimestral || 0}</option>
                  <option value="semestral">Semestral (180 dias) - Saldo atual: {adjustModalReseller.creditos?.semestral || 0}</option>
                  <option value="anual">Anual (365 dias) - Saldo atual: {adjustModalReseller.creditos?.anual || 0}</option>
                </select>
              </div>

              {/* Quantidade */}
              <div className="reseller-form-group">
                <label className="reseller-label"><span>Quantidade de Créditos</span></label>
                <input
                  type="number"
                  min="1"
                  className="reseller-input"
                  style={{ paddingLeft: '1rem' }}
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  required
                />
              </div>

              {/* Motivo para Auditoria */}
              <div className="reseller-form-group">
                <label className="reseller-label"><span>Motivo / Justificativa (Auditoria)</span></label>
                <input
                  type="text"
                  className="reseller-input"
                  style={{ paddingLeft: '1rem' }}
                  placeholder="Ex: Bonificação promocional, acerto de pagamento manual, etc."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="reseller-action-btn"
                  style={{ flex: 1, padding: '0.85rem', justifyContent: 'center' }}
                  onClick={() => setAdjustModalReseller(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="reseller-btn-primary"
                  style={{ flex: 1, marginTop: 0 }}
                  disabled={savingAdjust}
                >
                  {savingAdjust ? 'Salvando...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Master: Redefinir Senha do Lojista */}
      {resetPwReseller && (
        <div className="reseller-modal-overlay">
          <div className="reseller-modal-card" style={{ maxWidth: '440px' }}>
            <button className="reseller-modal-close" onClick={() => setResetPwReseller(null)}>
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.5rem' }}>
              Redefinir Senha do Lojista
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.25rem' }}>
              Digite uma nova senha para o lojista <strong>@{resetPwReseller.username}</strong>:
            </p>

            <form onSubmit={handleSaveResellerPassword}>
              <div className="reseller-form-group">
                <label className="reseller-label"><span>Nova Senha (mínimo 4 caracteres)</span></label>
                <input
                  type="text"
                  className="reseller-input"
                  style={{ paddingLeft: '1rem' }}
                  placeholder="Nova senha"
                  value={newResellerPassword}
                  onChange={(e) => setNewResellerPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="reseller-action-btn"
                  style={{ flex: 1, padding: '0.85rem', justifyContent: 'center' }}
                  onClick={() => setResetPwReseller(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="reseller-btn-primary"
                  style={{ flex: 1, marginTop: 0 }}
                  disabled={savingPw}
                >
                  {savingPw ? 'Salvando...' : 'Salvar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
