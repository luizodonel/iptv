import Hls from 'hls.js';

/**
 * Converte qualquer URL de transmissão externa (HTTP ou HTTPS) para a rota de proxy (/api/proxy),
 * eliminando erros de CORS, bloqueio de Mixed Content (HTTP em HTTPS)
 * e resolvendo redirecionamentos automáticos de servidores de streaming.
 */
export function toSafeStreamUrl(url, referer = '', userAgent = '') {
  if (!url || typeof url !== 'string') return url;

  // Se já for uma URL de proxy, preserva
  if (url.startsWith('/api/proxy') || url.startsWith('/stream-proxy')) {
    return url;
  }

  // Verifica se é uma URL externa absoluta
  const isHttp = url.startsWith('http://');
  const isHttps = url.startsWith('https://');

  if (isHttp || isHttps) {
    try {
      if (typeof window !== 'undefined') {
        const parsed = new URL(url, window.location.origin);
        // Se for o mesmo domínio do app e já em HTTPS, não precisa de proxy
        if (parsed.origin === window.location.origin && !url.includes('http://')) {
          return url;
        }
      }
    } catch (_) {}

    let proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    if (referer) proxyUrl += `&referer=${encodeURIComponent(referer)}`;
    if (userAgent) proxyUrl += `&ua=${encodeURIComponent(userAgent)}`;
    return proxyUrl;
  }

  return url;
}

/**
 * Loader customizado do HLS.js para interceptar sub-playlists, segmentos (.ts, .js, .m4s)
 * e chaves de criptografia que venham de servidores externos sem cabeçalhos CORS.
 */
export class SafeStreamLoader extends Hls.DefaultConfig.loader {
  load(context, config, callbacks) {
    if (context && context.url) {
      context.url = toSafeStreamUrl(context.url);
    }
    super.load(context, config, callbacks);
  }
}
