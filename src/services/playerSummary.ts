// src/services/playerSummary.ts

import { fetchPlayerProfile } from "@/services/w3cApi";

import {
  fetchAllMatches,
  fetchJson,
} from "@/lib/w3cUtils";

import { raceLabel } from "@/lib/w3cRaces";
import { getCountryRaceLadder } from "@/services/countryRaceLadder";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { flattenCountryLadder } from "@/lib/ranking";
import type { RaceKey } from "@/services/countryRaceLadder";

import {
  buildLadder,
  type LadderInputRow,
} from "@/lib/ladderEngine";

import { COUNTRY_OVERRIDE } from "@/lib/countryOverrides";

/* =====================================================
   GLOBAL CONSTANTS (shared)
===================================================== */

const GATEWAY = 20;
const GAMEMODE = 1;

const SEASON = 24;
const SEASONS = [22, 23, 24];

const MIN_GAMES = 5;
const MIN_DURATION_SECONDS = 120;

const GLOBAL_CACHE_TTL = 5 * 60 * 1000;

/* =====================================================
   SECTION A — RANK SERVICE
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

const MAX_LEAGUE_PAGE = 30;

/* ---------------- TYPES ---------------- */

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

/* ---------------- GLOBAL LADDER CACHE ---------------- */

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

/* ---------------- COUNTRY HELPERS ---------------- */

function iso2(code: unknown): string {
  const c = String(code ?? "").toUpperCase();
  return c.length === 2 ? c : "";
}

function effectiveCountryForTag(canonicalTag: string, apiCountry: string) {
  const override = COUNTRY_OVERRIDE[canonicalTag];
  return (override?.to ?? apiCountry).toUpperCase();
}

/* =====================================================
   PUBLIC — getW3CRank
===================================================== */

export async function getW3CRank(
  inputTag: string
): Promise<W3CRankResponse | null> {
  if (!inputTag) return null;

  const canonicalTag = await resolveBattleTagViaSearch(inputTag);
  if (!canonicalTag) return null;

  const [profile, matches, rowsByPage] = await Promise.all([
    fetchPlayerProfile(canonicalTag),
    fetchAllMatches(canonicalTag, [SEASON]),
    fetchGlobalRowsByPage(),
  ]);

  const canonicalLower = canonicalTag.toLowerCase();

  function resolveFromProfile(): string {
    return iso2(profile?.countryCode) || iso2(profile?.location) || "";
  }

  function resolveFromMatches(): string {
    for (const match of matches) {
      if (!Array.isArray(match?.teams)) continue;

      for (const team of match.teams) {
        for (const player of team.players ?? []) {
          if (String(player?.battleTag).toLowerCase() !== canonicalLower) continue;

          const cc = iso2(player?.countryCode) || iso2(player?.location);
          if (cc) return cc;
        }
      }
    }

    return "";
  }

  const countryCode = resolveFromMatches() || resolveFromProfile() || "";
  const effectiveCountry = countryCode
    ? effectiveCountryForTag(canonicalTag, countryCode)
    : "";

  const ranks: RankRow[] = [];
  const countryRaceLadderPromises = new Map<RaceKey, Promise<any>>();

  if (effectiveCountry) {
    for (const raceKey of Object.values(RACE_KEY_MAP)) {
      if (countryRaceLadderPromises.has(raceKey)) continue;

      countryRaceLadderPromises.set(
        raceKey,
        getCountryRaceLadder(
          effectiveCountry,
          raceKey,
          undefined,
          GAMEMODE,
          9999
        )
      );
    }
  }

  for (const [raceIdStr, raceName] of Object.entries(RACE_MAP)) {
    const raceId = Number(raceIdStr);
    const raceKey = RACE_KEY_MAP[raceId];

    const globalInputs: LadderInputRow[] = [];

    for (const rawRows of rowsByPage.values()) {
      const flatRows = flattenCountryLadder(rawRows);

      for (const row of flatRows as any[]) {
        if (row.games < MIN_GAMES) continue;
        if (row.race !== raceId) continue;
        if (!row.battleTag) continue;

        globalInputs.push({
          battletag: row.battleTag,
          mmr: row.mmr,
          wins: row.wins,
          games: row.games,
          sos: null,
        });
      }
    }

    const globalLadder = buildLadder(globalInputs);

    const globalIndex = globalLadder.findIndex(
      (player: any) => player.battletag.toLowerCase() === canonicalLower
    );

    if (globalIndex === -1) continue;

    let countryRank: number | null = null;
    let countryTotal: number | null = null;

    if (effectiveCountry) {
      const ladderData = await countryRaceLadderPromises.get(raceKey);

      if (ladderData) {
        countryTotal = ladderData.poolSize;

        const countryIndex = ladderData.full.findIndex(
          (player: any) => player.battletag.toLowerCase() === canonicalLower
        );

        countryRank = countryIndex === -1 ? null : countryIndex + 1;
      }
    }

    ranks.push({
      race: raceName,
      raceId,
      globalRank: globalIndex + 1,
      globalTotal: globalLadder.length,
      countryRank,
      countryTotal,
      mmr: globalLadder[globalIndex].mmr,
      games: globalLadder[globalIndex].games,
    });
  }

  return {
    battletag: canonicalTag,
    season: SEASON,
    country: effectiveCountry || countryCode || "—",
    minGames: MIN_GAMES,
    asOf: new Date().toLocaleString(),
    ranks,
  };
}

