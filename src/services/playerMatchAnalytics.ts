import {
  fetchAllMatches,
  getPlayerAndOpponent,
  fetchMatchDetail,
} from "@/lib/w3cUtils";

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { HERO_MAP } from "@/lib/heroMap";
import { W3C_RACE_LABEL } from "@/lib/w3cRaces";

/* ======================================================
   CONFIG
====================================================== */

const SEASONS = [22, 23, 24] as const;
const MIN_DURATION_SECONDS = 120;
const REVALIDATE_SECONDS = 300; // 5 min

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

function pickScore(
  scores: any[] | undefined,
  battletagLower: string
): PlayerScoreBlock {
  const row = scores?.find(
    (s: any) => String(s?.battleTag ?? "").toLowerCase() === battletagLower
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

function pickAvgPing(
  serverInfo: any,
  battletagLower: string
): number | null {
  const infos = serverInfo?.playerServerInfos;
  if (!Array.isArray(infos)) return null;

  const row = infos.find(
    (x: any) => String(x?.battleTag ?? "").toLowerCase() === battletagLower
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

function avg(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function normalizeHero(h: any) {
  const id = typeof h?.id === "number" ? h.id : 0;
  const rawName = String(h?.name ?? "Unknown");
  const name = HERO_MAP[rawName] ?? rawName;
  const level = typeof h?.level === "number" ? h.level : 0;
  return { id, name, level };
}

function normalizeMap(m: any): { map: string; mapId: number | null } {
  const map =
    typeof m?.mapName === "string"
      ? m.mapName
      : typeof m?.map === "string"
        ? m.map
        : "Unknown";

  const mapId = typeof m?.mapId === "number" ? m.mapId : null;
  return { map, mapId };
}

function raceLabelFromId(raceId: any): string {
  const id = typeof raceId === "number" ? raceId : Number(raceId ?? NaN);
  if (!Number.isFinite(id)) return "Unknown";
  return W3C_RACE_LABEL[id] ?? "Unknown";
}

/* ======================================================
   CORE (non-cached, expects canonical)
====================================================== */

async function _getPlayerMatchAnalyticsByCanonical(canonical: string) {
  const matches = await fetchAllMatches(canonical, [...SEASONS]);
  if (!matches?.length) return null;

  const prepared = await Promise.all(
    matches.map(async (m: any): Promise<NormalizedMatch | null> => {
      if (m?.gameMode !== 1) return null;

      const dur = Number(m?.durationInSeconds);
      if (!Number.isFinite(dur) || dur < MIN_DURATION_SECONDS) return null;

      // PASS CANONICAL (function lowercases internally)
      const pair = getPlayerAndOpponent(m, canonical);
      if (!pair) return null;

      const meLower = String(pair.me?.battleTag ?? "").toLowerCase();
      const oppLower = String(pair.opp?.battleTag ?? "").toLowerCase();

      // fields from list response
      let scores = m?.playerScores;
      let serverInfo = m?.serverInfo;
      let endTime = m?.endTime;
      let floMatchId = m?.floMatchId;
      let originalOngoingMatchId =
        m?.["original-ongoing-match-id"] ?? m?.originalOngoingMatchId;

      // Fetch detail if anything required is missing
      if (
        !scores ||
        !serverInfo ||
        !endTime ||
        floMatchId == null ||
        originalOngoingMatchId == null
      ) {
        const full = await fetchMatchDetail(m.id);

        if (!scores) scores = full?.playerScores ?? scores ?? [];
        if (!serverInfo) serverInfo = full?.serverInfo ?? serverInfo;
        if (!endTime) endTime = full?.endTime ?? endTime;

        if (floMatchId == null) {
          floMatchId = full?.floMatchId ?? floMatchId ?? null;
        }

        if (originalOngoingMatchId == null) {
          originalOngoingMatchId =
            full?.["original-ongoing-match-id"] ??
            full?.originalOngoingMatchId ??
            originalOngoingMatchId ??
            null;
        }
      }

      const meScore = pickScore(scores, meLower);
      const oppScore = pickScore(scores, oppLower);

      const server = normalizeServer(serverInfo);

      const { map, mapId } = normalizeMap(m);

      const gateway =
        typeof m?.gateWay === "number"
          ? m.gateWay
          : typeof m?.gateway === "number"
            ? m.gateway
            : null;

      const meHeroes = Array.isArray(pair.me?.heroes)
        ? pair.me.heroes.map(normalizeHero)
        : [];
      const oppHeroes = Array.isArray(pair.opp?.heroes)
        ? pair.opp.heroes.map(normalizeHero)
        : [];

      const meRaceId = Number(pair.me?.race ?? 0);
      const oppRaceId = Number(pair.opp?.race ?? 0);

      return {
        id: String(m.id),

        map,
        mapId,

        durationSeconds: dur,
        startTime: new Date(m.startTime),
        endTime: endTime ? new Date(endTime) : null,

        season: Number(m.season),
        gameMode: Number(m.gameMode),
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

          oldMmr: Number(pair.me?.oldMmr ?? 0),
          currentMmr: Number(pair.me?.currentMmr ?? 0),
          mmrGain: Number(pair.me?.mmrGain ?? 0),

          won: !!pair.me?.won,

          avgPing: pickAvgPing(serverInfo, meLower),

          heroes: meHeroes,
          score: meScore,
        },

        opp: {
          battletag: String(pair.opp?.battleTag ?? "Unknown"),
          raceId: oppRaceId,
          race: raceLabelFromId(oppRaceId),

          oldMmr: Number(pair.opp?.oldMmr ?? 0),
          currentMmr: Number(pair.opp?.currentMmr ?? 0),
          mmrGain: Number(pair.opp?.mmrGain ?? 0),

          won: !!pair.opp?.won,

          avgPing: pickAvgPing(serverInfo, oppLower),

          heroes: oppHeroes,
          score: oppScore,
        },
      };
    })
  );

  const normalized = prepared.filter(Boolean) as NormalizedMatch[];
  if (!normalized.length) return null;

  /* ======================================================
     AGGREGATES
  ====================================================== */

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

  for (const g of normalized) {
    if (g.me.won) wins++;

    durations.push(g.durationSeconds);

    gold.push(g.me.score.goldCollected);
    lumber.push(g.me.score.lumberCollected);
    upkeep.push(g.me.score.goldUpkeepLost);

    armies.push(g.me.score.largestArmy);
    xp.push(g.me.score.expGained);

    for (const h of g.me.heroes) {
      heroUsage[h.name] = (heroUsage[h.name] ?? 0) + 1;
    }

    const key = g.map || "Unknown";
    const row = (mapAgg[key] ??= { games: 0, wins: 0 });
    row.games++;
    if (g.me.won) row.wins++;
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

    maps: Object.entries(mapAgg).map(([map, v]) => ({
      map,
      games: v.games,
      wins: v.wins,
      winrate: v.games ? v.wins / v.games : 0,
    })),
  };
}

/* ======================================================
   CACHED CORE
====================================================== */

const getPlayerMatchAnalyticsByCanonical = _getPlayerMatchAnalyticsByCanonical;
/* ======================================================
   PUBLIC API (resolve once, then cached)
====================================================== */

export async function getPlayerMatchAnalytics(input: string) {
  if (!input) return null;

  const canonical = await resolveBattleTagViaSearch(input);
  if (!canonical) return null;

  return getPlayerMatchAnalyticsByCanonical(canonical);
}