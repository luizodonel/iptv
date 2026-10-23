import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Star, 
  X, 
  Clock, 
  Calendar, 
  Film, 
  Clapperboard, 
  Check, 
  Bookmark,
  Tv,
  ListFilter
} from 'lucide-react';
import { getSeriesEpisodes, resolveMediaItem } from '../services/vodService';

export default function MediaModal({ 
  item, 
  onClose, 
  isFav, 
  onToggleFav, 
  onPlayMedia 
}) {
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedVersion, setSelectedVersion] = useState('dub');

  const isSeries = item.type === 'series';

  useEffect(() => {
    if (isSeries) {
      setLoadingEpisodes(true);
      (async () => {
        let targetItem = item;
        if (targetItem.piece === undefined) {
          targetItem = await resolveMediaItem(item);
        }
        const res = await getSeriesEpisodes(targetItem);
        setEpisodes(res || []);
        if (res && res.length > 0) {
          setSelectedSeason(res[0].season);
        }
      })()
        .catch(err => console.error('Erro ao carregar episódios da série:', err))
        .finally(() => setLoadingEpisodes(false));
    }
  }, [item, isSeries]);

  // Group episodes by season
  const seasonsMap = new Map();
  episodes.forEach(ep => {
    const s = ep.season || 1;
    if (!seasonsMap.has(s)) {
      seasonsMap.set(s, []);
    }
    seasonsMap.get(s).push(ep);
  });

  const availableSeasons = Array.from(seasonsMap.keys()).sort((a, b) => a - b);
  const currentSeasonEpisodes = seasonsMap.get(selectedSeason) || [];

  // Version options
  const versionKeys = item.versions ? Object.keys(item.versions) : ['dub'];

  const handleStartPlay = (specificEp = null) => {
    if (isSeries) {
      const epToPlay = specificEp || episodes[0] || null;
      onPlayMedia(item, epToPlay, episodes);
    } else {
      onPlayMedia(item, null, null);
    }
  };

  return (
    <div className="media-modal-backdrop" onClick={onClose}>
      <div 
        className="media-modal-content glass-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button className="modal-close-btn" onClick={onClose} aria-label="Fechar">
          <X size={22} />
        </button>

        {/* Backdrop Banner */}
        <div 
          className="modal-hero-banner"
          style={{
            backgroundImage: `linear-gradient(to top, #0b0d14 10%, rgba(11, 13, 20, 0.4) 60%, rgba(11, 13, 20, 0.8) 100%), url(${item.backdrop || item.poster || ''})`
          }}
        >
          <div className="modal-hero-details">
            <div className="modal-badges-row">
              <span className={`badge-type ${isSeries ? 'badge-series' : 'badge-movie'}`}>
                {isSeries ? <Clapperboard size={14} /> : <Film size={14} />}
                <span>{isSeries ? 'Série Completa' : 'Filme'}</span>
              </span>

              {item.rating && (
                <span className="badge-rating-large">
                  <Star size={16} fill="#eab308" color="#eab308" />
                  <span>{item.rating}</span>
                </span>
              )}

              {item.year && (
                <span className="badge-meta-pill">
                  <Calendar size={14} /> {item.year}
                </span>
              )}
            </div>

            <h1 className="modal-title">{item.cleanTitle || item.title}</h1>

            <div className="modal-action-buttons">
              <button 
                id="btn-modal-play"
                className="btn-primary-play"
                onClick={() => handleStartPlay()}
              >
                <Play size={20} fill="#ffffff" />
                <span>{isSeries ? 'Assistir 1º Episódio' : 'Assistir Agora'}</span>
              </button>

              <button 
                className={`btn-secondary-fav ${isFav ? 'active' : ''}`}
                onClick={() => onToggleFav(item)}
              >
                <Bookmark size={18} fill={isFav ? '#eab308' : 'none'} color={isFav ? '#eab308' : '#fff'} />
                <span>{isFav ? 'Salvo nos Favoritos' : 'Salvar nos Favoritos'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body-content">
          <div className="modal-overview-section">
            <h3 className="section-title">Sinopse</h3>
            <p className="modal-overview-text">
              {item.overview || 'Sinopse e detalhes em processamento. Aproveite a reprodução em alta definição!'}
            </p>
          </div>

          {/* Versions available for movies */}
          {!isSeries && versionKeys.length > 0 && (
            <div className="modal-versions-section">
              <h4 className="section-sub-title">Áudio Disponível:</h4>
              <div className="version-tags-row">
                {versionKeys.map(ver => (
                  <span key={ver} className="version-tag-badge">
                    <Check size={14} color="#10b981" />
                    {ver.toLowerCase() === 'dub' ? 'Dublado (Português)' : 'Legendado'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Episodes section for Series */}
          {isSeries && (
            <div className="modal-episodes-section">
              <div className="episodes-header-row">
                <h3 className="section-title">
                  <Tv size={18} /> Episódios ({episodes.length})
                </h3>

                {/* Season tabs */}
                {availableSeasons.length > 1 && (
                  <div className="season-selector-pills">
                    {availableSeasons.map(s => (
                      <button
                        key={s}
                        className={`season-pill ${selectedSeason === s ? 'active' : ''}`}
                        onClick={() => setSelectedSeason(s)}
                      >
                        Temporada {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {loadingEpisodes ? (
                <div className="episodes-loading">
                  <div className="player-spinner"></div>
                  <span>Carregando episódios...</span>
                </div>
              ) : currentSeasonEpisodes.length > 0 ? (
                <div className="episodes-grid">
                  {currentSeasonEpisodes.map(ep => (
                    <div 
                      key={ep.id}
                      className="episode-item-card glass-card"
                      onClick={() => handleStartPlay(ep)}
                    >
                      <div className="ep-num-badge">
                        <span>{ep.episode}</span>
                      </div>
                      <div className="ep-meta">
                        <span className="ep-title">Episódio {ep.episode}</span>
                        <span className="ep-season-tag">Temporada {ep.season}</span>
                      </div>
                      <button className="ep-play-btn" title="Assistir este episódio">
                        <Play size={16} fill="#ffffff" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-episodes-msg">Nenhum episódio encontrado para esta temporada.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
