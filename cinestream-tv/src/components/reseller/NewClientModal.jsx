import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Lock,
  Tv,
  Calendar,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Share2,
  RefreshCw,
  Plus,
  Minus
} from 'lucide-react';
import {
  RESELLER_PLANS,
  createResellerClient
} from '../../services/resellerService';

export default function NewClientModal({
  isOpen,
  onClose,
  credits = { mensal: 0, trimestral: 0, semestral: 0, anual: 0 },
  onClientCreated,
  onOpenBuyCredits
}) {
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('mensal');
  const [telas, setTelas] = useState(1);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdResult, setCreatedResult] = useState(null);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);

  // Gera senha aleatória legível
  const generateRandomPassword = () => {
    const chars = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    let res = '';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSenha(res);
  };

  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setNome('');
      setTelefone('');
      setSelectedPlan('mensal');
      setTelas(1);
      setErrorMsg('');
      setCreatedResult(null);
      setCopiedWhatsapp(false);
      generateRandomPassword();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentAvailableCredits = Number(credits[selectedPlan]) || 0;
  const creditsNeeded = telas;
  const hasEnoughCredits = currentAvailableCredits >= creditsNeeded;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !senha) {
      setErrorMsg('Preencha o usuário e a senha do cliente.');
      return;
    }

    if (!hasEnoughCredits) {
      setErrorMsg(`Saldo insuficiente de créditos ${RESELLER_PLANS[selectedPlan].nome}. Você possui ${currentAvailableCredits} crédito(s), mas precisa de ${creditsNeeded}.`);
      return;
    }

    setLoading(true);
    try {
      const data = await createResellerClient({
        username: username.trim().toLowerCase(),
        senha,
        plano: selectedPlan,
        telas,
        nome: nome.trim(),
        telefone: telefone.trim()
      });

      setCreatedResult(data);
      if (onClientCreated) onClientCreated(data);
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao criar cliente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyWhatsapp = () => {
    if (!createdResult?.whatsappText) return;
    navigator.clipboard.writeText(createdResult.whatsappText);
    setCopiedWhatsapp(true);
    setTimeout(() => setCopiedWhatsapp(false), 3000);
  };

  return (
    <div className="reseller-modal-overlay">
      <div className="reseller-modal-card">
        <button className="reseller-modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        {!createdResult ? (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.35rem' }}>
                Novo Cliente Final
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                Crie um novo acesso para seu cliente debitando créditos de sua carteira.
              </p>
            </div>

            {errorMsg && (
              <div className="reseller-alert error">
                <AlertTriangle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* 1. Escolha do Plano */}
              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>1. Tipo de Plano (Vigência)</span>
                  <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>
                    Saldo disponível: <strong>{currentAvailableCredits}</strong> crédito(s)
                  </span>
                </label>
                <div className="reseller-plan-selector-grid">
                  {Object.entries(RESELLER_PLANS).map(([key, p]) => (
                    <div
                      key={key}
                      className={`reseller-plan-option ${selectedPlan === key ? 'selected' : ''}`}
                      onClick={() => setSelectedPlan(key)}
                    >
                      <div className="reseller-plan-title">{p.nome}</div>
                      <div className="reseller-plan-price">{p.badge}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Saldo: {Number(credits[key]) || 0} un
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Quantidade de Telas */}
              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>2. Quantidade de Telas Simultâneas</span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    1 tela = 1 crédito
                  </span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button
                    type="button"
                    className="reseller-action-btn"
                    style={{ padding: '0.75rem 1rem' }}
                    onClick={() => setTelas(prev => Math.max(1, prev - 1))}
                    disabled={telas <= 1}
                  >
                    <Minus size={18} />
                  </button>
                  <div style={{
                    flex: 1,
                    textAlign: 'center',
                    background: 'rgba(2, 6, 23, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '0.65rem',
                    borderRadius: '10px',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: '#f8fafc'
                  }}>
                    {telas} {telas > 1 ? 'Telas' : 'Tela'}
                  </div>
                  <button
                    type="button"
                    className="reseller-action-btn"
                    style={{ padding: '0.75rem 1rem' }}
                    onClick={() => setTelas(prev => prev + 1)}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {/* Box de Validação e Regra de Créditos (Seção 5) */}
              <div className="reseller-credit-rule-box">
                <div className="reseller-credit-rule-row">
                  <span style={{ color: '#94a3b8' }}>Plano Selecionado:</span>
                  <strong style={{ color: '#f8fafc' }}>{RESELLER_PLANS[selectedPlan].nome} ({RESELLER_PLANS[selectedPlan].badge})</strong>
                </div>
                <div className="reseller-credit-rule-row">
                  <span style={{ color: '#94a3b8' }}>Créditos Necessários:</span>
                  <strong style={{ color: '#f59e0b' }}>{creditsNeeded} crédito(s)</strong>
                </div>
                <div className="reseller-credit-rule-row">
                  <span style={{ color: '#94a3b8' }}>Seu Saldo Atual:</span>
                  <strong style={{ color: hasEnoughCredits ? '#4ade80' : '#f87171' }}>
                    {currentAvailableCredits} crédito(s)
                  </strong>
                </div>

                {!hasEnoughCredits && (
                  <div style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>⚠️ Saldo insuficiente para esta quantidade de telas.</span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onOpenBuyCredits) onOpenBuyCredits(selectedPlan);
                      }}
                      style={{
                        background: '#f59e0b',
                        color: '#000',
                        fontWeight: 700,
                        border: 'none',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                      }}
                    >
                      Comprar Créditos
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Dados de Acesso */}
              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>3. Nome de Usuário / Login</span>
                </label>
                <div className="reseller-input-wrapper">
                  <User size={18} className="reseller-input-icon" />
                  <input
                    type="text"
                    className="reseller-input"
                    placeholder="Ex: cliente_carlos"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    required
                  />
                </div>
              </div>

              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>Senha de Acesso</span>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f59e0b',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <RefreshCw size={12} />
                    Gerar Automática
                  </button>
                </label>
                <div className="reseller-input-wrapper">
                  <Lock size={18} className="reseller-input-icon" />
                  <input
                    type="text"
                    className="reseller-input"
                    placeholder="Senha de acesso"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>Nome do Cliente (Opcional)</span>
                </label>
                <input
                  type="text"
                  className="reseller-input"
                  style={{ paddingLeft: '1rem' }}
                  placeholder="Ex: Carlos Andrade"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>WhatsApp do Cliente (Opcional para envio)</span>
                </label>
                <input
                  type="text"
                  className="reseller-input"
                  style={{ paddingLeft: '1rem' }}
                  placeholder="(00) 90000-0000"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="reseller-btn-primary"
                disabled={loading || !hasEnoughCredits}
              >
                {loading
                  ? 'Debitando créditos e criando...'
                  : hasEnoughCredits
                  ? `Criar Cliente (Debitar ${creditsNeeded} Crédito${creditsNeeded > 1 ? 's' : ''})`
                  : 'Saldo Insuficiente — Faça uma Recarga'}
              </button>
            </form>
          </>
        ) : (
          /* Estado de Sucesso com Acesso Criado & WhatsApp */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '2px solid rgba(34, 197, 94, 0.5)',
              color: '#4ade80',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.5rem' }}>
              Cliente Liberado com Sucesso!
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 1.5rem' }}>
              A conta já está ativa no sistema e pronta para uso imediato em todas as plataformas.
            </p>

            <div style={{
              background: 'rgba(2, 6, 23, 0.8)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              marginBottom: '1.5rem',
              fontFamily: 'monospace',
              fontSize: '0.85rem'
            }}>
              <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: '0.5rem' }}>
                DADOS DE ACESSO DO CLIENTE:
              </div>
              <div>👤 <strong>Usuário:</strong> {createdResult.client?.username}</div>
              <div>🔑 <strong>Senha:</strong> {createdResult.rawPassword}</div>
              <div>📺 <strong>Telas:</strong> {createdResult.client?.limiteTelas} tela(s) simultâneas</div>
              <div>🗓️ <strong>Vencimento:</strong> {new Date(createdResult.client?.fimAssinatura).toLocaleDateString('pt-BR')}</div>
              <div>🌐 <strong>Portal:</strong> https://topcanais.tv</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                className="reseller-btn-primary"
                style={{ marginTop: 0, background: '#22c55e', color: '#000' }}
                onClick={handleCopyWhatsapp}
              >
                {copiedWhatsapp ? (
                  <>
                    <Check size={18} />
                    <span>Copiado para a Área de Transferência!</span>
                  </>
                ) : (
                  <>
                    <Share2 size={18} />
                    <span>Copiar Mensagem para WhatsApp</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="reseller-action-btn"
                style={{ padding: '0.85rem', justifyContent: 'center' }}
                onClick={onClose}
              >
                Concluir e Voltar aos Clientes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
