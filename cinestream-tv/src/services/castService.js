// Google Cast & Smart TV Service
// Integração com o Google Cast Application Framework (CAF) para transmissão direta para Smart TVs / Chromecast

let isCastFrameworkReady = false;
let castContextInstance = null;
const stateSubscribers = new Set();

/**
 * Notifica os assinantes sobre mudanças de estado do Cast
 */
function notifySubscribers() {
  const state = getCastStatus();
  stateSubscribers.forEach(cb => {
    try {
      cb(state);
    } catch (e) {
      console.warn('Erro ao notificar assinante do Cast:', e);
    }
  });
}

/**
 * Inicializa a integração com o Google Cast SDK
 */
export function initGoogleCast() {
  if (typeof window === 'undefined') return;

  // Callback chamado pelo script oficial da Google quando a API estiver pronta
  window['__onGCastApiAvailable'] = (isAvailable) => {
    if (isAvailable && window.cast && window.cast.framework && window.chrome && window.chrome.cast) {
      try {
        castContextInstance = window.cast.framework.CastContext.getInstance();
        castContextInstance.setOptions({
          receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
        });

        isCastFrameworkReady = true;

        // Escuta mudanças de disponibilidade de aparelhos
        castContextInstance.addEventListener(
          window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          () => notifySubscribers()
        );

        // Escuta conexão e desconexão de sessão
        castContextInstance.addEventListener(
          window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          () => notifySubscribers()
        );

        notifySubscribers();
      } catch (err) {
        console.warn('Google Cast Context error:', err);
      }
    }
  };

  // Caso o script da Google já tenha sido carregado antes do componente
  if (window.cast && window.cast.framework && window.chrome && window.chrome.cast && !castContextInstance) {
    try {
      castContextInstance = window.cast.framework.CastContext.getInstance();
      castContextInstance.setOptions({
        receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
      });
      isCastFrameworkReady = true;
      notifySubscribers();
    } catch (_) {}
  }
}

/**
 * Retorna o status atual do Google Cast
 */
export function getCastStatus() {
  if (typeof window === 'undefined') {
    return { isReady: false, isConnected: false, deviceName: '', state: 'UNAVAILABLE' };
  }

  const isReady = Boolean(isCastFrameworkReady && window.cast?.framework && castContextInstance);
  if (!isReady) {
    return { isReady: false, isConnected: false, deviceName: '', state: 'UNAVAILABLE' };
  }

  try {
    const session = castContextInstance.getCurrentSession();
    const isConnected = Boolean(session && session.getSessionState() === window.cast.framework.SessionState.SESSION_STARTED);
    const deviceName = session?.getCastDevice()?.friendlyName || '';
    const castState = castContextInstance.getCastState();

    return {
      isReady: true,
      isConnected,
      deviceName,
      state: castState, // 'NO_DEVICES_AVAILABLE' | 'NOT_CONNECTED' | 'CONNECTING' | 'CONNECTED'
      hasDevices: castState !== 'NO_DEVICES_AVAILABLE'
    };
  } catch (_) {
    return { isReady: true, isConnected: false, deviceName: '', state: 'NOT_CONNECTED' };
  }
}

/**
 * Inscreve um componente para receber atualizações de estado do Cast
 */
export function subscribeCastStatus(callback) {
  stateSubscribers.add(callback);
  callback(getCastStatus());
  return () => stateSubscribers.delete(callback);
}

/**
 * Dispara a transmissão para a TV:
 * Abre o seletor nativo do navegador para o usuário escolher a Smart TV / Chromecast
 * e envia o link e metadados diretamente para a tela da TV.
 */
export async function startCastMedia({ streamUrl, item = {}, isLive = false, videoElement = null }) {
  if (!streamUrl) {
    throw new Error('Nenhuma URL de vídeo para transmitir.');
  }

  // 1. Tenta Google Cast nativo (Chrome, Edge, Android Chrome, Google TV, Chromecast)
  if (window.cast && window.cast.framework && castContextInstance) {
    try {
      // Abre a janela nativa do navegador listando as Smart TVs da casa
      await castContextInstance.requestSession();
      const session = castContextInstance.getCurrentSession();
      
      if (!session) {
        throw new Error('Nenhuma Smart TV conectada.');
      }

      const contentType = streamUrl.includes('.mp4') ? 'video/mp4' : 'application/x-mpegURL';
      const mediaInfo = new window.chrome.cast.media.MediaInfo(streamUrl, contentType);

      mediaInfo.streamType = isLive 
        ? window.chrome.cast.media.StreamType.LIVE 
        : window.chrome.cast.media.StreamType.BUFFERED;

      const metadata = new window.chrome.cast.media.GenericMediaMetadata();
      metadata.title = item.name || item.cleanTitle || item.title || 'CineStream TV';
      metadata.subtitle = item.category || (item.year ? `(${item.year})` : (isLive ? 'Ao Vivo' : 'Transmissão'));

      const poster = item.poster || item.logo || item.backdrop;
      if (poster) {
        metadata.images = [new window.chrome.cast.Image(poster)];
      }

      mediaInfo.metadata = metadata;

      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      request.autoplay = true;

      await session.loadMedia(request);
      notifySubscribers();

      return {
        success: true,
        type: 'google_cast',
        device: session.getCastDevice()?.friendlyName || 'Smart TV'
      };
    } catch (err) {
      if (err === 'cancel' || err?.message?.includes('cancel')) {
        return { cancelled: true };
      }
      console.warn('Erro ao iniciar Google Cast:', err);
      // Se falhar o Google Cast, tenta fallback abaixo
    }
  }

  // 2. Fallback Apple AirPlay (Safari no iPhone, iPad ou Mac)
  if (videoElement && typeof videoElement.webkitShowPlaybackTargetPicker === 'function') {
    try {
      videoElement.webkitShowPlaybackTargetPicker();
      return { success: true, type: 'airplay' };
    } catch (airplayErr) {
      console.warn('Erro no seletor AirPlay:', airplayErr);
    }
  }

  // 3. Fallback Remote Playback API nativa
  if (videoElement && videoElement.remote && typeof videoElement.remote.prompt === 'function') {
    try {
      await videoElement.remote.prompt();
      return { success: true, type: 'remote_playback' };
    } catch (remoteErr) {
      console.warn('Erro Remote Playback API:', remoteErr);
    }
  }

  // Se nenhum método nativo estiver disponível no navegador atual
  throw new Error('Nenhum seletor de transmissão automática suportado neste navegador. Use o menu de 3 pontos do navegador ou abra o link na TV.');
}

/**
 * Encerra a transmissão na TV
 */
export function stopCastSession() {
  if (castContextInstance) {
    try {
      castContextInstance.endCurrentSession(true);
      notifySubscribers();
    } catch (err) {
      console.warn('Erro ao encerrar sessão de transmissão:', err);
    }
  }
}

/**
 * Pausa ou retoma o vídeo na TV
 */
export function toggleCastPlayPause() {
  if (!castContextInstance) return;
  try {
    const session = castContextInstance.getCurrentSession();
    const mediaSession = session?.getMediaSession();
    if (!mediaSession) return;

    if (mediaSession.playerState === window.chrome.cast.media.PlayerState.PLAYING) {
      mediaSession.pause(null);
    } else {
      mediaSession.play(null);
    }
  } catch (err) {
    console.warn('Erro ao alternar reprodução na TV:', err);
  }
}
