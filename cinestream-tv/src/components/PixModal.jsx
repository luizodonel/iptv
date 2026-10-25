import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  QrCode, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  PartyPopper,
  Zap,
  ArrowRight
} from 'lucide-react';
import { checkPixStatus } from '../services/authService';

export default function PixModal({ pixData, isOpen, onClose, onSuccess, onOpenSupport, brandName = 'Top Canais' }) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutos em segundos
  const [isApproved, setIsApproved] = useState(false);
  const pollingRef = useRef(null);

  const qrCodeBase64 = pixData?.qrCodeBase64;
  const qrCodeText = pixData?.qrCode;
  const paymentId = pixData?.paymentId;
  const valor = pixData?.valor ? Number(pixData.valor).toFixed(2).replace('.', ',') : '0,00';
  const planoNome = pixData?.plano?.nome || `Plano ${brandName || 'Top Canais'}`;

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isApproved) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isApproved]);

  // Polling para checar status no Mercado Pago a cada 2.5 segundos
  useEffect(() => {
    if (!isOpen || !paymentId || isApproved) return;

    const check = async () => {
      try {
        const res = await checkPixStatus(paymentId);
        if (res && res.status === 'APPROVED') {
          setIsApproved(true);
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (onSuccess) onSuccess(res.user);
        }
      } catch (err) {
        console.warn('Polling status pix:', err);
      }
    };

    pollingRef.current = setInterval(check, 2500);

    document.body.style.overflow = 'hidden';

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      document.body.style.overflow = '';
    };
  }, [isOpen, paymentId, isApproved, onSuccess]);

  if (!isOpen || !pixData) return null;

  const handleCopy = () => {
    if (qrCodeText) {
      navigator.clipboard.writeText(qrCodeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div 
        className="pix-modal-card glass-card scale-up" 
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

        {isApproved ? (
          /* Sucesso após aprovação do Pix */
          <div className="pix-success-screen fade-in">
            <div className="success-icon-wrap bounce">
              <PartyPopper size={48} className="text-emerald" />
            </div>
            <h2 className="success-title">Pagamento Confirmado!</h2>
            <p className="success-subtitle">
              Sua assinatura do <strong>{planoNome}</strong> foi ativada com sucesso pelo Mercado Pago!
            </p>
            <div className="success-features-box glass-card">
              <div className="success-feature-item">
                <Check size={18} className="text-emerald" />
                <span>Canais e VOD liberados instantaneamente</span>
              </div>
              <div className="success-feature-item">
                <Check size={18} className="text-emerald" />
                <span>Limite de telas simultâneas ativado</span>
              </div>
            </div>
            <button 
              type="button" 
              className="btn-glow-primary success-cta-btn"
              onClick={onClose}
            >
              <span>Começar a Assistir</span>
              <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          /* Tela de QR Code Pix e Copia e Cola */
          <div className="pix-payment-content">
            <div className="pix-modal-header">
              <div className="pix-top-pill">
                <Zap size={14} className="text-emerald" />
                <span>Pagamento Instantâneo via Pix</span>
              </div>
              <h2 className="pix-title">Pague com Pix</h2>
              <p className="pix-subtitle">
                Escaneie o QR Code ou copie o código abaixo no seu banco para ativar agora:
              </p>
              <div className="pix-amount-badge">
                <span className="pix-amount-label">Valor a pagar:</span>
                <span className="pix-amount-value">R$ {valor}</span>
              </div>
            </div>

            {/* QR Code */}
            <div className="pix-qr-container">
              {qrCodeBase64 ? (
                <div className="qr-wrapper">
                  <img 
                    src={`data:image/png;base64,${qrCodeBase64}`} 
                    alt="QR Code Pix Mercado Pago" 
                    className="qr-image"
                  />
                </div>
              ) : (
                <div className="qr-fallback">
                  <QrCode size={120} />
                </div>
              )}

              <div className="pix-timer-row">
                <Clock size={16} className="text-warning" />
                <span>Código expira em: <strong>{formattedTime}</strong></span>
              </div>
            </div>

            {/* Copia e Cola */}
            <div className="pix-copy-section">
              <label className="copy-label">Código Pix Copia e Cola:</label>
              <div className="copy-input-wrap">
                <input 
                  type="text" 
                  readOnly 
                  value={qrCodeText || 'Gerando código Pix...'} 
                  className="copy-input"
                  onClick={e => e.target.select()}
                />
                <button 
                  type="button" 
                  className={`copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopy}
                  title="Copiar código Pix"
                >
                  {copied ? (
                    <>
                      <Check size={16} />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="pix-waiting-indicator">
              <span className="pulse-indicator-dot" />
              <span>Aguardando confirmação do pagamento no banco...</span>
            </div>

            <div className="pix-modal-footer">
              <ShieldCheck size={16} className="text-emerald" />
              <span>Processado com segurança pelo <strong>Mercado Pago</strong></span>
            </div>

            {onOpenSupport && (
              <div className="pix-support-help">
                <button 
                  type="button" 
                  className="btn-link-support"
                  onClick={() => {
                    onClose();
                    onOpenSupport();
                  }}
                >
                  Dúvidas com o Pix? Fale com o suporte no WhatsApp (61) 98226-1155
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
