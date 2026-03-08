// src/services/playerMatchAnalytics.ts

import {
  fetchMatchDetail,
  getPlayerAndOpponent,
} from "@/lib/w3cUtils";

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { HERO_MAP } from "@/lib/heroMap";
import { W3C_RACE_LABEL } from "@/lib/w3cRaces";

import { getMatchesCached } from "@/services/matchCache";

import {
  W3C_CURRENT_SEASON,
  W3C_MIN_DURATION_SECONDS,
} from "@/lib/w3cConfig";

/* ======================================================
   CONFIG
====================================================== */

const SEASONS = [22, 23, W3C_CURRENT_SEASON] as const;
const MIN_DURATION_SECONDS = W3C_MIN_DURATION_SECONDS;

/* ======================================================
   TYPES
====================================================== */

type PlayerScoreBlock = {
  unitsProduced: number;
  unitsKilled: number;
  largestArmy: number;

  heroesKilled: number;
  itemsObtained: number;
  mercsHired: number;
  expGained: number;

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

  oldMmr: number;
  currentMmr: number;
  mmrGain: number;

  won: boolean;

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

  floMatchId: number | null;
  originalOngoingMatchId: string | null;

  server: NormalizedServerInfo;

  me: NormalizedSide;
  opp: NormalizedSide;
};

export type PlayerMatchAnalyticsResponse = {
  battletag: string;
  matches: NormalizedMatch[];
  summary: {
    games: number;
    wins: number;
    losses: number;
    winrate: number;
    avgDurationSec: number;
    avgGold: number;
    avgLumber: number;
    avgUpkeepLoss: number;
    avgArmy: number;
    avgXP: number;
  };
  heroUsage: Record<string, number>;
  maps: {
    map: string;
    games: number;
    wins: number;
    winrate: number;
  }[];
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

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;

  return Number.isFinite(n) ? n : fallback;
}

function pickScore(
  scores: any[] | undefined,
  battletagLower: string
): PlayerScoreBlock {
  const row = scores?.find(
    (score: any) =>
      String(score?.battleTag ?? "").toLowerCase() === battletagLower
  );

  if (!row) return emptyScore();

  return {
    unitsProduced: toFiniteNumber(row?.unitScore?.unitsProduced),
    unitsKilled: toFiniteNumber(row?.unitScore?.unitsKilled),
    largestArmy: toFiniteNumber(row?.unitScore?.largestArmy),

    heroesKilled: toFiniteNumber(row?.heroScore?.heroesKilled),
    itemsObtained: toFiniteNumber(row?.heroScore?.itemsObtained),
    mercsHired: toFiniteNumber(row?.heroScore?.mercsHired),
    expGained: toFiniteNumber(row?.heroScore?.expGained),

    goldCollected: toFiniteNumber(row?.resourceScore?.goldCollected),
    lumberCollected: toFiniteNumber(row?.resourceScore?.lumberCollected),
    goldUpkeepLost: toFiniteNumber(row?.resourceScore?.goldUpkeepLost),
  };
}

function pickAvgPing(
  serverInfo: any,
  battletagLower: string
): number | null {
  const infos = serverInfo?.playerServerInfos;
  if (!Array.isArray(infos)) return null;

  const row = infos.find(
    (entry: any) =>
      String(entry?.battleTag ?? "").toLowerCase() === battletagLower
  );

  return typeof row?.averagePing === "number" ? row.averagePing : null;
}

function normalizeServer(serverInfo: any): NormalizedServerInfo {
  return {
    provider:
      typeof serverInfo?.provider === "string" ? serverInfo.provider : null,
    nodeId:
      typeof serverInfo?.nodeId === "number" ? serverInfo.nodeId : null,
    name: typeof serverInfo?.name === "string" ? serverInfo.name : null,
  };
}

function avg(arr: number[]): number {
  return arr.length
    ? arr.reduce((sum, value) => sum + value, 0) / arr.length
    : 0;
}

