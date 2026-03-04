import {
  fetchCountryLadder,
  fetchPlayerProfile,
} from "@/services/w3cApi";

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
   GLOBAL CONSTANTS
===================================================== */

const GATEWAY = 20;
const GAMEMODE = 1;

const SEASON = 24;
const SEASONS = [21, 22, 23, 24];

const MIN_GAMES = 5;

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

const MAX_LEAGUE_PAGE = 50;

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

/* ---------------- GLOBAL LADDER FETCH (NO CACHE) ---------------- */

async function fetchGlobalRowsByPage(): Promise<Map<number, any[]>> {
  const requests: Promise<any[]>[] = [];

  for (let page = 0; page <= MAX_LEAGUE_PAGE; page++) {
    const url =
      `https://website-backend.w3champions.com/api/ladder/${page}` +
      `?gateWay=${GATEWAY}&gameMode=${GAMEMODE}&season=${SEASON}`;

    requests.push(
  fetch(url, { next: { revalidate: 300 } })
    .then((r) => r.json())
    .catch(() => [])
);
  }

  const pages = await Promise.all(requests);

  const map = new Map<number, any[]>();
  pages.forEach((rows, page) => map.set(page, rows));

  return map;
}

/* ---------------- COUNTRY HELPERS ---------------- */

function iso2(code: unknown): string {
  const c = String(code ?? "").toUpperCase();
  return c.length === 2 ? c : "";
}

function getBT(r: any): string {
  return r?.battletag ?? r?.battleTag ?? r?.battle_tag ?? "";
}

