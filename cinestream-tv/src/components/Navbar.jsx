import React, { useState } from 'react';
import { 
  Tv, 
  Film, 
  Clapperboard, 
  Trophy, 
  Star, 
  Search, 
  Home, 
  Radio
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenSearch, favoriteCount = 0 }) {
  const navItems = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'channels', label: 'Canais Ao Vivo', icon: Tv, badge: '408' },
    { id: 'movies', label: 'Filmes', icon: Film },
    { id: 'series', label: 'Séries', icon: Clapperboard },
    { id: 'sports', label: 'Jogos do Dia', icon: Trophy },
    { id: 'favorites', label: 'Favoritos', icon: Star, badge: favoriteCount > 0 ? String(favoriteCount) : null }
  ];

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
              <span className="brand-title">CineStream</span>
              <span className="brand-badge">TV</span>
            </div>
          </div>

          {/* Desktop Nav Links (hidden on mobile/tablet) */}
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
