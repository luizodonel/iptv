import React, { useState, useEffect } from 'react';
import { 
  X, 
  MessageCircle, 
  Send, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  CreditCard, 
  Tv, 
  TvMinimal, 
  Users, 
  Sparkles, 
  ShieldCheck, 
  Headset, 
  Clock, 
  ExternalLink,
  PhoneCall
} from 'lucide-react';
import { 
  SUPPORT_PHONE_DISPLAY, 
  SUPPORT_HOURS, 
  buildWhatsAppUrl, 
  openWhatsApp 
} from '../services/supportService';

// Ícone oficial em SVG do WhatsApp
export function WhatsAppIcon({ size = 20, className = '' }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function SupportModal({ 
  isOpen, 
  onClose, 
  currentUser = null,
  brandName = 'Top Canais',
  isCustomBrand = false,
  customPhone = null
}) {
  const [customMsg, setCustomMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const activePhoneDisplay = customPhone || SUPPORT_PHONE_DISPLAY;
  const activePhoneRaw = customPhone ? customPhone.replace(/\D/g, '') : null;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(activePhoneDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSendCustomMsg = (e) => {
    e.preventDefault();
    openWhatsApp(customMsg, currentUser, brandName, activePhoneRaw);
    setCustomMsg('');
  };

  const quickTopics = [
    {
      id: 'planos',
      icon: CreditCard,
      title: 'Planos e Assinatura',
      description: 'Dúvidas sobre ativação, renovação ou comprovante de pagamento',
      message: `Olá! Gostaria de tirar dúvidas sobre os planos ou pagamentos na ${brandName || 'Top Canais'}.`
    },
    {
      id: 'suporte-tecnico',
      icon: Tv,
      title: 'Suporte Técnico & Canais',
      description: 'Ajuda com canais ao vivo, filmes, séries ou qualidade de áudio e vídeo',
      message: `Olá! Preciso de suporte técnico sobre a reprodução de canais/conteúdo na ${brandName || 'Top Canais'}.`
    },
    {
      id: 'smart-tv',
      icon: TvMinimal,
      title: 'Como Assistir na Smart TV',
      description: 'Instruções para configurar na sua TV, TV Box, celular ou PC',
      message: `Olá! Gostaria de ajuda para configurar e assistir na minha Smart TV/aparelho.`
    },
    {
      id: 'telas',
      icon: Users,
      title: 'Telas Simultâneas & Conta',
      description: 'Gerenciamento de conexões simultâneas ou recuperação de login',
      message: `Olá! Preciso de ajuda com o limite de telas ou acesso na ${brandName || 'Top Canais'}.`
    }
  ];

  const faqs = [
    {
      question: 'Como funciona a ativação do meu plano?',
      answer: 'A liberação é automática e imediata! Seu plano e telas são ativados no mesmo instante para você aproveitar todos os canais, filmes e séries.'
    },
    {
      question: 'Quantas telas posso assistir simultaneamente?',
      answer: 'Depende do seu plano contratado. No plano de 1 Tela, você pode assistir em 1 aparelho por vez. No plano de 2 Telas ou mais, múltiplos aparelhos podem assistir ao mesmo tempo.'
    },
    {
      question: 'Consigo assistir na Smart TV, TV Box ou Celular?',
      answer: `Sim! O portal ${brandName} funciona direto no navegador web da sua Smart TV (Samsung Tizen, LG WebOS ou Android TV), TV Box, Fire TV Stick, Smartphone ou Computador sem necessidade de instalar aplicativos complicados.`
    },
    {
      question: 'Qual é o número e horário de atendimento do suporte?',
      answer: `Nosso atendimento oficial é via WhatsApp pelo número ${activePhoneDisplay}. Estamos à disposição todos os dias para melhor lhe atender.`
    }
  ];

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div 
        className="support-modal-card glass-card scale-up" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-modal-title"
      >
        {/* Close Button */}
        <button 
          className="modal-close-btn" 
          onClick={onClose}
          aria-label="Fechar Central de Suporte"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="support-modal-header">
          <div className="support-badge-pill">
            <span className="live-status-dot pulse" />
            <Headset size={14} />
            <span>Central de Suporte Oficial</span>
          </div>

          <h2 id="support-modal-title" className="support-modal-title">
            Como podemos te ajudar hoje?
          </h2>
          <p className="support-modal-subtitle">
            Atendimento humanizado e resposta rápida direto pelo WhatsApp.
          </p>

          {/* User info badge if logged in */}
          {currentUser && (
            <div className="support-user-context">
              <ShieldCheck size={14} className="text-accent" />
              <span>
                Conectado como <strong>@{currentUser.username || currentUser.nome}</strong> • {currentUser.planoNome || (currentUser.assinaturaAtiva ? 'Assinatura Ativa' : 'Sem Plano Ativo')}
              </span>
            </div>
          )}
        </div>

        {/* Main WhatsApp Direct Action Card */}
        <div className="support-hero-cta">
          <div className="support-cta-info">
            <div className="whatsapp-avatar-badge">
              <WhatsAppIcon size={26} />
            </div>
            <div className="support-cta-texts">
              <div className="support-cta-topline">
                <span className="online-label">Online Agora</span>
                <span className="support-hours-label">
                  <Clock size={12} /> {SUPPORT_HOURS}
                </span>
              </div>
              <h3 className="support-cta-number">{activePhoneDisplay}</h3>
              <p className="support-cta-desc">
                Clique no botão abaixo para iniciar uma conversa diretamente no nosso WhatsApp.
              </p>
            </div>
          </div>

          <div className="support-cta-buttons">
            <button 
              type="button" 
              className="btn-whatsapp-primary pulse-hover"
              onClick={() => openWhatsApp(`Olá! Gostaria de falar com o atendimento da loja ${brandName || 'Top Canais'}.`, currentUser, brandName, activePhoneRaw)}
            >
              <WhatsAppIcon size={22} />
              <span>Falar no WhatsApp Agora</span>
              <ExternalLink size={16} />
            </button>

            <button 
              type="button" 
              className={`btn-copy-phone ${copied ? 'copied' : ''}`}
              onClick={handleCopyPhone}
              title="Copiar número de telefone"
            >
              {copied ? (
                <>
                  <Check size={15} />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={15} />
                  <span>Copiar Número</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Topics */}
        <div className="support-topics-section">
          <h4 className="support-section-label">
            <Sparkles size={14} className="text-warning" />
            <span>Assuntos Rápidos de Atendimento</span>
          </h4>

          <div className="support-topics-grid">
            {quickTopics.map((topic) => {
              const Icon = topic.icon;
              return (
                <button
                  key={topic.id}
                  type="button"
                  className="support-topic-card glass-panel"
                  onClick={() => openWhatsApp(topic.message, currentUser)}
                >
                  <div className="topic-icon-wrap">
                    <Icon size={20} />
                  </div>
                  <div className="topic-content">
                    <div className="topic-header-row">
                      <span className="topic-title">{topic.title}</span>
                      <WhatsAppIcon size={14} className="topic-wa-icon" />
                    </div>
                    <span className="topic-desc">{topic.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Message Input */}
        <form onSubmit={handleSendCustomMsg} className="support-custom-box">
          <label htmlFor="custom-support-msg" className="support-custom-label">
            <MessageCircle size={15} />
            <span>Ou digite sua dúvida antes de abrir o WhatsApp:</span>
          </label>
          <div className="support-input-row">
            <input
              id="custom-support-msg"
              type="text"
              className="support-text-input"
              placeholder="Ex: Não estou conseguindo reproduzir o canal..."
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
            />
            <button 
              type="submit" 
              className="btn-send-whatsapp"
              disabled={!customMsg.trim()}
            >
              <Send size={16} />
              <span>Enviar</span>
            </button>
          </div>
        </form>

        {/* Frequently Asked Questions */}
        <div className="support-faq-section">
          <h4 className="support-section-label">
            <span>Perguntas Frequentes (FAQ)</span>
          </h4>

          <div className="support-faq-list">
            {faqs.map((faq, index) => {
              const isExpanded = expandedFaq === index;
              return (
                <div key={index} className={`support-faq-item ${isExpanded ? 'open' : ''}`}>
                  <button 
                    type="button" 
                    className="faq-question-btn"
                    onClick={() => setExpandedFaq(isExpanded ? null : index)}
                    aria-expanded={isExpanded}
                  >
                    <span>{faq.question}</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {isExpanded && (
                    <div className="faq-answer-body fade-in">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="support-modal-footer">
          <div className="footer-secure-guarantee">
            <ShieldCheck size={16} className="text-emerald" />
            <span>{brandName || 'Top Canais'} • Atendimento Dedicado • {activePhoneDisplay}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
