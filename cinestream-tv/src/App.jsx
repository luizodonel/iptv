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
import AuthModal from './components/AuthModal';
import PlansModal from './components/PlansModal';
import PixModal from './components/PixModal';
import SessionTerminatedModal from './components/SessionTerminatedModal';
import SupportModal from './components/SupportModal';
import SupportFloatingButton from './components/SupportFloatingButton';
import MasterPanelModal from './components/MasterPanelModal';
import ResellerPortal from './components/reseller/ResellerPortal';

import { getAuthUser, logoutUser, checkHeartbeat, verifyCurrentSession } from './services/authService';
import { getBranding, fetchBranding } from './services/brandingService';
import { updateSecurityUser } from './services/securityService';

import { getChannels, getCategories } from './services/channelsService';
import { 
  getVodIndex, 
  getMoviesByLetter, 
  getSeriesByLetter, 
  resolveMediaItem,
  searchVod
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
  Sparkles,
  Search,
  X
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('channels');
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Auth & Subscription State
  const [currentUser, setCurrentUser] = useState(() => getAuthUser());
  const [branding, setBranding] = useState(() => getBranding());

  useEffect(() => {
    fetchBranding().then(b => {
      if (b) setBranding(b);
    });

    const handleBrandingUpdate = (e) => {
      if (e.detail) setBranding(e.detail);
    };
    window.addEventListener('cinestream_branding_updated', handleBrandingUpdate);
    return () => window.removeEventListener('cinestream_branding_updated', handleBrandingUpdate);
  }, []);

  // Verificar se a sessão persistida bate com o tenant acessado
  useEffect(() => {
    verifyCurrentSession().then(result => {
      if (result?.tenantMismatch) {
        setCurrentUser(null);
      }
    });
  }, []);

  const effectiveBrandName = branding.isCustomBrand 
    ? branding.brandName 
    : (currentUser?.resellerNomeLoja || branding.brandName || 'Top Canais');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [plansModalOpen, setPlansModalOpen] = useState(false);
  const [pixModalData, setPixModalData] = useState(null);
  const [sessionKickedOpen, setSessionKickedOpen] = useState(false);
  const [sessionKickedReason, setSessionKickedReason] = useState('');
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [masterPanelOpen, setMasterPanelOpen] = useState(false);

  // Módulo de Revenda / B2B Routing
  const [isResellerRoute, setIsResellerRoute] = useState(() => {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/revenda');
  });

  useEffect(() => {
    const handlePopState = () => {
      setIsResellerRoute(window.location.pathname.startsWith('/revenda'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToReseller = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (!window.location.pathname.startsWith('/revenda')) {
        window.history.pushState({}, '', '/revenda');
      }
      setIsResellerRoute(true);
    }
  }, []);

  const navigateToTv = useCallback(() => {
    // Revendedores têm acesso restrito ao B2B e não podem entrar na TV
    if (currentUser?.role === 'reseller') return;

    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      setIsResellerRoute(false);
    }
  }, [currentUser]);

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

  // VOD Pagination & Separate Search state
  const ITEMS_PER_PAGE = 48;
  const [visibleMoviesCount, setVisibleMoviesCount] = useState(ITEMS_PER_PAGE);
  const [visibleSeriesCount, setVisibleSeriesCount] = useState(ITEMS_PER_PAGE);

  // Dedicated Search for Movies
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieSearchResults, setMovieSearchResults] = useState([]);
  const [isSearchingMovies, setIsSearchingMovies] = useState(false);

  // Dedicated Search for Series
  const [seriesSearchQuery, setSeriesSearchQuery] = useState('');
  const [seriesSearchResults, setSeriesSearchResults] = useState([]);
  const [isSearchingSeries, setIsSearchingSeries] = useState(false);


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

  // Monitorar autenticação e desconexão de telas simultâneas
  useEffect(() => {
    const handleAuthChange = (e) => setCurrentUser(e.detail?.user || null);
    const handleSessionKicked = (e) => {
      setCurrentUser(null);
      setSessionKickedReason(e.detail?.reason || 'Sua conta atingiu o limite de telas simultâneas e foi conectada em outro dispositivo.');
      setSessionKickedOpen(true);
      setActiveStreamItem(null);
      setSelectedLiveChannel(null);
    };

    window.addEventListener('cinestream_auth_changed', handleAuthChange);
    window.addEventListener('cinestream_session_terminated', handleSessionKicked);

    return () => {
      window.removeEventListener('cinestream_auth_changed', handleAuthChange);
      window.removeEventListener('cinestream_session_terminated', handleSessionKicked);
    };
  }, []);

  // Sincroniza usuário com o serviço de segurança (libera master para odonel)
  useEffect(() => {
    updateSecurityUser(currentUser);
  }, [currentUser]);

  // Registra o acesso do visitante no banco de dados (IP, Horário e Dispositivo)
  useEffect(() => {
    try {
      const token = localStorage.getItem('cinestream_token');
      fetch('/api/tracking/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ path: window.location.pathname })
      }).catch(() => {});
    } catch (_) {}
  }, []);


  // Heartbeat periódico (a cada 20s) para detecção instantânea de sessão ativa
  useEffect(() => {
    if (!currentUser || currentUser.role === 'reseller') return;
    const interval = setInterval(() => {
      checkHeartbeat();
    }, 20000);
    return () => clearInterval(interval);
  }, [currentUser]);

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
    setVisibleMoviesCount(ITEMS_PER_PAGE);
    setVisibleSeriesCount(ITEMS_PER_PAGE);

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

  // Busca Dedicada de Filmes no Catálogo Global (Debounced 260ms)
  useEffect(() => {
    if (!movieSearchQuery || movieSearchQuery.trim().length < 2) {
      setMovieSearchResults([]);
      setIsSearchingMovies(false);
      return;
    }

    setIsSearchingMovies(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchVod(movieSearchQuery);
        const movieMatches = results
          .filter(item => item.type === 'movie')
          .map((item, idx) => ({
            ...item,
            id: `search-movie-${item.letter}-${encodeURIComponent(item.title)}-${idx}`,
            cleanTitle: item.title
          }));
        setMovieSearchResults(movieMatches);
        setVisibleMoviesCount(ITEMS_PER_PAGE);
      } catch (err) {
        console.warn('Erro ao buscar filmes:', err);
      } finally {
        setIsSearchingMovies(false);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [movieSearchQuery]);

  // Busca Dedicada de Séries no Catálogo Global (Debounced 260ms)
  useEffect(() => {
    if (!seriesSearchQuery || seriesSearchQuery.trim().length < 2) {
      setSeriesSearchResults([]);
      setIsSearchingSeries(false);
      return;
    }

    setIsSearchingSeries(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchVod(seriesSearchQuery);
        const seriesMatches = results
          .filter(item => item.type === 'series')
          .map((item, idx) => ({
            ...item,
            id: `search-series-${item.letter}-${encodeURIComponent(item.title)}-${idx}`,
            cleanTitle: item.title
          }));
        setSeriesSearchResults(seriesMatches);
        setVisibleSeriesCount(ITEMS_PER_PAGE);
      } catch (err) {
        console.warn('Erro ao buscar séries:', err);
      } finally {
        setIsSearchingSeries(false);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [seriesSearchQuery]);

  const isMovieSearchActive = movieSearchQuery.trim().length >= 2;
  const filteredMovies = React.useMemo(() => {
    if (isMovieSearchActive) return movieSearchResults;
    return moviesList;
  }, [isMovieSearchActive, movieSearchResults, moviesList]);

  const displayedMovies = React.useMemo(() => {
    return filteredMovies.slice(0, visibleMoviesCount);
  }, [filteredMovies, visibleMoviesCount]);

  const isSeriesSearchActive = seriesSearchQuery.trim().length >= 2;
  const filteredSeries = React.useMemo(() => {
    if (isSeriesSearchActive) return seriesSearchResults;
    return seriesList;
  }, [isSeriesSearchActive, seriesSearchResults, seriesList]);

  const displayedSeries = React.useMemo(() => {
    return filteredSeries.slice(0, visibleSeriesCount);
  }, [filteredSeries, visibleSeriesCount]);


  // Handle Play Action with Subscription Protection
  const handlePlayMedia = async (item, episode = null, allEpisodes = null) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!currentUser.assinaturaAtiva) {
      setPlansModalOpen(true);
      return;
    }
    const resolved = await resolveMediaItem(item);
    setActiveStreamItem(resolved);
    setCurrentEpisode(episode);
    setSeriesEpisodes(allEpisodes || []);
    setSelectedDetailItem(null); // Close details modal if open
  };

  const handlePlayChannel = (channel) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!currentUser.assinaturaAtiva) {
      setPlansModalOpen(true);
      return;
    }
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

  const isResellerUser = currentUser?.role === 'reseller';

  if (isResellerRoute || isResellerUser) {
    return <ResellerPortal />;
  }

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onOpenSearch={() => setSearchModalOpen(true)}
        favoriteCount={favoriteCount}
        currentUser={currentUser}
        onOpenAuth={(mode = 'login') => {
          setAuthModalMode(mode);
          setAuthModalOpen(true);
        }}
        onOpenPlans={() => setPlansModalOpen(true)}
        onOpenSupport={() => setSupportModalOpen(true)}
        onOpenMasterPanel={() => setMasterPanelOpen(true)}
        onOpenReseller={navigateToReseller}
        onLogout={logoutUser}
        brandName={effectiveBrandName}
        brandBadge={branding.brandBadge}
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
              brandName={effectiveBrandName}
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
                    <h2 className="section-heading">Em Alta no {effectiveBrandName}</h2>
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
              currentUser={currentUser}
              onRequireAuth={() => setAuthModalOpen(true)}
              onRequireSubscription={() => setPlansModalOpen(true)}
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

            {/* A-Z Alphabet selector (exibido apenas quando não houver busca ativa) */}
            {!isMovieSearchActive && (
              <AlphabetNav 
                currentLetter={currentLetter} 
                onSelectLetter={setCurrentLetter}
                counts={letterCounts}
              />
            )}

            {/* Campo de Busca Dedicado de Filmes */}
            <div className="vod-controls-bar">
              <div className="vod-search-wrap">
                <Search size={18} className="vod-search-icon" />
                <input 
                  type="text" 
                  placeholder="Buscar qualquer filme no catálogo completo (Ex: Batman, Matrix, Vingadores)..."
                  value={movieSearchQuery}
                  onChange={e => setMovieSearchQuery(e.target.value)}
                  className="vod-search-input"
                />
                {isSearchingMovies && <RefreshCw size={16} className="vod-search-spinner spin-fast" />}
                {movieSearchQuery && (
                  <button className="vod-search-clear" onClick={() => setMovieSearchQuery('')} aria-label="Limpar busca">
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="vod-count-badge">
                <span>
                  {isMovieSearchActive 
                    ? `Encontrados ${filteredMovies.length} filmes para "${movieSearchQuery}" (Exibindo ${displayedMovies.length})`
                    : `Exibindo ${displayedMovies.length} de ${filteredMovies.length} filmes (Letra ${currentLetter})`
                  }
                </span>
              </div>
            </div>

            {/* Movies Grid */}
            {loadingVod || isSearchingMovies ? (
              <div className="media-loading-grid">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="media-skeleton shimmer"></div>
                ))}
              </div>
            ) : displayedMovies.length > 0 ? (
              <>
                <div className="media-grid">
                  {displayedMovies.map(movie => (
                    <MediaCard 
                      key={movie.id} 
                      item={movie}
                      isFav={isFavorite(movie.title, 'movie')}
                      onToggleFav={handleToggleFav}
                      onSelectMedia={setSelectedDetailItem}
                    />
                  ))}
                </div>

                {visibleMoviesCount < filteredMovies.length && (
                  <div className="load-more-container">
                    <button 
                      className="btn-load-more glass-panel"
                      onClick={() => setVisibleMoviesCount(prev => prev + ITEMS_PER_PAGE)}
                    >
                      <RefreshCw size={18} />
                      <span>Carregar Mais ({filteredMovies.length - visibleMoviesCount} restantes)</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state-box glass-panel">
                <Film size={48} className="text-secondary" />
                <h3>{movieSearchQuery ? `Nenhum filme encontrado para "${movieSearchQuery}"` : 'Nenhum filme carregado nesta letra'}</h3>
                <p>{movieSearchQuery ? 'Tente pesquisar outro termo ou limpe o campo de busca.' : 'Selecione outra letra no menu acima ou use a busca global.'}</p>
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

            {/* A-Z Alphabet selector (exibido apenas quando não houver busca ativa) */}
            {!isSeriesSearchActive && (
              <AlphabetNav 
                currentLetter={currentLetter} 
                onSelectLetter={setCurrentLetter}
                counts={letterCounts}
              />
            )}

            {/* Campo de Busca Dedicado de Séries */}
            <div className="vod-controls-bar">
              <div className="vod-search-wrap">
                <Search size={18} className="vod-search-icon" />
                <input 
                  type="text" 
                  placeholder="Buscar qualquer série no catálogo completo (Ex: Breaking Bad, Game of Thrones)..."
                  value={seriesSearchQuery}
                  onChange={e => setSeriesSearchQuery(e.target.value)}
                  className="vod-search-input"
                />
                {isSearchingSeries && <RefreshCw size={16} className="vod-search-spinner spin-fast" />}
                {seriesSearchQuery && (
                  <button className="vod-search-clear" onClick={() => setSeriesSearchQuery('')} aria-label="Limpar busca">
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="vod-count-badge">
                <span>
                  {isSeriesSearchActive 
                    ? `Encontradas ${filteredSeries.length} séries para "${seriesSearchQuery}" (Exibindo ${displayedSeries.length})`
                    : `Exibindo ${displayedSeries.length} de ${filteredSeries.length} séries (Letra ${currentLetter})`
                  }
                </span>
              </div>
            </div>

            {/* Series Grid */}
            {loadingVod || isSearchingSeries ? (
              <div className="media-loading-grid">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="media-skeleton shimmer"></div>
                ))}
              </div>
            ) : displayedSeries.length > 0 ? (
              <>
                <div className="media-grid">
                  {displayedSeries.map(series => (
                    <MediaCard 
                      key={series.id} 
                      item={series}
                      isFav={isFavorite(series.title, 'series')}
                      onToggleFav={handleToggleFav}
                      onSelectMedia={setSelectedDetailItem}
                    />
                  ))}
                </div>

                {visibleSeriesCount < filteredSeries.length && (
                  <div className="load-more-container">
                    <button 
                      className="btn-load-more glass-panel"
                      onClick={() => setVisibleSeriesCount(prev => prev + ITEMS_PER_PAGE)}
                    >
                      <RefreshCw size={18} />
                      <span>Carregar Mais ({filteredSeries.length - visibleSeriesCount} restantes)</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state-box glass-panel">
                <Clapperboard size={48} className="text-secondary" />
                <h3>{seriesSearchQuery ? `Nenhuma série encontrada para "${seriesSearchQuery}"` : 'Nenhuma série carregada nesta letra'}</h3>
                <p>{seriesSearchQuery ? 'Tente pesquisar outro termo ou limpe o campo de busca.' : 'Selecione outra letra no menu acima ou use a busca global.'}</p>
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

      {/* Auth Modal (Login / Cadastro) */}
      <AuthModal 
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          if (!user.assinaturaAtiva) {
            setPlansModalOpen(true);
          }
        }}
        brandName={effectiveBrandName}
        isCustomBrand={branding.isCustomBrand}
        resellerPhone={branding.contactPhone}
      />

      {/* Plans Modal (Escolha de Planos de 1 e 2 telas) */}
      <PlansModal 
        isOpen={plansModalOpen}
        onClose={() => setPlansModalOpen(false)}
        currentUser={currentUser}
        onRequireAuth={() => {
          setAuthModalMode('login');
          setAuthModalOpen(true);
        }}
        onPixGenerated={(data) => setPixModalData(data)}
        onOpenSupport={() => setSupportModalOpen(true)}
        brandName={effectiveBrandName}
      />

      {/* Pix Payment Modal (QR Code & Copia e Cola com polling do Mercado Pago) */}
      <PixModal 
        isOpen={!!pixModalData}
        pixData={pixModalData}
        onClose={() => setPixModalData(null)}
        onSuccess={(updatedUser) => {
          setCurrentUser(updatedUser);
        }}
        onOpenSupport={() => setSupportModalOpen(true)}
        brandName={effectiveBrandName}
      />

      {/* Session Terminated Modal (Aviso de limite de telas / outro dispositivo logado) */}
      <SessionTerminatedModal 
        isOpen={sessionKickedOpen}
        reason={sessionKickedReason}
        onReLogin={() => {
          setSessionKickedOpen(false);
          setAuthModalOpen(true);
        }}
        onUpgradePlans={() => {
          setSessionKickedOpen(false);
          setPlansModalOpen(true);
        }}
        brandName={effectiveBrandName}
      />

      {/* Floating WhatsApp Support Icon */}
      <SupportFloatingButton 
        onOpenSupportModal={() => setSupportModalOpen(true)}
        currentUser={currentUser}
        hidden={!!activeStreamItem}
      />

      {/* Central de Suporte WhatsApp Modal */}
      <SupportModal 
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        currentUser={currentUser}
        brandName={effectiveBrandName}
        isCustomBrand={branding.isCustomBrand}
        customPhone={branding.contactPhone}
      />

      {/* Painel Administrativo Exclusivo Master Odonel */}
      <MasterPanelModal 
        isOpen={masterPanelOpen}
        onClose={() => setMasterPanelOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}

