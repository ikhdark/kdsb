// src/services/playerSummary.ts

import { fetchPlayerProfile } from "@/services/w3cApi";
import { fetchAllMatches, fetchJson } from "@/lib/w3cUtils";
import { raceLabel } from "@/lib/w3cRaces";
import { getCountryRaceLadder } from "@/services/countryRaceLadder";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { flattenCountryLadder } from "@/lib/ranking";
import type { RaceKey } from "@/services/countryRaceLadder";
import { buildLadder, type LadderInputRow } from "@/lib/ladderEngine";
import { COUNTRY_OVERRIDE } from "@/lib/countryOverrides";

/* =====================================================
   GLOBAL CONSTANTS
===================================================== */

const GATEWAY = 20;
const GAMEMODE = 1;

const SEASON = 24;
const SEASONS = [22, 23, 24];

const MIN_GAMES = 5;
const MIN_DURATION_SECONDS = 120;

const GLOBAL_CACHE_TTL = 5 * 60 * 1000;
const MAX_LEAGUE_PAGE = 30;

/* =====================================================
   RACE MAPS
===================================================== */

const RACE_MAP: Record<number, string> = {
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
  0: "Random",
};

const RACE_KEY_MAP: Record<number, RaceKey> = {
  1: "human",
  2: "orc",
  4: "elf",
  8: "undead",
  0: "random",
};

/* =====================================================
   TYPES
===================================================== */

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

/* =====================================================
   GLOBAL LADDER CACHE
===================================================== */

let cachedRowsByPage: Map<number, any[]> | null = null;
let lastFetchTime = 0;

async function fetchGlobalRowsByPage() {
  const now = Date.now();

  if (cachedRowsByPage && now - lastFetchTime < GLOBAL_CACHE_TTL) {
    return cachedRowsByPage;
  }

  const pages = await Promise.all(
    Array.from({ length: MAX_LEAGUE_PAGE + 1 }, (_, page) =>
      fetchJson<any[]>(
        `https://website-backend.w3champions.com/api/ladder/${page}?gateWay=${GATEWAY}&gameMode=${GAMEMODE}&season=${SEASON}`
      ).then((r) => r ?? [])
    )
  );

  const map = new Map<number, any[]>();
  pages.forEach((rows, i) => map.set(i, rows));

  cachedRowsByPage = map;
  lastFetchTime = now;

  return map;
}

/* =====================================================
   HELPERS
===================================================== */

const iso2 = (v: unknown) =>
  String(v ?? "").toUpperCase().slice(0, 2);

const effectiveCountryForTag = (tag: string, country: string) =>
  (COUNTRY_OVERRIDE[tag]?.to ?? country).toUpperCase();

const toDate = (v: any): Date | null => {
  const n = Number(v);
  if (Number.isFinite(n)) return new Date(n < 1e12 ? n * 1000 : n);
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
};

const toNumber = (v: any): number | null =>
  typeof v === "number"
    ? v
    : typeof v === "string"
    ? Number(v)
    : null;

/* =====================================================
   PUBLIC — getW3CRank
===================================================== */

export async function getW3CRank(
  inputTag: string
): Promise<W3CRankResponse | null> {

  if (!inputTag) return null;

  const canonical = await resolveBattleTagViaSearch(inputTag);
  if (!canonical) return null;

  const lower = canonical.toLowerCase();

  const [profile, matches, rowsByPage] = await Promise.all([
    fetchPlayerProfile(canonical),
    fetchAllMatches(canonical, [SEASON]),
    fetchGlobalRowsByPage(),
  ]);

  /* ---------- resolve country ---------- */

  let countryFromMatches = "";

  for (const m of matches) {
    for (const t of m?.teams ?? []) {
      for (const p of t.players ?? []) {
        if (p?.battleTag?.toLowerCase() !== lower) continue;

        const cc =
          iso2(p?.countryCode) ||
          iso2(p?.location);

        if (cc) {
          countryFromMatches = cc;
          break;
        }
      }
    }
  }

  const countryCode =
    countryFromMatches ||
    iso2(profile?.countryCode) ||
    iso2(profile?.location) ||
    "";

  const effectiveCountry = countryCode
    ? effectiveCountryForTag(canonical, countryCode)
    : "";

  /* =====================================================
     PERFORMANCE FIX
     flatten ladder ONCE instead of 5 times
  ===================================================== */

  const allRows: any[] = [];

  for (const raw of rowsByPage.values()) {
    allRows.push(...flattenCountryLadder(raw));
  }

  const rowsByRace = new Map<number, any[]>();

  for (const r of allRows) {
    if (r.games < MIN_GAMES || !r.battleTag) continue;

    if (!rowsByRace.has(r.race)) {
      rowsByRace.set(r.race, []);
    }

    rowsByRace.get(r.race)!.push(r);
  }

  /* =====================================================
     COUNTRY LADDER PROMISE CACHE
  ===================================================== */

  const countryRacePromises = new Map<RaceKey, Promise<any>>();

  if (effectiveCountry) {
    for (const key of Object.values(RACE_KEY_MAP)) {
      if (!countryRacePromises.has(key)) {
        countryRacePromises.set(
          key,
          getCountryRaceLadder(
            effectiveCountry,
            key,
            undefined,
            GAMEMODE,
            9999
          )
        );
      }
    }
  }

  const ranks: RankRow[] = [];

  for (const raceIdStr in RACE_MAP) {

    const raceId = Number(raceIdStr);
    const raceName = RACE_MAP[raceId];
    const raceKey = RACE_KEY_MAP[raceId];

    const raceRows = rowsByRace.get(raceId) ?? [];

    const inputs: LadderInputRow[] = raceRows.map((r) => ({
      battletag: r.battleTag,
      mmr: r.mmr,
      wins: r.wins,
      games: r.games,
      sos: null,
    }));

    const ladder = buildLadder(inputs);

    const idx = ladder.findIndex(
      (p: any) => p.battletag.toLowerCase() === lower
    );

    if (idx === -1) continue;

    let countryRank: number | null = null;
    let countryTotal: number | null = null;

    if (effectiveCountry) {
      const ladderData = await countryRacePromises.get(raceKey);

      if (ladderData) {
        countryTotal = ladderData.poolSize;

        const i = ladderData.full.findIndex(
          (p: any) =>
            p.battletag.toLowerCase() === lower
        );

        countryRank = i === -1 ? null : i + 1;
      }
    }

    const p = ladder[idx];

    ranks.push({
      race: raceName,
      raceId,
      globalRank: idx + 1,
      globalTotal: ladder.length,
      countryRank,
      countryTotal,
      mmr: p.mmr,
      games: p.games,
    });
  }

  return {
    battletag: canonical,
    season: SEASON,
    country: effectiveCountry || countryCode || "—",
    minGames: MIN_GAMES,
    asOf: new Date().toLocaleString(),
    ranks,
  };
}

