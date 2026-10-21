// Service to fetch movies and series catalogs, search, and resolve stream URLs

const VOD_BASE_URL = 'https://filmes-saimo.pages.dev/';

let cachedBases = [];
let cachedIndex = null;
let cachedSearchIndex = null;
const letterCache = new Map();

function normalizeLetter(l) {
  return l === '#' ? '%23' : encodeURIComponent(l);
}

/**
 * Fetch and parse indice.txt containing server base URLs and letter counts
 */
export async function getVodIndex() {
  if (cachedIndex && cachedBases.length > 0) {
    return { bases: cachedBases, letters: cachedIndex };
  }

  const res = await fetch(`${VOD_BASE_URL}indice.txt`);
  if (!res.ok) {
    throw new Error('Falha ao obter índice VOD');
  }

  const text = await res.text();
  const bases = [];
  const letters = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('base:')) {
      const parts = trimmed.slice(5).trim().split(/\s+/);
      if (parts.length >= 2) {
        bases[Number(parts[0])] = parts.slice(1).join(' ');
      }
    } else {
      const cols = trimmed.split('\t');
      if (cols.length >= 3) {
        letters.push({
          letra: cols[0],
          filmes: Number(cols[1]) || 0,
          series: Number(cols[2]) || 0,
          reservados: Number(cols[3]) || 0
        });
      }
    }
  }

  cachedBases = bases;
  cachedIndex = letters;
  return { bases, letters };
}

/**
 * Resolve an encoded stream source like "2:3491823" to full URL
 */
export function resolveSourceUrl(src, bases) {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) return src;

  const colonIdx = src.indexOf(':');
  if (colonIdx <= 0) return '';

  const baseNum = Number(src.slice(0, colonIdx));
  if (!Number.isInteger(baseNum)) return '';

  const path = src.slice(colonIdx + 1);
  const base = bases[baseNum];
  if (!base) return '';

  return path.includes('.') ? base + path : `${base}${path}.mp4`;
}

/**
 * Fetch movies by letter (e.g. 'A', 'B', '#')
 */
export async function getMoviesByLetter(letter) {
  const cacheKey = `filmes_${letter}`;
  if (letterCache.has(cacheKey)) {
    return letterCache.get(cacheKey);
  }

  const { bases } = await getVodIndex();
  const url = `${VOD_BASE_URL}filmes-${normalizeLetter(letter)}.txt`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];

    const text = await res.text();
    const movies = [];

    for (const line of text.split('\n')) {
      const parts = line.split('\t');
      if (parts.length < 2 || !parts[0].trim()) continue;

      const title = parts[0].trim();
      const versions = {};

      for (let i = 1; i < parts.length; i++) {
        const item = parts[i].trim();
        const eqIdx = item.indexOf('=');
        if (eqIdx <= 0) continue;

        const verName = item.slice(0, eqIdx); // 'dub', 'leg', etc.
        const rawUrls = item.slice(eqIdx + 1).split(',').filter(Boolean);
        const resolvedUrls = rawUrls
          .map(u => resolveSourceUrl(u, bases))
          .filter(u => u && !u.includes('desativado.invalid'));

        if (resolvedUrls.length > 0) {
          versions[verName] = resolvedUrls;
        }
      }

      if (Object.keys(versions).length > 0) {
        // Extract year and clean title if formatted like "Filme (2024)"
        const yearMatch = title.match(/\((\d{4})\)/);
        const year = yearMatch ? yearMatch[1] : '';
        const cleanTitle = title.replace(/\(\d{4}\)/, '').trim();

        movies.push({
          id: `movie-${normalizeLetter(letter)}-${movies.length + 1}`,
          type: 'movie',
          title,
          cleanTitle,
          year,
          letter,
          versions
        });
      }
    }

    letterCache.set(cacheKey, movies);
    return movies;
  } catch (err) {
    console.error(`Erro ao carregar filmes da letra ${letter}:`, err);
    return [];
  }
}

/**
 * Fetch series list by letter
 */
