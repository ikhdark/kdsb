// src/services/playerMatchAnalytics.ts
//
// CANONICAL MATCH ANALYTICS LAYER
// Single source of truth for ALL match telemetry
//
// Rules:
// - resolve tag once
// - fetch once
// - normalize once
// - everything derives from normalized records
//
// No UI logic here. Pure data.
//

import {
  fetchAllMatches,
  getPlayerAndOpponent,
  RACE_MAP,
  fetchMatchDetail,
} from "@/lib/w3cUtils";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { HERO_MAP } from "@/lib/heroMap";

/* ======================================================
   CONFIG
====================================================== */

const SEASONS = [22,23,24];
const MIN_DURATION_SECONDS = 120;

/* ======================================================
   TYPES
====================================================== */

type PlayerScoreBlock = {
  /* unit */
  unitsProduced: number;
  unitsKilled: number;
  largestArmy: number;

  /* hero */
  heroesKilled: number;
  itemsObtained: number;
  mercsHired: number;
  expGained: number;

  /* eco */
  goldCollected: number;
  lumberCollected: number;
  goldUpkeepLost: number;
};

export type NormalizedServerInfo = {
  provider: string | null;
  nodeId: number | null;
  name: string | null;
};

export type NormalizedSide = {
  battletag: string;

  raceId: number;
  race: string;
  mmrGain: number;

  won: boolean;

  // ping (nullable because not always present)
  avgPing: number | null;

  heroes: {
    id: number;
    name: string;
    level: number;
  }[];

  score: PlayerScoreBlock;
};

export type NormalizedMatch = {
  id: string;

  map: string;
  mapId: number | null;

  durationSeconds: number;
  startTime: Date;
  endTime: Date | null;

  season: number;
  gameMode: number;
  gateway: number | null;

  // ids from API (optional)
  floMatchId: number | null;
  originalOngoingMatchId: string | null;

  server: NormalizedServerInfo;

  me: NormalizedSide;
  opp: NormalizedSide;
};

/* ======================================================
   HELPERS
====================================================== */

function emptyScore(): PlayerScoreBlock {
  return {
    unitsProduced: 0,
    unitsKilled: 0,
    largestArmy: 0,

    heroesKilled: 0,
    itemsObtained: 0,
    mercsHired: 0,
    expGained: 0,

    goldCollected: 0,
    lumberCollected: 0,
    goldUpkeepLost: 0,
  };
}

function pickScore(scores: any[], battletagLower: string): PlayerScoreBlock {
  const row = scores?.find(
    (s: any) => s?.battleTag?.toLowerCase() === battletagLower
  );

  if (!row) return emptyScore();

  return {
    unitsProduced: row?.unitScore?.unitsProduced ?? 0,
    unitsKilled: row?.unitScore?.unitsKilled ?? 0,
    largestArmy: row?.unitScore?.largestArmy ?? 0,

    heroesKilled: row?.heroScore?.heroesKilled ?? 0,
    itemsObtained: row?.heroScore?.itemsObtained ?? 0,
    mercsHired: row?.heroScore?.mercsHired ?? 0,
    expGained: row?.heroScore?.expGained ?? 0,

    goldCollected: row?.resourceScore?.goldCollected ?? 0,
    lumberCollected: row?.resourceScore?.lumberCollected ?? 0,
    goldUpkeepLost: row?.resourceScore?.goldUpkeepLost ?? 0,
  };
}

function pickPing(
  serverInfo: any,
  battletagLower: string
): { avgPing: number | null;} {
  const infos = serverInfo?.playerServerInfos;
  if (!Array.isArray(infos)) return { avgPing: null};

  const row = infos.find(
    (x: any) => String(x?.battleTag ?? "").toLowerCase() === battletagLower
  );

  const avgPing =
    typeof row?.averagePing === "number" ? row.averagePing : null;

  return { avgPing };
}

function normalizeServer(serverInfo: any): NormalizedServerInfo {
  return {
    provider: typeof serverInfo?.provider === "string" ? serverInfo.provider : null,
    nodeId: typeof serverInfo?.nodeId === "number" ? serverInfo.nodeId : null,
    name: typeof serverInfo?.name === "string" ? serverInfo.name : null,
  };
}

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

/* ======================================================
   MAIN SERVICE
====================================================== */

