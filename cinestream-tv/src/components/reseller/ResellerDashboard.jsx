import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  CreditCard,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Tv,
  Calendar,
  Lock,
  Power,
  Share2,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  LogOut,
  Smartphone,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Globe
} from 'lucide-react';
import {
  RESELLER_PLANS,
  getResellerMe,
  getResellerClients,
  getResellerTransactions,
  getResellerOrders,
  resetResellerClientPassword,
  kickResellerClient,
  updateResellerProfile,
  formatCpfCnpj,
  formatPhone
} from '../../services/resellerService';
import NewClientModal from './NewClientModal';
import RenewClientModal from './RenewClientModal';
import BuyCreditsModal from './BuyCreditsModal';

export default function ResellerDashboard({ currentUser, onLogout, onNavigateToTv }) {
  // Navigation tabs: 'clients' | 'transactions' | 'orders'
  const [activeTab, setActiveTab] = useState('clients');

  // Reseller data
  const [reseller, setReseller] = useState(currentUser);
  const [credits, setCredits] = useState(() => currentUser?.creditos || { mensal: 0, trimestral: 0, semestral: 0, anual: 0 });
  const [clients, setClients] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos'); // 'todos' | 'ativos' | 'vencendo' | 'expirados'

  // Modals state
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [renewClientModalData, setRenewClientModalData] = useState(null);
  const [buyCreditsModalOpen, setBuyCreditsModalOpen] = useState(false);
  const [buyCreditsPlan, setBuyCreditsPlan] = useState('mensal');

  // Password reset inline modal
  const [resetPwClient, setResetPwClient] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [copiedClientId, setCopiedClientId] = useState(null);

  // Link Exclusivo & Domínio Próprio do Lojista
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [customLinkInput, setCustomLinkInput] = useState(currentUser?.linkExclusivo || '');
  const [nomeLojaInput, setNomeLojaInput] = useState(currentUser?.nomeLoja || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Carrega todos os dados do revendedor
  const loadDashboardData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const [meRes, clientsRes, txRes, ordersRes] = await Promise.all([
        getResellerMe().catch(() => null),
        getResellerClients().catch(() => []),
        getResellerTransactions().catch(() => []),
        getResellerOrders().catch(() => [])
      ]);

      if (meRes?.reseller) {
        setReseller(meRes.reseller);
        setCredits(meRes.credits || meRes.reseller.creditos);
        if (meRes.reseller.linkExclusivo) setCustomLinkInput(meRes.reseller.linkExclusivo);
        if (meRes.reseller.nomeLoja) setNomeLojaInput(meRes.reseller.nomeLoja);
      }
      setClients(clientsRes);
      setTransactions(txRes);
      setOrders(ordersRes);
    } catch (err) {
      console.warn('Erro ao carregar dados do dashboard do revendedor:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Clientes filtrados por busca e status
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      // Busca
      const matchSearch = !searchTerm ||
        c.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.nome && c.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.telefone && c.telefone.includes(searchTerm));

      if (!matchSearch) return false;

      // Status
      if (statusFilter === 'ativos') return c.status === 'ativo';
      if (statusFilter === 'vencendo') return c.status === 'vencendo';
      if (statusFilter === 'expirados') return c.status === 'expirado';

      return true;
    });
  }, [clients, searchTerm, statusFilter]);

  const handleOpenBuyCredits = (plan = 'mensal') => {
    setBuyCreditsPlan(plan);
    setBuyCreditsModalOpen(true);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetPwClient || !newPasswordInput.trim()) return;

    try {
      await resetResellerClientPassword(resetPwClient.id, newPasswordInput.trim());
      alert(`Senha de @${resetPwClient.username} redefinida com sucesso para "${newPasswordInput.trim()}".`);
      setResetPwClient(null);
      setNewPasswordInput('');
    } catch (err) {
      alert(err.message || 'Erro ao alterar senha.');
    }
  };

  const handleKickSession = async (client) => {
    if (!window.confirm(`Deseja derrubar as sessões ativas do cliente @${client.username}?`)) return;

    try {
      await kickResellerClient(client.id);
      alert(`Sessão de @${client.username} desconectada com sucesso.`);
      loadDashboardData(true);
    } catch (err) {
      alert(err.message || 'Erro ao desconectar cliente.');
    }
  };

  const handleCopyAccess = (client) => {
    const accessUrl = reseller?.linkExclusivo || 'https://topcanais.tv';
    const storeName = reseller?.nomeLoja || reseller?.nome || 'CineStream';
    const text = `🌟 *SEU ACESSO ${storeName.toUpperCase()} ESTÁ ATIVO!* 🌟\n\n` +
      `👤 *Usuário:* ${client.username}\n` +
      `📺 *Telas Simultâneas:* ${client.limiteTelas} tela(s)\n` +
      `🗓️ *Validade:* ${new Date(client.fimAssinatura).toLocaleDateString('pt-BR')}\n\n` +
      `🌐 *Acesse agora:* ${accessUrl}\n\n` +
      `Dúvidas ou renovações, estamos à disposição!`;

    navigator.clipboard.writeText(text);
    setCopiedClientId(client.id);
    setTimeout(() => setCopiedClientId(null), 2500);
  };

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSavingProfile(true);
    setProfileSuccessMsg(null);
    try {
      const res = await updateResellerProfile({
        linkExclusivo: customLinkInput,
        nomeLoja: nomeLojaInput
      });
      setProfileSuccessMsg('Link exclusivo e dados da loja atualizados com sucesso!');
      if (res.reseller) {
        setReseller(prev => ({
          ...prev,
          linkExclusivo: res.reseller.linkExclusivo,
          nomeLoja: res.reseller.nomeLoja
        }));
      }
      setTimeout(() => {
        setLinkModalOpen(false);
        setProfileSuccessMsg(null);
      }, 1500);
    } catch (err) {
      alert(err.message || 'Erro ao atualizar dados do revendedor.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="reseller-portal-container">
      {/* Top Header */}
      <header className="reseller-topbar">
        <div className="reseller-logo">
          <span className="reseller-logo-badge">B2B</span>
          <span className="reseller-logo-text">
            CineStream <span style={{ color: '#f59e0b' }}>Revenda</span>
          </span>
        </div>

        <div className="reseller-topbar-actions">
          <button
            className="reseller-nav-link"
            onClick={() => loadDashboardData(true)}
            title="Atualizar dados em tempo real"
          >
            <RefreshCw size={16} className={refreshing ? 'spin-animation' : ''} />
            <span>Atualizar</span>
          </button>

          <button
            className="reseller-nav-link"
            onClick={onLogout}
            style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}
            title="Sair da conta de revendedor"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="reseller-dashboard-content">
        {/* Banner do Revendedor */}
        <div className="reseller-banner">
          <div className="reseller-banner-info">
            <div className="reseller-banner-avatar">
              {(reseller?.nome || reseller?.username || 'R').charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="reseller-banner-name">
                {reseller?.nome || `@${reseller?.username}`}
                <span className="reseller-logo-badge" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>
                  Lojista Ativo
                </span>
              </h1>
              <div className="reseller-banner-meta">
                {reseller?.cpf && (
                  <span>
                    <FileText size={14} />
                    {formatCpfCnpj(reseller.cpf)}
                  </span>
                )}
                {reseller?.telefone && (
                  <span>
                    <Smartphone size={14} />
                    {formatPhone(reseller.telefone)}
                  </span>
                )}
                <span>
                  <Users size={14} />
                  {clients.length} cliente(s) gerado(s)
                </span>
              </div>
            </div>
          </div>

          <div className="reseller-banner-actions">
            <button
              className="reseller-action-btn"
              style={{ padding: '0.75rem 1.25rem', background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', borderColor: 'rgba(59, 130, 246, 0.4)' }}
              onClick={() => setLinkModalOpen(true)}
              title="Cadastrar ou alterar meu link exclusivo / domínio próprio"
            >
              <Globe size={18} />
              <span>{reseller?.linkExclusivo ? 'Meu Link Exclusivo' : 'Configurar Link'}</span>
            </button>

            <button
              className="reseller-btn-primary"
              style={{ marginTop: 0, padding: '0.75rem 1.25rem' }}
              onClick={() => setNewClientModalOpen(true)}
            >
              <Plus size={18} />
              <span>Novo Cliente</span>
            </button>

            <button
              className="reseller-action-btn"
              style={{ padding: '0.75rem 1.25rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}
              onClick={() => handleOpenBuyCredits('mensal')}
            >
              <CreditCard size={18} />
              <span>Comprar Créditos</span>
            </button>
          </div>
        </div>

        {/* Card Informativo do Link Exclusivo Configurado */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.7) 0%, rgba(30, 58, 138, 0.22) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '14px',
          padding: '14px 20px',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}>
              <Globe size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                  Meu Link de Acesso Exclusivo (Domínio Próprio)
                </span>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontWeight: 600,
                  background: reseller?.linkExclusivo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: reseller?.linkExclusivo ? '#34d399' : '#fbbf24',
                  border: `1px solid ${reseller?.linkExclusivo ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                }}>
                  {reseller?.linkExclusivo ? 'Ativo' : 'Não configurado'}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '3px' }}>
                {reseller?.linkExclusivo ? (
                  <span>
                    Endereço enviado aos clientes: <strong style={{ color: '#60a5fa' }}>{reseller.linkExclusivo}</strong>
                    {reseller.nomeLoja && <span style={{ color: '#cbd5e1' }}> ({reseller.nomeLoja})</span>}
                  </span>
                ) : (
                  <span>Cadastre seu link (ex: <em>https://linkdologista.logistadigital.com.br/</em>) para que seus clientes recebam o seu endereço personalizado.</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {reseller?.linkExclusivo && (
              <button
                type="button"
                className="reseller-action-btn"
                style={{ padding: '7px 14px', fontSize: '13px', color: '#a7f3d0', borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.12)' }}
                onClick={() => {
                  navigator.clipboard.writeText(reseller.linkExclusivo);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2500);
                }}
                title="Copiar meu link exclusivo"
              >
                {copiedLink ? <Check size={14} style={{ marginRight: '6px' }} /> : <Copy size={14} style={{ marginRight: '6px' }} />}
                <span>{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
              </button>
            )}

            <button
              type="button"
              className="reseller-action-btn"
              style={{ padding: '7px 14px', fontSize: '13px', color: '#bfdbfe', borderColor: 'rgba(59, 130, 246, 0.4)', background: 'rgba(59, 130, 246, 0.15)' }}
              onClick={() => setLinkModalOpen(true)}
            >
              <Globe size={14} style={{ marginRight: '6px' }} />
              <span>{reseller?.linkExclusivo ? 'Alterar Link' : 'Cadastrar Link'}</span>
            </button>
          </div>
        </div>

        {/* 4 Cards de Saldos de Créditos (Seção 4) */}
        <div className="reseller-credits-grid">
          {/* Card Mensal */}
          <div className="reseller-credit-card highlight">
            <div className="reseller-credit-header">
              <span className="reseller-credit-plan">📅 Créditos Mensais</span>
              <span className="reseller-credit-badge">30 Dias</span>
            </div>
            <div className="reseller-credit-value">
              {Number(credits.mensal) || 0}
              <span className="reseller-credit-unit">telas</span>
            </div>
            <div className="reseller-credit-footer">
              <span className="reseller-credit-price">R$ 12,50 / crédito</span>
              <button
                className="reseller-action-btn"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => handleOpenBuyCredits('mensal')}
              >
                + Recarregar
              </button>
            </div>
          </div>

          {/* Card Trimestral */}
          <div className="reseller-credit-card">
            <div className="reseller-credit-header">
              <span className="reseller-credit-plan">🗓️ Créditos Trimestrais</span>
              <span className="reseller-credit-badge">90 Dias</span>
            </div>
            <div className="reseller-credit-value">
              {Number(credits.trimestral) || 0}
              <span className="reseller-credit-unit">telas</span>
            </div>
            <div className="reseller-credit-footer">
              <span className="reseller-credit-price">R$ 32,50 / crédito</span>
              <button
                className="reseller-action-btn"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => handleOpenBuyCredits('trimestral')}
              >
                + Recarregar
              </button>
            </div>
          </div>

          {/* Card Semestral */}
          <div className="reseller-credit-card">
            <div className="reseller-credit-header">
              <span className="reseller-credit-plan">📆 Créditos Semestrais</span>
              <span className="reseller-credit-badge">180 Dias</span>
            </div>
            <div className="reseller-credit-value">
              {Number(credits.semestral) || 0}
              <span className="reseller-credit-unit">telas</span>
            </div>
            <div className="reseller-credit-footer">
              <span className="reseller-credit-price">R$ 60,00 / crédito</span>
              <button
                className="reseller-action-btn"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => handleOpenBuyCredits('semestral')}
              >
                + Recarregar
              </button>
            </div>
          </div>

          {/* Card Anual */}
          <div className="reseller-credit-card highlight">
            <div className="reseller-credit-header">
              <span className="reseller-credit-plan">👑 Créditos Anuais</span>
              <span className="reseller-credit-badge" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#eab308' }}>365 Dias</span>
            </div>
            <div className="reseller-credit-value">
              {Number(credits.anual) || 0}
              <span className="reseller-credit-unit">telas</span>
            </div>
            <div className="reseller-credit-footer">
              <span className="reseller-credit-price">R$ 110,00 / crédito</span>
              <button
                className="reseller-action-btn"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => handleOpenBuyCredits('anual')}
              >
                + Recarregar
              </button>
            </div>
          </div>
        </div>

        {/* Abas Principais do Painel */}
        <div className="reseller-main-nav">
          <button
            className={`reseller-nav-tab ${activeTab === 'clients' ? 'active' : ''}`}
            onClick={() => setActiveTab('clients')}
          >
            <Users size={18} />
            <span>Meus Clientes ({clients.length})</span>
          </button>

          <button
            className={`reseller-nav-tab ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            <FileText size={18} />
            <span>Extrato de Créditos ({transactions.length})</span>
          </button>

          <button
            className={`reseller-nav-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <CreditCard size={18} />
            <span>Compras de Pacotes ({orders.length})</span>
          </button>
        </div>

        {/* CONTEÚDO DA ABA 1: MEUS CLIENTES */}
        {activeTab === 'clients' && (
          <div>
            {/* Toolbar com Busca, Filtros e Botão Novo Cliente */}
            <div className="reseller-toolbar">
              <div className="reseller-search-box">
                <Search size={18} className="reseller-input-icon" />
                <input
                  type="text"
                  className="reseller-search-input"
                  placeholder="Buscar por usuário, nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="reseller-filter-pills">
                <button
                  className={`reseller-filter-btn ${statusFilter === 'todos' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('todos')}
                >
                  Todos ({clients.length})
                </button>
                <button
                  className={`reseller-filter-btn ${statusFilter === 'ativos' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('ativos')}
                >
                  Ativos ({clients.filter(c => c.status === 'ativo').length})
                </button>
                <button
                  className={`reseller-filter-btn ${statusFilter === 'vencendo' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('vencendo')}
                >
                  Vencendo ({clients.filter(c => c.status === 'vencendo').length})
                </button>
                <button
                  className={`reseller-filter-btn ${statusFilter === 'expirados' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('expirados')}
                >
                  Expirados ({clients.filter(c => c.status === 'expirado').length})
                </button>
              </div>
            </div>

            {/* Tabela de Clientes */}
            <div className="reseller-table-card">
              {filteredClients.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="reseller-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Plano & Telas</th>
                        <th>Status</th>
                        <th>Validade</th>
                        <th>Conexões</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
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
                                <div className="reseller-user-sub">
                                  {c.nome !== c.username ? c.nome : (c.telefone || 'Sem telefone')}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                              {c.planoNome || 'Plano Personalizado'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              {c.limiteTelas} tela(s) simultânea(s)
                            </div>
                          </td>
                          <td>
                            <span className={`reseller-status-pill ${c.status}`}>
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: 'currentColor',
                                display: 'inline-block'
                              }} />
                              {c.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                              {c.expiresInText}
                            </div>
                          </td>
                          <td>
                            {c.isOnline ? (
                              <span style={{ color: '#4ade80', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span className="pulse-glow" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                                Online agora ({c.activeSessionsCount})
                              </span>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                Offline
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {/* Renovar */}
                              <button
                                className="reseller-action-btn"
                                onClick={() => setRenewClientModalData(c)}
                                title="Renovar assinatura do cliente com créditos"
                              >
                                <RefreshCw size={14} />
                                <span>Renovar</span>
                              </button>

                              {/* Copiar WhatsApp */}
                              <button
                                className="reseller-action-btn"
                                onClick={() => handleCopyAccess(c)}
                                title="Copiar mensagem pronta para enviar no WhatsApp"
                              >
                                {copiedClientId === c.id ? <Check size={14} style={{ color: '#4ade80' }} /> : <Copy size={14} />}
                                <span>{copiedClientId === c.id ? 'Copiado!' : 'WhatsApp'}</span>
                              </button>

                              {/* Alterar Senha */}
                              <button
                                className="reseller-action-btn"
                                onClick={() => {
                                  setResetPwClient(c);
                                  setNewPasswordInput('');
                                }}
                                title="Redefinir senha de acesso deste cliente"
                              >
                                <Lock size={14} />
                              </button>

                              {/* Kick Sessão */}
                              {c.activeSessionsCount > 0 && (
                                <button
                                  className="reseller-action-btn danger"
                                  onClick={() => handleKickSession(c)}
                                  title="Derrubar conexões ativas deste cliente"
                                >
                                  <Power size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                  <Users size={48} style={{ color: '#64748b', margin: '0 auto 1rem' }} />
                  <h3 style={{ fontSize: '1.2rem', color: '#f8fafc', margin: '0 0 0.5rem' }}>
                    {searchTerm ? 'Nenhum cliente encontrado com este filtro' : 'Você ainda não cadastrou nenhum cliente'}
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                    Utilize seus créditos disponíveis para criar acessos de 1 ou mais telas para seus clientes finais.
                  </p>
                  <button
                    className="reseller-btn-primary"
                    style={{ display: 'inline-flex', width: 'auto', padding: '0.75rem 1.5rem' }}
                    onClick={() => setNewClientModalOpen(true)}
                  >
                    <Plus size={18} />
                    <span>Cadastrar Primeiro Cliente</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA 2: EXTRATO DE TRANSAÇÕES */}
        {activeTab === 'transactions' && (
          <div className="reseller-table-card">
            {transactions.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="reseller-table">
                  <thead>
                    <tr>
                      <th>Data e Hora</th>
                      <th>Tipo</th>
                      <th>Plano</th>
                      <th>Qtd. Créditos</th>
                      <th>Saldo Resultante</th>
                      <th>Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id}>
                        <td>
                          {new Date(t.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td>
                          <span style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: t.quantidade > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: t.quantidade > 0 ? '#4ade80' : '#f87171',
                            border: `1px solid ${t.quantidade > 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                          }}>
                            {t.tipo}
                          </span>
                        </td>
                        <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                          {t.plano}
                        </td>
                        <td style={{ fontWeight: 800, color: t.quantidade > 0 ? '#4ade80' : '#f87171' }}>
                          {t.quantidade > 0 ? `+${t.quantidade}` : t.quantidade}
                        </td>
                        <td style={{ fontWeight: 700, color: '#f8fafc' }}>
                          {t.saldoNovo} un
                        </td>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                          {t.descricao}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                <FileText size={48} style={{ color: '#64748b', margin: '0 auto 1rem' }} />
                <h3>Nenhuma movimentação de créditos registrada ainda.</h3>
              </div>
            )}
          </div>
        )}

        {/* CONTEÚDO DA ABA 3: PEDIDOS DE CRÉDITO */}
        {activeTab === 'orders' && (
          <div className="reseller-table-card">
            {orders.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="reseller-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Plano</th>
                      <th>Quantidade</th>
                      <th>Valor Unitário</th>
                      <th>Valor Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          {new Date(o.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                          {o.plano}
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {o.quantidade} créditos
                        </td>
                        <td>
                          R$ {Number(o.valorUnitario).toFixed(2).replace('.', ',')}
                        </td>
                        <td style={{ fontWeight: 800, color: '#f59e0b' }}>
                          R$ {Number(o.valorTotal).toFixed(2).replace('.', ',')}
                        </td>
                        <td>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: o.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: o.status === 'APPROVED' ? '#4ade80' : '#fbbf24',
                            border: `1px solid ${o.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                          }}>
                            {o.status === 'APPROVED' ? '✓ Aprovado' : '⏳ Pendente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                <CreditCard size={48} style={{ color: '#64748b', margin: '0 auto 1rem' }} />
                <h3>Nenhuma compra de pacote de créditos registrada.</h3>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal: Novo Cliente Final */}
      <NewClientModal
        isOpen={newClientModalOpen}
        onClose={() => setNewClientModalOpen(false)}
        credits={credits}
        onClientCreated={() => {
          loadDashboardData(true);
        }}
        onOpenBuyCredits={(plan) => handleOpenBuyCredits(plan)}
      />

      {/* Modal: Renovar Cliente */}
      <RenewClientModal
        isOpen={!!renewClientModalData}
        onClose={() => setRenewClientModalData(null)}
        client={renewClientModalData}
        credits={credits}
        onRenewSuccess={() => {
          loadDashboardData(true);
        }}
        onOpenBuyCredits={(plan) => handleOpenBuyCredits(plan)}
      />

      {/* Modal: Comprar Créditos */}
      <BuyCreditsModal
        isOpen={buyCreditsModalOpen}
        onClose={() => setBuyCreditsModalOpen(false)}
        initialPlan={buyCreditsPlan}
        onCreditsPurchased={(newCredits) => {
          if (newCredits) setCredits(newCredits);
          loadDashboardData(true);
        }}
      />

      {/* Modal: Alterar Senha de Cliente */}
      {resetPwClient && (
        <div className="reseller-modal-overlay">
          <div className="reseller-modal-card" style={{ maxWidth: '420px' }}>
            <button className="reseller-modal-close" onClick={() => setResetPwClient(null)}>
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', margin: '0 0 0.5rem' }}>
              Redefinir Senha
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1.25rem' }}>
              Defina uma nova senha de acesso para o cliente <strong>@{resetPwClient.username}</strong>:
            </p>

            <form onSubmit={handleResetPasswordSubmit}>
              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>Nova Senha (mínimo 4 caracteres)</span>
                </label>
                <div className="reseller-input-wrapper">
                  <Lock size={18} className="reseller-input-icon" />
                  <input
                    type="text"
                    className="reseller-input"
                    placeholder="Digite a nova senha"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="reseller-action-btn"
                  style={{ flex: 1, padding: '0.85rem', justifyContent: 'center' }}
                  onClick={() => setResetPwClient(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="reseller-btn-primary"
                  style={{ flex: 1, marginTop: 0 }}
                >
                  Salvar Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Configuração do Link Exclusivo / Domínio do Lojista */}
      {linkModalOpen && (
        <div className="reseller-modal-backdrop">
          <div className="reseller-modal-card" style={{ maxWidth: '520px' }}>
            <div className="reseller-modal-header">
              <div className="reseller-modal-title">
                <Globe size={22} style={{ color: '#3b82f6' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Cadastrar Link Exclusivo</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                    Personalize o domínio ou endereço que seus clientes acessarão
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="reseller-modal-close"
                onClick={() => setLinkModalOpen(false)}
              >
                <Power size={18} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>

            {profileSuccessMsg && (
              <div className="reseller-alert success" style={{ margin: '1rem 0 0 0' }}>
                <CheckCircle2 size={16} />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} style={{ marginTop: '1rem' }}>
              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>Link / Domínio Exclusivo do Lojista</span>
                </label>
                <div className="reseller-input-wrapper">
                  <Globe size={18} className="reseller-input-icon" />
                  <input
                    type="text"
                    className="reseller-input"
                    placeholder="https://linkdologista.logistadigital.com.br/"
                    value={customLinkInput}
                    onChange={(e) => setCustomLinkInput(e.target.value)}
                    autoFocus
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', display: 'block' }}>
                  💡 Exemplo: <code>https://linkdologista.logistadigital.com.br/</code> ou <code>https://meusite.com/tv</code>
                </span>
              </div>

              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>Nome da Loja / Marca (Opcional)</span>
                </label>
                <div className="reseller-input-wrapper">
                  <Sparkles size={18} className="reseller-input-icon" />
                  <input
                    type="text"
                    className="reseller-input"
                    placeholder="Ex: Lojista Digital TV"
                    value={nomeLojaInput}
                    onChange={(e) => setNomeLojaInput(e.target.value)}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', display: 'block' }}>
                  Aparecerá no cabeçalho dos acessos gerados para WhatsApp.
                </span>
              </div>

              {/* Pré-visualização ao vivo da mensagem para o cliente */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginTop: '1rem',
                fontSize: '0.8rem',
                color: '#cbd5e1',
                lineHeight: '1.4'
              }}>
                <div style={{ color: '#25D366', fontWeight: 'bold', marginBottom: '4px' }}>
                  📲 Como seu cliente verá no WhatsApp:
                </div>
                <div>🌟 *SEU ACESSO {(nomeLojaInput || reseller?.nome || 'CINESTREAM').toUpperCase()} ESTÁ LIBERADO!* 🌟</div>
                <div>👤 *Usuário:* cliente_exemplo</div>
                <div>🔑 *Senha:* ••••••••</div>
                <div style={{ color: '#60a5fa', fontWeight: '600', marginTop: '3px' }}>
                  🌐 *Acesse agora:* {customLinkInput.trim() || 'https://topcanais.tv'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="reseller-action-btn"
                  style={{ flex: 1, padding: '0.85rem', justifyContent: 'center' }}
                  onClick={() => setLinkModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="reseller-btn-primary"
                  style={{ flex: 1, marginTop: 0 }}
                  disabled={savingProfile}
                >
                  {savingProfile ? 'Salvando...' : 'Salvar Link Exclusivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
