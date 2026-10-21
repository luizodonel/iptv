import React, { useState, useEffect } from 'react';
import { Trophy, Radio, Clock, Tv, ExternalLink } from 'lucide-react';
import { getLiveSportsEvents } from '../services/sportsService';

export default function SportsSection({ onSelectSportsChannel }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLiveSportsEvents()
      .then(res => setEvents(res))
      .finally(() => setLoading(false));
  }, []);

  const formatMatchTime = (isoDate) => {
    try {
      const d = new Date(isoDate);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="sports-section-container">
      <div className="section-header-row">
        <div className="section-title-wrap">
          <Trophy className="section-icon text-accent" size={24} />
          <div>
            <h2 className="section-heading">Jogos e Campeonatos de Hoje</h2>
            <p className="section-subheading">Acompanhe placares ao vivo e assista nos canais de esportes</p>
          </div>
        </div>

        <button 
          className="btn-view-channels"
          onClick={() => onSelectSportsChannel && onSelectSportsChannel('Esportes')}
        >
          <Tv size={16} />
          <span>Ver Canais de Esportes</span>
        </button>
      </div>

      {loading ? (
        <div className="sports-loading-grid">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="sports-card-skeleton shimmer"></div>
          ))}
        </div>
      ) : events.length > 0 ? (
        <div className="sports-grid">
          {events.map(ev => {
            const isLive = ev.status === 'in';
            const isFinished = ev.status === 'post';
            return (
              <div 
                key={ev.id} 
                className={`sports-match-card glass-card ${isLive ? 'match-live' : ''}`}
                onClick={() => onSelectSportsChannel && onSelectSportsChannel('Esportes')}
              >
                {/* Match header */}
                <div className="match-card-header">
                  <span className="match-league">{ev.league}</span>
                  {isLive ? (
                    <span className="match-status-live">
                      <span className="live-dot-pulse"></span> {ev.statusDetail || 'AO VIVO'}
                    </span>
                  ) : isFinished ? (
                    <span className="match-status-finished">Encerrado</span>
                  ) : (
                    <span className="match-status-time">
                      <Clock size={12} /> {formatMatchTime(ev.date)}
                    </span>
                  )}
                </div>

                {/* Teams and score */}
                <div className="match-teams-box">
                  {/* Home */}
                  <div className="match-team-row">
                    <div className="team-meta">
                      {ev.home.logo ? (
                        <img src={ev.home.logo} alt={ev.home.name} className="team-crest" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="team-crest-fallback">{ev.home.name.slice(0, 2)}</div>
                      )}
                      <span className="team-name">{ev.home.name}</span>
                    </div>
                    <span className="team-score">{ev.home.score}</span>
                  </div>

                  {/* Away */}
                  <div className="match-team-row">
                    <div className="team-meta">
                      {ev.away.logo ? (
                        <img src={ev.away.logo} alt={ev.away.name} className="team-crest" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="team-crest-fallback">{ev.away.name.slice(0, 2)}</div>
                      )}
                      <span className="team-name">{ev.away.name}</span>
                    </div>
                    <span className="team-score">{ev.away.score}</span>
                  </div>
                </div>

                {/* Footer action */}
                <div className="match-card-footer">
                  <span className="broadcast-hint">Transmissão: {ev.broadcast}</span>
                  <span className="watch-link">
                    Assistir <ExternalLink size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="no-sports-box glass-panel">
          <p>Nenhuma partida agendada para este momento nas ligas monitoradas.</p>
        </div>
      )}
    </div>
  );
}
