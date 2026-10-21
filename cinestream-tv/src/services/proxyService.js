import Hls from 'hls.js';

/**
 * Converte qualquer URL insegura de transmissão HTTP para a rota de proxy segura HTTPS
 * servida pelo Nginx da própria VPS, eliminando o bloqueio de Mixed Content.
 */
export function toSafeStreamUrl(url) {
  if (!url || typeof url !== 'string') return url;

  // Se a URL for HTTP, encaminha pelo stream-proxy da VPS
  if (url.startsWith('http://')) {
    const stripped = url.replace(/^http:\/\//, '');
    return `/stream-proxy/http/${stripped}`;
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
