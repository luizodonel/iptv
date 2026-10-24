import React from 'react';
import { WhatsAppIcon } from './SupportModal';
import { SUPPORT_PHONE_DISPLAY } from '../services/supportService';

export default function SupportFloatingButton({ 
  onOpenSupportModal, 
  currentUser = null,
  hidden = false 
}) {
  // Se estiver escondido (ex: reproduzindo vídeo full screen), não exibe
  if (hidden) return null;

  return (
    <div className="support-floating-wrapper">
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
