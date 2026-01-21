// src/services/playerRank.ts
// Next.js-friendly ESM/TypeScript service (no Discord logic)

import {
  fetchCountryLadder,
  fetchPlayerProfile,
  type PlayerProfile,
} from "@/services/w3cApi";

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { flattenCountryLadder, rankByMMR } from "@/lib/ranking";

/* =========================
   RACE MAP (local)
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
  // IMPORTANT: despite the name, in practice this may be a BattleTag string on the ladder endpoint.
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
  battletag: string; // canonical casing
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
const SEASON = 23;
const MAX_LEAGUE_PAGE = 76;
const MIN_GAMES = 25;

/* =========================
   GLOBAL LADDER CACHE
========================= */

let cachedRowsByPage: Map<number, LadderEntry[]> | null = null;
let lastFetchTime = 0;
const GLOBAL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
          const data = (await r.json()) as unknown;
          return Array.isArray(data) ? (data as LadderEntry[]) : [];
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
   SERVICE
========================= */

export async function getW3CRank(
  inputTag: string
): Promise<W3CRankResponse | null> {
  if (!inputTag) return null;

  // SINGLE SOURCE OF TRUTH for BattleTag casing
  const canonicalTag = await resolveBattleTagViaSearch(inputTag);
  if (!canonicalTag) return null;

  // Profile fetch requires canonical BattleTag
  const profile: PlayerProfile = await fetchPlayerProfile(canonicalTag);

  // Keep these for country ladder matching fallback
  const canonicalLower = canonicalTag.toLowerCase();
  const playerIdLower =
    typeof profile.playerId === "string" && profile.playerId.length
      ? profile.playerId.toLowerCase()
      : null;

  const battletag = canonicalTag;
  const country = (profile.countryCode || profile.location || "UNK").toUpperCase();

  const [rowsByPage, countryPayload] = await Promise.all([
    fetchGlobalRowsByPage(),
    fetchCountryLadder(country, GATEWAY, GAMEMODE, SEASON),
  ]);

  const countryRows = Array.isArray(countryPayload)
    ? flattenCountryLadder(countryPayload)
    : [];

  // Build global pools by race.
  // IMPORTANT: match identity primarily by canonical BattleTag EXACT casing,
  // because your Discord working version implies ladder "player1Id" == BattleTag.
  const globalPools: Record<
    number,
    { idRaw: string; idLower: string; mmr: number; games: number; winPct: number }[]
  > = {};

  for (const raceId of Object.keys(RACE_MAP).map(Number)) globalPools[raceId] = [];

  for (const rows of rowsByPage.values()) {
    for (const e of rows) {
      const raceId = Number(e?.race);
      const pool = globalPools[raceId];
      if (!pool) continue;

      const idRaw = typeof e?.player1Id === "string" ? e.player1Id : null;
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

  // Sort pools by MMR desc, then win%, then games
  for (const raceId of Object.keys(RACE_MAP).map(Number)) {
    globalPools[raceId].sort((a, b) =>
      b.mmr !== a.mmr
        ? b.mmr - a.mmr
        : b.winPct !== a.winPct
        ? b.winPct - a.winPct
        : b.games - a.games
    );
  }

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

    // GLOBAL MATCH:
    // 1) Exact casing match vs canonical BattleTag (this matches your Discord behavior)
    // 2) Fallback: if ladder ever uses a lowercased battletag, try lower
    // 3) Fallback: if ladder ever uses playerId, allow matching via playerIdLower (also lower)
    let idx = pool.findIndex((p) => p.idRaw === canonicalTag);
    if (idx === -1) idx = pool.findIndex((p) => p.idLower === canonicalLower);
    if (idx === -1 && playerIdLower) idx = pool.findIndex((p) => p.idLower === playerIdLower);

    if (idx === -1) continue;

    const globalRank = idx + 1;
    const globalTotal = pool.length;

    const mmr = pool[idx].mmr;
    const games = pool[idx].games;

    // Country ladder: canonical battleTag lower first, then fallback playerId lower
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
      (countryRes
        ? ` | #${countryRes.rank} in ${country} (of ${countryRes.total})`
        : "") +
      ` — ${mmr} MMR, ${games} games\n`;
  }

  if (!foundAny) result += "_No ranked ladder data found._";

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
