import { fetchJson } from "@/lib/w3cUtils";

const SEASON = 24;
const GATEWAY = 20;

export async function fetchMatchHistory(
  battletag: string
) {
  const url =
    `https://website-backend.w3champions.com/api/matches/search` +
    `?playerId=${encodeURIComponent(battletag)}` +
    `&gateway=${GATEWAY}` +
    `&offset=0&pageSize=50` +
    `&season=${SEASON}`;

  const json = await fetchJson<any>(url);
  if (!json?.matches) return [];

  return json.matches
    .map((m: any) => extractMatch(m, battletag))
    .filter(Boolean);
}

function extractMatch(match: any, battletag: string) {
  const players = match.teams.flatMap(
    (t: any) => t.players
  );

  const me = players.find(
    (p: any) =>
      p.battleTag.toLowerCase() ===
      battletag.toLowerCase()
  );

  if (!me) return null;

  const opponent = players.find(
    (p: any) =>
      p.battleTag.toLowerCase() !==
      battletag.toLowerCase()
  );

  return {
    id: match.id,
    map: match.mapName,
    startTime: match.startTime,
    duration: match.durationInSeconds,

    server: match.serverInfo?.name ?? "Unknown",
    provider: match.serverInfo?.provider ?? null,

    won: me.won,

    oldMmr: me.oldMmr,
    newMmr: me.currentMmr,
    mmrGain: me.mmrGain,

    leagueId: me.ranking?.leagueId ?? null,
    division: me.ranking?.division ?? null,
    ladderRank: me.ranking?.rank ?? null,

    myRace: me.race,
    myRndRace: me.rndRace ?? null,

    oppRace: opponent?.race ?? null,
    oppRndRace: opponent?.rndRace ?? null,

    opponentTag: opponent?.battleTag ?? null,
    opponentCountry:
      opponent?.countryCode ??
      opponent?.location ??
      null,

    myHeroes: me.heroes ?? [],
    oppHeroes: opponent?.heroes ?? [],
  };
}