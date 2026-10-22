import React from 'react';
import { MonitorX, AlertTriangle, ArrowRight, Sparkles, LogIn } from 'lucide-react';

export default function SessionTerminatedModal({ isOpen, reason, onReLogin, onUpgradePlans }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fade-in" style={{ zIndex: 9999 }}>
      <div 
        className="session-kicked-card glass-card scale-up"
        role="alertdialog"
        aria-modal="true"
      >
        <div className="kicked-icon-wrap">
          <MonitorX size={44} className="text-warning pulse-glow" />
        </div>

        <h2 className="kicked-title">Sessão Desconectada</h2>
        
        <p className="kicked-desc">
          {reason || 'Sua conta atingiu o limite de telas simultâneas do seu plano e foi conectada em outro dispositivo.'}
        </p>

        <div className="kicked-tips-box glass-card">
          <div className="tip-row">
            <AlertTriangle size={16} className="text-warning flex-shrink-0" />
            <span>
              Caso você tenha o plano de <strong>1 tela</strong>, ao conectar em um novo aparelho, o anterior é desconectado automaticamente.
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
              <span>Fazer Upgrade para 2 Telas</span>
            </button>
          )}

          <button 
            type="button" 
            className="btn-outline kicked-btn"
            onClick={onReLogin}
          >
            <LogIn size={18} />
            <span>Entrar Novamente</span>
          </button>
        </div>
      </div>
    </div>
  );
}
