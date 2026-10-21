// Service to fetch and manage live TV channels from Saimo TV catalog

const CATALOG_URL = 'https://canais-saimo.pages.dev/catalogo.txt';
const DEACTIVATED_URL = 'https://saimo-tv.pages.dev/fontes-desativadas.json';
const CACHE_KEY = 'cinestream_channels_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

let cachedChannels = null;
let deactivatedHosts = new Set();

/**
 * Fetch deactivated stream hosts to filter dead sources
 */
export async function getDeactivatedHosts() {
  if (deactivatedHosts.size > 0) return deactivatedHosts;
  try {
    const res = await fetch(DEACTIVATED_URL);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.desativados)) {
        deactivatedHosts = new Set(data.desativados);
      }
    }
  } catch (err) {
    console.warn('Could not fetch deactivated hosts:', err);
  }
  return deactivatedHosts;
}

/**
 * Parse catalogo.txt into structured Channel objects
 */
export function parseChannelsCatalog(text, blockedHosts = new Set()) {
  const lines = text.split('\n');
  const channels = [];
  let currentChannel = null;
  let currentSource = null;

  function isHostBlocked(url) {
    if (!url) return false;
    for (const host of blockedHosts) {
      if (url.includes(host)) return true;
    }
    return false;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('#')) continue;

    const colonIdx = rawLine.indexOf(':');
    if (colonIdx === -1) continue;

    const key = rawLine.slice(0, colonIdx).trim().toLowerCase();
    const value = rawLine.slice(colonIdx + 1).trim();

    if (key === 'canal') {
      if (currentChannel && currentChannel.sources.length > 0) {
        channels.push(currentChannel);
      }
      currentChannel = {
        id: `ch-${channels.length + 1}-${encodeURIComponent(value.toLowerCase().replace(/\s+/g, '-'))}`,
        name: value,
        category: 'Geral',
        logo: '',
        sources: []
      };
      currentSource = null;
    } else if (!currentChannel) {
      continue;
    } else if (key === 'categoria') {
      currentChannel.category = value;
    } else if (key === 'logo') {
      currentChannel.logo = value;
    } else if (key === 'fonte') {
      if (!isHostBlocked(value)) {
        currentSource = {
          url: value,
          quality: 'Auto',
          name: '',
          referer: '',
          agent: '',
          key: ''
        };
        currentChannel.sources.push(currentSource);
      } else {
        currentSource = null;
      }
    } else if (currentSource) {
      if (key === 'qualidade') {
        currentSource.quality = value;
      } else if (key === 'nome') {
        currentSource.name = value;
      } else if (key === 'referer') {
        currentSource.referer = value;
      } else if (key === 'agente') {
        currentSource.agent = value;
      } else if (key === 'chave') {
        currentSource.key = value;
      }
    }
  }

  if (currentChannel && currentChannel.sources.length > 0) {
    channels.push(currentChannel);
  }

  return channels;
}

/**
 * Fetch and return all available channels
 */
export async function getChannels(forceRefresh = false) {
  if (!forceRefresh && cachedChannels) {
    return cachedChannels;
  }

  // Check localStorage cache
  if (!forceRefresh) {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const { timestamp, data } = JSON.parse(stored);
        if (Date.now() - timestamp < CACHE_TTL && Array.isArray(data) && data.length > 0) {
          cachedChannels = data;
          return cachedChannels;
        }
      }
    } catch {
      // ignore
    }
  }

  const blockedHosts = await getDeactivatedHosts();
  const res = await fetch(CATALOG_URL);
  if (!res.ok) {
    throw new Error(`Erro ao baixar catálogo de canais: HTTP ${res.status}`);
  }

  const text = await res.text();
  const channels = parseChannelsCatalog(text, blockedHosts);

  cachedChannels = channels;

  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data: channels
      })
    );
  } catch {
    // ignore quota error
  }

  return channels;
}

/**
 * Extract unique categories and counts
 */
export function getCategories(channels) {
  const map = new Map();
  map.set('Todos', channels.length);

  channels.forEach(ch => {
    const cat = ch.category || 'Outros';
    map.set(cat, (map.get(cat) || 0) + 1);
  });

  return Array.from(map.entries()).map(([name, count]) => ({
    name,
    count
  }));
}
