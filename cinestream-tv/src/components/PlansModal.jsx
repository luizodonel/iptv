import React, { useState, useEffect } from 'react';
import { 
  X, 
  Tv, 
  Check, 
  Zap, 
  ShieldCheck, 
  Sparkles, 
  Crown, 
  Flame, 
  Clock, 
  Layers,
  ChevronRight,
  Headset
} from 'lucide-react';
import { createPixPayment } from '../services/authService';

export default function PlansModal({ 
  isOpen, 
  onClose, 
  currentUser, 
  onRequireAuth, 
  onPixGenerated,
  onOpenSupport
}) {
  const [selectedCycle, setSelectedCycle] = useState('mensal'); // 'mensal' | 'anual'
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const plans = [
    {
      id: 'tela1-mensal',
      cycle: 'mensal',
      nome: '1 Tela',
      telas: 1,
      badge: null,
      valor: '14,90',
      periodo: 'por mês',
      duracao: '30 dias',
      telasTexto: '1 tela por vez',
      destaque: false,
      vantagens: [
        'Acesso a todos os 400+ canais ao vivo',
        'Mais de 40.000 filmes e séries completas',
        '1 tela simultânea',
        'Qualidade Full HD e 4K',
        'Sem fidelidade ou carência'
      ]
    },
    {
      id: 'tela2-mensal',
      cycle: 'mensal',
      nome: '2 Telas',
      telas: 2,
      badge: 'Mais Popular',
      badgeColor: 'badge-fire',
      valor: '19,90',
      periodo: 'por mês',
      duracao: '30 dias',
      telasTexto: '2 telas simultâneas',
      destaque: true,
      vantagens: [
        'Acesso a todos os 400+ canais ao vivo',
        'Mais de 40.000 filmes e séries completas',
        'Até 2 telas simultâneas em qualquer aparelho',
        'Qualidade Full HD e 4K',
        'Desconexão automática inteligente'
      ]
    },
    {
      id: 'tela1-anual',
      cycle: 'anual',
      nome: '1 Tela Anual',
      telas: 1,
      badge: 'Economia',
      badgeColor: 'badge-green',
      valor: '120,00',
      periodo: 'por ano (R$ 10,00/mês)',
      duracao: '365 dias',
      telasTexto: '1 tela por vez',
      destaque: false,
      vantagens: [
        '1 ano inteiro garantido sem reajuste',
        'Acesso a todos os 400+ canais e VOD',
        '1 tela simultânea',
        'Qualidade Full HD e 4K',
        'Economize R$ 58,80 no ano'
      ]
    },
    {
      id: 'tela2-anual',
      cycle: 'anual',
      nome: '2 Telas Anual',
      telas: 2,
      badge: 'Melhor Custo-Benefício',
      badgeColor: 'badge-purple',
      valor: '180,00',
      periodo: 'por ano (R$ 15,00/mês)',
      duracao: '365 dias',
      telasTexto: '2 telas simultâneas',
      destaque: true,
      vantagens: [
        '1 ano inteiro para a família toda',
        'Até 2 telas simultâneas liberadas',
        'Todos os canais ao vivo, filmes e séries',
        'Qualidade Full HD e 4K',
        'Economize R$ 58,80 no ano'
      ]
    }
  ];

  const filteredPlans = plans.filter(p => p.cycle === selectedCycle);

  const handleSelectPlan = async (plan) => {
    if (!currentUser) {
      onClose();
      if (onRequireAuth) onRequireAuth();
      return;
    }

    setErrorMsg('');
    setLoadingPlan(plan.id);

    try {
      const pixData = await createPixPayment(plan.id);
      onClose();
      if (onPixGenerated) {
        onPixGenerated(pixData);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao gerar Pix.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div 
        className="plans-modal-card glass-card scale-up" 
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button 
          className="modal-close-btn" 
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className="plans-modal-header">
          <div className="plans-badge-wrap">
            <Crown size={22} className="text-warning pulse-glow" />
            <span className="plans-top-tag">Escolha seu Plano</span>
          </div>
          <h2 className="plans-title">Assista Sem Interrupções</h2>
          <p className="plans-subtitle">
            Canais ao vivo em alta definição, filmes e séries liberados instantaneamente via Pix.
          </p>

          {/* Toggle Mensal / Anual */}
          <div className="plans-cycle-toggle">
            <button 
              type="button"
              className={`cycle-btn ${selectedCycle === 'mensal' ? 'active' : ''}`}
              onClick={() => setSelectedCycle('mensal')}
            >
              Planos Mensais
            </button>
            <button 
              type="button"
              className={`cycle-btn ${selectedCycle === 'anual' ? 'active' : ''}`}
              onClick={() => setSelectedCycle('anual')}
            >
              Planos Anuais <span className="discount-pill">Mais Econômico</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="auth-error-banner shake mb-4">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Current User Subscription Status */}
        {currentUser && currentUser.assinaturaAtiva && (
          <div className="current-sub-banner glass-card">
            <div className="sub-banner-icon">
              <ShieldCheck size={20} className="text-emerald" />
            </div>
            <div className="sub-banner-info">
              <span className="sub-title">Você já possui assinatura ativa: <strong>{currentUser.planoNome || 'Plano Top Canais'}</strong></span>
              <span className="sub-exp">
                Válida até {new Date(currentUser.fimAssinatura).toLocaleDateString('pt-BR')} ({currentUser.limiteTelas || 1} tela{currentUser.limiteTelas > 1 ? 's' : ''})
              </span>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="plans-grid">
          {filteredPlans.map(plan => {
            const isCurrent = currentUser?.planoId === plan.id && currentUser?.assinaturaAtiva;
            return (
              <div 
                key={plan.id}
                className={`plan-card glass-card ${plan.destaque ? 'is-featured' : ''} ${isCurrent ? 'is-current' : ''}`}
              >
                {plan.badge && (
                  <div className={`plan-badge ${plan.badgeColor || ''}`}>
                    {plan.destaque ? <Flame size={13} /> : <Sparkles size={13} />}
                    <span>{plan.badge}</span>
                  </div>
                )}

                <div className="plan-card-top">
                  <h3 className="plan-name">{plan.nome}</h3>
                  <div className="plan-screens-tag">
                    <Layers size={14} />
                    <span>{plan.telasTexto}</span>
                  </div>
                </div>

                <div className="plan-price-wrap">
                  <span className="currency">R$</span>
                  <span className="price-val">{plan.valor}</span>
                  <span className="period">{plan.periodo}</span>
                </div>

                <div className="plan-features">
                  {plan.vantagens.map((v, i) => (
                    <div key={i} className="plan-feature-row">
                      <div className="check-icon-wrap">
                        <Check size={14} />
                      </div>
                      <span className="feature-text">{v}</span>
                    </div>
                  ))}
                </div>

                <button 
                  type="button"
                  className={`plan-cta-btn ${plan.destaque ? 'btn-glow-primary' : 'btn-outline'}`}
                  onClick={() => handleSelectPlan(plan)}
                  disabled={loadingPlan === plan.id}
                >
                  {loadingPlan === plan.id ? (
                    <span className="spinner-sm" />
                  ) : isCurrent ? (
                    'Renovar Plano com Pix'
                  ) : (
                    <>
                      <span>Assinar via Pix</span>
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="plans-footer">
          <div className="pix-secure-guarantee">
            <Zap size={16} className="text-warning" />
            <span>Liberação 100% automática e instantânea pelo Mercado Pago logo após o pagamento do Pix.</span>
          </div>

          {onOpenSupport && (
            <button 
              type="button" 
              className="plans-support-link"
              onClick={() => {
                onClose();
                onOpenSupport();
              }}
            >
              <Headset size={15} />
              <span>Dúvidas sobre os planos? Fale com o suporte no WhatsApp (61) 98226-1155</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
