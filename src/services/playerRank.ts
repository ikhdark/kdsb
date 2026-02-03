import {
  fetchCountryLadder,
  fetchPlayerProfile,
  type PlayerProfile,
} from "@/services/w3cApi";

import { hasLifetimeRaceGames } from "@/lib/raceEligibility";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { flattenCountryLadder, rankByMMR } from "@/lib/ranking";
import {
  fetchAllMatches,
  fetchJson,
} from "@/lib/w3cUtils";

/* =========================
   CONFIG
========================= */

const RACE_MAP: Record<number, string> = {
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
  0: "Random",
};

const GATEWAY = 20;
const GAMEMODE = 1;
const SEASON = 24;
const MAX_LEAGUE_PAGE = 76;

const MIN_GAMES = 5;
const MIN_LIFETIME_RACE_GAMES = 35;

const GLOBAL_CACHE_TTL = 5 * 60 * 1000;

/* =========================
   TYPES
========================= */

type RankRow = {
  race: string;
  raceId: number;
  globalRank: number;
  globalTotal: number;
  countryRank: number | null;
  countryTotal: number | null;
  mmr: number;
  games: number;
};

export type W3CRankResponse = {
  battletag: string;
  season: number;
  country: string;
  minGames: number;
  asOf: string;
  ranks: RankRow[];
};

/* =========================
   GLOBAL LADDER CACHE
========================= */

let cachedRowsByPage: Map<number, any[]> | null = null;
let lastFetchTime = 0;

async function fetchGlobalRowsByPage(): Promise<Map<number, any[]>> {
  const now = Date.now();

  if (cachedRowsByPage && now - lastFetchTime < GLOBAL_CACHE_TTL) {
    return cachedRowsByPage;
  }

  const requests: Promise<any[]>[] = [];

  for (let page = 0; page <= MAX_LEAGUE_PAGE; page++) {
    const url =
      `https://website-backend.w3champions.com/api/ladder/${page}` +
      `?gateWay=${GATEWAY}&gameMode=${GAMEMODE}&season=${SEASON}`;

    requests.push(fetchJson<any[]>(url).then((json) => json ?? []));
  }

  const pages = await Promise.all(requests);

  const map = new Map<number, any[]>();
  pages.forEach((rows, page) => map.set(page, rows));

  cachedRowsByPage = map;
  lastFetchTime = now;

  return map;
}

/* =========================
   COUNTRY INFERENCE
========================= */

function iso2(code: unknown): string {
  const c = String(code ?? "").toUpperCase();
  return c.length === 2 ? c : "";
}

function inferCountryFromMatches(matches: any[], selfLower: string): string {
  for (const m of matches) {
    if (!Array.isArray(m?.teams)) continue;

    for (const t of m.teams) {
      for (const p of t.players ?? []) {
        if (String(p?.battleTag).toLowerCase() === selfLower) {
          const cc = iso2(p?.countryCode);
          if (cc) return cc;
        }
      }
    }
  }

  return "";
}

/* =========================
   MAIN
========================= */

export async function getW3CRank(
  inputTag: string
): Promise<W3CRankResponse | null> {
  if (!inputTag) return null;

  const canonicalTag = await resolveBattleTagViaSearch(inputTag);
  if (!canonicalTag) return null;

  /* --------------------------------
     PARALLEL FETCH (only change)
     removes unnecessary latency
  -------------------------------- */

  const [profile, matches] = await Promise.all([
    fetchPlayerProfile(canonicalTag),
    fetchAllMatches(canonicalTag, [SEASON]),
  ]);

  const canonicalLower = canonicalTag.toLowerCase();
  const playerIdLower =
    typeof profile.playerId === "string"
      ? profile.playerId.toLowerCase()
      : null;

  /* =========================
     COUNTRY
  ========================== */

  const inferredCountry = inferCountryFromMatches(matches, canonicalLower);
  const profileCountry = iso2(profile.countryCode);
  const countryCode = inferredCountry || profileCountry;

  /* ========================= */

  const [rowsByPage, countryPayload] = await Promise.all([
    fetchGlobalRowsByPage(),
    countryCode
      ? fetchCountryLadder(countryCode, GATEWAY, GAMEMODE, SEASON)
      : Promise.resolve([]),
  ]);

  const countryRows = flattenCountryLadder(countryPayload);

  /* =========================
     BUILD GLOBAL POOLS
  ========================== */

  const globalPools: Record<number, any[]> = {};
  for (const raceId of Object.keys(RACE_MAP).map(Number)) {
    globalPools[raceId] = [];
  }

  for (const rawRows of rowsByPage.values()) {
    const flat = flattenCountryLadder(rawRows);

    for (const r of flat) {
      if (r.games < MIN_GAMES) continue;

      const pool = globalPools[r.race];
      if (!pool) continue;

      pool.push({
        battleTagLower: r.battleTagLower,
        playerIdLower: r.playerIdLower,
        mmr: r.mmr,
        games: r.games,
        winPct: r.games ? r.wins / r.games : 0,
      });
    }
  }

  for (const raceId of Object.keys(RACE_MAP).map(Number)) {
    globalPools[raceId].sort((a, b) =>
      b.mmr !== a.mmr
        ? b.mmr - a.mmr
        : b.winPct !== a.winPct
        ? b.winPct - a.winPct
        : b.games - a.games
    );
  }

  /* =========================
     RANK CALC
  ========================== */

  const ranks: RankRow[] = [];

  for (const [raceIdStr, raceName] of Object.entries(RACE_MAP)) {
    const raceId = Number(raceIdStr);

    const eligible = await hasLifetimeRaceGames(
      canonicalTag,
      raceId,
      MIN_LIFETIME_RACE_GAMES
    );
    if (!eligible) continue;

    const pool = globalPools[raceId];

    const idx = pool.findIndex(
      (p) =>
        p.battleTagLower === canonicalLower ||
        (playerIdLower && p.playerIdLower === playerIdLower)
    );

    if (idx === -1) continue;

    const countryRes = rankByMMR(
      countryRows,
      canonicalLower,
      raceId,
      MIN_GAMES,
      playerIdLower
    );

    ranks.push({
      race: raceName,
      raceId,
      globalRank: idx + 1,
      globalTotal: pool.length,
      countryRank: countryRes?.rank ?? null,
      countryTotal: countryRes?.total ?? null,
      mmr: pool[idx].mmr,
      games: pool[idx].games,
    });
  }

  return {
    battletag: canonicalTag,
    season: SEASON,
    country: countryCode || "—",
    minGames: MIN_GAMES,
    asOf: new Date().toLocaleString(),
    ranks,
  };
}
