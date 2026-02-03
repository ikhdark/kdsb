import {
  fetchCountryLadder,
  fetchPlayerProfile,
} from "@/services/w3cApi";

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { flattenCountryLadder } from "@/lib/ranking";
import { fetchAllMatches, fetchJson } from "@/lib/w3cUtils";

import {
  buildLadder,
  type LadderInputRow,
} from "@/lib/ladderEngine";

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
   GLOBAL CACHE
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
   COUNTRY HELPERS
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

  const [profile, matches] = await Promise.all([
    fetchPlayerProfile(canonicalTag),
    fetchAllMatches(canonicalTag, [SEASON]),
  ]);

  const canonicalLower = canonicalTag.toLowerCase();

  const inferredCountry = inferCountryFromMatches(matches, canonicalLower);
  const profileCountry = iso2(profile.countryCode);
  const countryCode = inferredCountry || profileCountry;

  const [rowsByPage, countryPayload] = await Promise.all([
    fetchGlobalRowsByPage(),
    countryCode
      ? fetchCountryLadder(countryCode, GATEWAY, GAMEMODE, SEASON)
      : Promise.resolve([]),
  ]);

  const countryRows = flattenCountryLadder(countryPayload);

  /* =========================
     BUILD RANKS USING SAME ENGINE
  ========================== */

  const ranks: RankRow[] = [];

  for (const [raceIdStr, raceName] of Object.entries(RACE_MAP)) {
    const raceId = Number(raceIdStr);

    /* ---------- GLOBAL LADDER ---------- */

    const globalInputs: LadderInputRow[] = [];

    for (const rawRows of rowsByPage.values()) {
      const flat = flattenCountryLadder(rawRows);

      for (const r of flat) {
        if (r.games < MIN_GAMES) continue;
        if (r.race !== raceId) continue;
        if (!r.battleTag) continue;

        globalInputs.push({
          battletag: r.battleTag,
          mmr: r.mmr,
          wins: r.wins,
          games: r.games,
          sos: null,
        });
      }
    }

    const globalLadder = buildLadder(globalInputs);

    const gIdx = globalLadder.findIndex(
      (p) => p.battletag.toLowerCase() === canonicalLower
    );

    if (gIdx === -1) continue;

    /* ---------- COUNTRY LADDER (FIXED) ---------- */

    let countryRank: number | null = null;
    let countryTotal: number | null = null;

    if (countryRows.length) {
      const countryInputs: LadderInputRow[] = countryRows
        .filter(
          (r) =>
            r.race === raceId &&
            r.games >= MIN_GAMES &&
            r.battleTag
        )
        .map((r) => ({
          battletag: r.battleTag!,
          mmr: r.mmr,
          wins: r.wins,
          games: r.games,
          sos: null,
        }));

      const countryLadder = buildLadder(countryInputs);

      countryTotal = countryLadder.length;

      const cIdx = countryLadder.findIndex(
        (p) => p.battletag.toLowerCase() === canonicalLower
      );

      countryRank = cIdx === -1 ? null : cIdx + 1;
    }

    ranks.push({
      race: raceName,
      raceId,
      globalRank: gIdx + 1,
      globalTotal: globalLadder.length,
      countryRank,
      countryTotal,
      mmr: globalLadder[gIdx].mmr,
      games: globalLadder[gIdx].games,
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
