import React, { useState, useEffect } from 'react';
import { 
  Tv, 
  Cast, 
  Radio, 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Sparkles, 
  Smartphone, 
  Play, 
  Square, 
  Pause,
  Wifi,
  Cast as CastIcon,
  HelpCircle
} from 'lucide-react';
import { 
  startCastMedia, 
  stopCastSession, 
  toggleCastPlayPause, 
  subscribeCastStatus 
} from '../services/castService';

export default function CastToTvModal({ 
  isOpen, 
  onClose, 
  item, 
  streamUrl, 
  videoElement 
}) {
  const [copied, setCopied] = useState(false);
  const [copiedWeb, setCopiedWeb] = useState(false);
  const [activeMethod, setActiveMethod] = useState('smart'); // 'smart' | 'mirror' | 'airplay' | 'web' | 'direct'
  const [castStatus, setCastStatus] = useState('');
  const [isCasting, setIsCasting] = useState(false);
  const [castInfo, setCastInfo] = useState({
    isReady: false,
    isConnected: false,
    deviceName: '',
    state: 'NOT_CONNECTED'
  });

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = 'hidden';
    setCastStatus('');

    // Escuta atualizações do estado do Google Cast
    const unsubscribe = subscribeCastStatus((status) => {
      setCastInfo(status);
      if (status.isConnected) {
        setCastStatus(`🟢 Conectado e transmitindo para: ${status.deviceName || 'Smart TV'}`);
      }
    });

    return () => {
      document.body.style.overflow = '';
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const title = item?.name || item?.cleanTitle || item?.title || 'Conteúdo';
  const subtitle = item?.category || (item?.year ? `(${item?.year})` : 'Transmissão');
  const isLive = Boolean(item?.isLive || !item?.year);

  // URL para abrir direto no navegador da Smart TV
  const currentWebUrl = window.location.href;
  const qrCodeUrl = `https://api.quickchart.io/qr?text=${encodeURIComponent(currentWebUrl)}&size=200&dark=ffffff&light=111827`;

  // 1. Dispara o seletor nativo do Google Cast para escolher a TV
  const handleStartCast = async () => {
    setIsCasting(true);
    setCastStatus('🔍 Procurando Smart TVs no seu Wi-Fi...');
    try {
      const res = await startCastMedia({
        streamUrl,
        item,
        isLive,
        videoElement
      });

      if (res?.cancelled) {
        setCastStatus('');
      } else if (res?.success) {
        if (res.type === 'google_cast') {
          setCastStatus(`🟢 Transmitindo na TV: ${res.device || 'Smart TV'}`);
        } else if (res.type === 'airplay') {
          setCastStatus('🍏 Menu AirPlay aberto! Escolha sua Smart TV.');
        } else {
          setCastStatus('✅ Transmissão iniciada na TV!');
        }
      }
    } catch (err) {
      console.warn('Erro ao conectar com a TV:', err);
      setCastStatus(err.message || 'Não foi possível encontrar a TV. Verifique se estão no mesmo Wi-Fi.');
    } finally {
      setIsCasting(false);
    }
  };

  // 2. Desconecta da TV
  const handleStopCast = () => {
    stopCastSession();
    setCastStatus('Transmissão encerrada.');
  };

  // 3. Apple AirPlay
  const handleAirPlay = () => {
    try {
      if (videoElement && typeof videoElement.webkitShowPlaybackTargetPicker === 'function') {
        videoElement.webkitShowPlaybackTargetPicker();
        setCastStatus('🍏 Menu AirPlay aberto! Escolha sua TV.');
      } else {
        setCastStatus('⚠️ Apple AirPlay só está disponível no Safari (iPhone, iPad ou Mac). No Android ou Windows, utilize a aba "Smart TV / Cast".');
      }
    } catch (err) {
      console.warn('Erro ao disparar AirPlay:', err);
      setCastStatus('Não foi possível abrir o AirPlay.');
    }
  };

  // Copiar Stream URL
  const handleCopyStream = () => {
    if (streamUrl) {
      navigator.clipboard.writeText(streamUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  // Copiar Web URL
  const handleCopyWeb = () => {
    navigator.clipboard.writeText(currentWebUrl);
    setCopiedWeb(true);
    setTimeout(() => setCopiedWeb(false), 3000);
  };

  return (
    <div className="modal-backdrop fade-in" style={{ zIndex: 10000 }}>
      <div 
        className="cast-modal-card glass-card scale-up" 
        role="dialog" 
        aria-modal="true"
      >
        {/* Header */}
        <div className="cast-modal-header">
          <div className="cast-header-icon-wrap">
            <Tv size={26} className="text-accent" />
            <span className={`cast-pulse-signal ${castInfo.isConnected ? 'connected' : ''}`}></span>
          </div>
          <div className="cast-header-text">
            <h2 className="cast-modal-title">Transmitir para a TV</h2>
            <p className="cast-modal-sub">
              <strong>{title}</strong> {subtitle && `• ${subtitle}`}
            </p>
          </div>
          <button 
            type="button" 
            className="cast-close-btn" 
            onClick={onClose} 
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Feedback pill */}
        {castStatus && (
          <div className={`cast-status-pill ${castInfo.isConnected ? 'is-connected' : ''}`}>
            <span>{castStatus}</span>
          </div>
        )}

        {/* Card de Sessão Ativa na TV (quando já conectado) */}
        {castInfo.isConnected && (
          <div className="cast-active-device-banner">
            <div className="active-device-info">
              <Tv size={22} className="text-success" />
              <div>
                <strong>Transmitindo na TV</strong>
                <span>{castInfo.deviceName || 'Dispositivo Conectado'}</span>
              </div>
            </div>
            <div className="active-device-actions">
              <button 
                type="button"
                className="btn-cast-ctrl"
                onClick={toggleCastPlayPause}
                title="Pausar / Retomar na TV"
              >
                <Pause size={16} />
              </button>
              <button 
                type="button"
                className="btn-cast-ctrl danger"
                onClick={handleStopCast}
                title="Desconectar"
              >
                <Square size={16} />
                <span>Desconectar</span>
              </button>
            </div>
          </div>
        )}

        {/* Métodos de Transmissão */}
        <div className="cast-methods-tabs">
          <button 
            type="button"
            className={`cast-tab-btn ${activeMethod === 'smart' ? 'active' : ''}`}
            onClick={() => setActiveMethod('smart')}
          >
            <Cast size={18} />
            <span>Smart TV / Cast</span>
          </button>
          <button 
            type="button"
            className={`cast-tab-btn ${activeMethod === 'mirror' ? 'active' : ''}`}
            onClick={() => setActiveMethod('mirror')}
          >
            <Smartphone size={18} />
            <span>Espelhar Celular</span>
          </button>
          <button 
            type="button"
            className={`cast-tab-btn ${activeMethod === 'airplay' ? 'active' : ''}`}
            onClick={() => setActiveMethod('airplay')}
          >
            <Tv size={18} />
            <span>AirPlay (Apple)</span>
          </button>
          <button 
            type="button"
            className={`cast-tab-btn ${activeMethod === 'web' ? 'active' : ''}`}
            onClick={() => setActiveMethod('web')}
          >
            <QrCode size={18} />
            <span>Web TV / App</span>
          </button>
        </div>

        {/* Conteúdo da Aba Selecionada */}
        <div className="cast-tab-content">
          {/* 1. SMART TV & GOOGLE CAST */}
          {activeMethod === 'smart' && (
            <div className="cast-method-panel">
              <div className="method-instruction">
                <p>
                  Transmissão direta via <strong>Google Cast / Smart TV</strong>. 
                  Ao clicar abaixo, o navegador listará as TVs disponíveis no seu Wi-Fi para você conectar com 1 clique.
                </p>
              </div>

              {!castInfo.isConnected ? (
                <button 
                  type="button" 
                  className="btn-glow-primary cast-action-btn"
                  onClick={handleStartCast}
                  disabled={isCasting}
                >
                  <Cast size={20} className={isCasting ? 'animate-spin' : ''} />
                  <span>{isCasting ? 'Procurando Smart TVs...' : 'Conectar à Smart TV (Cast)'}</span>
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn-glow-primary cast-action-btn"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                  onClick={handleStartCast}
                >
                  <Check size={20} />
                  <span>Alterar TV Conectada</span>
                </button>
              )}

              <div className="cast-hints-box">
                <div className="hint-item">
                  <span className="hint-bullet">1.</span>
                  <span>O celular/computador e a sua Smart TV precisam estar no <strong>mesmo Wi-Fi</strong>.</span>
                </div>
                <div className="hint-item">
                  <span className="hint-bullet">2.</span>
                  <span>Compatível com <strong>Chromecast, Android TV, Google TV, TVs Philips, TCL, Samsung e LG</strong>.</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. ESPELHAR TELA DO CELULAR (SMART VIEW / TRANSMITIR ANDROID) */}
          {activeMethod === 'mirror' && (
            <div className="cast-method-panel">
              <div className="method-instruction">
                <p>
                  A forma mais rápida no celular sem precisar de navegador na TV: 
                  use a <strong>transmissão nativa do seu smartphone</strong>.
                </p>
              </div>

              <div className="cast-mirror-steps">
                <div className="mirror-step-card">
                  <div className="step-num">1</div>
                  <div className="step-content">
                    <strong>Arraste para baixo</strong>
                    <p>Puxe a barra de notificações do topo da tela do seu celular.</p>
                  </div>
                </div>

                <div className="mirror-step-card">
                  <div className="step-num">2</div>
                  <div className="step-content">
                    <strong>Toque em Transmitir / Smart View</strong>
                    <p>No <strong>Samsung</strong> é <em>Smart View</em>. Na <strong>Motorola/Xiaomi</strong> é <em>Transmitir / Emitir</em>.</p>
                  </div>
                </div>

                <div className="mirror-step-card">
                  <div className="step-num">3</div>
                  <div className="step-content">
                    <strong>Escolha sua Smart TV</strong>
                    <p>A TV aceitará na hora e a tela do filme/canal passará em tela cheia na TV!</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. APPLE AIRPLAY */}
          {activeMethod === 'airplay' && (
            <div className="cast-method-panel">
              <div className="method-instruction">
                <p>
                  Transmita via <strong>Apple AirPlay</strong> do iPhone, iPad ou Mac para Smart TVs compatíveis (Apple TV, Samsung, LG, Roku, Sony).
                </p>
              </div>

              <button 
                type="button" 
                className="btn-glow-primary cast-action-btn"
                style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
                onClick={handleAirPlay}
              >
                <Tv size={20} />
                <span>Abrir Seletor AirPlay</span>
              </button>

              <div className="cast-hints-box">
                <div className="hint-item">
                  <span className="hint-bullet">•</span>
                  <span>No iPhone, você também pode abrir a <strong>Central de Controle</strong> e tocar no ícone de dois retângulos (<strong>Espelhar a Tela</strong>).</span>
                </div>
              </div>
            </div>
          )}

          {/* 4. WEB TV & APP DE IPTV */}
          {activeMethod === 'web' && (
            <div className="cast-method-panel">
              <div className="method-instruction">
                <p>
                  Abra na Smart TV apontando a câmera para o QR Code ou use o link direto em aplicativos como <strong>IPTV Smarters, Smart IPTV ou SS IPTV</strong>:
                </p>
              </div>

              <div className="cast-qr-container">
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code para Smart TV" 
                  className="cast-qr-image"
                  loading="lazy"
                />
                <span className="qr-caption">Aponte a câmera da TV ou celular</span>
              </div>

              <div className="cast-url-copy-box">
                <span className="cast-url-text">{streamUrl || currentWebUrl}</span>
                <button 
                  type="button" 
                  className="cast-copy-btn"
                  onClick={streamUrl ? handleCopyStream : handleCopyWeb}
                >
                  {(copied || copiedWeb) ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                  <span>{(copied || copiedWeb) ? 'Copiado!' : 'Copiar Link'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cast-modal-footer">
          <button 
            type="button" 
            className="btn-outline" 
            style={{ width: '100%', padding: '12px', borderRadius: '10px' }}
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
