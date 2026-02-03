// src/services/vsPlayer.ts
//
// PUBLIC HEAD-TO-HEAD LOOKUP (FULL TELEMETRY)
// Symmetric. No "me" semantics.
// Aggregates ALL score fields + MMR + ping + server usage.
//

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { getPlayerMatchAnalytics } from "@/services/playerMatchAnalytics";
import type { NormalizedMatch } from "@/services/playerMatchAnalytics";

/* ======================================================
   TYPES
====================================================== */

type WL = {
  games: number;
  wins: number;
  losses: number;
  winrate: number;
};

export type SideStats = {
  overall: WL;

  avgDurationSec: number;

  mmr: {
    totalMmrGain: number;
  };

  economy: {
    avgGold: number;
    avgLumber: number;
    avgUpkeepLoss: number;
  };

  units: {
    avgUnitsProduced: number;
    avgUnitsKilled: number;
    avgLargestArmy: number;
  };

  hero: {
    avgHeroesKilled: number;
    avgItemsObtained: number;
    avgMercsHired: number;
    avgXP: number;
  };

  network: {
    avgPing: number | null;
  };

  heroUsage: Record<string, { games: number; wins: number }>;
};

export type ServerUsage = {
  provider: string | null;
  nodeId: number | null;
  name: string | null;
  games: number;
  share: number; // 0..1
};

/* =========================
   NEW: race breakdown
========================= */

export type RaceBreakdownRow = {
  race: string;

  aGames: number;
  aWins: number;
  aLosses: number;
  aWinrate: number;

  bGames: number;
  bWins: number;
  bLosses: number;
  bWinrate: number;
};

export type VsPlayerResponse = {
  playerA: string;
  playerB: string;

  statsA: SideStats;
  statsB: SideStats;

  raceBreakdown: RaceBreakdownRow[]; // ✅ added

  servers: ServerUsage[];
  mostUsedServer: ServerUsage | null;

  maps: {
    map: string;
    games: number;
    winsA: number;
    winsB: number;
    winrateA: number;
    winrateB: number;
  }[];

  games: NormalizedMatch[];
};

/* ======================================================
   HELPERS
====================================================== */

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

function avgNullable(arr: Array<number | null | undefined>): number | null {
  const xs = arr.filter((x): x is number => typeof x === "number");
  if (!xs.length) return null;
  return avg(xs);
}

function makeWL(wins: number, games: number): WL {
  return {
    games,
    wins,
    losses: games - wins,
    winrate: games ? wins / games : 0,
  };
}

function buildSideStats(args: {
  wins: number;
  games: number;

  durations: number[];
  mmrGain: number[];

  gold: number[];
  lumber: number[];
  upkeep: number[];

  unitsProduced: number[];
  unitsKilled: number[];
  largestArmy: number[];

  heroesKilled: number[];
  itemsObtained: number[];
  mercsHired: number[];
  xp: number[];

  avgPing: Array<number | null>;

  heroUsage: Record<string, { games: number; wins: number }>;
}): SideStats {
  return {
    overall: makeWL(args.wins, args.games),

    avgDurationSec: avg(args.durations),

    mmr: {
      totalMmrGain: args.mmrGain.reduce((a, b) => a + b, 0),
    },

    economy: {
      avgGold: avg(args.gold),
      avgLumber: avg(args.lumber),
      avgUpkeepLoss: avg(args.upkeep),
    },

    units: {
      avgUnitsProduced: avg(args.unitsProduced),
      avgUnitsKilled: avg(args.unitsKilled),
      avgLargestArmy: avg(args.largestArmy),
    },

    hero: {
      avgHeroesKilled: avg(args.heroesKilled),
      avgItemsObtained: avg(args.itemsObtained),
      avgMercsHired: avg(args.mercsHired),
      avgXP: avg(args.xp),
    },

    network: {
      avgPing: avgNullable(args.avgPing),
    },

    heroUsage: args.heroUsage,
  };
}

function serverKey(s: NormalizedMatch["server"]) {
  return `${s.provider ?? "?"}|${s.nodeId ?? "?"}|${s.name ?? "?"}`;
}

/* ======================================================
   SERVICE
====================================================== */

