import React from 'react';
import { Play, Info, Star, Calendar, Radio } from 'lucide-react';

export default function HeroBanner({ featured, onPlay, onSelectMedia }) {
  if (!featured) return null;

  const isLive = featured.category !== undefined;

  return (
    <div className="hero-banner-container">
      <div 
        className="hero-backdrop"
        style={{
          backgroundImage: `linear-gradient(to top, #0b0d14 10%, rgba(11, 13, 20, 0.4) 60%, rgba(11, 13, 20, 0.7) 100%), linear-gradient(to right, #0b0d14 30%, rgba(11, 13, 20, 0.1) 80%), url(${featured.backdrop || featured.poster || ''})`
        }}
      >
        <div className="hero-content">
          <div className="hero-badges-row">
            {isLive ? (
              <span className="hero-badge-live">
                <Radio size={14} className="pulse-icon" /> AO VIVO AGORA
              </span>
            ) : (
              <span className="hero-badge-featured">DESTAQUE DA SEMANA</span>
            )}

            {featured.rating && (
              <span className="hero-badge-rating">
                <Star size={14} fill="#eab308" color="#eab308" /> {featured.rating}
              </span>
            )}

            {featured.releaseDate && (
              <span className="hero-badge-year">
                <Calendar size={14} /> {featured.releaseDate.slice(0, 4)}
              </span>
            )}
          </div>

          <h1 className="hero-title">{featured.title || featured.name}</h1>

          <p className="hero-overview">
            {featured.overview || 'Assista em alta resolução com transmissão ultrarrápida no CineStream TV.'}
          </p>

          <div className="hero-buttons-row">
            <button 
              id="btn-hero-watch"
              className="btn-hero-play" 
              onClick={() => onPlay(featured)}
            >
              <Play size={20} fill="#ffffff" />
              <span>{isLive ? 'Assistir Transmissão' : 'Assistir Agora'}</span>
            </button>

            {!isLive && (
              <button 
                className="btn-hero-info"
                onClick={() => onSelectMedia(featured)}
              >
                <Info size={20} />
                <span>Mais Detalhes</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
