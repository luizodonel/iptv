// TMDB Service for Brazilian Portuguese metadata, posters, backdrops, and ratings
// Features: Persistent localStorage cache, Concurrency Limiter, Request Queue & 429 Rate Limit Backoff

const TMDB_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

// In-memory cache
const metadataCache = new Map();
const STORAGE_PREFIX = 'cinestream_tmdb_v1_';

export function getImageUrl(path, size = 'w500') {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(path, size = 'w1280') {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

// Persistent Storage Helpers
function getFromStorage(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToStorage(key, data) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (_) {
    // LocalStorage full or private mode: ignore gracefully
  }
}

// Concurrency queue to protect against 429 Rate Limits
const queue = [];
let activeCount = 0;
const MAX_CONCURRENT = 2;
const THROTTLE_DELAY = 120;
let isRateLimited = false;

function processQueue() {
  if (isRateLimited) return;
  if (activeCount >= MAX_CONCURRENT || queue.length === 0) return;

  const task = queue.shift();
  if (!task) return;

  activeCount++;

  task()
    .finally(() => {
      activeCount--;
      setTimeout(processQueue, THROTTLE_DELAY);
    });
}

function enqueueRequest(fn) {
  return new Promise((resolve) => {
    queue.push(async () => {
      try {
        const res = await fn();
        resolve(res);
      } catch {
        resolve(null);
      }
    });
    processQueue();
  });
}

/**
 * Search TMDB for movie or series details with robust rate limiting & caching
 */
export async function getTmdbMetadata(title, type = 'movie', year = '') {
  if (!title || typeof title !== 'string') return null;

  // Clean title for better search matching
  const cleanTitle = title
    .replace(/\(\d{4}\)/g, '')
    .replace(/\b(dublado|legendado|dub|leg|4k|1080p|720p|hd|web-dl|bluray)\b/gi, '')
    .trim();

  if (!cleanTitle) return null;

  const cacheKey = `${type}_${cleanTitle.toLowerCase()}_${year || ''}`;

  // 1. Check in-memory cache
  if (metadataCache.has(cacheKey)) {
    const cached = metadataCache.get(cacheKey);
    return cached?.notFound ? null : cached;
  }

  // 2. Check localStorage cache
  const stored = getFromStorage(cacheKey);
  if (stored) {
    metadataCache.set(cacheKey, stored);
    return stored?.notFound ? null : stored;
  }

  // 3. Queue the network fetch
  return enqueueRequest(async () => {
    // Re-check cache in case it was resolved while queued
    if (metadataCache.has(cacheKey)) {
      const cached = metadataCache.get(cacheKey);
      return cached?.notFound ? null : cached;
    }

    try {
      const endpoint = type === 'series' ? 'search/tv' : 'search/movie';
      const params = new URLSearchParams({
        api_key: TMDB_KEY,
        language: 'pt-BR',
        query: cleanTitle,
        include_adult: 'false'
      });

      if (year) {
        if (type === 'series') {
          params.append('first_air_date_year', year);
        } else {
          params.append('year', year);
        }
      }

      const res = await fetch(`${BASE_URL}/${endpoint}?${params.toString()}`);

      // Handle 429 Too Many Requests with automatic backoff
      if (res.status === 429) {
        console.warn(`TMDB rate limited (429) para "${cleanTitle}". Pausando fila temporariamente...`);
        isRateLimited = true;
        setTimeout(() => {
          isRateLimited = false;
          processQueue();
        }, 3500);
        return null;
      }

      if (!res.ok) {
        metadataCache.set(cacheKey, { notFound: true });
        saveToStorage(cacheKey, { notFound: true });
        return null;
      }

      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const match = data.results[0];
        const result = {
          tmdbId: match.id,
          title: match.title || match.name,
          originalTitle: match.original_title || match.original_name,
          overview: match.overview || 'Sinopse não disponível.',
          poster: getImageUrl(match.poster_path, 'w500'),
          backdrop: getBackdropUrl(match.backdrop_path, 'w1280'),
          rating: match.vote_average ? match.vote_average.toFixed(1) : null,
          voteCount: match.vote_count,
          releaseDate: match.release_date || match.first_air_date || year,
          genreIds: match.genre_ids || []
        };

        metadataCache.set(cacheKey, result);
        saveToStorage(cacheKey, result);
        return result;
      }
    } catch (_) {
      // Network failure, ignore silently
    }

    // Cache negative result to prevent repeat hammer
    const negResult = { notFound: true };
    metadataCache.set(cacheKey, negResult);
    saveToStorage(cacheKey, negResult);
    return null;
  });
}

/**
 * Fetch trending movies or series for the hero banner / curated carousels
 */
export async function getTrending(type = 'all', timeWindow = 'week') {
  try {
    const res = await fetch(
      `${BASE_URL}/trending/${type}/${timeWindow}?api_key=${TMDB_KEY}&language=pt-BR`
    );
    if (!res.ok) return [];

    const data = await res.json();
    return (data.results || []).slice(0, 10).map(item => ({
      tmdbId: item.id,
      type: item.media_type || (item.title ? 'movie' : 'series'),
      title: item.title || item.name,
      overview: item.overview,
      poster: getImageUrl(item.poster_path, 'w500'),
      backdrop: getBackdropUrl(item.backdrop_path, 'w1280'),
      rating: item.vote_average ? item.vote_average.toFixed(1) : null,
      releaseDate: item.release_date || item.first_air_date
    }));
  } catch (err) {
    console.error('Error fetching trending:', err);
    return [];
  }
}
