// Local storage management for favorites, watch progress, and user settings

const FAVORITES_KEY = 'cinestream_favorites';
const PROGRESS_KEY = 'cinestream_watch_progress';
const SETTINGS_KEY = 'cinestream_settings';
const SEARCH_HISTORY_KEY = 'cinestream_recent_searches';

export function getFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : { channels: [], movies: [], series: [] };
  } catch {
    return { channels: [], movies: [], series: [] };
  }
}

export function isFavorite(id, type = 'channel') {
  const favs = getFavorites();
  const list = type === 'channel' ? favs.channels : type === 'movie' ? favs.movies : favs.series;
  return list.some(item => (typeof item === 'string' ? item === id : item.id === id));
}

export function toggleFavorite(item, type = 'channel') {
  const favs = getFavorites();
  const listKey = type === 'channel' ? 'channels' : type === 'movie' ? 'movies' : 'series';
  const list = favs[listKey] || [];

  const existingIdx = list.findIndex(i => (typeof i === 'string' ? i === item.id : i.id === item.id));

  if (existingIdx >= 0) {
    list.splice(existingIdx, 1);
  } else {
    list.unshift(item);
  }

  favs[listKey] = list;
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    window.dispatchEvent(new Event('cinestream_favorites_updated'));
  } catch (err) {
    console.error('Failed to save favorites:', err);
  }

  return existingIdx < 0; // returns true if now favorited
}

export function getContinueWatching() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw);
    return Object.values(map)
      .filter(item => item.progress > 0.03 && item.progress < 0.95) // between 3% and 95%
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function saveWatchProgress(item, currentTime, duration) {
  if (!item || !duration || duration <= 0) return;

  const progress = currentTime / duration;
  const itemId = item.id || `${item.type}_${item.title}`;

  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const map = raw ? JSON.parse(raw) : {};

    map[itemId] = {
      id: itemId,
      title: item.title || item.name,
      type: item.type || 'movie',
      poster: item.poster || item.logo || '',
      currentTime,
      duration,
      progress,
      season: item.season,
      episode: item.episode,
      updatedAt: Date.now()
    };

    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save watch progress:', err);
  }
}

export function getSavedProgress(itemId) {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw);
    return map[itemId]?.currentTime || 0;
  } catch {
    return 0;
  }
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw
      ? JSON.parse(raw)
      : {
          autoplayNext: true,
          defaultAudio: 'dub', // 'dub' or 'leg'
          fitMode: 'contain', // 'contain' or 'cover'
          volume: 1
        };
  } catch {
    return {
      autoplayNext: true,
      defaultAudio: 'dub',
      fitMode: 'contain',
      volume: 1
    };
  }
}

export function saveSettings(newSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}
