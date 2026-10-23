import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { toSafeStreamUrl, SafeStreamLoader } from '../services/proxyService';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  RotateCcw, 
  RotateCw, 
  X, 
  Tv, 
  Layers, 
  Radio, 
  SkipForward, 
  AlertCircle,
  PictureInPicture,
  Check,
  Scan
} from 'lucide-react';
import { saveWatchProgress, getSavedProgress } from '../services/storageService';

export default function VideoPlayer({ 
  item, 
  onClose, 
  allChannels = [], 
  onSwitchChannel,
  seriesEpisodes = [],
  currentEpisode = null,
  onSwitchEpisode
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const sourceTimeoutRef = useRef(null);

  // Stream state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);
  const [fitMode, setFitMode] = useState('contain'); // 'contain' (original) or 'cover' (preencher tela)
  const [toastMsg, setToastMsg] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const toastTimeoutRef = useRef(null);
  const lastTapRef = useRef(0);

  // Source selection
  const isLive = item.category !== undefined || item.sources !== undefined;
  const isSeries = item.type === 'series' || currentEpisode !== null;

  // Selected version (dub vs leg)
  const availableVersions = item.versions ? Object.keys(item.versions) : [];
  const [selectedVersion, setSelectedVersion] = useState(() => {
    if (availableVersions.length > 0) {
      return availableVersions.includes('dub') ? 'dub' : availableVersions[0];
    }
    return '';
  });

  // Collect source URLs
  const getSourcesList = useCallback(() => {
    if (isLive) {
      return item.sources || [];
    }
    if (isSeries && currentEpisode) {
      const vers = currentEpisode.versions || {};
      const urls = vers[selectedVersion] || Object.values(vers)[0] || [];
      return urls.map((u, i) => ({ url: u, quality: `Fonte ${i + 1}` }));
    }
    if (item.versions) {
      const urls = item.versions[selectedVersion] || Object.values(item.versions)[0] || [];
      return urls.map((u, i) => ({ url: u, quality: `Fonte ${i + 1}` }));
    }
    if (item.url) {
      return [{ url: item.url, quality: 'Padrão' }];
    }
    return [];
  }, [item, isLive, isSeries, currentEpisode, selectedVersion]);

  const sources = getSourcesList();
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [showChannelDrawer, setShowChannelDrawer] = useState(false);

  // Reset source index when item or version changes
  useEffect(() => {
    setCurrentSourceIndex(0);
    setErrorMsg('');
  }, [item, selectedVersion, currentEpisode]);

  // Load and play stream
  const activeSource = sources[currentSourceIndex] || null;
  const streamUrl = typeof activeSource === 'string' ? activeSource : activeSource?.url;

  const clearSourceTimeout = useCallback(() => {
    if (sourceTimeoutRef.current) {
      clearTimeout(sourceTimeoutRef.current);
      sourceTimeoutRef.current = null;
    }
  }, []);

  const handleSourceFail = useCallback(() => {
    clearSourceTimeout();
    setCurrentSourceIndex(prevIdx => {
      const nextIdx = prevIdx + 1;
      if (nextIdx < sources.length) {
        console.log(`Fonte ${prevIdx + 1} falhou. Alternando para fonte ${nextIdx + 1}...`);
        return nextIdx;
      }
      setIsLoading(false);
      setErrorMsg('Todas as fontes deste conteúdo falharam ou estão indisponíveis no momento.');
      return prevIdx;
    });
  }, [sources.length, clearSourceTimeout]);

  const loadStream = useCallback((url, source = null) => {
    if (!url || !videoRef.current) return;

    setIsLoading(true);
    setErrorMsg('');
    clearSourceTimeout();

    // Timeout de 8.5s para failover automático caso a fonte demore
    sourceTimeoutRef.current = setTimeout(() => {
      console.warn('Fonte atual demorou mais de 8.5s para responder. Alternando para a próxima...');
      handleSourceFail();
    }, 8500);

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    const safeUrl = toSafeStreamUrl(url, source?.referer, source?.agent);

    const lowerUrl = (url || '').toLowerCase();
    const lowerSafe = (safeUrl || '').toLowerCase();

    // Direct video formats (MP4, MKV, WebM, etc.) must use native video element
    const isDirectVideo = (
      lowerUrl.includes('.mp4') || 
      lowerUrl.includes('.mkv') || 
      lowerUrl.includes('.webm') || 
      lowerUrl.includes('.avi') ||
      lowerSafe.includes('.mp4')
    );

    // HLS playlists (.m3u8, /live/ streams, master.txt)
    const isHlsUrl = !isDirectVideo && (
      lowerUrl.includes('.m3u8') || 
      lowerUrl.includes('/live/') || 
      lowerUrl.includes('master.txt') || 
      lowerSafe.includes('.m3u8') ||
      lowerSafe.includes('master.txt')
    );

    if (isHlsUrl) {
      if (Hls.isSupported()) {
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
          clearSourceTimeout();
          setIsLoading(false);
          video.play().catch(() => {
            setIsPlaying(false);
            setIsLoading(false);
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            clearSourceTimeout();
            console.warn('HLS fatal error encountered:', data.details);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                handleSourceFail();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                handleSourceFail();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari/iOS)
        video.src = safeUrl;
        video.play().catch(() => {
          clearSourceTimeout();
          setIsPlaying(false);
          setIsLoading(false);
        });
      } else {
        clearSourceTimeout();
        setErrorMsg('Seu navegador não suporta reprodução HLS nativa.');
      }
    } else {
      // Direct MP4 or standard video
      video.src = safeUrl;
      video.load();

      // Resume watch progress if available
      const savedTime = getSavedProgress(item.id);
      if (savedTime > 0) {
        video.currentTime = savedTime;
      }

      video.play()
        .then(() => {
          clearSourceTimeout();
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(err => {
          console.warn('Autoplay bloqueado pelo navegador, aguardando interação do usuário:', err);
          clearSourceTimeout();
          setIsPlaying(false);
          setIsLoading(false);
        });
    }
  }, [handleSourceFail, clearSourceTimeout, item.id]);

  useEffect(() => {
    if (streamUrl) {
      loadStream(streamUrl, activeSource);
    } else {
      clearSourceTimeout();
      setIsLoading(false);
      setErrorMsg('Nenhuma URL de transmissão válida encontrada para este item.');
    }

    return () => {
      clearSourceTimeout();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, activeSource, loadStream, clearSourceTimeout]);

  // Video event listeners
  const onTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(curr);
    setDuration(dur);

    if (!isLive && dur > 0 && Math.floor(curr) % 5 === 0) {
      saveWatchProgress(item, curr, dur);
    }
  };

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

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const seek = (seconds) => {
    if (!videoRef.current || isLive) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
  };

  const handleProgressChange = (e) => {
    if (!videoRef.current || isLive) return;
    const val = parseFloat(e.target.value);
    videoRef.current.currentTime = val;
    setCurrentTime(val);
  };

  // Handle fullscreen change events across all devices & browsers
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
    handleMouseMove();
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
    const target = containerRef.current;

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seek(10);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seek(-10);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (videoRef.current) {
          const newVol = Math.min(1, volume + 0.1);
          setVolume(newVol);
          videoRef.current.volume = newVol;
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (videoRef.current) {
          const newVol = Math.max(0, volume - 0.1);
          setVolume(newVol);
          videoRef.current.volume = newVol;
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, isFullscreen, isLive, duration, onClose]);

  // Auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSourceMenu(false);
      }
    }, 3500);
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === Infinity) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const h = Math.floor(m / 60);
    if (h > 0) {
      const remM = m % 60;
      return `${h}:${remM < 10 ? '0' : ''}${remM}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div 
      className={`video-player-overlay ${isFullscreen ? 'is-fullscreen' : ''} ${isFallbackFullscreen ? 'is-fullscreen-fallback' : ''}`}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouch}
      onDoubleClick={handleDoubleClick}
    >
      <video
        ref={videoRef}
        className={`main-video-element fit-${fitMode}`}
        playsInline
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={() => { clearSourceTimeout(); setIsLoading(false); }}
        onCanPlay={() => { clearSourceTimeout(); setIsLoading(false); }}
        onLoadedData={() => { clearSourceTimeout(); setIsLoading(false); }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => { clearSourceTimeout(); setIsLoading(false); setIsPlaying(true); }}
        onPause={() => setIsPlaying(false)}
        onError={() => { clearSourceTimeout(); handleSourceFail(); }}
        onClick={togglePlay}
      />

      {/* Center Play Button when paused and not loading */}
      {!isPlaying && !isLoading && !errorMsg && (
        <div className="center-play-trigger" onClick={togglePlay}>
          <div className="center-play-circle pulse-hover">
            <Play size={40} fill="#ffffff" color="#ffffff" />
          </div>
        </div>
      )}

      {/* Toast Notification Pill (Ajustar / Preencher Tela) */}
      {toastMsg && (
        <div className="livetv-toast-pill">
          <Scan size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <div className="player-loading-backdrop">
          <div className="player-spinner"></div>
          <span className="player-loading-text">Carregando transmissão...</span>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="player-error-backdrop">
          <AlertCircle size={48} color="#ef4444" />
          <h3 className="error-title">Erro na Reprodução</h3>
          <p className="error-desc">{errorMsg}</p>
          <div className="error-actions">
            {sources.length > 1 && (
              <button 
                className="btn-retry"
                onClick={() => {
                  const next = (currentSourceIndex + 1) % sources.length;
                  setCurrentSourceIndex(next);
                }}
              >
                Tentar Outra Fonte ({currentSourceIndex + 1}/{sources.length})
              </button>
            )}
            <button className="btn-close-error" onClick={onClose}>Fechar Player</button>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div className={`player-controls-wrap ${showControls ? 'visible' : 'hidden'}`}>
        
        {/* Top Header Bar */}
        <div className="player-top-bar">
          <div className="player-header-title">
            {isLive ? (
              <div className="title-row">
                <span className="live-badge-glow"><Radio size={14} /> AO VIVO</span>
                <span className="player-title">{item.name || item.title}</span>
                <span className="player-sub">{item.category}</span>
              </div>
            ) : (
              <div className="title-row">
                <span className="player-title">{item.cleanTitle || item.title}</span>
                {isSeries && currentEpisode && (
                  <span className="player-sub">T{currentEpisode.season} : E{currentEpisode.episode}</span>
                )}
                {item.year && <span className="player-year">({item.year})</span>}
              </div>
            )}
          </div>

          <div className="player-top-actions">
            {/* Version Switcher (Dublado / Legendado) */}
            {availableVersions.length > 1 && (
              <div className="version-pill-group">
                {availableVersions.map(ver => (
                  <button
                    key={ver}
                    className={`version-pill ${selectedVersion === ver ? 'active' : ''}`}
                    onClick={() => setSelectedVersion(ver)}
                  >
                    {ver.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {/* Source Selector Menu */}
            {sources.length > 1 && (
              <div className="source-menu-wrapper">
                <button 
                  className="player-top-btn"
                  onClick={() => setShowSourceMenu(!showSourceMenu)}
                  title="Trocar Fonte de Vídeo"
                >
                  <Layers size={18} />
                  <span>Fonte {currentSourceIndex + 1}/{sources.length}</span>
                </button>

                {showSourceMenu && (
                  <div className="source-dropdown glass-panel">
                    <div className="dropdown-header">Escolha a Fonte:</div>
                    {sources.map((s, idx) => (
                      <button
                        key={idx}
                        className={`source-option-btn ${currentSourceIndex === idx ? 'active' : ''}`}
                        onClick={() => {
                          setCurrentSourceIndex(idx);
                          setShowSourceMenu(false);
                        }}
                      >
                        <span>{s.quality || `Fonte ${idx + 1}`}</span>
                        {currentSourceIndex === idx && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Channel List Drawer for Live TV */}
            {isLive && allChannels.length > 0 && (
              <button 
                className="player-top-btn"
                onClick={() => setShowChannelDrawer(!showChannelDrawer)}
                title="Lista de Canais"
              >
                <Tv size={18} />
                <span>Canais</span>
              </button>
            )}

            {/* Close Button */}
            <button className="player-top-btn btn-close-x" onClick={onClose} title="Fechar (Esc)">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Live TV Channels Quick Drawer */}
        {showChannelDrawer && isLive && (
          <div className="player-channels-drawer glass-panel">
            <div className="drawer-header">
              <h3>Canais ({allChannels.length})</h3>
              <button onClick={() => setShowChannelDrawer(false)}><X size={18} /></button>
            </div>
            <div className="drawer-channel-list">
              {allChannels.map(ch => (
                <div 
                  key={ch.id} 
                  className={`drawer-channel-item ${ch.id === item.id ? 'active' : ''}`}
                  onClick={() => {
                    onSwitchChannel(ch);
                    setShowChannelDrawer(false);
                  }}
                >
                  {ch.logo ? (
                    <img src={ch.logo} alt={ch.name} className="drawer-ch-logo" />
                  ) : (
                    <Tv size={20} />
                  )}
                  <span className="drawer-ch-name">{ch.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Control Bar */}
        <div className="player-bottom-bar">
          {/* Progress bar for VOD */}
          {!isLive && (
            <div className="player-progress-container">
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={handleProgressChange}
                className="player-progress-slider"
              />
              <div 
                className="player-progress-fill" 
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
          )}

          <div className="player-controls-row">
            <div className="controls-left">
              <button className="control-btn main-play-btn" onClick={togglePlay}>
                {isPlaying ? <Pause size={22} /> : <Play size={22} fill="#fff" />}
              </button>

              {!isLive && (
                <>
                  <button className="control-btn" onClick={() => seek(-10)} title="Voltar 10s">
                    <RotateCcw size={18} />
                  </button>
                  <button className="control-btn" onClick={() => seek(10)} title="Avançar 10s">
                    <RotateCw size={18} />
                  </button>
                </>
              )}

              {/* Volume Slider */}
              <div className="volume-control-group">
                <button className="control-btn" onClick={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={isMuted ? 0 : volume} 
                  onChange={handleVolumeChange}
                  className="volume-slider"
                />
              </div>

              {/* Time display */}
              <div className="time-display">
                {isLive ? (
                  <span className="live-indicator-pill">
                    <span className="live-dot-pulse"></span> AO VIVO
                  </span>
                ) : (
                  <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                )}
              </div>
            </div>

            <div className="controls-right">
              {/* Next Episode Button */}
              {isSeries && seriesEpisodes.length > 0 && onSwitchEpisode && (
                <button 
                  className="control-btn" 
                  onClick={onSwitchEpisode}
                  title="Próximo Episódio"
                >
                  <SkipForward size={18} />
                  <span className="btn-label-desktop">Próximo Ep</span>
                </button>
              )}

              {/* Preencher Tela / Ajustar Proporção */}
              <button 
                className={`control-btn ${fitMode === 'cover' ? 'is-active-btn' : ''}`} 
                onClick={toggleFitMode} 
                title={fitMode === 'cover' ? "Ajustar à Tela (Original)" : "Preencher Toda a Tela (Sem Barras Pretas)"}
              >
                <Scan size={18} />
              </button>

              {/* PiP Button */}
              <button className="control-btn" onClick={togglePiP} title="Picture in Picture">
                <PictureInPicture size={18} />
              </button>

              {/* Fullscreen Button */}
              <button className="control-btn" onClick={toggleFullscreen} title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia (Ocupar Todo Dispositivo)"}>
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
