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
  const canonical = (await resolveBattleTagViaSearch(inputBattletag)) || inputBattletag;

  const url =
    `https://website-backend.w3champions.com/api/matches/search` +
    `?playerId=${encodeURIComponent(canonical)}` +
    `&gateway=${GATEWAY}` +
    `&offset=0&pageSize=${PAGE_SIZE}` +
    `&season=${SEASON}`;

  const json = await fetchJson<any>(url);
  if (!json?.matches) return [];

  return json.matches.map((m: any) => extractMatch(m, canonical)).filter(Boolean);
}

/* -------------------- CACHED EXPORT -------------------- */

export const fetchMatchHistory = unstable_cache(
  async (battletag: string) => _fetchMatchHistory(battletag),
  ["w3c-match-history"],
  { revalidate: 120 }
);

/* -------------------- EXTRACTOR -------------------- */

function extractMatch(match: any, battletag: string) {
  const players =
    match.teams?.flatMap((t: any) => t.players ?? []) ?? [];

  const me = players.find(
    (p: any) =>
      p?.battleTag?.toLowerCase() === battletag.toLowerCase()
  );

  if (!me) return null;

  const opponent = players.find(
    (p: any) =>
      p?.battleTag?.toLowerCase() !== battletag.toLowerCase()
  );

  const oppOldMmr =
    typeof opponent?.oldMmr === "number" ? opponent.oldMmr : undefined;

  const oppNewMmr =
    typeof opponent?.currentMmr === "number" ? opponent.currentMmr : undefined;

  const oppMmrGain =
    typeof opponent?.mmrGain === "number"
      ? opponent.mmrGain
      : typeof oppOldMmr === "number" && typeof oppNewMmr === "number"
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

    // add opponent MMR
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
    opponentCountry: opponent?.countryCode ?? opponent?.location ?? null,

    myHeroes: me.heroes ?? [],
    oppHeroes: opponent?.heroes ?? [],
  };
}