function uniqBy<T>(rows: T[], keyFn: (r: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = keyFn(r);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function effectiveCountryForTag(canonicalTag: string, apiCountry: string) {
  const o = COUNTRY_OVERRIDE[canonicalTag];
  return (o?.to ?? apiCountry).toUpperCase();
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
    return (
      iso2(profile?.countryCode) ||
      iso2(profile?.location) ||
      ""
    );
  }

  function resolveFromMatches(): string {
    for (const m of matches) {
      if (!Array.isArray(m?.teams)) continue;

      for (const t of m.teams) {
        for (const p of t.players ?? []) {
          if (String(p?.battleTag).toLowerCase() === canonicalLower) {
            const cc =
              iso2(p?.countryCode) ||
              iso2(p?.location);
            if (cc) return cc;
          }
        }
      }
    }
    return "";
  }

  const countryCode =
    resolveFromMatches() ||
    resolveFromProfile() ||
    "";

  const effectiveCountry = countryCode
    ? effectiveCountryForTag(canonicalTag, countryCode)
    : "";

  const basePayload = effectiveCountry
    ? await fetchCountryLadder(effectiveCountry, GATEWAY, GAMEMODE, SEASON)
    : [];

  let countryRows = flattenCountryLadder(basePayload);

  if (countryRows.length) {
    countryRows = countryRows.filter((r: any) => {
      const bt = getBT(r);
      const o = COUNTRY_OVERRIDE[bt];
      if (!o) return true;
      return o.from.toUpperCase() !== effectiveCountry;
    });
  }

  const injectTargets = Object.entries(COUNTRY_OVERRIDE)
    .filter(([, o]) => o.to.toUpperCase() === effectiveCountry);

  if (injectTargets.length) {
    const byFrom = new Map<string, string[]>();

    for (const [bt, o] of injectTargets) {
      const from = o.from.toUpperCase();
      byFrom.set(from, [...(byFrom.get(from) ?? []), bt]);
    }

    for (const [fromCountry, battletags] of byFrom.entries()) {
      const fromPayload = await fetchCountryLadder(
        fromCountry,
        GATEWAY,
        GAMEMODE,
        SEASON
      );
      if (!fromPayload) continue;

      const fromRows = flattenCountryLadder(fromPayload);

      for (const bt of battletags) {
        const hit = fromRows.find((r: any) => getBT(r) === bt);
        if (hit) countryRows.push(hit);
      }
    }

    countryRows = uniqBy(countryRows, (r: any) => getBT(r));
  }

  const ranks: RankRow[] = [];

  const raceKeyMap: Record<number, RaceKey> = {
    1: "human",
    2: "orc",
    4: "elf",
    8: "undead",
    0: "random",
  };

  for (const [raceIdStr, raceName] of Object.entries(RACE_MAP)) {
    const raceId = Number(raceIdStr);

    const globalInputs: LadderInputRow[] = [];

    for (const rawRows of rowsByPage.values()) {
      const flat = flattenCountryLadder(rawRows);

      for (const r of flat as any[]) {
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

    let countryRank: number | null = null;
    let countryTotal: number | null = null;

    if (effectiveCountry) {
      const raceKey = raceKeyMap[raceId];

      if (raceKey) {
        const ladderData = await getCountryRaceLadder(
          effectiveCountry,
          raceKey,
          undefined,
          1,
          9999
        );

        if (ladderData) {
          countryTotal = ladderData.poolSize;

          const cIdx = ladderData.full.findIndex(
            (p) => p.battletag.toLowerCase() === canonicalLower
          );

          countryRank = cIdx === -1 ? null : cIdx + 1;
        }
      }
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
    country: effectiveCountry || countryCode || "—",
    minGames: MIN_GAMES,
    asOf: new Date().toLocaleString(),
    ranks,
  };
}

function getPlayerAndOpponentCI(match: any, lowerTag: string) {
  if (!Array.isArray(match?.teams)) return null;

  for (const team of match.teams) {
    for (const player of team.players ?? []) {
      if (String(player?.battleTag).toLowerCase() === lowerTag) {
        const opponent =
          match.teams
            .flatMap((t: any) => t.players ?? [])
            .find(
              (p: any) =>
                String(p?.battleTag).toLowerCase() !== lowerTag
            ) ?? null;

        return {
          me: player,
          opponent,
        };
      }
    }
  }

  return null;
}

/* =====================================================
   PLAYER SUMMARY SERVICE
===================================================== */

const CURRENT_SEASON = SEASON;
const LAST_3_SEASONS = new Set([22, 23, 24]);
const MIN_DURATION_SECONDS = 120;

export async function getPlayerSummary(inputTag: string) {
  const raw = String(inputTag ?? "").trim();
  if (!raw) return null;

  const canonicalBattleTag = await resolveBattleTagViaSearch(raw);
  if (!canonicalBattleTag) return null;

 const matches = await fetchAllMatches(canonicalBattleTag, SEASONS);

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

  const raceGamesAllTime: Record<string, number> = {};
  const raceGamesCurrentSeason: Record<string, number> = {};
  const lastPlayedRace: Record<string, Date | undefined> = {};
  const raceMMRCurrent: Record<string, number> = {};
  const racePeaks: Record<string, any> = {};

  let highestCurrentRace: string | null = null;
  let lastPlayedLadder: Date | null = null;

  const toDate = (v: any) => {
    if (!v) return null;
    const n = Number(v);
    if (Number.isFinite(n)) {
      return new Date(n < 1e12 ? n * 1000 : n);
    }
    return new Date(v);
  };

  for (const match of matches) {
    if (match.gameMode !== 1) continue;
    if (match.durationInSeconds < MIN_DURATION_SECONDS) continue;

    const date = toDate(match.startTime);
    if (!date) continue;

    const season = match.season;

    const pair = getPlayerAndOpponentCI(match, lower);
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

    if (season === CURRENT_SEASON) {
      raceGamesCurrentSeason[race] =
        (raceGamesCurrentSeason[race] || 0) + 1;

      if (typeof me.currentMmr === "number") {
        raceMMRCurrent[race] = me.currentMmr;
      }

      if (
        !highestCurrentRace ||
        (raceMMRCurrent[race] ?? 0) >
          (raceMMRCurrent[highestCurrentRace] ?? 0)
      ) {
        highestCurrentRace = race;
      }
    }

    if (LAST_3_SEASONS.has(season) && typeof me.currentMmr === "number") {
      if (!racePeaks[race] || me.currentMmr > racePeaks[race].mmr) {
        racePeaks[race] = {
          race,
          mmr: me.currentMmr,
          season,
        };
      }
    }
  }

  const mostPlayedAllTime =
    Object.entries(raceGamesAllTime)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

  const mostPlayedThisSeason =
    Object.entries(raceGamesCurrentSeason)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

  const top2Peaks = Object.values(racePeaks)
    .sort((a: any, b: any) => b.mmr - a.mmr)
    .slice(0, 2);

  return {
    summary: {
      battletag: canonicalBattleTag,
      mostPlayedAllTime,
      mostPlayedThisSeason,
      highestCurrentRace,
      highestCurrentMMR:
        highestCurrentRace
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