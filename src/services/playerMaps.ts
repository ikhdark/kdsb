// src/services/playerMaps.ts

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { getPlayerAndOpponent } from "@/lib/w3cUtils";

import { getMatchesCached } from "@/services/matchCache";

import {
  W3C_CURRENT_SEASON,
  W3C_GAME_MODE_1V1,
  W3C_MIN_DURATION_SECONDS,
} from "@/lib/w3cConfig";

/* -------------------- CONSTANTS -------------------- */

const SEASONS = [W3C_CURRENT_SEASON] as const;
const GAMEMODE = W3C_GAME_MODE_1V1;
const MIN_DURATION_SECONDS = W3C_MIN_DURATION_SECONDS;
const MIN_MAP_GAMES = 1;

const DURATION_BUCKETS = [
  { label: "5–10 min", min: 300, max: 600 },
  { label: "11–15 min", min: 601, max: 900 },
  { label: "16–20 min", min: 901, max: 1200 },
  { label: "20–25 min", min: 1201, max: 1500 },
  { label: "26–30 min", min: 1501, max: 1800 },
  { label: "30+ min", min: 1801, max: Infinity },
] as const;

/* -------------------- TYPES -------------------- */

type DurationRow = {
  label: string;
  wins: number;
  losses: number;
  winrate: number;
};

type HeroCounts = {
  1: number;
  2: number;
  3: number;
};

type MapRow = {
  map: string;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  avgMinutes: number;
  netMMR: number;
  vsHigher: number;
  vsLower: number;
  heroAvgLevel: number | null;
  heroCounts: HeroCounts;
};

type LongestWinRow = {
  map: string;
  minutes: number;
  oppTag: string | null;
  oppMMR: number | null;
  mmrChange: number;
  secs: number;
};

export type W3CMapStatsResponse = {
  battletag: string;
  seasons: readonly number[];

  avgWinMinutes: number | null;
  avgLossMinutes: number | null;
  winrateByDuration: DurationRow[];

  topMaps: MapRow[];
  worstMaps: MapRow[];

  longestWin: LongestWinRow | null;

  heroLevels: {
    highestAvgHeroLevel: MapRow | null;
    lowestAvgHeroLevel: MapRow | null;
  };

  mapsWithHighestHeroCount: {
    oneHeroMap: string | null;
    twoHeroMap: string | null;
    threeHeroMap: string | null;
  };

  mmrContext: {
    mostPlayed: MapRow | null;
    bestNet: MapRow | null;
    worstNet: MapRow | null;
    mostVsHigher: MapRow | null;
    mostVsLower: MapRow | null;
  };
};

type MapAggRow = {
  games: number;
  wins: number;
  losses: number;
  totalSecs: number;
  netMMR: number;
  vsHigher: number;
  vsLower: number;
  heroAvgSum: number;
  heroAvgGames: number;
  heroCounts: HeroCounts;
};

/* -------------------- HELPERS -------------------- */

function resolveMapName(match: any): string {
  if (typeof match?.mapName === "string" && match.mapName.trim()) {
    return match.mapName.trim();
  }

  if (typeof match?.map === "string" && match.map.trim()) {
    return match.map
      .replace(/^.*?(?=[A-Z])/, "")
      .replace(/v\d+_.*/, "")
      .trim();
  }

  return "Unknown";
}

function makeHeroCounts(): HeroCounts {
  return { 1: 0, 2: 0, 3: 0 };
}

function makeMapAgg(): MapAggRow {
  return {
    games: 0,
    wins: 0,
    losses: 0,
    totalSecs: 0,
    netMMR: 0,
    vsHigher: 0,
    vsLower: 0,
    heroAvgSum: 0,
    heroAvgGames: 0,
    heroCounts: makeHeroCounts(),
  };
}

