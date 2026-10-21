import React, { useState, useEffect } from 'react';
import { Play, Star, Film, Clapperboard, Info } from 'lucide-react';
import { getTmdbMetadata } from '../services/tmdbService';

export default function MediaCard({ item, isFav, onToggleFav, onSelectMedia }) {
  const [meta, setMeta] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (item.poster && item.rating) {
      setMeta({
        poster: item.poster,
        backdrop: item.backdrop,
        rating: item.rating,
        overview: item.overview
      });
      return;
    }

    // Lazy load TMDB metadata
    getTmdbMetadata(item.cleanTitle || item.title, item.type, item.year)
      .then(res => {
        if (isMounted && res) {
          setMeta(res);
        }
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, [item.title, item.cleanTitle, item.type, item.year, item.poster, item.rating]);

  const displayPoster = meta?.poster || item.poster;
  const displayRating = meta?.rating || item.rating;
  const isSeries = item.type === 'series';

  return (
    <div 
      className="media-card glass-card"
      onClick={() => onSelectMedia({ ...item, ...meta })}
      role="button"
      tabIndex={0}
      id={`media-${item.id || encodeURIComponent(item.title)}`}
    >
      {/* Top badges */}
      <div className="card-top-badges">
        <span className={`badge-type ${isSeries ? 'badge-series' : 'badge-movie'}`}>
          {isSeries ? <Clapperboard size={12} /> : <Film size={12} />}
          <span>{isSeries ? 'Série' : 'Filme'}</span>
        </span>
        {displayRating && (
          <span className="badge-rating">
            <Star size={11} fill="#eab308" color="#eab308" />
            <span>{displayRating}</span>
          </span>
        )}
      </div>

      {/* Favorite Button */}
      <button 
        className={`fav-button ${isFav ? 'is-fav' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav(item);
        }}
        aria-label="Favoritar"
        title={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      >
        <Star size={16} fill={isFav ? '#eab308' : 'none'} color={isFav ? '#eab308' : '#fff'} />
      </button>

      {/* Poster image container */}
      <div className="poster-container">
        {displayPoster ? (
          <img 
            src={displayPoster} 
            alt={item.title} 
            className={`media-poster ${imgLoaded ? 'loaded' : 'loading'}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setImgLoaded(true)}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="media-poster-fallback">
            {isSeries ? <Clapperboard size={42} /> : <Film size={42} />}
            <span className="fallback-title">{item.title}</span>
          </div>
        )}

        {/* Hover overlay with action buttons */}
        <div className="card-play-overlay">
          <div className="play-circle pulse-hover">
            <Play size={22} fill="#ffffff" color="#ffffff" />
          </div>
          <span className="overlay-details-hint">
            <Info size={14} /> Detalhes
          </span>
        </div>
      </div>

      {/* Title & Subtitle */}
      <div className="media-info">
        <h3 className="media-title" title={item.fullName || item.title}>
          {item.cleanTitle || item.title}
        </h3>
        <div className="media-sub-meta">
          <span className="media-year">{item.year || (meta?.releaseDate?.slice(0, 4)) || 'HD'}</span>
          {isSeries && item.episodeCount > 0 && (
            <span className="media-ep-count">{item.episodeCount} eps</span>
          )}
        </div>
      </div>
    </div>
  );
}