export async function getVsPlayer(
  inputA: string,
  inputB: string
): Promise<VsPlayerResponse | null> {
  if (!inputA || !inputB) return null;

  const [tagA, tagB] = await Promise.all([
    resolveBattleTagViaSearch(inputA),
    resolveBattleTagViaSearch(inputB),
  ]);

  if (!tagA || !tagB) return null;

  const [aAnalytics, bAnalytics] = await Promise.all([
    getPlayerMatchAnalytics(tagA),
    getPlayerMatchAnalytics(tagB),
  ]);

  if (!aAnalytics || !bAnalytics) return null;

  // intersect by match id
  const bIds = new Set(bAnalytics.matches.map((m) => m.id));

  const shared = aAnalytics.matches
    .filter((m) => bIds.has(m.id))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  if (!shared.length) {
    const empty = buildSideStats({
      wins: 0,
      games: 0,
      durations: [],
      mmrGain: [],
      gold: [],
      lumber: [],
      upkeep: [],
      unitsProduced: [],
      unitsKilled: [],
      largestArmy: [],
      heroesKilled: [],
      itemsObtained: [],
      mercsHired: [],
      xp: [],
      avgPing: [],
      heroUsage: {},
    });

    return {
      playerA: tagA,
      playerB: tagB,
      statsA: empty,
      statsB: empty,
      raceBreakdown: [], // ✅ added
      servers: [],
      mostUsedServer: null,
      maps: [],
      games: [],
    };
  }

  /* ======================================================
     AGGREGATION (single pass, EVERYTHING)
  ====================================================== */

  const durations: number[] = [];

  let winsA = 0;
  let winsB = 0;

  // A arrays
  const aGain: number[] = [];

  const aGold: number[] = [];
  const aLumber: number[] = [];
  const aUpkeep: number[] = [];

  const aUnitsProduced: number[] = [];
  const aUnitsKilled: number[] = [];
  const aLargestArmy: number[] = [];

  const aHeroesKilled: number[] = [];
  const aItems: number[] = [];
  const aMercs: number[] = [];
  const aXP: number[] = [];

  const aAvgPing: Array<number | null> = [];

  // B arrays
  const bGain: number[] = [];

  const bGold: number[] = [];
  const bLumber: number[] = [];
  const bUpkeep: number[] = [];

  const bUnitsProduced: number[] = [];
  const bUnitsKilled: number[] = [];
  const bLargestArmy: number[] = [];

  const bHeroesKilled: number[] = [];
  const bItems: number[] = [];
  const bMercs: number[] = [];
  const bXP: number[] = [];

  const bAvgPing: Array<number | null> = [];

  // hero usage
  const heroA: Record<string, { games: number; wins: number }> = {};
  const heroB: Record<string, { games: number; wins: number }> = {};

  // map stats (wins by A/B)
  const mapAgg: Record<string, { games: number; winsA: number; winsB: number }> =
    {};

  // server usage
  const serverAgg: Record<
    string,
    { provider: string | null; nodeId: number | null; name: string | null; games: number }
  > = {};

  /* =========================
     NEW: race aggregation
  ========================= */

  const raceAgg: Record<
    string,
    { aWins: number; aLosses: number; bWins: number; bLosses: number }
  > = {};

  for (const g of shared) {
    durations.push(g.durationSeconds);

    // Determine which side in this normalized record is A/B
    const sideA = g.me.battletag === tagA ? g.me : g.opp;
    const sideB = g.me.battletag === tagA ? g.opp : g.me;

    const aWon = sideA.won;
    if (aWon) winsA++;
    else winsB++;

    // MMR
    aGain.push(sideA.mmrGain);
    bGain.push(sideB.mmrGain);

    // Economy
    aGold.push(sideA.score.goldCollected);
    aLumber.push(sideA.score.lumberCollected);
    aUpkeep.push(sideA.score.goldUpkeepLost);

    bGold.push(sideB.score.goldCollected);
    bLumber.push(sideB.score.lumberCollected);
    bUpkeep.push(sideB.score.goldUpkeepLost);

    // Units
    aUnitsProduced.push(sideA.score.unitsProduced);
    aUnitsKilled.push(sideA.score.unitsKilled);
    aLargestArmy.push(sideA.score.largestArmy);

    bUnitsProduced.push(sideB.score.unitsProduced);
    bUnitsKilled.push(sideB.score.unitsKilled);
    bLargestArmy.push(sideB.score.largestArmy);

    // Hero score
    aHeroesKilled.push(sideA.score.heroesKilled);
    aItems.push(sideA.score.itemsObtained);
    aMercs.push(sideA.score.mercsHired);
    aXP.push(sideA.score.expGained);

    bHeroesKilled.push(sideB.score.heroesKilled);
    bItems.push(sideB.score.itemsObtained);
    bMercs.push(sideB.score.mercsHired);
    bXP.push(sideB.score.expGained);

    // Network
    aAvgPing.push(sideA.avgPing);
    bAvgPing.push(sideB.avgPing);

    // Hero usage counts
    for (const h of sideA.heroes) {
      heroA[h.name] ??= { games: 0, wins: 0 };
      heroA[h.name].games++;
      if (sideA.won) heroA[h.name].wins++;
    }

    for (const h of sideB.heroes) {
      heroB[h.name] ??= { games: 0, wins: 0 };
      heroB[h.name].games++;
      if (sideB.won) heroB[h.name].wins++;
    }

    // ✅ NEW: Race breakdown
    const raceA = sideA.race ?? "Unknown";
    const raceB = sideB.race ?? "Unknown";

    raceAgg[raceA] ??= { aWins: 0, aLosses: 0, bWins: 0, bLosses: 0 };
    raceAgg[raceB] ??= { aWins: 0, aLosses: 0, bWins: 0, bLosses: 0 };

    if (sideA.won) raceAgg[raceA].aWins++;
    else raceAgg[raceA].aLosses++;

    if (sideB.won) raceAgg[raceB].bWins++;
    else raceAgg[raceB].bLosses++;

    // Map
    mapAgg[g.map] ??= { games: 0, winsA: 0, winsB: 0 };
    mapAgg[g.map].games++;
    aWon ? mapAgg[g.map].winsA++ : mapAgg[g.map].winsB++;

    // Server usage
    const sKey = serverKey(g.server);
    serverAgg[sKey] ??= {
      provider: g.server.provider,
      nodeId: g.server.nodeId,
      name: g.server.name,
      games: 0,
    };
    serverAgg[sKey].games++;
  }

  const maps = Object.entries(mapAgg).map(([map, v]) => ({
    map,
    games: v.games,
    winsA: v.winsA,
    winsB: v.winsB,
    winrateA: v.winsA / v.games,
    winrateB: v.winsB / v.games,
  }));

  const servers: ServerUsage[] = Object.values(serverAgg)
    .sort((x, y) => y.games - x.games)
    .map((s) => ({
      ...s,
      share: s.games / shared.length,
    }));

  const mostUsedServer = servers.length ? servers[0] : null;

  // ✅ NEW: build raceBreakdown rows (sorted by total games desc)
  const raceBreakdown: RaceBreakdownRow[] = Object.entries(raceAgg)
    .map(([race, r]) => {
      const aGames = r.aWins + r.aLosses;
      const bGames = r.bWins + r.bLosses;

      return {
        race,
        aGames,
        aWins: r.aWins,
        aLosses: r.aLosses,
        aWinrate: aGames ? r.aWins / aGames : 0,

        bGames,
        bWins: r.bWins,
        bLosses: r.bLosses,
        bWinrate: bGames ? r.bWins / bGames : 0,
      };
    })
    .sort((x, y) => (y.aGames + y.bGames) - (x.aGames + x.bGames));

  const statsA = buildSideStats({
    wins: winsA,
    games: shared.length,
    durations,

    mmrGain: aGain,

    gold: aGold,
    lumber: aLumber,
    upkeep: aUpkeep,

    unitsProduced: aUnitsProduced,
    unitsKilled: aUnitsKilled,
    largestArmy: aLargestArmy,

    heroesKilled: aHeroesKilled,
    itemsObtained: aItems,
    mercsHired: aMercs,
    xp: aXP,

    avgPing: aAvgPing,

    heroUsage: heroA,
  });

  const statsB = buildSideStats({
    wins: winsB,
    games: shared.length,
    durations,

    mmrGain: bGain,

    gold: bGold,
    lumber: bLumber,
    upkeep: bUpkeep,

    unitsProduced: bUnitsProduced,
    unitsKilled: bUnitsKilled,
    largestArmy: bLargestArmy,

    heroesKilled: bHeroesKilled,
    itemsObtained: bItems,
    mercsHired: bMercs,
    xp: bXP,

    avgPing: bAvgPing,

    heroUsage: heroB,
  });

  return {
    playerA: tagA,
    playerB: tagB,
    statsA,
    statsB,

    raceBreakdown, // ✅ added

    servers,
    mostUsedServer,

    maps,

    games: shared,
  };
}
