import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Tv, Film, Clapperboard, Star, ArrowRight } from 'lucide-react';
import { searchVod } from '../services/vodService';

export default function GlobalSearchModal({ 
  isOpen, 
  onClose, 
  channels = [], 
  onSelectChannel, 
  onSelectMedia 
}) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'channels', 'movies', 'series'
  const [vodResults, setVodResults] = useState([]);
  const [isSearchingVod, setIsSearchingVod] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setVodResults([]);
    }
  }, [isOpen]);

  // Search logic
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setVodResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearchingVod(true);
      searchVod(query, 60)
        .then(results => setVodResults(results))
        .finally(() => setIsSearchingVod(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  // Filter channels locally
  const cleanQ = query.toLowerCase().trim();
  const matchedChannels = channels.filter(ch => 
    ch.name.toLowerCase().includes(cleanQ) || 
    (ch.category && ch.category.toLowerCase().includes(cleanQ))
  );

  const matchedMovies = vodResults.filter(i => i.type === 'movie');
  const matchedSeries = vodResults.filter(i => i.type === 'series');

  const showChannels = activeFilter === 'all' || activeFilter === 'channels';
  const showMovies = activeFilter === 'all' || activeFilter === 'movies';
  const showSeries = activeFilter === 'all' || activeFilter === 'series';

  return (
    <div className="search-modal-backdrop" onClick={onClose}>
      <div 
        className="search-modal-content glass-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="search-bar-header">
          <Search size={22} className="search-input-icon text-accent" />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Pesquisar canais (ex: ESPN, Globo), filmes ou séries..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-main-input"
          />
          {query && (
            <button className="search-clear-btn" onClick={() => setQuery('')}>
              <X size={18} />
            </button>
          )}
          <button className="search-close-x" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="search-filter-tabs">
          <button 
            className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            Todos
          </button>
          <button 
            className={`filter-tab ${activeFilter === 'channels' ? 'active' : ''}`}
            onClick={() => setActiveFilter('channels')}
          >
            Canais ({matchedChannels.length})
          </button>
          <button 
            className={`filter-tab ${activeFilter === 'movies' ? 'active' : ''}`}
            onClick={() => setActiveFilter('movies')}
          >
            Filmes ({matchedMovies.length})
          </button>
          <button 
            className={`filter-tab ${activeFilter === 'series' ? 'active' : ''}`}
            onClick={() => setActiveFilter('series')}
          >
            Séries ({matchedSeries.length})
          </button>
        </div>

        {/* Results Area */}
        <div className="search-results-area">
          {isSearchingVod && (
            <div className="search-loading-bar">
              <div className="search-progress-indeterminate"></div>
            </div>
          )}

          {query.trim().length < 2 ? (
            <div className="search-empty-prompt">
              <Search size={40} className="text-secondary" />
              <p>Digite ao menos 2 letras para pesquisar entre mais de 400 canais e 40.000 filmes e séries.</p>
            </div>
          ) : (
            <div className="results-groups-container">
              {/* Channel Results */}
              {showChannels && matchedChannels.length > 0 && (
                <div className="results-group">
                  <h4 className="group-title">
                    <Tv size={16} /> Canais Ao Vivo ({matchedChannels.length})
                  </h4>
                  <div className="channel-results-list">
                    {matchedChannels.slice(0, 15).map(ch => (
                      <div 
                        key={ch.id} 
                        className="search-channel-item glass-card"
                        onClick={() => { onSelectChannel(ch); onClose(); }}
                      >
                        <div className="search-ch-logo-wrap">
                          {ch.logo ? (
                            <img src={ch.logo} alt={ch.name} className="search-ch-logo" referrerPolicy="no-referrer" />
                          ) : (
                            <Tv size={20} />
                          )}
                        </div>
                        <div className="search-ch-meta">
                          <span className="search-ch-name">{ch.name}</span>
                          <span className="search-ch-cat">{ch.category}</span>
                        </div>
                        <ArrowRight size={16} className="search-item-arrow" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Movies Results */}
              {showMovies && matchedMovies.length > 0 && (
                <div className="results-group">
                  <h4 className="group-title">
                    <Film size={16} /> Filmes ({matchedMovies.length})
                  </h4>
                  <div className="vod-results-list">
                    {matchedMovies.map((movie, idx) => (
                      <div 
                        key={idx} 
                        className="search-vod-item glass-card"
                        onClick={() => { onSelectMedia(movie); onClose(); }}
                      >
                        <div className="search-vod-icon"><Film size={18} /></div>
                        <div className="search-vod-info">
                          <span className="search-vod-title">{movie.title}</span>
                          <span className="search-vod-year">{movie.year || 'Filme'}</span>
                        </div>
                        <ArrowRight size={16} className="search-item-arrow" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Series Results */}
              {showSeries && matchedSeries.length > 0 && (
                <div className="results-group">
                  <h4 className="group-title">
                    <Clapperboard size={16} /> Séries ({matchedSeries.length})
                  </h4>
                  <div className="vod-results-list">
                    {matchedSeries.map((series, idx) => (
                      <div 
                        key={idx} 
                        className="search-vod-item glass-card"
                        onClick={() => { onSelectMedia(series); onClose(); }}
                      >
                        <div className="search-vod-icon"><Clapperboard size={18} /></div>
                        <div className="search-vod-info">
                          <span className="search-vod-title">{series.title}</span>
                          <span className="search-vod-year">{series.year || 'Série'}</span>
                        </div>
                        <ArrowRight size={16} className="search-item-arrow" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchedChannels.length === 0 && matchedMovies.length === 0 && matchedSeries.length === 0 && !isSearchingVod && (
                <div className="no-results-box">
                  <p>Nenhum resultado encontrado para "{query}".</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
