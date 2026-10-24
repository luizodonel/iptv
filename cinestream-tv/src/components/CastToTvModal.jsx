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
  HelpCircle,
  Smartphone,
  Monitor
} from 'lucide-react';

export default function CastToTvModal({ 
  isOpen, 
  onClose, 
  item, 
  streamUrl, 
  videoElement 
}) {
  const [copied, setCopied] = useState(false);
  const [copiedWeb, setCopiedWeb] = useState(false);
  const [activeMethod, setActiveMethod] = useState('smart'); // 'smart' | 'airplay' | 'web' | 'direct'
  const [castStatus, setCastStatus] = useState('');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setCastStatus('');
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const title = item?.name || item?.cleanTitle || item?.title || 'Conteúdo';
  const subtitle = item?.category || (item?.year ? `(${item?.year})` : 'Transmissão');

  // URL para abrir direto no navegador da Smart TV
  const currentWebUrl = window.location.href;
  const qrCodeUrl = `https://api.quickchart.io/qr?text=${encodeURIComponent(currentWebUrl)}&size=200&dark=ffffff&light=111827`;

  // 1. Google Cast / Remote Playback API
  const handleRemotePlaybackCast = async () => {
    setCastStatus('Iniciando transmissão...');
    try {
      if (videoElement && videoElement.remote && typeof videoElement.remote.prompt === 'function') {
        await videoElement.remote.prompt();
        setCastStatus('✅ Dispositivo de transmissão selecionado!');
      } else if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
        setCastStatus('Iniciando Google Cast...');
      } else {
        // Tenta Presentation API ou informa instrução
        if (navigator.presentation && navigator.presentation.defaultRequest) {
          await navigator.presentation.defaultRequest.start();
          setCastStatus('✅ Tela conectada!');
        } else {
          setCastStatus('⚠️ O seletor de transmissão automática não é suportado pelo seu navegador atual. Use o botão de três pontos do Chrome/Edge > "Transmitir" ou abra o link na TV.');
        }
      }
    } catch (err) {
      console.warn('Erro ao disparar transmissão remota:', err);
      setCastStatus('Transmissão cancelada ou não concluída.');
    }
  };

  // 2. Apple AirPlay
  const handleAirPlay = () => {
    try {
      if (videoElement && typeof videoElement.webkitShowPlaybackTargetPicker === 'function') {
        videoElement.webkitShowPlaybackTargetPicker();
        setCastStatus('🍏 Menu AirPlay aberto! Escolha sua Smart TV ou Apple TV.');
      } else {
        setCastStatus('⚠️ Apple AirPlay só está disponível no navegador Safari / iOS. No Android ou Windows, utilize a opção Chromecast ou Web TV.');
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
            <span className="cast-pulse-signal"></span>
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

        {/* Status feedback pill */}
        {castStatus && (
          <div className="cast-status-pill">
            <span>{castStatus}</span>
          </div>
        )}

        {/* Transmit Options Grid / Tabs */}
        <div className="cast-methods-tabs">
          <button 
            type="button"
            className={`cast-tab-btn ${activeMethod === 'smart' ? 'active' : ''}`}
            onClick={() => setActiveMethod('smart')}
          >
            <Cast size={18} />
            <span>Chromecast / Cast</span>
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
            <span>Web Smart TV</span>
          </button>
          <button 
            type="button"
            className={`cast-tab-btn ${activeMethod === 'direct' ? 'active' : ''}`}
            onClick={() => setActiveMethod('direct')}
          >
            <Radio size={18} />
            <span>Link Stream</span>
          </button>
        </div>

        {/* Content depending on activeMethod */}
        <div className="cast-tab-content">
          {activeMethod === 'smart' && (
            <div className="cast-method-panel">
              <div className="method-instruction">
                <p>
                  Transmita instantaneamente para <strong>Chromecast, Android TV, Google TV, Samsung ou LG Smart TV</strong> conectadas na mesma rede Wi-Fi.
                </p>
              </div>

              <button 
                type="button" 
                className="btn-glow-primary cast-action-btn"
                onClick={handleRemotePlaybackCast}
              >
                <Cast size={20} />
                <span>Iniciar Transmissão na TV</span>
              </button>

              <div className="cast-hints-box">
                <div className="hint-item">
                  <span className="hint-bullet">1.</span>
                  <span>Certifique-se de que a sua TV e o celular estão conectados no <strong>mesmo Wi-Fi</strong>.</span>
                </div>
                <div className="hint-item">
                  <span className="hint-bullet">2.</span>
                  <span>No navegador Google Chrome no celular ou PC, você também pode tocar no menu de 3 pontos ⋮ e selecionar <strong>"Transmitir..."</strong>.</span>
                </div>
              </div>
            </div>
          )}

          {activeMethod === 'airplay' && (
            <div className="cast-method-panel">
              <div className="method-instruction">
                <p>
                  Transmita via <strong>Apple AirPlay</strong> direto do iPhone, iPad ou Mac para Smart TVs compatíveis (Apple TV, Samsung, LG, Roku, Sony).
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
                  <span>Disponível nativamente no Safari no iPhone/iPad. Na central de controle do iOS, você também pode tocar em <strong>"Espelhar a Tela"</strong>.</span>
                </div>
              </div>
            </div>
          )}

          {activeMethod === 'web' && (
            <div className="cast-method-panel">
              <div className="method-instruction">
                <p>
                  Abra o navegador da sua <strong>Smart TV (Samsung Tizen, LG webOS, Fire TV, Roku)</strong> e aponte a câmera ou acesse o endereço abaixo:
                </p>
              </div>

              <div className="cast-qr-container">
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code para Smart TV" 
                  className="cast-qr-image"
                  loading="lazy"
                />
                <span className="qr-caption">Aponte a câmera ou abra na TV</span>
              </div>

              <div className="cast-url-copy-box">
                <span className="cast-url-text">{currentWebUrl}</span>
                <button 
                  type="button" 
                  className="cast-copy-btn"
                  onClick={handleCopyWeb}
                >
                  {copiedWeb ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                  <span>{copiedWeb ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          )}

          {activeMethod === 'direct' && (
            <div className="cast-method-panel">
              <div className="method-instruction">
                <p>
                  Link direto da transmissão (M3U8 / HLS) para usar em aplicativos de IPTV na sua TV (como <strong>Smart IPTV, IPTV Smarters, SS IPTV, VLC ou Kodi</strong>):
                </p>
              </div>

              <div className="cast-url-copy-box">
                <span className="cast-url-text">{streamUrl || 'URL não disponível'}</span>
                <button 
                  type="button" 
                  className="cast-copy-btn"
                  onClick={handleCopyStream}
                  disabled={!streamUrl}
                >
                  {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                  <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
                </button>
              </div>

              <div className="cast-hints-box">
                <div className="hint-item">
                  <span className="hint-bullet">•</span>
                  <span>Cole este link no campo "Adicionar URL de Transmissão" no player da sua TV.</span>
                </div>
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
