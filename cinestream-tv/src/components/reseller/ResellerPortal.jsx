import React, { useState, useEffect } from 'react';
import './reseller.css';
import ResellerAuth from './ResellerAuth';
import ResellerDashboard from './ResellerDashboard';
import { getAuthUser, logoutUser } from '../../services/authService';

export default function ResellerPortal({ onNavigateToTv }) {
  const [currentUser, setCurrentUser] = useState(() => getAuthUser());
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setCurrentUser(getAuthUser());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleAuthChange = (e) => {
      setCurrentUser(e.detail?.user || null);
    };
    window.addEventListener('cinestream_auth_changed', handleAuthChange);
    return () => window.removeEventListener('cinestream_auth_changed', handleAuthChange);
  }, []);

  const isResellerOrMaster =
    currentUser &&
    (currentUser.role === 'reseller' ||
      currentUser.role === 'admin' ||
      (currentUser.username || '').toLowerCase() === 'odonel' ||
      currentUser.isMaster === true);

  const initialAuthMode = currentPath === '/revenda/cadastro' ? 'register' : 'login';

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    window.history.pushState({}, '', '/revenda');
    setCurrentPath('/revenda');
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    window.history.pushState({}, '', '/revenda/login');
    setCurrentPath('/revenda/login');
  };

  const handleGoToTv = () => {
    window.history.pushState({}, '', '/');
    if (onNavigateToTv) onNavigateToTv();
  };

  if (isResellerOrMaster) {
    return (
      <ResellerDashboard
        currentUser={currentUser}
        onLogout={handleLogout}
        onNavigateToTv={handleGoToTv}
      />
    );
  }

  return (
    <ResellerAuth
      initialMode={initialAuthMode}
      onAuthSuccess={handleAuthSuccess}
      onNavigateToTv={handleGoToTv}
    />
  );
}
