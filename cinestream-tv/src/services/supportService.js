/**
 * Serviço de Suporte e Integração Oficial com WhatsApp
 * CineStream TV
 * Número de Contato: (61) 98226-1155
 */

export const SUPPORT_PHONE_RAW = '5561982261155';
export const SUPPORT_PHONE_DISPLAY = '(61) 98226-1155';
export const SUPPORT_HOURS = 'Atendimento Diário • 08h às 23h';

/**
 * Monta o link para o WhatsApp com mensagem contextualizada
 * @param {string} message - Mensagem ou dúvida do usuário
 * @param {object|null} user - Dados do usuário autenticado (opcional)
 * @returns {string} URL do WhatsApp pronta para abertura
 */
export function buildWhatsAppUrl(message = '', user = null, brandName = 'Top Canais', overridePhone = null) {
  let text = '';
  const store = brandName || 'Top Canais';

  if (user) {
    const userIdentifier = user.username ? `@${user.username}` : (user.nome || 'Cliente');
    const planInfo = user.planoNome 
      ? `Plano: ${user.planoNome}` 
      : (user.assinaturaAtiva ? 'Assinatura Ativa' : 'Sem plano ativo');
    
    const intro = `👋 Olá! Sou ${userIdentifier} (${planInfo}) no ${store}.`;
    const body = message ? `\n\n📌 Motivo do contato:\n${message}` : '\n\nGostaria de falar com o suporte.';
    text = `${intro}${body}`;
  } else {
    const intro = `👋 Olá! Estou acessando o ${store}.`;
    const body = message ? `\n\n📌 Motivo do contato:\n${message}` : '\n\nGostaria de falar com o suporte.';
    text = `${intro}${body}`;
  }

  const phoneRaw = overridePhone ? `55${overridePhone.replace(/\D/g, '')}` : SUPPORT_PHONE_RAW;
  return `https://wa.me/${phoneRaw}?text=${encodeURIComponent(text.trim())}`;
}

/**
 * Abre o WhatsApp em uma nova aba
 * @param {string} message 
 * @param {object|null} user 
 * @param {string} brandName
 * @param {string|null} overridePhone
 */
export function openWhatsApp(message = '', user = null, brandName = 'Top Canais', overridePhone = null) {
  const url = buildWhatsAppUrl(message, user, brandName, overridePhone);
  window.open(url, '_blank', 'noopener,noreferrer');
}