export async function getSeriesByLetter(letter) {
  const cacheKey = `series_${letter}`;
  if (letterCache.has(cacheKey)) {
    return letterCache.get(cacheKey);
  }

  const url = `${VOD_BASE_URL}series-${normalizeLetter(letter)}.txt`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];

    const text = await res.text();
    const seriesList = [];

    for (const line of text.split('\n')) {
      const parts = line.split('\t');
      if (parts.length < 3 || !parts[0].trim()) continue;

      const title = parts[0].trim();
      const year = (parts[1] || '').trim();
      const piece = Number(parts[2]) || 0;
      const episodeCount = Number(parts[3]) || 0;

      seriesList.push({
        id: `series-${normalizeLetter(letter)}-${seriesList.length + 1}`,
        type: 'series',
        title,
        cleanTitle: title,
        year,
        letter,
        piece,
        episodeCount,
        fullName: year ? `${title} (${year})` : title
      });
    }

    letterCache.set(cacheKey, seriesList);
    return seriesList;
  } catch (err) {
    console.error(`Erro ao carregar séries da letra ${letter}:`, err);
    return [];
  }
}

/**
 * Fetch episode details for a given series
 */
export async function getSeriesEpisodes(seriesItem) {
  const { letter, piece, title, year } = seriesItem;
  const cacheKey = `episodes_${letter}_${piece}_${title}`;
  if (letterCache.has(cacheKey)) {
    return letterCache.get(cacheKey);
  }

  const { bases } = await getVodIndex();
  const url = `${VOD_BASE_URL}series-${normalizeLetter(letter)}-${piece}.txt`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];

    const text = await res.text();
    const episodes = [];
    let isTargetSeries = false;

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('@')) {
        if (isTargetSeries) {
          // Reached next series in this piece
          break;
        }
        const headerParts = trimmed.slice(1).split('\t');
        const headerTitle = headerParts[0].trim();
        const headerYear = (headerParts[1] || '').trim();

        if (headerTitle === title && (!year || headerYear === year)) {
          isTargetSeries = true;
        }
        continue;
      }

      if (!isTargetSeries) continue;

      const cols = trimmed.split('\t');
      if (cols.length < 4) continue;

      const seasonNum = Number(cols[0]) || 1;
      const epNum = Number(cols[1]) || 1;
      const version = cols[2].trim(); // dub / leg
      const rawUrls = cols[3].split(',').filter(Boolean);
      const urls = rawUrls
        .map(u => resolveSourceUrl(u, bases))
        .filter(u => u && !u.includes('desativado.invalid'));

      if (urls.length > 0) {
        // Group by season and episode number
        let ep = episodes.find(e => e.season === seasonNum && e.episode === epNum);
        if (!ep) {
          ep = {
            id: `ep-${seasonNum}-${epNum}`,
            season: seasonNum,
            episode: epNum,
            versions: {}
          };
          episodes.push(ep);
        }
        ep.versions[version] = urls;
      }
    }

    letterCache.set(cacheKey, episodes);
    return episodes;
  } catch (err) {
    console.error(`Erro ao obter episódios de ${title}:`, err);
    return [];
  }
}

/**
 * Load global search index from busca.txt (contains 40k+ titles)
 */
export async function getSearchIndex() {
  if (cachedSearchIndex) return cachedSearchIndex;

  try {
    const res = await fetch(`${VOD_BASE_URL}busca.txt`);
    if (!res.ok) return [];

    const text = await res.text();
    const items = [];

    for (const line of text.split('\n')) {
      const parts = line.split('\t');
      if (parts.length < 3 || !parts[0].trim()) continue;

      const title = parts[0].trim();
      const isSeries = parts[1].trim() === 's';
      const letter = parts[2].trim();
      const year = (parts[3] || '').trim();

      items.push({
        title,
        type: isSeries ? 'series' : 'movie',
        letter,
        year,
        fullName: year ? `${title} (${year})` : title
      });
    }

    cachedSearchIndex = items;
    return items;
  } catch (err) {
    console.error('Erro ao baixar índice de busca:', err);
    return [];
  }
}

/**
 * Search across the 40k+ titles
 */
export async function searchVod(query, maxResults = 50) {
  if (!query || query.trim().length < 2) return [];

  const index = await getSearchIndex();
  const clean = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const matches = [];
  for (const item of index) {
    const target = item.fullName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (target.includes(clean)) {
      matches.push(item);
    }
  }

  return matches;
}

/**
 * Find full media item with streaming sources given a search result item
 */
export async function resolveMediaItem(item) {
  if (item.versions || (item.type === 'series' && item.piece !== undefined)) {
    return item;
  }

  const letter = item.letter || (item.title ? item.title[0].toUpperCase() : 'A');

  if (item.type === 'series') {
    const list = await getSeriesByLetter(letter);
    const match = list.find(s => s.title === item.title) || list[0];
    return match ? { ...item, ...match } : item;
  } else {
    const list = await getMoviesByLetter(letter);
    const match = list.find(m => m.title === item.title) || list[0];
    return match ? { ...item, ...match } : item;
  }
}
