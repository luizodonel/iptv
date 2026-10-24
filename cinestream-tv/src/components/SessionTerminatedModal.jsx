import React, { useEffect } from 'react';
import { MonitorX, AlertTriangle, ArrowRight, Sparkles, LogIn, Clock, CreditCard } from 'lucide-react';

export default function SessionTerminatedModal({ isOpen, reason, onReLogin, onUpgradePlans }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isTrialExpired = (reason || '').toLowerCase().includes('teste') || 
                        (reason || '').toLowerCase().includes('2 horas') ||
                        (reason || '').toLowerCase().includes('trial');

  return (
    <div className="modal-backdrop fade-in" style={{ zIndex: 9999 }}>
      <div 
        className="session-kicked-card glass-card scale-up"
        role="alertdialog"
        aria-modal="true"
      >
        <div className="kicked-icon-wrap">
          {isTrialExpired ? (
            <Clock size={44} className="text-warning pulse-glow" style={{ color: '#f59e0b' }} />
          ) : (
            <MonitorX size={44} className="text-warning pulse-glow" />
          )}
        </div>

        <h2 className="kicked-title">
          {isTrialExpired ? 'Período de Teste Encerrado' : 'Sessão Desconectada'}
        </h2>
        
        <p className="kicked-desc">
          {reason || 'Sua conta atingiu o limite de telas simultâneas do seu plano e foi conectada em outro dispositivo.'}
        </p>

        <div className="kicked-tips-box glass-card">
          <div className="tip-row">
            {isTrialExpired ? (
              <CreditCard size={18} className="text-warning flex-shrink-0" style={{ color: '#10b981' }} />
            ) : (
              <AlertTriangle size={16} className="text-warning flex-shrink-0" />
            )}
            <span>
              {isTrialExpired ? (
                <>
                  Esperamos que tenha gostado do <strong>CineStream TV</strong>! Para continuar assistindo aos mais de 400 canais, filmes e séries, escolha um de nossos planos com <strong>liberação instantânea via Pix</strong>.
                </>
              ) : (
                <>
                  Caso você tenha o plano de <strong>1 tela</strong>, ao conectar em um novo aparelho, o anterior é desconectado automaticamente.
                </>
              )}
            </span>
          </div>
        </div>

        <div className="kicked-actions">
          {onUpgradePlans && (
            <button 
              type="button" 
              className="btn-glow-primary kicked-btn"
              onClick={onUpgradePlans}
            >
              <Sparkles size={18} />
              <span>{isTrialExpired ? 'Assinar Agora com Pix' : 'Fazer Upgrade para 2 Telas'}</span>
            </button>
          )}

          <button 
            type="button" 
            className="btn-outline kicked-btn"
            onClick={onReLogin}
          >
            <LogIn size={18} />
            <span>Entrar com Outra Conta</span>
          </button>
        </div>
      </div>
    </div>
  );
}
