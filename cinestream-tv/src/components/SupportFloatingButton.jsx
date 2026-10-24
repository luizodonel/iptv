import React, { useState, useEffect } from 'react';
import { Headset, X, Sparkles, MessageCircle, ExternalLink } from 'lucide-react';
import { WhatsAppIcon } from './SupportModal';
import { SUPPORT_PHONE_DISPLAY, openWhatsApp } from '../services/supportService';

export default function SupportFloatingButton({ 
  onOpenSupportModal, 
  currentUser = null,
  hidden = false 
}) {
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Se estiver escondido (ex: reproduzindo vídeo full screen), não exibe
  if (hidden) return null;

  return (
    <div 
      className="support-floating-wrapper"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Speech / Greeting Tooltip Bubble */}
      {!bubbleDismissed && (
        <div className="support-floating-bubble fade-in">
          <button 
            type="button" 
            className="bubble-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              setBubbleDismissed(true);
            }}
            title="Fechar aviso"
            aria-label="Fechar aviso"
          >
            <X size={12} />
          </button>
          
          <div 
            className="bubble-content"
            onClick={onOpenSupportModal}
            role="button"
            tabIndex={0}
          >
            <div className="bubble-header">
              <span className="bubble-pulse-dot" />
              <span className="bubble-tag">Suporte Online</span>
            </div>
            <p className="bubble-text">
              Precisa de ajuda? Fale conosco no <strong>WhatsApp</strong>!
            </p>
            <span className="bubble-phone">{SUPPORT_PHONE_DISPLAY}</span>
          </div>
        </div>
      )}

      {/* Main Floating Round Button */}
      <button
        type="button"
        id="btn-cinestream-support"
        className="support-floating-trigger"
        onClick={onOpenSupportModal}
        title={`Central de Suporte WhatsApp: ${SUPPORT_PHONE_DISPLAY}`}
        aria-label="Abrir Central de Suporte no WhatsApp"
      >
        {/* Radar Pulse Effect */}
        <span className="support-radar-pulse" />
        
        {/* WhatsApp Icon */}
        <div className="support-icon-inner">
          <WhatsAppIcon size={28} />
        </div>

        {/* Live Badge */}
        <span className="support-online-badge" title="Atendentes disponíveis" />
      </button>
    </div>
  );
}
