import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  QrCode,
  Copy,
  Check,
  Clock,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus
} from 'lucide-react';
import {
  RESELLER_PLANS,
  getResellerUnitPrice,
  buyResellerCredits,
  checkResellerOrderStatus,
  simulateApproveCreditsOrder
} from '../../services/resellerService';

export default function BuyCreditsModal({
  isOpen,
  onClose,
  initialPlan = 'mensal',
  onCreditsPurchased
}) {
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [quantidade, setQuantidade] = useState(5);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pix payment state
  const [pixData, setPixData] = useState(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [pollStatus, setPollStatus] = useState('PENDING'); // 'PENDING' | 'APPROVED'
  const [checkingPayment, setCheckingPayment] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const plan = initialPlan || 'mensal';
      setSelectedPlan(plan);
      const minRequired = (plan === 'mensal' || plan === 'trimestral') ? 5 : 1;
      setQuantidade(minRequired);
      setErrorMsg('');
      setPixData(null);
      setCopiedPix(false);
      setPollStatus('PENDING');
    }
  }, [isOpen, initialPlan]);

  // Polling automático a cada 5 segundos se houver Pix gerado
  useEffect(() => {
    if (!pixData?.orderId || pollStatus === 'APPROVED') return;

    const interval = setInterval(async () => {
      try {
        const res = await checkResellerOrderStatus(pixData.orderId);
        if (res.status === 'APPROVED') {
          setPollStatus('APPROVED');
          if (onCreditsPurchased) onCreditsPurchased(res.credits);
        }
      } catch (_) {}
    }, 5000);

    return () => clearInterval(interval);
  }, [pixData, pollStatus]);

  if (!isOpen) return null;

  const currentPlan = RESELLER_PLANS[selectedPlan] || RESELLER_PLANS.mensal;
  const minQtd = currentPlan.compraMinima || ((selectedPlan === 'mensal' || selectedPlan === 'trimestral') ? 5 : 1);
  const valorUnitario = getResellerUnitPrice(selectedPlan, quantidade);
  const valorTotal = Number((quantidade * valorUnitario).toFixed(2));
  const valorSemDesconto = Number((quantidade * currentPlan.preco).toFixed(2));
  const economia = Number((valorSemDesconto - valorTotal).toFixed(2));

  const handleGeneratePix = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (quantidade < minQtd) {
      setErrorMsg(`A compra mínima para o ${currentPlan.nome} é de ${minQtd} créditos.`);
      return;
    }

    setLoading(true);
    try {
      const data = await buyResellerCredits(selectedPlan, quantidade);
      setPixData(data);
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao gerar Pix de créditos.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (!pixData?.qrCode) return;
    navigator.clipboard.writeText(pixData.qrCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const handleSimulateApproval = async () => {
    if (!pixData?.orderId) return;
    setCheckingPayment(true);
    try {
      const res = await simulateApproveCreditsOrder(pixData.orderId);
      setPollStatus('APPROVED');
      if (onCreditsPurchased) onCreditsPurchased(res.credits);
    } catch (err) {
      alert(err.message || 'Erro ao simular aprovação.');
    } finally {
      setCheckingPayment(false);
    }
  };

  return (
    <div className="reseller-modal-overlay">
      <div className="reseller-modal-card" style={{ maxWidth: '560px' }}>
        <button className="reseller-modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        {!pixData ? (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.35rem' }}>
                Comprar Pacote de Créditos
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                1 crédito = 1 tela liberada para seu cliente final pelo período contratado.
              </p>
            </div>

            {errorMsg && (
              <div className="reseller-alert error">
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleGeneratePix}>
              {/* Seleção do Tipo de Plano */}
              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>1. Selecione o Tipo de Plano</span>
                </label>
                <div className="reseller-plan-selector-grid">
                  {Object.entries(RESELLER_PLANS).map(([key, p]) => (
                    <div
                      key={key}
                      className={`reseller-plan-option ${selectedPlan === key ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedPlan(key);
                        const minRequired = p.compraMinima || ((key === 'mensal' || key === 'trimestral') ? 5 : 1);
                        setQuantidade(prev => Math.max(minRequired, prev));
                      }}
                      style={{ position: 'relative' }}
                    >
                      {p.compraMinima > 1 && (
                        <span style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          borderRadius: '4px',
                          padding: '1px 5px',
                          fontSize: '0.62rem',
                          fontWeight: 700
                        }}>
                          Mín. {p.compraMinima} un
                        </span>
                      )}
                      <div className="reseller-plan-title">{p.nome}</div>
                      <div className="reseller-plan-price">
                        R$ {p.preco.toFixed(2).replace('.', ',')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, marginTop: '0.15rem' }}>
                        Até R$ {p.preco50.toFixed(2).replace('.', ',')} (50+ un)
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                        {p.custoMes ? `Equiv. R$ ${p.custoMes.toFixed(2).replace('.', ',')}/mês` : p.badge}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quantidade de Créditos */}
              <div className="reseller-form-group">
                <label className="reseller-label">
                  <span>2. Quantidade de Créditos Desejada</span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Libera {quantidade} tela(s) de {currentPlan.badge}
                  </span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    className="reseller-action-btn"
                    style={{ padding: '0.75rem 1rem' }}
                    onClick={() => setQuantidade(prev => Math.max(minQtd, prev - 1))}
                    disabled={quantidade <= minQtd}
                  >
                    <Minus size={18} />
                  </button>

                  <input
                    type="number"
                    min={minQtd}
                    className="reseller-input"
                    style={{ textAlign: 'center', fontSize: '1.25rem', fontWeight: 800, paddingLeft: '1rem' }}
                    value={quantidade}
                    onChange={(e) => setQuantidade(Math.max(minQtd, parseInt(e.target.value, 10) || minQtd))}
                    required
                  />

                  <button
                    type="button"
                    className="reseller-action-btn"
                    style={{ padding: '0.75rem 1rem' }}
                    onClick={() => setQuantidade(prev => prev + 1)}
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {/* Botões Rápidos de Quantidade */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[5, 10, 20, 50, 100].map(val => (
                    <button
                      key={val}
                      type="button"
                      className="reseller-filter-btn"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => setQuantidade(val)}
                    >
                      +{val} un
                    </button>
                  ))}
                </div>

                {/* Indicadores Visuais das Faixas de Desconto por Volume */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem',
                  marginTop: '0.85rem'
                }}>
                  <div style={{
                    padding: '0.6rem 0.4rem',
                    borderRadius: '8px',
                    background: quantidade < 10 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: quantidade < 10 ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ fontSize: '0.7rem', color: quantidade < 10 ? '#f59e0b' : '#94a3b8', fontWeight: 700 }}>
                      {quantidade < 10 && '✓ '}Faixa 1 ({minQtd} a 9 un)
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.2rem' }}>
                      R$ {currentPlan.preco.toFixed(2).replace('.', ',')}
                    </div>
                  </div>

                  <div style={{
                    padding: '0.6rem 0.4rem',
                    borderRadius: '8px',
                    background: (quantidade >= 10 && quantidade < 50) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: (quantidade >= 10 && quantidade < 50) ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ fontSize: '0.7rem', color: (quantidade >= 10 && quantidade < 50) ? '#10b981' : '#94a3b8', fontWeight: 700 }}>
                      {(quantidade >= 10 && quantidade < 50) && '✓ '}Faixa 2 (10 a 49 un) 🔥
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.2rem' }}>
                      R$ {currentPlan.preco10.toFixed(2).replace('.', ',')}
                    </div>
                  </div>

                  <div style={{
                    padding: '0.6rem 0.4rem',
                    borderRadius: '8px',
                    background: quantidade >= 50 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    border: quantidade >= 50 ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ fontSize: '0.7rem', color: quantidade >= 50 ? '#60a5fa' : '#94a3b8', fontWeight: 700 }}>
                      {quantidade >= 50 && '✓ '}Faixa 3 (50+ un) 🚀
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.2rem' }}>
                      R$ {currentPlan.preco50.toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumo do Cálculo Financeiro (Seção 4.1) */}
              <div className="reseller-credit-rule-box">
                <div className="reseller-credit-rule-row">
                  <span style={{ color: '#94a3b8' }}>Plano Selecionado:</span>
                  <strong style={{ color: '#f8fafc' }}>{currentPlan.nome} ({currentPlan.badge})</strong>
                </div>
                <div className="reseller-credit-rule-row">
                  <span style={{ color: '#94a3b8' }}>Preço Unitário do Crédito:</span>
                  <strong style={{ color: '#f8fafc' }}>R$ {valorUnitario.toFixed(2).replace('.', ',')}</strong>
                </div>
                <div className="reseller-credit-rule-row">
                  <span style={{ color: '#94a3b8' }}>Quantidade Solicitada:</span>
                  <strong style={{ color: '#f59e0b' }}>{quantidade} crédito(s)</strong>
                </div>
                {economia > 0 && (
                  <div className="reseller-credit-rule-row" style={{ color: '#10b981', paddingTop: '0.25rem' }}>
                    <span style={{ color: '#10b981' }}>Economia de Volume:</span>
                    <strong style={{ color: '#10b981' }}>
                      - R$ {economia.toFixed(2).replace('.', ',')} ({Math.round((economia / valorSemDesconto) * 100)}% OFF)
                    </strong>
                  </div>
                )}
                <div style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>Total a Pagar:</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f59e0b' }}>
                    R$ {valorTotal.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="reseller-btn-primary"
                disabled={loading}
              >
                {loading ? 'Gerando cobrança Pix...' : `Gerar Cobrança Pix (R$ ${valorTotal.toFixed(2).replace('.', ',')})`}
                <QrCode size={18} />
              </button>
            </form>
          </>
        ) : pollStatus === 'APPROVED' ? (
          /* Estado de Pagamento Aprovado */
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
              Pagamento Confirmado com Sucesso!
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#94a3b8', margin: '0 0 1.5rem' }}>
              Os <strong>{pixData.quantidade} créditos ({pixData.planoNome || pixData.plano})</strong> foram adicionados à sua carteira de revendedor.
            </p>

            <button
              type="button"
              className="reseller-btn-primary"
              onClick={onClose}
            >
              Concluir e Voltar ao Painel
            </button>
          </div>
        ) : (
          /* Tela de Pagamento PIX com QR Code e Copia e Cola */
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.35rem' }}>
                Pague via PIX para Liberar os Créditos
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
                Escaneie o QR Code no app do seu banco ou utilize o código Copia e Cola.
              </p>
            </div>

            {/* Valor em destaque */}
            <div style={{
              background: 'rgba(2, 6, 23, 0.8)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              padding: '0.85rem',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Créditos</span>
                <strong style={{ color: '#f8fafc' }}>{pixData.quantidade}x {pixData.planoNome || pixData.plano}</strong>
              </div>
              <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.1)' }} />
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Valor Total</span>
                <strong style={{ color: '#f59e0b', fontSize: '1.2rem' }}>
                  R$ {Number(pixData.valorTotal).toFixed(2).replace('.', ',')}
                </strong>
              </div>
            </div>

            {/* QR Code Container */}
            <div style={{
              background: '#fff',
              padding: '1rem',
              borderRadius: '16px',
              display: 'inline-block',
              margin: '0 auto 1.25rem',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
            }}>
              {pixData.qrCodeBase64 ? (
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR Code Pix"
                  style={{ width: '180px', height: '180px', display: 'block' }}
                />
              ) : (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixData.qrCode || '')}`}
                  alt="QR Code Pix"
                  style={{ width: '180px', height: '180px', display: 'block' }}
                />
              )}
            </div>

            {/* Input Copia e Cola */}
            <div className="reseller-form-group">
              <label className="reseller-label">
                <span>Código PIX Copia e Cola</span>
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  readOnly
                  className="reseller-input"
                  style={{ paddingLeft: '1rem', fontFamily: 'monospace', fontSize: '0.75rem' }}
                  value={pixData.qrCode || ''}
                />
                <button
                  type="button"
                  className="reseller-action-btn"
                  style={{ padding: '0 1rem', whiteSpace: 'nowrap', background: '#f59e0b', color: '#000', border: 'none' }}
                  onClick={handleCopyPix}
                >
                  {copiedPix ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedPix ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* Status de Polling em tempo real */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              color: '#94a3b8',
              margin: '1.25rem 0'
            }}>
              <span className="pulse-glow" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
              <span>Aguardando confirmação bancária em tempo real...</span>
            </div>

            {/* Ação de Demonstração / Teste Instantâneo */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={handleSimulateApproval}
                disabled={checkingPayment}
                style={{
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#4ade80',
                  padding: '0.65rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Zap size={16} />
                <span>{checkingPayment ? 'Confirmando...' : 'Simular Aprovação Imediata (Ambiente de Testes)'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
