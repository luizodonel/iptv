import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import HeroBanner from './components/HeroBanner';
import ChannelCard from './components/ChannelCard';
import MediaCard from './components/MediaCard';
import VideoPlayer from './components/VideoPlayer';
import MediaModal from './components/MediaModal';
import AlphabetNav from './components/AlphabetNav';
import SportsSection from './components/SportsSection';
import GlobalSearchModal from './components/GlobalSearchModal';
import LiveTvView from './components/LiveTvView';

import { getChannels, getCategories } from './services/channelsService';
import { 
  getVodIndex, 
  getMoviesByLetter, 
  getSeriesByLetter, 
  resolveMediaItem 
} from './services/vodService';
import { getTrending, getTmdbMetadata } from './services/tmdbService';
import { 
  getFavorites, 
  toggleFavorite, 
  isFavorite, 
  getContinueWatching 
} from './services/storageService';

import { 
  Tv, 
  Film, 
  Clapperboard, 
  Play, 
  Star, 
  TrendingUp, 
  RefreshCw, 
  Compass,
  History,
  Layers,
  Sparkles
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Channels state
  const [channels, setChannels] = useState([]);
  const [channelCategories, setChannelCategories] = useState([]);
  const [selectedChannelCategory, setSelectedChannelCategory] = useState('Todos');
  const [channelSearchQuery, setChannelSearchQuery] = useState('');
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [selectedLiveChannel, setSelectedLiveChannel] = useState(null);

  // VOD state
  const [letterCounts, setLetterCounts] = useState({});
  const [currentLetter, setCurrentLetter] = useState('A');
  const [moviesList, setMoviesList] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [loadingVod, setLoadingVod] = useState(false);

  // Trending & Home state
  const [trendingItems, setTrendingItems] = useState([]);
  const [featuredItem, setFeaturedItem] = useState(null);
  const [continueWatchingList, setContinueWatchingList] = useState([]);

  // Active playing stream
  const [activeStreamItem, setActiveStreamItem] = useState(null);
  const [seriesEpisodes, setSeriesEpisodes] = useState([]);
  const [currentEpisode, setCurrentEpisode] = useState(null);

  // Details Modal
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);

  // Favorites state
  const [favs, setFavs] = useState(getFavorites());
  const favoriteCount = favs.channels.length + favs.movies.length + favs.series.length;

  // Listen to favorite updates
  useEffect(() => {
    const handleFavUpdate = () => setFavs(getFavorites());
    window.addEventListener('cinestream_favorites_updated', handleFavUpdate);
    return () => window.removeEventListener('cinestream_favorites_updated', handleFavUpdate);
  }, []);

  // Keyboard shortcut Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initial load
  useEffect(() => {
    // 1. Load Channels
    setLoadingChannels(true);
    getChannels()
      .then(chs => {
        setChannels(chs);
        setChannelCategories(getCategories(chs));
      })
      .catch(err => console.error('Erro ao carregar canais:', err))
      .finally(() => setLoadingChannels(false));

    // 2. Load VOD Index
    getVodIndex()
      .then(({ letters }) => {
        const counts = {};
        letters.forEach(l => {
          counts[l.letra] = (counts[l.letra] || 0) + l.filmes + l.series;
        });
        setLetterCounts(counts);
      })
      .catch(err => console.error('Erro ao carregar índice VOD:', err));

    // 3. Load Trending & Continue watching
    getTrending('all')
      .then(items => {
        setTrendingItems(items);
        if (items.length > 0) {
          setFeaturedItem(items[0]);
        }
      })
      .catch(err => console.warn('Erro ao carregar trending:', err));

    setContinueWatchingList(getContinueWatching());
  }, []);

  // Load Movies / Series when tab or letter changes
  useEffect(() => {
    if (activeTab === 'movies') {
      setLoadingVod(true);
      getMoviesByLetter(currentLetter)
        .then(list => setMoviesList(list))
        .finally(() => setLoadingVod(false));
    } else if (activeTab === 'series') {
      setLoadingVod(true);
      getSeriesByLetter(currentLetter)
        .then(list => setSeriesList(list))
        .finally(() => setLoadingVod(false));
    }
  }, [activeTab, currentLetter]);

  // Handle Play Action
  const handlePlayMedia = async (item, episode = null, allEpisodes = null) => {
    const resolved = await resolveMediaItem(item);
    setActiveStreamItem(resolved);
    setCurrentEpisode(episode);
    setSeriesEpisodes(allEpisodes || []);
    setSelectedDetailItem(null); // Close details modal if open
  };

  const handlePlayChannel = (channel) => {
    setSelectedLiveChannel(channel);
    setActiveTab('channels');
  };

  const handleToggleFav = (item) => {
    const type = item.category ? 'channel' : item.type || 'movie';
    toggleFavorite(item, type);
    setFavs(getFavorites());
  };

  const handleNextEpisode = () => {
    if (!currentEpisode || seriesEpisodes.length === 0) return;
    const currentIndex = seriesEpisodes.findIndex(
      e => e.season === currentEpisode.season && e.episode === currentEpisode.episode
    );
    if (currentIndex >= 0 && currentIndex + 1 < seriesEpisodes.length) {
      setCurrentEpisode(seriesEpisodes[currentIndex + 1]);
    }
  };

  // Filtered Channels
  const filteredChannels = channels.filter(ch => {
    const matchesCat = selectedChannelCategory === 'Todos' || ch.category === selectedChannelCategory;
    const matchesSearch = !channelSearchQuery || 
      ch.name.toLowerCase().includes(channelSearchQuery.toLowerCase()) ||
      (ch.category && ch.category.toLowerCase().includes(channelSearchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onOpenSearch={() => setSearchModalOpen(true)}
        favoriteCount={favoriteCount}
      />

      {/* Main Content Area */}
      <main className="main-viewport">
        
        {/* ==================== TAB: INÍCIO ==================== */}
        {activeTab === 'home' && (
          <div className="tab-pane home-tab">
            {/* Hero Banner */}
            <HeroBanner 
              featured={featuredItem} 
              onPlay={handlePlayMedia}
              onSelectMedia={setSelectedDetailItem}
            />

            {/* Continue Watching Section */}
            {continueWatchingList.length > 0 && (
              <section className="home-section">
                <div className="section-title-wrap">
                  <History className="section-icon text-accent" size={22} />
                  <h2 className="section-heading">Continuar Assistindo</h2>
                </div>
                <div className="continue-scroll-row">
                  {continueWatchingList.map(item => (
                    <div 
                      key={item.id} 
                      className="continue-card glass-card"
                      onClick={() => handlePlayMedia(item)}
                    >
                      <div className="continue-thumb-wrap">
                        {item.poster ? (
                          <img src={item.poster} alt={item.title} className="continue-thumb" />
                        ) : (
                          <Film size={28} />
                        )}
                        <div className="continue-play-hover">
                          <Play size={20} fill="#fff" />
                        </div>
                      </div>
                      <div className="continue-info">
                        <span className="continue-title">{item.title}</span>
                        <div className="progress-bar-bg">
                          <div 
                            className="progress-bar-fill" 
                            style={{ width: `${Math.round(item.progress * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Featured Live Channels Row */}
            <section className="home-section">
              <div className="section-title-wrap">
                <Tv className="section-icon text-accent" size={22} />
                <div>
                  <h2 className="section-heading">Canais em Destaque</h2>
                  <p className="section-subheading">Transmissão ao vivo em alta definição com múltiplos servidores</p>
                </div>
              </div>
              <div className="channels-horizontal-row">
                {channels.slice(0, 8).map(ch => (
                  <ChannelCard 
                    key={ch.id} 
                    channel={ch}
                    isFav={isFavorite(ch.id, 'channel')}
                    onToggleFav={handleToggleFav}
                    onPlay={handlePlayChannel}
                  />
                ))}
              </div>
            </section>

            {/* Trending Movies and Series Carousel */}
            {trendingItems.length > 0 && (
              <section className="home-section">
                <div className="section-title-wrap">
                  <TrendingUp className="section-icon text-accent" size={22} />
                  <div>
                    <h2 className="section-heading">Em Alta no Oninha TV</h2>
                    <p className="section-subheading">Os filmes e séries mais populares da semana</p>
                  </div>
                </div>
                <div className="media-horizontal-row">
                  {trendingItems.slice(0, 10).map((item, idx) => (
                    <MediaCard 
                      key={idx} 
                      item={item}
                      isFav={isFavorite(item.title, item.type)}
                      onToggleFav={handleToggleFav}
                      onSelectMedia={setSelectedDetailItem}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Live Sports Matches of the Day */}
            <section className="home-section">
              <SportsSection 
                onSelectSportsChannel={() => {
                  setSelectedChannelCategory('Esportes');
                  setActiveTab('channels');
                }} 
              />
            </section>
          </div>
        )}

        {/* ==================== TAB: CANAIS AO VIVO (LISTA LATERAL A-Z + TV NO CENTRO) ==================== */}
        {activeTab === 'channels' && (
          <div className="tab-pane channels-tab">
            <LiveTvView 
              channels={channels}
              categories={channelCategories}
              favs={favs}
              onToggleFav={handleToggleFav}
              initialChannel={selectedLiveChannel}
            />
          </div>
        )}

        {/* ==================== TAB: FILMES ==================== */}
        {activeTab === 'movies' && (
          <div className="tab-pane vod-tab">
            <div className="page-header">
              <div className="header-text">
                <h1 className="page-title">
                  <Film className="header-icon text-accent" size={28} />
                  Catálogo de Filmes
                </h1>
                <p className="page-desc">
                  Explore milhares de filmes em alta resolução, dublados e legendados.
                </p>
              </div>
            </div>

            {/* A-Z Alphabet selector */}
            <AlphabetNav 
              currentLetter={currentLetter} 
              onSelectLetter={setCurrentLetter}
              counts={letterCounts}
            />

            {/* Movies Grid */}
            {loadingVod ? (
              <div className="media-loading-grid">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="media-skeleton shimmer"></div>
                ))}
              </div>
            ) : moviesList.length > 0 ? (
              <div className="media-grid">
                {moviesList.map(movie => (
                  <MediaCard 
                    key={movie.id} 
                    item={movie}
                    isFav={isFavorite(movie.title, 'movie')}
                    onToggleFav={handleToggleFav}
                    onSelectMedia={setSelectedDetailItem}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state-box glass-panel">
                <Film size={48} className="text-secondary" />
                <h3>Nenhum filme carregado nesta letra</h3>
                <p>Selecione outra letra no menu acima ou use a busca global.</p>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB: SÉRIES ==================== */}
        {activeTab === 'series' && (
          <div className="tab-pane vod-tab">
            <div className="page-header">
              <div className="header-text">
                <h1 className="page-title">
                  <Clapperboard className="header-icon text-accent" size={28} />
                  Catálogo de Séries
                </h1>
                <p className="page-desc">
                  Temporadas completas com seleção de episódios e áudio em português.
                </p>
              </div>
            </div>

            {/* A-Z Alphabet selector */}
            <AlphabetNav 
              currentLetter={currentLetter} 
              onSelectLetter={setCurrentLetter}
              counts={letterCounts}
            />

            {/* Series Grid */}
            {loadingVod ? (
              <div className="media-loading-grid">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="media-skeleton shimmer"></div>
                ))}
              </div>
            ) : seriesList.length > 0 ? (
              <div className="media-grid">
                {seriesList.map(series => (
                  <MediaCard 
                    key={series.id} 
                    item={series}
                    isFav={isFavorite(series.title, 'series')}
                    onToggleFav={handleToggleFav}
                    onSelectMedia={setSelectedDetailItem}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state-box glass-panel">
                <Clapperboard size={48} className="text-secondary" />
                <h3>Nenhuma série carregada nesta letra</h3>
                <p>Selecione outra letra no menu acima ou use a busca global.</p>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB: JOGOS & ESPORTES ==================== */}
        {activeTab === 'sports' && (
          <div className="tab-pane sports-tab">
            <SportsSection 
              onSelectSportsChannel={() => {
                setSelectedChannelCategory('Esportes');
                setActiveTab('channels');
              }} 
            />
          </div>
        )}

        {/* ==================== TAB: FAVORITOS ==================== */}
        {activeTab === 'favorites' && (
          <div className="tab-pane favorites-tab">
            <div className="page-header">
              <div className="header-text">
                <h1 className="page-title">
                  <Star className="header-icon text-accent" size={28} fill="#eab308" />
                  Meus Favoritos
                </h1>
                <p className="page-desc">
                  Seus canais, filmes e séries salvos para acesso instantâneo.
                </p>
              </div>
            </div>

            {/* Favorite Channels */}
            {favs.channels.length > 0 && (
              <section className="fav-section">
                <h2 className="section-heading">Canais Favoritos ({favs.channels.length})</h2>
                <div className="channels-grid">
                  {favs.channels.map(ch => (
                    <ChannelCard 
                      key={ch.id} 
                      channel={ch}
                      isFav={true}
                      onToggleFav={handleToggleFav}
                      onPlay={handlePlayChannel}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Favorite Movies */}
            {favs.movies.length > 0 && (
              <section className="fav-section">
                <h2 className="section-heading">Filmes Favoritos ({favs.movies.length})</h2>
                <div className="media-grid">
                  {favs.movies.map((movie, idx) => (
                    <MediaCard 
                      key={idx} 
                      item={movie}
                      isFav={true}
                      onToggleFav={handleToggleFav}
                      onSelectMedia={setSelectedDetailItem}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Favorite Series */}
            {favs.series.length > 0 && (
              <section className="fav-section">
                <h2 className="section-heading">Séries Favoritas ({favs.series.length})</h2>
                <div className="media-grid">
                  {favs.series.map((series, idx) => (
                    <MediaCard 
                      key={idx} 
                      item={series}
                      isFav={true}
                      onToggleFav={handleToggleFav}
                      onSelectMedia={setSelectedDetailItem}
                    />
                  ))}
                </div>
              </section>
            )}

            {favoriteCount === 0 && (
              <div className="empty-state-box glass-panel">
                <Star size={48} className="text-secondary" />
                <h3>Nenhum favorito salvo ainda</h3>
                <p>Clique no ícone de estrela em qualquer canal, filme ou série para guardá-lo aqui.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Global Search Modal */}
      <GlobalSearchModal 
        isOpen={searchModalOpen} 
        onClose={() => setSearchModalOpen(false)}
        channels={channels}
        onSelectChannel={handlePlayChannel}
        onSelectMedia={setSelectedDetailItem}
      />

      {/* Media Details Modal */}
      {selectedDetailItem && (
        <MediaModal 
          item={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
          isFav={isFavorite(selectedDetailItem.title, selectedDetailItem.type)}
          onToggleFav={handleToggleFav}
          onPlayMedia={handlePlayMedia}
        />
      )}

      {/* Video Player Modal */}
      {activeStreamItem && (
        <VideoPlayer 
          item={activeStreamItem}
          onClose={() => setActiveStreamItem(null)}
          allChannels={channels}
          onSwitchChannel={handlePlayChannel}
          seriesEpisodes={seriesEpisodes}
          currentEpisode={currentEpisode}
          onSwitchEpisode={handleNextEpisode}
        />
      )}
    </div>
  );
}
