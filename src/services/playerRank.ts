// src/services/playerRank.ts
// Next.js-friendly ESM/TypeScript service

import {
  fetchCountryLadder,
  fetchPlayerProfile,
  type PlayerProfile,
} from "@/services/w3cApi";

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { flattenCountryLadder, rankByMMR } from "@/lib/ranking";
import { fetchAllMatches } from "@/lib/w3cUtils";

/* =========================
   RACE MAP
========================= */

const RACE_MAP: Record<number, string> = {
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
  0: "Random",
};

/* =========================
   TYPES
========================= */

type LadderPlayerStats = {
  games?: number;
  wins?: number;
  won?: number;
  mmr?: number;
};

type LadderEntry = {
  race?: number | string;
  player1Id?: string;
  player?: LadderPlayerStats;
};

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
  result?: string;
};

/* =========================
   CONFIG
========================= */

const GATEWAY = 20;
const GAMEMODE = 1;
const SEASON = 24;
const MAX_LEAGUE_PAGE = 76;
const MIN_GAMES = 5;

/* =========================
   GLOBAL LADDER CACHE
========================= */

let cachedRowsByPage: Map<number, LadderEntry[]> | null = null;
let lastFetchTime = 0;

const GLOBAL_CACHE_TTL = 5 * 60 * 1000;

async function fetchGlobalRowsByPage(): Promise<Map<number, LadderEntry[]>> {
  const now = Date.now();

  if (cachedRowsByPage && now - lastFetchTime < GLOBAL_CACHE_TTL) {
    return cachedRowsByPage;
  }

  const requests: Promise<LadderEntry[]>[] = [];

  for (let page = 0; page <= MAX_LEAGUE_PAGE; page++) {
    const url =
      `https://website-backend.w3champions.com/api/ladder/${page}` +
      `?gateWay=${GATEWAY}&gameMode=${GAMEMODE}&season=${SEASON}`;

    requests.push(
      fetch(url, { cache: "no-store" })
        .then(async (r) => {
          if (!r.ok) return [];
          const data = await r.json();
          return Array.isArray(data) ? data : [];
        })
        .catch(() => [])
    );
  }

  const pages = await Promise.all(requests);

  const map = new Map<number, LadderEntry[]>();
  pages.forEach((rows, page) => map.set(page, rows));

  cachedRowsByPage = map;
  lastFetchTime = now;

  return map;
}

/* =========================
   HELPERS
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
   SERVICE
========================= */

export async function getW3CRank(
  inputTag: string
): Promise<W3CRankResponse | null> {
  if (!inputTag) return null;

  const canonicalTag = await resolveBattleTagViaSearch(inputTag);
  if (!canonicalTag) return null;

  const profile: PlayerProfile = await fetchPlayerProfile(canonicalTag);

  const canonicalLower = canonicalTag.toLowerCase();
  const playerIdLower =
    typeof profile.playerId === "string"
      ? profile.playerId.toLowerCase()
      : null;

  const battletag = canonicalTag;

  /* =========================
     COUNTRY (MATCH FIRST)
  ========================== */

  const matches = await fetchAllMatches(canonicalTag, [SEASON]);

  const inferredCountry = inferCountryFromMatches(matches, canonicalLower);
  const profileCountry = iso2(profile.countryCode);

  const rawCountry = inferredCountry || profileCountry;
  const isValidCountry = rawCountry.length === 2;

  const country = isValidCountry ? rawCountry : "—";

  const [rowsByPage, countryPayload] = await Promise.all([
    fetchGlobalRowsByPage(),
    isValidCountry
      ? fetchCountryLadder(rawCountry, GATEWAY, GAMEMODE, SEASON)
      : Promise.resolve([]),
  ]);

  const countryRows = Array.isArray(countryPayload)
    ? flattenCountryLadder(countryPayload)
    : [];

  /* =========================
     BUILD GLOBAL POOLS
  ========================== */

  const globalPools: Record<
    number,
    { idRaw: string; idLower: string; mmr: number; games: number; winPct: number }[]
  > = {};

  for (const raceId of Object.keys(RACE_MAP).map(Number)) {
    globalPools[raceId] = [];
  }

  for (const rows of rowsByPage.values()) {
    for (const e of rows) {
      const raceId = Number(e?.race);
      const pool = globalPools[raceId];
      if (!pool) continue;

      const idRaw = e?.player1Id;
      if (!idRaw) continue;

      const games = Number(e?.player?.games ?? 0);
      if (games < MIN_GAMES) continue;

      const wins = Number(e?.player?.wins ?? e?.player?.won ?? 0);
      const mmr = Math.round(Number(e?.player?.mmr ?? 0));

      pool.push({
        idRaw,
        idLower: idRaw.toLowerCase(),
        mmr,
        games,
        winPct: games ? wins / games : 0,
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
     BUILD RANKS
  ========================== */

  const asOf = new Date().toLocaleString();

  const ranks: RankRow[] = [];

  let result =
    `📊 ${battletag} — 1v1 Race Rank by MMR (Season ${SEASON})\n\n` +
    `— Min ${MIN_GAMES} Games —\n\n` +
    `As of: ${asOf}\n\n`;

  let foundAny = false;

  for (const [raceIdStr, raceName] of Object.entries(RACE_MAP)) {
    const raceId = Number(raceIdStr);
    const pool = globalPools[raceId];
    if (!pool?.length) continue;

    let idx = pool.findIndex((p) => p.idRaw === canonicalTag);
    if (idx === -1) idx = pool.findIndex((p) => p.idLower === canonicalLower);
    if (idx === -1 && playerIdLower)
      idx = pool.findIndex((p) => p.idLower === playerIdLower);
    if (idx === -1) continue;

    const globalRank = idx + 1;
    const globalTotal = pool.length;
    const mmr = pool[idx].mmr;
    const games = pool[idx].games;

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
      globalRank,
      globalTotal,
      countryRank: countryRes ? countryRes.rank : null,
      countryTotal: countryRes ? countryRes.total : null,
      mmr,
      games,
    });

    foundAny = true;

    result +=
      `${raceName} — #${globalRank}/${globalTotal} globally` +
      `${countryRes ? ` | #${countryRes.rank} in ${country} (of ${countryRes.total})` : ""}` +
      ` — ${mmr} MMR, ${games} games\n`;
  }

  if (!foundAny) {
    result += "_No ranked ladder data found._";
  }

  ranks.sort((a, b) => b.mmr - a.mmr);

  return {
    battletag,
    season: SEASON,
    country,
    minGames: MIN_GAMES,
    asOf,
    ranks,
    result,
  };
}