/* =====================================================
   SUMMARY SERVICE
===================================================== */

export async function getPlayerSummary(inputTag: string) {

  const canonical = await resolveBattleTagViaSearch(inputTag);
  if (!canonical) return null;

  const lower = canonical.toLowerCase();

  let matches = await fetchAllMatches(canonical, SEASONS);

  if (!matches.length) {
    return {
      summary: {
        battletag: canonical,
        mostPlayedAllTime: "Unknown",
        mostPlayedThisSeason: "Unknown",
        highestCurrentRace: null,
        highestCurrentMMR: null,
        lastPlayedLadder: null,
        lastPlayedRace: {},
        top2Peaks: [],
      },
    };
  }

  matches = [...matches].sort(
    (a, b) =>
      (toDate(a?.startTime)?.getTime() ?? 0) -
      (toDate(b?.startTime)?.getTime() ?? 0)
  );

  const raceGamesAll: Record<string, number> = {};
  const raceGamesSeason: Record<string, number> = {};
  const lastPlayedRace: Record<string, Date> = {};

  const raceMMR: Record<string, number> = {};
  const raceMMRAt: Record<string, number> = {};
  const peaks: Record<string, any> = {};

  let lastPlayedLadder: Date | null = null;

  for (const m of matches) {

    if (
      m.gameMode !== GAMEMODE ||
      m.durationInSeconds < MIN_DURATION_SECONDS
    ) continue;

    const date = toDate(m.startTime);
    if (!date) continue;

    const players =
      m.teams?.flatMap((t: any) => t.players ?? []) ?? [];

    const me = players.find(
      (p: any) => p?.battleTag?.toLowerCase() === lower
    );

    if (!me) continue;

    const race = raceLabel(me?.race) ?? "Unknown";

    raceGamesAll[race] = (raceGamesAll[race] || 0) + 1;

    if (!lastPlayedRace[race] || date > lastPlayedRace[race])
      lastPlayedRace[race] = date;

    if (!lastPlayedLadder || date > lastPlayedLadder)
      lastPlayedLadder = date;

    if (m.season === SEASON) {

      raceGamesSeason[race] =
        (raceGamesSeason[race] || 0) + 1;

      const mmr =
        toNumber(me?.newMmr) ??
        toNumber(me?.currentMmr) ??
        toNumber(me?.oldMmr);

      if (mmr != null) {
        const t = date.getTime();
        if (t >= (raceMMRAt[race] ?? -1)) {
          raceMMRAt[race] = t;
          raceMMR[race] = mmr;
        }
      }
    }

    if (typeof me.currentMmr === "number") {
      if (!peaks[race] || me.currentMmr > peaks[race].mmr) {
        peaks[race] = {
          race,
          mmr: me.currentMmr,
          season: m.season,
        };
      }
    }
  }

  const mostPlayedAllTime =
    Object.entries(raceGamesAll)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Unknown";

  const mostPlayedThisSeason =
    Object.entries(raceGamesSeason)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Unknown";

  const highest =
    Object.entries(raceMMR)
      .sort((a, b) => b[1] - a[1])[0];

  const highestRace = highest?.[0] ?? null;

  const top2Peaks = Object.values(peaks)
    .sort((a: any, b: any) => b.mmr - a.mmr)
    .slice(0, 2);

  return {
    summary: {
      battletag: canonical,
      mostPlayedAllTime,
      mostPlayedThisSeason,
      highestCurrentRace: highestRace,
      highestCurrentMMR: highestRace
        ? raceMMR[highestRace] ?? null
        : null,
      lastPlayedLadder: lastPlayedLadder?.toISOString() ?? null,
      lastPlayedRace: Object.fromEntries(
        Object.entries(lastPlayedRace).map(([k, v]) => [
          k,
          v.toISOString(),
        ])
      ),
      top2Peaks,
    },
  };
}