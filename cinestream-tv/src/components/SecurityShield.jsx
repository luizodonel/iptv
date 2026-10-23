import React from 'react';
import { ShieldAlert, Lock, AlertTriangle, EyeOff } from 'lucide-react';

export default function SecurityShield({ isOpen }) {
  if (!isOpen) return null;

  return (
    <div className="security-shield-overlay">
      <div className="security-shield-card glass-card scale-up">
        <div className="security-shield-icon-wrap">
          <ShieldAlert size={48} className="shield-pulsing-icon" />
          <div className="shield-icon-badge">
            <Lock size={16} />
          </div>
        </div>

        <h2 className="security-shield-title">
          Acesso Restrito: Inspeção Desativada
        </h2>

        <p className="security-shield-desc">
          Por motivos de segurança e integridade de conteúdo, a visualização de código-fonte, 
          inspeção de elementos (F12) e extração de listas de transmissão são restritas nesta plataforma.
        </p>

        <div className="security-shield-notice">
          <EyeOff size={18} className="text-warning flex-shrink-0" />
          <span>
            O acesso a ferramentas de depuração e inspeção é liberado exclusivamente para 
            administradores e usuários master autorizados (<strong>@odonel</strong>).
          </span>
        </div>

        <div className="security-shield-action-box">
          <div className="security-pulse-dot"></div>
          <span>Feche as ferramentas de desenvolvedor (DevTools) para continuar utilizando a plataforma normalmente.</span>
        </div>
      </div>
    </div>
  );
}
