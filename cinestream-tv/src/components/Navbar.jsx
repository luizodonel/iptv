import React, { useState, useRef, useEffect } from 'react';
import { 
  Tv, 
  Film, 
  Clapperboard, 
  Trophy, 
  Star, 
  Search, 
  Home, 
  Radio,
  Crown,
  User,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Layers,
  Sparkles
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  onOpenSearch, 
  favoriteCount = 0,
  currentUser = null,
  onOpenAuth,
  onOpenPlans,
  onLogout
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const navItems = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'channels', label: 'Canais Ao Vivo', icon: Tv, badge: '408' },
    { id: 'movies', label: 'Filmes', icon: Film },
    { id: 'series', label: 'Séries', icon: Clapperboard },
    { id: 'sports', label: 'Jogos do Dia', icon: Trophy },
    { id: 'favorites', label: 'Favoritos', icon: Star, badge: favoriteCount > 0 ? String(favoriteCount) : null }
  ];

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const firstLetter = currentUser?.nome ? currentUser.nome.charAt(0).toUpperCase() : 'U';

  return (
    <>
      {/* Top Header Navbar */}
      <header className="navbar-container">
        <div className="navbar-content">
          {/* Brand Logo */}
          <div 
            className="brand-logo" 
            onClick={() => setActiveTab('home')}
            role="button"
            tabIndex={0}
          >
            <div className="logo-icon-wrap">
              <Radio className="logo-icon pulse-glow" size={24} />
            </div>
            <div className="brand-text">
              <span className="brand-title">Oninha</span>
              <span className="brand-badge">TV</span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="desktop-nav">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  className={`nav-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </button>
              );
            })}
          </nav>

          {/* Top Actions */}
          <div className="navbar-actions">
            {/* Search Trigger */}
            <button 
              id="btn-search-trigger"
              className="search-trigger-btn"
              onClick={onOpenSearch}
              title="Buscar canais, filmes ou séries (Ctrl + K)"
            >
              <Search size={18} />
              <span className="search-hint">Buscar...</span>
              <kbd className="search-kbd">Ctrl+K</kbd>
            </button>

            {/* Planos Button */}
            <button 
              className="nav-plans-btn pulse-hover"
              onClick={onOpenPlans}
              title="Ver planos e assinaturas"
            >
              <Crown size={16} className="text-warning" />
              <span>Planos</span>
            </button>

            {/* User Account / Auth Button */}
            {currentUser ? (
              <div className="user-menu-wrapper" ref={menuRef}>
                <button 
                  className={`user-avatar-btn ${userMenuOpen ? 'active' : ''}`}
                  onClick={() => setUserMenuOpen(prev => !prev)}
                  title="Menu do Usuário"
                >
                  <div className="avatar-circle">
                    {firstLetter}
                  </div>
                  <span className="user-name-label">{currentUser.nome?.split(' ')[0]}</span>
                  {currentUser.assinaturaAtiva ? (
                    <span className="user-plan-pill active" title={`${currentUser.limiteTelas} tela(s)`}>
                      {currentUser.limiteTelas} Tela{currentUser.limiteTelas > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="user-plan-pill expired">Sem Plano</span>
                  )}
                  <ChevronDown size={14} className={`dropdown-arrow ${userMenuOpen ? 'rotated' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="user-dropdown-menu glass-card scale-up">
                    <div className="dropdown-user-header">
                      <div className="dropdown-avatar">{firstLetter}</div>
                      <div className="dropdown-details">
                        <span className="dropdown-name">{currentUser.nome}</span>
                        <span className="dropdown-email">{currentUser.email}</span>
                      </div>
                    </div>

                    <div className="dropdown-subscription-box">
                      <div className="sub-status-row">
                        <span className="sub-status-label">Status da Conta:</span>
                        {currentUser.assinaturaAtiva ? (
                          <span className="sub-status-val active">Ativa</span>
                        ) : (
                          <span className="sub-status-val inactive">Inativa</span>
                        )}
                      </div>
                      <div className="sub-plan-row">
                        <Layers size={14} />
                        <span>{currentUser.planoNome || 'Nenhum plano ativo'}</span>
                      </div>
                      {currentUser.assinaturaAtiva && currentUser.fimAssinatura && (
                        <div className="sub-date-row">
                          Até {new Date(currentUser.fimAssinatura).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>

                    <div className="dropdown-divider" />

                    <button 
                      className="dropdown-item"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenPlans();
                      }}
                    >
                      <Sparkles size={16} className="text-warning" />
                      <span>{currentUser.assinaturaAtiva ? 'Gerenciar Planos' : 'Assinar Agora'}</span>
                    </button>

                    <button 
                      className="dropdown-item text-danger"
                      onClick={() => {
                        setUserMenuOpen(false);
                        if (onLogout) onLogout();
                      }}
                    >
                      <LogOut size={16} />
                      <span>Sair da Conta</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                className="nav-login-btn"
                onClick={onOpenAuth}
              >
                <User size={16} />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile/Tablet Fixed Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`mobile-bottom-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <div className="bottom-nav-icon-wrap">
                <Icon size={20} />
                {item.badge && <span className="bottom-nav-badge">{item.badge}</span>}
              </div>
              <span className="bottom-nav-label">
                {item.id === 'channels' ? 'Canais' : item.id === 'sports' ? 'Jogos' : item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
