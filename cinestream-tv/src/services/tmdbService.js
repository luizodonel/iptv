// TMDB Service for Brazilian Portuguese metadata, posters, backdrops, and ratings

const TMDB_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

const metadataCache = new Map();

export function getImageUrl(path, size = 'w500') {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(path, size = 'w1280') {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

/**
 * Search TMDB for movie or series details
 */
export async function getTmdbMetadata(title, type = 'movie', year = '') {
  const cleanTitle = title.replace(/\(\d{4}\)/, '').trim();
  const cacheKey = `${type}_${cleanTitle}_${year}`;

  if (metadataCache.has(cacheKey)) {
    return metadataCache.get(cacheKey);
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
    if (!res.ok) return null;

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
      return result;
    }
  } catch (err) {
    console.warn(`TMDB search error for "${cleanTitle}":`, err);
  }

  metadataCache.set(cacheKey, null);
  return null;
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