/* =====================================================
   SECTION B — SUMMARY SERVICE
===================================================== */

const CURRENT_SEASON = SEASON;
const LAST_3_SEASONS = new Set(SEASONS);

function getPlayerAndOpponentCI2(match: any, lowerTag: string) {
  if (!Array.isArray(match?.teams)) return null;

  for (const team of match.teams) {
    for (const player of team.players ?? []) {
      if (String(player?.battleTag).toLowerCase() === lowerTag) {
        const opponent =
          match.teams
            .flatMap((t: any) => t.players ?? [])
            .find(
              (p: any) => String(p?.battleTag).toLowerCase() !== lowerTag
            ) ?? null;

        return { me: player, opponent };
      }
    }
  }

  return null;
}

function toDate(v: any): Date | null {
  if (!v) return null;

  const n = Number(v);
  if (Number.isFinite(n)) {
    return new Date(n < 1e12 ? n * 1000 : n);
  }

  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function toNumber(v: any): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

async function _getPlayerSummary(inputTag: string) {
  const raw = String(inputTag ?? "").trim();
  if (!raw) return null;

  const canonicalBattleTag = await resolveBattleTagViaSearch(raw);
  if (!canonicalBattleTag) return null;

  let matches = await fetchAllMatches(canonicalBattleTag, SEASONS);

  if (!matches.length) {
    return {
      summary: {
        battletag: canonicalBattleTag,
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

  const lower = canonicalBattleTag.toLowerCase();

  matches = [...matches].sort((a, b) => {
    const ta = toDate(a?.startTime)?.getTime() ?? 0;
    const tb = toDate(b?.startTime)?.getTime() ?? 0;
    return ta - tb;
  });

  const raceGamesAllTime: Record<string, number> = {};
  const raceGamesCurrentSeason: Record<string, number> = {};
  const lastPlayedRace: Record<string, Date | undefined> = {};

  const raceMMRCurrent: Record<string, number> = {};
  const raceMMRCurrentAt: Record<string, number> = {};
  const racePeaks: Record<string, any> = {};

  let lastPlayedLadder: Date | null = null;

  for (const match of matches) {
    if (match.gameMode !== GAMEMODE) continue;
    if (match.durationInSeconds < MIN_DURATION_SECONDS) continue;

    const date = toDate(match.startTime);
    if (!date) continue;

    const pair = getPlayerAndOpponentCI2(match, lower);
    if (!pair) continue;

    const { me } = pair;
    const race = raceLabel(me?.race) ?? "Unknown";

    raceGamesAllTime[race] = (raceGamesAllTime[race] || 0) + 1;

    const prevRaceDate = lastPlayedRace[race];
    if (!prevRaceDate || date.getTime() > prevRaceDate.getTime()) {
      lastPlayedRace[race] = date;
    }

    if (!lastPlayedLadder || date.getTime() > lastPlayedLadder.getTime()) {
      lastPlayedLadder = date;
    }

    if (match.season === CURRENT_SEASON) {
      raceGamesCurrentSeason[race] =
        (raceGamesCurrentSeason[race] || 0) + 1;

      const mmrAfter =
        toNumber(me?.newMmr) ??
        toNumber(me?.currentMmr) ??
        toNumber(me?.oldMmr);

      if (mmrAfter != null) {
        const time = date.getTime();
        const prevTime = raceMMRCurrentAt[race] ?? -1;

        if (time >= prevTime) {
          raceMMRCurrentAt[race] = time;
          raceMMRCurrent[race] = mmrAfter;
        }
      }
    }

    if (LAST_3_SEASONS.has(match.season) && typeof me.currentMmr === "number") {
      if (!racePeaks[race] || me.currentMmr > racePeaks[race].mmr) {
        racePeaks[race] = {
          race,
          mmr: me.currentMmr,
          season: match.season,
        };
      }
    }
  }

  const mostPlayedAllTime =
    Object.entries(raceGamesAllTime).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Unknown";

  const mostPlayedThisSeason =
    Object.entries(raceGamesCurrentSeason).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Unknown";

  const highest = Object.entries(raceMMRCurrent).sort((a, b) => b[1] - a[1])[0];
  const highestCurrentRace = highest?.[0] ?? null;

  const top2Peaks = Object.values(racePeaks)
    .sort((a: any, b: any) => b.mmr - a.mmr)
    .slice(0, 2);

  return {
    summary: {
      battletag: canonicalBattleTag,
      mostPlayedAllTime,
      mostPlayedThisSeason,
      highestCurrentRace,
      highestCurrentMMR: highestCurrentRace
        ? raceMMRCurrent[highestCurrentRace] ?? null
        : null,
      lastPlayedLadder: lastPlayedLadder?.toISOString() ?? null,
      lastPlayedRace: Object.fromEntries(
        Object.entries(lastPlayedRace)
          .filter(([, v]) => !!v)
          .map(([k, v]) => [k, (v as Date).toISOString()])
      ),
      top2Peaks,
    },
  };
}

/* =====================================================
   PUBLIC EXPORT (no next/cache here)
===================================================== */

export async function getPlayerSummary(inputTag: string) {
  return _getPlayerSummary(inputTag);
}