function buildMapRow(map: string, agg: MapAggRow): MapRow {
  return {
    map,
    games: agg.games,
    wins: agg.wins,
    losses: agg.losses,
    winrate: agg.games ? +((agg.wins / agg.games) * 100).toFixed(1) : 0,
    avgMinutes: agg.games ? +((agg.totalSecs / agg.games) / 60).toFixed(1) : 0,
    netMMR: agg.netMMR,
    vsHigher: agg.vsHigher,
    vsLower: agg.vsLower,
    heroAvgLevel:
      agg.heroAvgGames > 0
        ? +(agg.heroAvgSum / agg.heroAvgGames).toFixed(2)
        : null,
    heroCounts: agg.heroCounts,
  };
}

/* ===================================================
   SERVICE
=================================================== */

export async function getW3CMapStats(
  inputTag: string
): Promise<W3CMapStatsResponse | null> {
  if (!inputTag?.trim()) return null;

  const canonical =
    (await resolveBattleTagViaSearch(inputTag)) || inputTag.trim();

  const matches = await getMatchesCached(canonical, SEASONS);
  if (!matches.length) return null;

  const durationStats = DURATION_BUCKETS.map((bucket) => ({
    label: bucket.label,
    wins: 0,
    losses: 0,
  }));

  let winTime = 0;
  let lossTime = 0;
  let winGames = 0;
  let lossGames = 0;

  let longestWin: LongestWinRow | null = null;

  const mapAgg: Record<string, MapAggRow> = {};

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    if (match?.gameMode !== GAMEMODE) continue;

    const pair = getPlayerAndOpponent(match, canonical);
    if (!pair) continue;

    const { me, opp } = pair;

    const dur = Number(match?.durationInSeconds);
    if (!Number.isFinite(dur) || dur < MIN_DURATION_SECONDS) continue;

    const mmrGain = Number(me?.mmrGain);
    if (!Number.isFinite(mmrGain)) continue;

    const map = resolveMapName(match);
    const agg = (mapAgg[map] ??= makeMapAgg());

    agg.games++;
    agg.totalSecs += dur;
    agg.netMMR += mmrGain;

    if (
      typeof me?.oldMmr === "number" &&
      typeof opp?.oldMmr === "number"
    ) {
      if (me.oldMmr < opp.oldMmr) agg.vsHigher++;
      if (me.oldMmr > opp.oldMmr) agg.vsLower++;
    }

    for (let j = 0; j < DURATION_BUCKETS.length; j++) {
      const bucket = DURATION_BUCKETS[j];

      if (dur >= bucket.min && dur <= bucket.max) {
        if (me?.won) durationStats[j].wins++;
        else durationStats[j].losses++;
        break;
      }
    }

    if (me?.won) {
      agg.wins++;
      winTime += dur;
      winGames++;

      if (!longestWin || dur > longestWin.secs) {
        longestWin = {
          map,
          minutes: +(dur / 60).toFixed(1),
          oppTag:
            typeof opp?.battleTag === "string" ? opp.battleTag : null,
          oppMMR:
            typeof opp?.oldMmr === "number" ? opp.oldMmr : null,
          mmrChange: mmrGain,
          secs: dur,
        };
      }
    } else {
      agg.losses++;
      lossTime += dur;
      lossGames++;
    }

    const heroes = Array.isArray(me?.heroes) ? me.heroes : [];

    if (heroes.length >= 1 && heroes.length <= 3) {
      agg.heroCounts[heroes.length as 1 | 2 | 3]++;
    }

    if (heroes.length) {
      let levelSum = 0;

      for (let j = 0; j < heroes.length; j++) {
        levelSum += Number(heroes[j]?.level || 0);
      }

      const avgLevel = levelSum / heroes.length;

      if (Number.isFinite(avgLevel)) {
        agg.heroAvgSum += avgLevel;
        agg.heroAvgGames++;
      }
    }
  }

  const validMaps = Object.entries(mapAgg)
    .filter(([, agg]) => agg.games >= MIN_MAP_GAMES)
    .map(([map, agg]) => buildMapRow(map, agg));

  const byWinrate = [...validMaps].sort((a, b) => {
    if (b.winrate !== a.winrate) return b.winrate - a.winrate;
    if (b.games !== a.games) return b.games - a.games;
    return a.map.localeCompare(b.map);
  });

  const worstByWinrate = [...validMaps].sort((a, b) => {
    if (a.winrate !== b.winrate) return a.winrate - b.winrate;
    if (b.games !== a.games) return b.games - a.games;
    return a.map.localeCompare(b.map);
  });

  let mostPlayed: MapRow | null = null;
  let bestNet: MapRow | null = null;
  let worstNet: MapRow | null = null;
  let mostVsHigher: MapRow | null = null;
  let mostVsLower: MapRow | null = null;

  let highestAvgHeroLevel: MapRow | null = null;
  let lowestAvgHeroLevel: MapRow | null = null;

  let oneHeroLeader: MapRow | null = null;
  let twoHeroLeader: MapRow | null = null;
  let threeHeroLeader: MapRow | null = null;

  for (let i = 0; i < validMaps.length; i++) {
    const map = validMaps[i];

    if (!mostPlayed || map.games > mostPlayed.games) {
      mostPlayed = map;
    }

    if (!bestNet || map.netMMR > bestNet.netMMR) {
      bestNet = map;
    }

    if (!worstNet || map.netMMR < worstNet.netMMR) {
      worstNet = map;
    }

    if (!mostVsHigher || map.vsHigher > mostVsHigher.vsHigher) {
      mostVsHigher = map;
    }

    if (!mostVsLower || map.vsLower > mostVsLower.vsLower) {
      mostVsLower = map;
    }

    if (map.heroAvgLevel != null) {
      if (
        !highestAvgHeroLevel ||
        map.heroAvgLevel > (highestAvgHeroLevel.heroAvgLevel ?? -Infinity)
      ) {
        highestAvgHeroLevel = map;
      }

      if (
        !lowestAvgHeroLevel ||
        map.heroAvgLevel < (lowestAvgHeroLevel.heroAvgLevel ?? Infinity)
      ) {
        lowestAvgHeroLevel = map;
      }
    }

    if (!oneHeroLeader || map.heroCounts[1] > oneHeroLeader.heroCounts[1]) {
      oneHeroLeader = map;
    }

    if (!twoHeroLeader || map.heroCounts[2] > twoHeroLeader.heroCounts[2]) {
      twoHeroLeader = map;
    }

    if (
      !threeHeroLeader ||
      map.heroCounts[3] > threeHeroLeader.heroCounts[3]
    ) {
      threeHeroLeader = map;
    }
  }

  const avgWinMinutes =
    winGames > 0 ? +(winTime / winGames / 60).toFixed(1) : null;

  const avgLossMinutes =
    lossGames > 0 ? +(lossTime / lossGames / 60).toFixed(1) : null;

  const winrateByDuration: DurationRow[] = durationStats.map((row) => {
    const games = row.wins + row.losses;

    return {
      label: row.label,
      wins: row.wins,
      losses: row.losses,
      winrate: games > 0 ? +((row.wins / games) * 100).toFixed(1) : 0,
    };
  });

  return {
    battletag: canonical,
    seasons: SEASONS,

    avgWinMinutes,
    avgLossMinutes,
    winrateByDuration,

    topMaps: byWinrate.slice(0, 5),
    worstMaps: worstByWinrate.slice(0, 5),

    longestWin,

    heroLevels: {
      highestAvgHeroLevel,
      lowestAvgHeroLevel,
    },

    mapsWithHighestHeroCount: {
      oneHeroMap: oneHeroLeader?.map ?? null,
      twoHeroMap: twoHeroLeader?.map ?? null,
      threeHeroMap: threeHeroLeader?.map ?? null,
    },

    mmrContext: {
      mostPlayed,
      bestNet,
      worstNet,
      mostVsHigher,
      mostVsLower,
    },
  };
}