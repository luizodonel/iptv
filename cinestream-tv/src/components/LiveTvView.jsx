import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Hls from 'hls.js';
import { toSafeStreamUrl, SafeStreamLoader } from '../services/proxyService';
import { 
  Tv, 
  Trophy, 
  Film, 
  Radio, 
  Compass, 
  Sparkles, 
  Clock, 
  Music, 
  Star, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  X, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  RefreshCw, 
  Layers, 
  Check, 
  AlertCircle,
  PictureInPicture,
  Flame,
  Baby,
  Newspaper,
  Scan,
  Maximize2
} from 'lucide-react';

// Category metadata with icons and colors
const CATEGORY_CONFIG = {
  'Favoritos': { icon: Star, color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
  'TV Aberta': { icon: Tv, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  'Esportes': { icon: Trophy, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  'Filmes e Séries': { icon: Film, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  'Notícias': { icon: Newspaper, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  'Documentários': { icon: Compass, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  'Infantil': { icon: Baby, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  'Variedades': { icon: Sparkles, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
  'PPV': { icon: Flame, color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
  '24 Horas': { icon: Clock, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  'Músicas': { icon: Music, color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)' }
};

const CATEGORY_ORDER = [
  'Favoritos',
  'TV Aberta',
  'Esportes',
  'Filmes e Séries',
  'Notícias',
  'Documentários',
  'Infantil',
  'Variedades',
  'PPV',
  '24 Horas',
  'Músicas'
];

export default function LiveTvView({ 
  channels = [], 
  favs = { channels: [] }, 
  onToggleFav,
  initialChannel = null
}) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track open/collapsed categories
  const [openCategories, setOpenCategories] = useState({
    'TV Aberta': true,
    'Esportes': false,
    'Filmes e Séries': false,
    'Favoritos': true
  });

  // Group and sort channels by category (alphabetical within each category)
  const categorizedChannels = useMemo(() => {
    const groups = new Map();

    // 1. Favoritos group
    const favIds = new Set(favs.channels.map(c => typeof c === 'string' ? c : c.id));
    const favChannels = channels
      .filter(ch => favIds.has(ch.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

    if (favChannels.length > 0) {
      groups.set('Favoritos', favChannels);
    }

    // 2. Standard categories
    CATEGORY_ORDER.forEach(cat => {
      if (cat === 'Favoritos') return;
      const list = channels
        .filter(ch => ch.category === cat)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

      if (list.length > 0) {
        groups.set(cat, list);
      }
    });

    // 3. Catch any other categories not in predefined list
    channels.forEach(ch => {
      const cat = ch.category || 'Outros';
      if (!groups.has(cat) && cat !== 'Favoritos') {
        const list = channels
          .filter(c => c.category === cat)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
        groups.set(cat, list);
      }
    });

    return groups;
  }, [channels, favs.channels]);

  // Initial active channel: pick Band, Globo, or first available from TV Aberta
  const [activeChannel, setActiveChannel] = useState(() => {
    if (initialChannel) return initialChannel;
    const tvAberta = channels.filter(c => c.category === 'TV Aberta');
    return tvAberta.find(c => c.name.toLowerCase().includes('band')) || 
           tvAberta.find(c => c.name.toLowerCase().includes('globo')) || 
           channels[0] || null;
  });

  // Sync if initialChannel changes
  useEffect(() => {
    if (initialChannel) {
      setActiveChannel(initialChannel);
      // Automatically expand that channel's category
      if (initialChannel.category) {
        setOpenCategories(prev => ({ ...prev, [initialChannel.category]: true }));
      }
    }
  }, [initialChannel]);

  // When searching, auto-expand categories that have matches
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const q = searchQuery.toLowerCase().trim();
      const newOpen = {};
      categorizedChannels.forEach((list, cat) => {
        const hasMatch = list.some(ch => ch.name.toLowerCase().includes(q));
        if (hasMatch) newOpen[cat] = true;
      });
      setOpenCategories(prev => ({ ...prev, ...newOpen }));
    }
  }, [searchQuery, categorizedChannels]);

  const toggleCategory = (catName) => {
    setOpenCategories(prev => {
      const isCurrentlyOpen = !!prev[catName];
      if (isCurrentlyOpen) {
        return { ...prev, [catName]: false };
      }
      // Exclusive accordion: close others and open the selected one
      return { [catName]: true };
    });
  };

  // Player state
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerContainerRef = useRef(null);
  const screenWrapperRef = useRef(null);

  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);
  const [fitMode, setFitMode] = useState('contain'); // 'contain' (original) or 'cover' (preencher toda a tela)
  const [showControls, setShowControls] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const controlsTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const lastTapRef = useRef(0);

  // Reset when active channel changes
  useEffect(() => {
    setCurrentSourceIndex(0);
    setErrorMsg('');
    setAutoplayBlocked(false);
  }, [activeChannel?.id]);

  const sources = activeChannel?.sources || [];
  const currentSource = sources[currentSourceIndex] || null;
  const streamUrl = typeof currentSource === 'string' ? currentSource : currentSource?.url;

  const handleFailover = useCallback(() => {
    setCurrentSourceIndex(prevIdx => {
      const nextIdx = prevIdx + 1;
      if (nextIdx < sources.length) {
        console.log(`Fonte ${prevIdx + 1} falhou. Tentando servidor ${nextIdx + 1}...`);
        return nextIdx;
      }
      setIsLoading(false);
      setErrorMsg('Nenhuma fonte disponível funcionou para este canal no momento.');
      return prevIdx;
    });
  }, [sources.length]);

  // Load and play HLS stream
  const loadStream = useCallback((url, source = null) => {
    if (!url || !videoRef.current) return;

    setIsLoading(true);
    setErrorMsg('');
    setAutoplayBlocked(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    const safeUrl = toSafeStreamUrl(url, source?.referer, source?.agent);
    const isHlsUrl = url.includes('.m3u8') || url.includes('/live/') || safeUrl.includes('.m3u8') || safeUrl.includes('/api/proxy');

    const attemptPlay = () => {
      setIsLoading(false);
      video.play().then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      }).catch(err => {
        // Autoplay policy prevented playback with audio
        if (err.name === 'NotAllowedError') {
          console.warn('Autoplay blocked with sound. Retrying muted...');
          video.muted = true;
          setIsMuted(true);
          video.play().then(() => {
            setIsPlaying(true);
            setAutoplayBlocked(true);
          }).catch(() => {
            setIsPlaying(false);
          });
        } else {
          setIsPlaying(false);
        }
      });
    };

    if (isHlsUrl && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        loader: SafeStreamLoader,
        pLoader: SafeStreamLoader,
        fLoader: SafeStreamLoader,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 2,
        levelLoadingTimeOut: 15000,
        fragLoadingTimeOut: 20000
      });

      hlsRef.current = hls;
      hls.loadSource(safeUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        attemptPlay();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn('HLS stream fatal error:', data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              handleFailover();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              handleFailover();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = safeUrl;
      attemptPlay();
    } else {
      video.src = safeUrl;
      video.load();
      attemptPlay();
    }
  }, [handleFailover, sources.length]);

  useEffect(() => {
    if (streamUrl) {
      loadStream(streamUrl, currentSource);
    } else {
      setIsLoading(false);
      setErrorMsg('Nenhuma URL de transmissão válida encontrada para este canal.');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, currentSource, loadStream]);

  // Video Controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const unmuteAudio = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = false;
    setIsMuted(false);
    setAutoplayBlocked(false);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) setAutoplayBlocked(false);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
      if (val > 0) setAutoplayBlocked(false);
    }
  };

  // Handle fullscreen change events across all browsers and devices
  useEffect(() => {
    const handleFsChange = () => {
      const fsElement = document.fullscreenElement || 
                        document.webkitFullscreenElement || 
                        document.mozFullScreenElement || 
                        document.msFullscreenElement;
      const isFs = !!fsElement;
      setIsFullscreen(isFs);
      if (!isFs) {
        setIsFallbackFullscreen(false);
        if (window.screen?.orientation?.unlock) {
          window.screen.orientation.unlock().catch(() => {});
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, []);

  // Auto-hide controls after inactivity
  const handleUserActivity = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3500);
  }, [isPlaying]);

  const toggleFitMode = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setFitMode(prev => {
      const next = prev === 'contain' ? 'cover' : 'contain';
      setToastMsg(next === 'cover' ? 'Tela Preenchida (Sem Barras Pretas)' : 'Proporção Original');
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setToastMsg(''), 1800);
      return next;
    });
  };

  const handleTouch = () => {
    handleUserActivity();
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap toggles fill/fit mode
      toggleFitMode();
    }
    lastTapRef.current = now;
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    toggleFitMode();
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    // Target the video screen wrapper so info-bar and server buttons are omitted in fullscreen
    const target = screenWrapperRef.current || playerContainerRef.current;

    const isCurrentlyFs = !!(
      document.fullscreenElement || 
      document.webkitFullscreenElement || 
      document.mozFullScreenElement || 
      document.msFullscreenElement ||
      isFallbackFullscreen
    );

    if (!isCurrentlyFs) {
      const req = target?.requestFullscreen || 
                  target?.webkitRequestFullscreen || 
                  target?.mozRequestFullScreen || 
                  target?.msRequestFullscreen;

      if (req && target) {
        req.call(target).then(() => {
          setIsFullscreen(true);
          // Auto rotate to landscape on mobile devices for full immersion
          if (window.screen?.orientation?.lock) {
            window.screen.orientation.lock('landscape').catch(() => {});
          }
        }).catch((err) => {
          console.warn('requestFullscreen failed, trying webkitEnterFullscreen or CSS fallback:', err);
          if (video && video.webkitEnterFullscreen) {
            try {
              video.webkitEnterFullscreen();
              setIsFullscreen(true);
              return;
            } catch (e) {
              console.warn('webkitEnterFullscreen error:', e);
            }
          }
          // CSS fixed fallback for webviews
          setIsFallbackFullscreen(true);
          setIsFullscreen(true);
        });
      } else if (video && video.webkitEnterFullscreen) {
        try {
          video.webkitEnterFullscreen();
          setIsFullscreen(true);
        } catch (e) {
          setIsFallbackFullscreen(true);
          setIsFullscreen(true);
        }
      } else {
        setIsFallbackFullscreen(true);
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen().catch(() => {});
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen().catch(() => {});
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen().catch(() => {});
      }

      if (window.screen?.orientation?.unlock) {
        window.screen.orientation.unlock().catch(() => {});
      }

      setIsFallbackFullscreen(false);
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP not supported or denied', e);
    }
  };

  const isCurrentFav = activeChannel ? favs.channels.some(c => 
    typeof c === 'string' ? c === activeChannel.id : c.id === activeChannel.id
  ) : false;

  return (
    <div className="livetv-layout-container">
      {/* ==================== LISTA LATERAL CATEGORIZADA ==================== */}
      <aside className="livetv-sidebar glass-panel">
        
        {/* Sidebar Header & Search */}
        <div className="livetv-sidebar-header">
          <div className="livetv-header-title-row">
            <div className="livetv-title-tag">
              <Radio size={16} className="text-accent" />
              <span>Categorias de Canais</span>
            </div>
            <span className="livetv-badge-count">{channels.length} canais</span>
          </div>

          {/* Search channel */}
          <div className="livetv-search-box">
            <Search size={16} className="search-box-icon" />
            <input 
              type="text" 
              placeholder="Buscar canal por nome..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="livetv-search-input"
            />
            {searchQuery && (
              <button className="search-clear-mini" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Categories Accordion List */}
        <div className="livetv-accordion-wrapper">
          {Array.from(categorizedChannels.entries()).map(([categoryName, channelList]) => {
            const config = CATEGORY_CONFIG[categoryName] || { 
              icon: Tv, 
              color: '#94a3b8', 
              bg: 'rgba(255, 255, 255, 0.08)' 
            };
            const CategoryIcon = config.icon;
            const isOpen = !!openCategories[categoryName];

            // Filter channels if searching
            const filteredList = searchQuery.trim()
              ? channelList.filter(ch => ch.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
              : channelList;

            // Hide category if searching and has 0 matches
            if (searchQuery.trim() && filteredList.length === 0) {
              return null;
            }

            return (
              <div key={categoryName} className="category-accordion-group">
                {/* Category Header Button */}
                <button 
                  className={`category-header-btn ${isOpen ? 'is-open' : ''}`}
                  onClick={() => toggleCategory(categoryName)}
                >
                  <div className="category-btn-left">
                    <div 
                      className="category-icon-bubble"
                      style={{ color: config.color, background: config.bg }}
                    >
                      <CategoryIcon size={16} />
                    </div>
                    <span className="category-header-name">{categoryName}</span>
                  </div>

                  <div className="category-btn-right">
                    <span className="category-channel-counter">
                      {filteredList.length}
                    </span>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>

                {/* Sub-list of Channels (A-Z) */}
                {isOpen && (
                  <div className="category-subchannels-list">
                    {filteredList.map(channel => {
                      const isSelected = activeChannel?.id === channel.id;
                      const isFav = favs.channels.some(c => 
                        typeof c === 'string' ? c === channel.id : c.id === channel.id
                      );

                      return (
                        <div 
                          key={channel.id}
                          className={`subchannel-item ${isSelected ? 'active-playing' : ''}`}
                          onClick={() => setActiveChannel(channel)}
                          id={`sub-ch-${channel.id}`}
                        >
                          {/* Channel Logo */}
                          <div className="subchannel-logo-wrap">
                            {channel.logo ? (
                              <img 
                                src={channel.logo} 
                                alt={channel.name} 
                                className="subchannel-logo"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <Tv size={16} className="subchannel-fallback-icon" />
                            )}
                          </div>

                          {/* Channel Title & Sources */}
                          <div className="subchannel-info">
                            <span className="subchannel-name">{channel.name}</span>
                            <div className="subchannel-meta">
                              <span className="subchannel-sources-count">
                                {channel.sources?.length || 1} {channel.sources?.length === 1 ? 'fonte' : 'fontes'}
                              </span>
                            </div>
                          </div>

                          {/* Live Equalizer indicator when selected */}
                          {isSelected && (
                            <span className="playing-pulse-indicator">
                              <span className="bar bar-1"></span>
                              <span className="bar bar-2"></span>
                              <span className="bar bar-3"></span>
                            </span>
                          )}

                          {/* Favorite button */}
                          <button 
                            className={`subchannel-fav-btn ${isFav ? 'is-fav' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFav(channel);
                            }}
                            title={isFav ? "Remover dos favoritos" : "Favoritar canal"}
                          >
                            <Star size={14} fill={isFav ? '#eab308' : 'none'} color={isFav ? '#eab308' : '#71717a'} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ==================== CENTRO: TV JÁ RODANDO ==================== */}
      <section className="livetv-main-stage">
        {activeChannel ? (
          <div className="livetv-player-container glass-card" ref={playerContainerRef}>
            
            {/* The Video Screen (Occupies entire display on fullscreen) */}
            <div 
              ref={screenWrapperRef}
              className={`livetv-video-screen-wrapper ${isFullscreen ? 'is-fullscreen' : ''} ${isFallbackFullscreen ? 'is-fullscreen-fallback' : ''}`}
              onMouseMove={handleUserActivity}
              onTouchStart={handleTouch}
              onDoubleClick={handleDoubleClick}
            >
              <video 
                ref={videoRef}
                className={`livetv-video-element fit-${fitMode}`}
                playsInline
                autoPlay
                onWaiting={() => setIsLoading(true)}
                onPlaying={() => { setIsLoading(false); setIsPlaying(true); }}
                onPause={() => setIsPlaying(false)}
                onError={handleFailover}
                onClick={togglePlay}
              />

              {/* Toast Pill Notification (Ajustar / Preencher Tela) */}
              {toastMsg && (
                <div className="livetv-toast-pill">
                  <Scan size={16} />
                  <span>{toastMsg}</span>
                </div>
              )}

              {/* Autoplay Muted Notification Banner */}
              {autoplayBlocked && (
                <div className="livetv-unmute-floating-banner" onClick={unmuteAudio}>
                  <VolumeX size={18} />
                  <span>Vídeo iniciado sem som. <strong>Clique para ativar o áudio</strong></span>
                </div>
              )}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="livetv-screen-loading">
                  <div className="player-spinner"></div>
                  <span className="livetv-loading-title">Carregando {activeChannel.name}...</span>
                  <span className="livetv-loading-sub">Conectando ao servidor de transmissão ao vivo</span>
                </div>
              )}

              {/* Error overlay */}
              {errorMsg && (
                <div className="livetv-screen-error">
                  <AlertCircle size={44} color="#ef4444" />
                  <h3>Erro na Transmissão</h3>
                  <p>{errorMsg}</p>
                  {sources.length > 1 && (
                    <button 
                      className="btn-retry-livetv"
                      onClick={() => {
                        const next = (currentSourceIndex + 1) % sources.length;
                        setCurrentSourceIndex(next);
                      }}
                    >
                      <RefreshCw size={16} /> Tentar Próxima Fonte ({currentSourceIndex + 1}/{sources.length})
                    </button>
                  )}
                </div>
              )}

              {/* Player Floating Controls (auto-hide on inactivity, shown on touch / hover) */}
              <div className={`livetv-screen-overlay-controls ${showControls ? 'visible' : ''}`}>
                <div className="screen-controls-top">
                  <div className="screen-live-tag">
                    <Radio size={14} className="live-icon-dot" />
                    <span>AO VIVO</span>
                  </div>
                  <span className="screen-channel-title">{activeChannel.name}</span>
                </div>

                <div className="screen-controls-bottom">
                  <div className="screen-ctrl-left">
                    <button className="ctrl-btn-round" onClick={togglePlay} title={isPlaying ? "Pausar" : "Reproduzir"}>
                      {isPlaying ? <Pause size={20} /> : <Play size={20} fill="#fff" />}
                    </button>

                    <div className="ctrl-volume-wrap">
                      <button className="ctrl-btn-ghost" onClick={toggleMute} title="Mudo">
                        {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={isMuted ? 0 : volume} 
                        onChange={handleVolumeChange}
                        className="ctrl-volume-slider"
                      />
                    </div>
                  </div>

                  <div className="screen-ctrl-right">
                    {/* Botão de Preencher Toda a Tela (sem barras pretas em celulares e tablets) */}
                    <button 
                      className={`ctrl-btn-ghost ${fitMode === 'cover' ? 'is-active-btn' : ''}`}
                      onClick={toggleFitMode}
                      title={fitMode === 'cover' ? "Ajustar à Tela (Original)" : "Preencher Toda a Tela (Sem Barras Pretas)"}
                    >
                      <Scan size={18} />
                      <span className="ctrl-btn-label-text">{fitMode === 'cover' ? 'Preenchido' : 'Ajustar'}</span>
                    </button>

                    <button className="ctrl-btn-ghost" onClick={togglePiP} title="Picture in Picture">
                      <PictureInPicture size={18} />
                    </button>

                    <button className="ctrl-btn-ghost" onClick={toggleFullscreen} title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia (Ocupar Todo Dispositivo)"}>
                      {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Video Info Bar */}
            <div className="livetv-info-bar">
              <div className="info-bar-left">
                <div className="info-bar-logo-wrap">
                  {activeChannel.logo ? (
                    <img 
                      src={activeChannel.logo} 
                      alt={activeChannel.name} 
                      className="info-bar-logo"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <Tv size={28} />
                  )}
                </div>

                <div className="info-bar-meta">
                  <div className="info-bar-title-row">
                    <h2 className="info-bar-title">{activeChannel.name}</h2>
                    <span className="badge-category">{activeChannel.category}</span>
                    <span className="badge-quality">{currentSource?.quality || 'HD'}</span>
                  </div>
                  <span className="info-bar-status">
                    <span className="live-dot-pulse"></span> Transmissão ao vivo em tempo real
                  </span>
                </div>
              </div>

              <div className="info-bar-right">
                {/* Favorite Action */}
                <button 
                  className={`btn-livetv-action ${isCurrentFav ? 'is-fav' : ''}`}
                  onClick={() => onToggleFav(activeChannel)}
                  title={isCurrentFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                >
                  <Star size={16} fill={isCurrentFav ? '#eab308' : 'none'} color={isCurrentFav ? '#eab308' : '#fff'} />
                  <span>{isCurrentFav ? 'Favoritado' : 'Favoritar'}</span>
                </button>

                {/* Reload Stream */}
                <button 
                  className="btn-livetv-action"
                  onClick={() => loadStream(streamUrl)}
                  title="Recarregar transmissão"
                >
                  <RefreshCw size={16} />
                  <span>Recarregar</span>
                </button>
              </div>
            </div>

            {/* Source Servers Selector Pills */}
            {sources.length > 1 && (
              <div className="livetv-sources-selector-row">
                <div className="sources-label">
                  <Layers size={14} />
                  <span>Servidores Disponíveis:</span>
                </div>
                <div className="sources-pills-list">
                  {sources.map((src, idx) => (
                    <button
                      key={idx}
                      className={`source-server-chip ${currentSourceIndex === idx ? 'active' : ''}`}
                      onClick={() => setCurrentSourceIndex(idx)}
                    >
                      {currentSourceIndex === idx && <Check size={13} className="chip-check" />}
                      <span>{src.quality || `Servidor ${idx + 1}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="livetv-no-channel-selected glass-panel">
            <Tv size={56} className="text-secondary" />
            <h2>Selecione um canal na categoria lateral</h2>
            <p>Escolha qualquer categoria (TV Aberta, Esportes, Filmes...) e clique em um canal para iniciar.</p>
          </div>
        )}
      </section>
    </div>
  );
}
