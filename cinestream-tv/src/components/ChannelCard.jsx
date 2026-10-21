import React, { useState } from 'react';
import { Play, Star, Tv } from 'lucide-react';

export default function ChannelCard({ channel, isFav, onToggleFav, onPlay }) {
  const [imgError, setImgError] = useState(false);

  const topQuality = channel.sources?.[0]?.quality || 'HD';
  const sourceCount = channel.sources?.length || 1;

  return (
    <div 
      className="channel-card glass-card"
      onClick={() => onPlay(channel)}
      role="button"
      tabIndex={0}
      id={`channel-${channel.id}`}
    >
      {/* Category & Quality Badges */}
      <div className="card-top-badges">
        <span className="badge-category">{channel.category || 'Geral'}</span>
        <span className="badge-quality">{topQuality}</span>
      </div>

      {/* Favorite Button */}
      <button 
        className={`fav-button ${isFav ? 'is-fav' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav(channel);
        }}
        aria-label="Favoritar canal"
        title={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      >
        <Star size={16} fill={isFav ? '#eab308' : 'none'} color={isFav ? '#eab308' : '#fff'} />
      </button>

      {/* Channel Logo */}
      <div className="channel-logo-container">
        {!imgError && channel.logo ? (
          <img 
            src={channel.logo} 
            alt={channel.name} 
            className="channel-logo"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="channel-logo-fallback">
            <Tv size={36} className="text-secondary" />
          </div>
        )}

        {/* Hover play overlay */}
        <div className="card-play-overlay">
          <div className="play-circle pulse-hover">
            <Play size={24} fill="#ffffff" color="#ffffff" />
          </div>
        </div>
      </div>

      {/* Channel Meta */}
      <div className="channel-info">
        <h3 className="channel-name" title={channel.name}>{channel.name}</h3>
        <div className="channel-sub-meta">
          <span className="live-pill"><span className="live-dot"></span>AO VIVO</span>
          <span className="source-counter">{sourceCount} {sourceCount === 1 ? 'fonte' : 'fontes'}</span>
        </div>
      </div>
    </div>
  );
}
