// ESPN Sports Service to show live and upcoming matches for Brazilian and international football

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const LEAGUES = [
  { id: 'soccer/bra.1', name: 'Brasileirão Série A' },
  { id: 'soccer/bra.2', name: 'Brasileirão Série B' },
  { id: 'soccer/bra.copa_do_brazil', name: 'Copa do Brasil' },
  { id: 'soccer/conmebol.libertadores', name: 'Copa Libertadores' },
  { id: 'soccer/conmebol.sudamericana', name: 'Copa Sul-Americana' },
  { id: 'soccer/uefa.champions', name: 'UEFA Champions League' },
  { id: 'soccer/eng.1', name: 'Premier League' },
  { id: 'soccer/esp.1', name: 'La Liga' },
  { id: 'soccer/ita.1', name: 'Serie A Italiana' }
];

let cachedEvents = null;
let lastFetchTime = 0;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export async function getLiveSportsEvents() {
  if (cachedEvents && Date.now() - lastFetchTime < CACHE_DURATION) {
    return cachedEvents;
  }

  const allEvents = [];

  // Fetch top 4 active leagues in parallel to keep it fast
  const targetLeagues = LEAGUES.slice(0, 6);

  await Promise.all(
    targetLeagues.map(async league => {
      try {
        const res = await fetch(`${ESPN_BASE}/${league.id}/scoreboard`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          for (const ev of data.events) {
            const comp = ev.competitions?.[0];
            if (!comp) continue;

            const homeTeam = comp.competitors?.find(c => c.homeAway === 'home');
            const awayTeam = comp.competitors?.find(c => c.homeAway === 'away');

            const status = ev.status?.type?.state; // 'pre', 'in', 'post'
            const statusDetail = ev.status?.type?.shortDetail || '';

            allEvents.push({
              id: ev.id,
              league: league.name,
              name: ev.name,
              date: ev.date,
              status, // 'pre' = agendado, 'in' = ao vivo, 'post' = finalizado
              statusDetail,
              home: {
                name: homeTeam?.team?.displayName || 'Casa',
                shortName: homeTeam?.team?.shortDisplayName || '',
                logo: homeTeam?.team?.logo || '',
                score: homeTeam?.score || '0'
              },
              away: {
                name: awayTeam?.team?.displayName || 'Visitante',
                shortName: awayTeam?.team?.shortDisplayName || '',
                logo: awayTeam?.team?.logo || '',
                score: awayTeam?.score || '0'
              },
              broadcast: comp.broadcasts?.[0]?.names?.[0] || 'Ao Vivo'
            });
          }
        }
      } catch (err) {
        console.warn(`Erro ao carregar liga ${league.name}:`, err);
      }
    })
  );

  // Sort: 'in' (ao vivo) first, then 'pre' (próximos), then 'post'
  allEvents.sort((a, b) => {
    const order = { in: 0, pre: 1, post: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  cachedEvents = allEvents;
  lastFetchTime = Date.now();
  return allEvents;
}