function normalizeHero(hero: any) {
  const id = typeof hero?.id === "number" ? hero.id : 0;
  const rawName = String(hero?.name ?? "Unknown");
  const name = HERO_MAP[rawName] ?? rawName;
  const level = typeof hero?.level === "number" ? hero.level : 0;

  return { id, name, level };
}

function normalizeMap(match: any): { map: string; mapId: number | null } {
  const map =
    typeof match?.mapName === "string" && match.mapName.trim()
      ? match.mapName.trim()
      : typeof match?.map === "string" && match.map.trim()
      ? match.map.trim()
      : "Unknown";

  const mapId = typeof match?.mapId === "number" ? match.mapId : null;

  return { map, mapId };
}

function raceLabelFromId(raceId: unknown): string {
  const id =
    typeof raceId === "number" ? raceId : Number(raceId ?? NaN);

  if (!Number.isFinite(id)) return "Unknown";

  return W3C_RACE_LABEL[id] ?? "Unknown";
}

/* ======================================================
   CORE (expects canonical)
====================================================== */

async function _getPlayerMatchAnalyticsByCanonical(
  canonical: string
): Promise<PlayerMatchAnalyticsResponse | null> {
  const matches = await getMatchesCached(canonical, SEASONS);
  if (!matches.length) return null;

  const prepared = await Promise.all(
    matches.map(async (match: any): Promise<NormalizedMatch | null> => {
      if (match?.gameMode !== 1) return null;

      const durationSeconds = Number(match?.durationInSeconds);
      if (!Number.isFinite(durationSeconds) || durationSeconds < MIN_DURATION_SECONDS) {
        return null;
      }

      const pair = getPlayerAndOpponent(match, canonical);
      if (!pair) return null;

      const meLower = String(pair.me?.battleTag ?? "").toLowerCase();
      const oppLower = String(pair.opp?.battleTag ?? "").toLowerCase();

      let scores = Array.isArray(match?.playerScores) ? match.playerScores : undefined;
      let serverInfo = match?.serverInfo;
      let endTime = match?.endTime;
      let floMatchId = match?.floMatchId;
      let originalOngoingMatchId =
        match?.["original-ongoing-match-id"] ?? match?.originalOngoingMatchId;

      if (
        !scores ||
        !serverInfo ||
        !endTime ||
        floMatchId == null ||
        originalOngoingMatchId == null
      ) {
        const full = await fetchMatchDetail(String(match.id));

        if (!scores) {
          scores = Array.isArray(full?.playerScores) ? full.playerScores : [];
        }

        if (!serverInfo) serverInfo = full?.serverInfo ?? serverInfo;
        if (!endTime) endTime = full?.endTime ?? endTime;

        if (floMatchId == null) {
          floMatchId = full?.floMatchId ?? null;
        }

        if (originalOngoingMatchId == null) {
          originalOngoingMatchId =
            full?.["original-ongoing-match-id"] ??
            full?.originalOngoingMatchId ??
            null;
        }
      }

      const meScore = pickScore(scores, meLower);
      const oppScore = pickScore(scores, oppLower);

      const server = normalizeServer(serverInfo);
      const { map, mapId } = normalizeMap(match);

      const gateway =
        typeof match?.gateWay === "number"
          ? match.gateWay
          : typeof match?.gateway === "number"
          ? match.gateway
          : null;

      const meHeroes = Array.isArray(pair.me?.heroes)
        ? pair.me.heroes.map(normalizeHero)
        : [];

      const oppHeroes = Array.isArray(pair.opp?.heroes)
        ? pair.opp.heroes.map(normalizeHero)
        : [];

      const meRaceId = toFiniteNumber(pair.me?.race, 0);
      const oppRaceId = toFiniteNumber(pair.opp?.race, 0);

      const startTime = new Date(match.startTime);
      if (!Number.isFinite(startTime.getTime())) return null;

      const normalized: NormalizedMatch = {
        id: String(match.id),

        map,
        mapId,

        durationSeconds,
        startTime,
        endTime: endTime ? new Date(endTime) : null,

        season: toFiniteNumber(match.season, 0),
        gameMode: toFiniteNumber(match.gameMode, 0),
        gateway,

        floMatchId: typeof floMatchId === "number" ? floMatchId : null,
        originalOngoingMatchId:
          typeof originalOngoingMatchId === "string"
            ? originalOngoingMatchId
            : null,

        server,

        me: {
          battletag: String(pair.me?.battleTag ?? canonical),
          raceId: meRaceId,
          race: raceLabelFromId(meRaceId),

          oldMmr: toFiniteNumber(pair.me?.oldMmr, 0),
          currentMmr: toFiniteNumber(pair.me?.currentMmr, 0),
          mmrGain: toFiniteNumber(pair.me?.mmrGain, 0),

          won: !!pair.me?.won,

          avgPing: pickAvgPing(serverInfo, meLower),

          heroes: meHeroes,
          score: meScore,
        },

        opp: {
          battletag: String(pair.opp?.battleTag ?? "Unknown"),
          raceId: oppRaceId,
          race: raceLabelFromId(oppRaceId),

          oldMmr: toFiniteNumber(pair.opp?.oldMmr, 0),
          currentMmr: toFiniteNumber(pair.opp?.currentMmr, 0),
          mmrGain: toFiniteNumber(pair.opp?.mmrGain, 0),

          won: !!pair.opp?.won,

          avgPing: pickAvgPing(serverInfo, oppLower),

          heroes: oppHeroes,
          score: oppScore,
        },
      };

      return normalized;
    })
  );

  const normalized = prepared.filter(Boolean) as NormalizedMatch[];
  if (!normalized.length) return null;

  const totalGames = normalized.length;

  let wins = 0;

  const durations: number[] = [];
  const gold: number[] = [];
  const lumber: number[] = [];
  const upkeep: number[] = [];
  const armies: number[] = [];
  const xp: number[] = [];

  const heroUsage: Record<string, number> = {};
  const mapAgg: Record<string, { games: number; wins: number }> = {};

  for (let i = 0; i < normalized.length; i++) {
    const game = normalized[i];

    if (game.me.won) wins++;

    durations.push(game.durationSeconds);

    gold.push(game.me.score.goldCollected);
    lumber.push(game.me.score.lumberCollected);
    upkeep.push(game.me.score.goldUpkeepLost);

    armies.push(game.me.score.largestArmy);
    xp.push(game.me.score.expGained);

    for (let j = 0; j < game.me.heroes.length; j++) {
      const hero = game.me.heroes[j];
      heroUsage[hero.name] = (heroUsage[hero.name] ?? 0) + 1;
    }

    const key = game.map || "Unknown";
    const row = (mapAgg[key] ??= { games: 0, wins: 0 });

    row.games++;
    if (game.me.won) row.wins++;
  }

  return {
    battletag: canonical,
    matches: normalized,

    summary: {
      games: totalGames,
      wins,
      losses: totalGames - wins,
      winrate: totalGames ? wins / totalGames : 0,

      avgDurationSec: avg(durations),

      avgGold: avg(gold),
      avgLumber: avg(lumber),
      avgUpkeepLoss: avg(upkeep),

      avgArmy: avg(armies),
      avgXP: avg(xp),
    },

    heroUsage,

    maps: Object.entries(mapAgg)
      .map(([map, value]) => ({
        map,
        games: value.games,
        wins: value.wins,
        winrate: value.games ? value.wins / value.games : 0,
      }))
      .sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        if (b.winrate !== a.winrate) return b.winrate - a.winrate;
        return a.map.localeCompare(b.map);
      }),
  };
}

/* ======================================================
   PUBLIC API
====================================================== */

export async function getPlayerMatchAnalytics(
  input: string
): Promise<PlayerMatchAnalyticsResponse | null> {
  if (!input?.trim()) return null;

  const canonical = await resolveBattleTagViaSearch(input);
  if (!canonical) return null;

  return _getPlayerMatchAnalyticsByCanonical(canonical);
}