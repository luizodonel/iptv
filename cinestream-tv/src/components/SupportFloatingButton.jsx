import React, { useState, useEffect, useRef } from 'react';
import { WhatsAppIcon } from './SupportModal';
import { SUPPORT_PHONE_DISPLAY, openWhatsApp } from '../services/supportService';
import { X, Trash2 } from 'lucide-react';

const POS_STORAGE_KEY = 'cinestream_support_btn_pos';
const DISMISSED_KEY = 'cinestream_support_btn_dismissed';

export default function SupportFloatingButton({ 
  onOpenSupportModal, 
  currentUser = null,
  brandName = 'Top Canais',
  customPhone = null,
  hidden = false 
}) {
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem(POS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return null; // Será calculado no mount baseado na tela
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const dragRef = useRef({
    startX: 0,
    startY: 0,
    btnStartX: 0,
    btnStartY: 0,
    hasMoved: false
  });

  const btnRef = useRef(null);
  const trashZoneRef = useRef(null);

  // Inicializa posição padrão no canto inferior direito respeitando safe areas
  useEffect(() => {
    if (!position && typeof window !== 'undefined') {
      const defaultX = Math.max(20, window.innerWidth - 76);
      const defaultY = Math.max(20, window.innerHeight - 150);
      setPosition({ x: defaultX, y: defaultY });
    }
  }, [position]);

  // Redimensionamento de tela: garante que o botão permaneça visível
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        if (!prev) return prev;
        const clampedX = Math.min(Math.max(12, prev.x), window.innerWidth - 68);
        const clampedY = Math.min(Math.max(12, prev.y), window.innerHeight - 68);
        return { x: clampedX, y: clampedY };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Deletar / Remover ícone permanentemente da tela
  const handleDismiss = (e) => {
    if (e) e.stopPropagation();
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch (_) {}
  };

  // Pointer Down (Mouse ou Touch)
  const handlePointerDown = (e) => {
    // Se clicar no botão de fechar, não inicia drag
    if (e.target.closest('.support-btn-delete')) return;

    const startX = e.clientX;
    const startY = e.clientY;

    const curX = position ? position.x : (window.innerWidth - 76);
    const curY = position ? position.y : (window.innerHeight - 150);

    dragRef.current = {
      startX,
      startY,
      btnStartX: curX,
      btnStartY: curY,
      hasMoved: false
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Pointer Move (Arrastando pela tela)
  const handlePointerMove = (e) => {
    if (!dragRef.current.startX && !dragRef.current.startY) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const dist = Math.hypot(dx, dy);

    if (dist > 5) {
      dragRef.current.hasMoved = true;
      if (!isDragging) setIsDragging(true);

      const newX = Math.min(Math.max(12, dragRef.current.btnStartX + dx), window.innerWidth - 68);
      const newY = Math.min(Math.max(12, dragRef.current.btnStartY + dy), window.innerHeight - 68);

      setPosition({ x: newX, y: newY });

      // Checa se está sobre a zona de lixeira (parte inferior central da tela)
      const isNearTrash = newY > window.innerHeight - 120 && Math.abs(newX - (window.innerWidth / 2 - 28)) < 80;
      setIsOverTrash(isNearTrash);
    }
  };

  // Pointer Up (Soltando o botão)
  const handlePointerUp = (e) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (isOverTrash) {
      // Soltou na lixeira -> Deleta!
      handleDismiss();
      setIsDragging(false);
      setIsOverTrash(false);
      dragRef.current = { startX: 0, startY: 0, btnStartX: 0, btnStartY: 0, hasMoved: false };
      return;
    }

    if (dragRef.current.hasMoved) {
      // Foi arrastado -> Salva nova posição
      if (position) {
        try {
          localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(position));
        } catch (_) {}
      }
    } else {
      // Foi apenas um clique rápido -> Abre diretamente o WhatsApp do lojista
      openWhatsApp(
        `Olá! Gostaria de falar com o atendimento da loja ${brandName || 'Top Canais'}.`,
        currentUser,
        brandName,
        customPhone
      );
    }

    setIsDragging(false);
    setIsOverTrash(false);
    dragRef.current = { startX: 0, startY: 0, btnStartX: 0, btnStartY: 0, hasMoved: false };
  };

  // Se estiver escondido por props ou foi deletado pelo usuário, não renderiza
  if (hidden || isDismissed) return null;

  const currentX = position ? position.x : (typeof window !== 'undefined' ? window.innerWidth - 76 : 300);
  const currentY = position ? position.y : (typeof window !== 'undefined' ? window.innerHeight - 150 : 500);
  const displayPhone = customPhone || SUPPORT_PHONE_DISPLAY;

  return (
    <>
      {/* Botão Flutuante Móvel e Arrastável */}
      <div 
        ref={btnRef}
        className={`support-draggable-container ${isDragging ? 'is-dragging' : ''}`}
        style={{
          transform: `translate3d(${currentX}px, ${currentY}px, 0)`,
          touchAction: 'none'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Botão de Excluir / Fechar (✕) */}
        <button
          type="button"
          className="support-btn-delete"
          onClick={handleDismiss}
          title="Remover botão da tela"
          aria-label="Deletar botão de suporte"
        >
          <X size={12} strokeWidth={3} />
        </button>

        {/* Botão Principal Flutuante do WhatsApp */}
        <div
          id="btn-cinestream-support"
          className={`support-floating-trigger ${isOverTrash ? 'over-trash' : ''}`}
          title={`Central de Atendimento WhatsApp: ${displayPhone} (Clique para conversar ou arraste para reposicionar)`}
          role="button"
          tabIndex={0}
        >
          {/* Efeito Radar Pulse (apenas quando parado) */}
          {!isDragging && <span className="support-radar-pulse" />}
          
          {/* WhatsApp Icon */}
          <div className="support-icon-inner">
            <WhatsAppIcon size={28} />
          </div>

          {/* Live Online Badge */}
          <span className="support-online-badge" title="Atendentes disponíveis agora" />
        </div>
      </div>

      {/* Zona da Lixeira ao Arrastar (Drop to delete) */}
      {isDragging && (
        <div 
          ref={trashZoneRef}
          className={`support-trash-zone ${isOverTrash ? 'active-trash' : ''} fade-in`}
        >
          <div className="trash-circle">
            <Trash2 size={24} color="#ffffff" />
          </div>
          <span className="trash-label">
            {isOverTrash ? 'Solte para remover' : 'Arraste aqui para deletar'}
          </span>
        </div>
      )}
    </>
  );
}
