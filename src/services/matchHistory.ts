// src/services/matchHistory.ts

import { unstable_cache } from "next/cache";

import { fetchJson } from "@/lib/w3cUtils";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

/* -------------------- CONSTANTS -------------------- */

const SEASON = 24;
const GATEWAY = 20;
const PAGE_SIZE = 50;

/* -------------------- CORE (UNCACHED) -------------------- */

async function _fetchMatchHistory(inputBattletag: string) {

  const canonical =
    (await resolveBattleTagViaSearch(inputBattletag)) ||
    inputBattletag;

  const url =
    `https://website-backend.w3champions.com/api/matches/search` +
    `?playerId=${encodeURIComponent(canonical)}` +
    `&gateway=${GATEWAY}` +
    `&offset=0&pageSize=${PAGE_SIZE}` +
    `&season=${SEASON}`;

  const json = await fetchJson<any>(url);
  if (!json?.matches) return [];

  const out: any[] = [];

  for (let i = 0; i < json.matches.length; i++) {

    const m = extractMatch(json.matches[i], canonical);

    if (m) out.push(m);
  }

  return out;
}

/* -------------------- CACHED EXPORT -------------------- */

export const fetchMatchHistory = unstable_cache(
  async (battletag: string) => _fetchMatchHistory(battletag),
  ["w3c-match-history"],
  { revalidate: 120 }
);

/* -------------------- EXTRACTOR -------------------- */

function extractMatch(match: any, battletag: string) {

  const tagLower = battletag.toLowerCase();

  const teams = match.teams;
  if (!Array.isArray(teams)) return null;

  let me: any = null;
  let opponent: any = null;

  for (let i = 0; i < teams.length; i++) {

    const players = teams[i]?.players;
    if (!Array.isArray(players)) continue;

    for (let j = 0; j < players.length; j++) {

      const p = players[j];
      const tag = p?.battleTag?.toLowerCase();

      if (!tag) continue;

      if (tag === tagLower) {
        me = p;
      } else if (!opponent) {
        opponent = p;
      }
    }
  }

  if (!me) return null;

  const oppOldMmr =
    typeof opponent?.oldMmr === "number"
      ? opponent.oldMmr
      : undefined;

  const oppNewMmr =
    typeof opponent?.currentMmr === "number"
      ? opponent.currentMmr
      : undefined;

  const oppMmrGain =
    typeof opponent?.mmrGain === "number"
      ? opponent.mmrGain
      : typeof oppOldMmr === "number" &&
        typeof oppNewMmr === "number"
      ? oppNewMmr - oppOldMmr
      : undefined;

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

    oppOldMmr,
    oppNewMmr,
    oppMmrGain,

    leagueId: me.ranking?.leagueId ?? null,
    division: me.ranking?.division ?? null,
    ladderRank: me.ranking?.rank ?? null,

    myRace: me.race,
    myRndRace: me.rndRace ?? null,

    oppRace: opponent?.race ?? null,
    oppRndRace: opponent?.rndRace ?? null,

    opponentTag: opponent?.battleTag ?? null,
    opponentCountry:
      opponent?.countryCode ?? opponent?.location ?? null,

    myHeroes: me.heroes ?? [],
    oppHeroes: opponent?.heroes ?? [],
  };
}