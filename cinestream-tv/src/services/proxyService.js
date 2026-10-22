import Hls from 'hls.js';

/**
 * Converte qualquer URL de transmissão para a rota de proxy segura HTTPS (/api/proxy),
 * eliminando o bloqueio de Mixed Content (HTTP em HTTPS), corrigindo erros de CORS
 * e resolvendo redirecionamentos automáticos de servidores de IPTV.
 */
export function toSafeStreamUrl(url, referer = '', userAgent = '') {
  if (!url || typeof url !== 'string') return url;

  // Se já for uma URL de proxy, preserva
  if (url.startsWith('/api/proxy') || url.startsWith('/stream-proxy')) {
    return url;
  }

  // Em sites HTTPS, URLs HTTP são bloqueadas pelo navegador (Mixed Content).
  // Streams HLS (.m3u8) e fluxos ao vivo também passam pelo proxy para garantir CORS e reescrita de segmentos.
  const isHttp = url.startsWith('http://');
  const isStream = url.includes('.m3u8') || url.includes('/live/') || url.includes('/auth/');

  if (isHttp || isStream) {
    let proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    if (referer) proxyUrl += `&referer=${encodeURIComponent(referer)}`;
    if (userAgent) proxyUrl += `&ua=${encodeURIComponent(userAgent)}`;
    return proxyUrl;
  }

  return url;
}

/**
 * Loader customizado do HLS.js para interceptar sub-playlists e segmentos
 * que eventualmente venham com URLs absolutas http://
 */
export class SafeStreamLoader extends Hls.DefaultConfig.loader {
  load(context, config, callbacks) {
    if (context && context.url && context.url.startsWith('http://')) {
      context.url = toSafeStreamUrl(context.url);
    }
    super.load(context, config, callbacks);
  }
}