export async function getPlayerMatchAnalytics(input: string) {
  const canonical = await resolveBattleTagViaSearch(input);
  if (!canonical) return null;

  const matches = await fetchAllMatches(canonical, SEASONS);
  if (!matches?.length) return null;

  /* ======================================================
     NORMALIZE (PARALLEL DETAIL FETCH WHEN NEEDED)
  ====================================================== */

  const prepared = await Promise.all(
    matches.map(async (m: any) => {
      // filter early
      if (m.gameMode !== 1) return null;
      if (m.durationInSeconds < MIN_DURATION_SECONDS) return null;

      const pair = getPlayerAndOpponent(m, canonical);
      if (!pair) return null;

      const meLower = pair.me.battleTag.toLowerCase();
      const oppLower = pair.opp.battleTag.toLowerCase();

      // base fields from list response
      let scores = m.playerScores;
      let serverInfo = m.serverInfo;
      let endTime = m.endTime;
      let floMatchId = m.floMatchId;
      let originalOngoingMatchId = m["original-ongoing-match-id"];

      // Fetch detail if ANY telemetry we care about is missing
      // (scores OR serverInfo OR endTime OR ids)
      if (!scores || !serverInfo || !endTime || floMatchId == null || originalOngoingMatchId == null) {
        const full = await fetchMatchDetail(m.id);

        // only override if present
        if (!scores) scores = full?.playerScores ?? scores ?? [];
        if (!serverInfo) serverInfo = full?.serverInfo ?? serverInfo;
        if (!endTime) endTime = full?.endTime ?? endTime;
        if (floMatchId == null) floMatchId = full?.floMatchId ?? floMatchId ?? null;
        if (originalOngoingMatchId == null)
          originalOngoingMatchId =
            full?.["original-ongoing-match-id"] ??
            full?.originalOngoingMatchId ??
            originalOngoingMatchId ??
            null;
      }

      const meScore = pickScore(scores ?? [], meLower);
      const oppScore = pickScore(scores ?? [], oppLower);

      const mePing = pickPing(serverInfo, meLower);
      const oppPing = pickPing(serverInfo, oppLower);

      const server = normalizeServer(serverInfo);

      return {
        id: m.id,

        map: m.mapName ?? m.map ?? "Unknown",
        mapId: m.mapId ?? null,

        durationSeconds: m.durationInSeconds,
        startTime: new Date(m.startTime),
        endTime: endTime ? new Date(endTime) : null,

        season: m.season,
        gameMode: m.gameMode,
        gateway: typeof m.gateWay === "number" ? m.gateWay : null,

        floMatchId: typeof floMatchId === "number" ? floMatchId : null,
        originalOngoingMatchId:
          typeof originalOngoingMatchId === "string" ? originalOngoingMatchId : null,

        server,

        me: {
          battletag: pair.me.battleTag,
          raceId: pair.me.race,
          race: RACE_MAP[pair.me.race] ?? "Unknown",

          oldMmr: pair.me.oldMmr ?? 0,
          currentMmr: pair.me.currentMmr ?? 0,
          mmrGain: pair.me.mmrGain ?? 0,

          won: !!pair.me.won,

          avgPing: mePing.avgPing,

          heroes: (pair.me.heroes ?? []).map((h: any) => ({
            id: h.id,
            name: HERO_MAP[h.name] ?? h.name,
            level: h.level ?? 0,
          })),

          score: meScore,
        },

        opp: {
          battletag: pair.opp.battleTag,
          raceId: pair.opp.race,
          race: RACE_MAP[pair.opp.race] ?? "Unknown",

          oldMmr: pair.opp.oldMmr ?? 0,
          currentMmr: pair.opp.currentMmr ?? 0,
          mmrGain: pair.opp.mmrGain ?? 0,

          won: !!pair.opp.won,

          avgPing: oppPing.avgPing,

          heroes: (pair.opp.heroes ?? []).map((h: any) => ({
            id: h.id,
            // keep raw or map if you want; using HERO_MAP is safer for display
            name: HERO_MAP[h.name] ?? h.name,
            level: h.level ?? 0,
          })),

          score: oppScore,
        },
      } as NormalizedMatch;
    })
  );

  const normalized: NormalizedMatch[] = [];
  for (const n of prepared) if (n) normalized.push(n);

  if (!normalized.length) return null;

  /* ======================================================
     AGGREGATES (common stuff every page needs)
  ====================================================== */

  const totalGames = normalized.length;
  const wins = normalized.filter((g) => g.me.won).length;

  const durations = normalized.map((g) => g.durationSeconds);

  const gold = normalized.map((g) => g.me.score.goldCollected);
  const lumber = normalized.map((g) => g.me.score.lumberCollected);
  const upkeep = normalized.map((g) => g.me.score.goldUpkeepLost);

  const armies = normalized.map((g) => g.me.score.largestArmy);
  const xp = normalized.map((g) => g.me.score.expGained);


  /* hero usage */
  const heroUsage: Record<string, number> = {};
  for (const g of normalized) {
    for (const h of g.me.heroes) {
      heroUsage[h.name] = (heroUsage[h.name] ?? 0) + 1;
    }
  }

  /* map stats */
  const mapAgg: Record<string, { games: number; wins: number }> = {};
  for (const g of normalized) {
    mapAgg[g.map] ??= { games: 0, wins: 0 };
    mapAgg[g.map].games++;
    if (g.me.won) mapAgg[g.map].wins++;
  }

  return {
    battletag: canonical,

    matches: normalized,

    summary: {
      games: totalGames,
      wins,
      losses: totalGames - wins,
      winrate: wins / totalGames,

      avgDurationSec: avg(durations),

      avgGold: avg(gold),
      avgLumber: avg(lumber),
      avgUpkeepLoss: avg(upkeep),

      avgArmy: avg(armies),
      avgXP: avg(xp),
    },

    heroUsage,

    maps: Object.entries(mapAgg).map(([map, v]) => ({
      map,
      games: v.games,
      wins: v.wins,
      winrate: v.wins / v.games,
    })),
  };
}
