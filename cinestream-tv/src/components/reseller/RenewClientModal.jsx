import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  Calendar,
  Tv,
  AlertTriangle,
  CheckCircle2,
  Minus,
  Plus
} from 'lucide-react';
import {
  RESELLER_PLANS,
  renewResellerClient
} from '../../services/resellerService';

export default function RenewClientModal({
  isOpen,
  onClose,
  client,
  credits = { mensal: 0, trimestral: 0, semestral: 0, anual: 0 },
  onRenewSuccess,
  onOpenBuyCredits
}) {
  const [selectedPlan, setSelectedPlan] = useState('mensal');
  const [telas, setTelas] = useState(() => (client?.limiteTelas || 1));
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  if (!isOpen || !client) return null;

  const currentAvailableCredits = Number(credits[selectedPlan]) || 0;
  const creditsNeeded = telas;
  const hasEnoughCredits = currentAvailableCredits >= creditsNeeded;

  const handleRenew = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!hasEnoughCredits) {
      setErrorMsg(`Saldo insuficiente de créditos ${RESELLER_PLANS[selectedPlan].nome}. Você possui ${currentAvailableCredits} crédito(s), mas precisa de ${creditsNeeded}.`);
      return;
    }

    setLoading(true);
    try {
      const data = await renewResellerClient(client.id, selectedPlan, telas);
      setSuccessResult(data);
      if (onRenewSuccess) onRenewSuccess(data);
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao renovar cliente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reseller-modal-overlay">
      <div className="reseller-modal-card">
        <button className="reseller-modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        {!successResult ? (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.35rem' }}>
                Renovar Assinatura
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                Renovando acesso para o cliente <strong style={{ color: '#f59e0b' }}>@{client.username}</strong>
              </p>
            </div>

            {errorMsg && (
              <div className="reseller-alert error">
                <AlertTriangle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleRenew}>
              {/* Plano */}
              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>Selecione o Período de Renovação</span>
                  <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>
                    Saldo: <strong>{currentAvailableCredits}</strong> crédito(s)
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

              {/* Telas */}
              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>Quantidade de Telas Simultâneas</span>
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

              {/* Box de Resumo */}
              <div className="reseller-credit-rule-box">
                <div className="reseller-credit-rule-row">
                  <span style={{ color: '#94a3b8' }}>Créditos a Debitar:</span>
                  <strong style={{ color: '#f59e0b' }}>{creditsNeeded} crédito(s) {selectedPlan}</strong>
                </div>
                <div className="reseller-credit-rule-row">
                  <span style={{ color: '#94a3b8' }}>Saldo Atual:</span>
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
                    <span>⚠️ Saldo insuficiente para renovação.</span>
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

              <button
                type="submit"
                className="reseller-btn-primary"
                disabled={loading || !hasEnoughCredits}
              >
                {loading
                  ? 'Processando renovação...'
                  : hasEnoughCredits
                  ? `Confirmar Renovação (${creditsNeeded} Crédito${creditsNeeded > 1 ? 's' : ''})`
                  : 'Saldo Insuficiente — Faça uma Recarga'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
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
              Assinatura Renovada com Sucesso!
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 1.5rem' }}>
              Novo vencimento de <strong>@{client.username}</strong>: {' '}
              <strong style={{ color: '#4ade80' }}>
                {new Date(successResult.client?.fimAssinatura).toLocaleDateString('pt-BR')}
              </strong>
            </p>

            <button
              type="button"
              className="reseller-btn-primary"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
