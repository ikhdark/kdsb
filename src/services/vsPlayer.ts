// src/services/vsPlayer.ts

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

type SideStats = {
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
  share: number;
};

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

  raceBreakdown: RaceBreakdownRow[];

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

function avg(arr: number[]): number {
  return arr.length
    ? arr.reduce((sum, value) => sum + value, 0) / arr.length
    : 0;
}

function avgNullable(arr: Array<number | null | undefined>): number | null {
  const xs = arr.filter((value): value is number => typeof value === "number");
  return xs.length ? avg(xs) : null;
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
      totalMmrGain: args.mmrGain.reduce((sum, value) => sum + value, 0),
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

function emptySideStats(): SideStats {
  return buildSideStats({
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
}

function serverKey(server: NormalizedMatch["server"]) {
  return `${server.provider ?? "?"}|${server.nodeId ?? "?"}|${server.name ?? "?"}`;
}

/* ======================================================
   SERVICE
====================================================== */

export async function getVsPlayer(
  inputA: string,
  inputB: string
): Promise<VsPlayerResponse | null> {
  const rawA = inputA?.trim();
  const rawB = inputB?.trim();

  if (!rawA || !rawB) return null;

  const [tagA, tagB] = await Promise.all([
    resolveBattleTagViaSearch(rawA),
    resolveBattleTagViaSearch(rawB),
  ]);

  if (!tagA || !tagB) return null;

  const [aAnalytics, bAnalytics] = await Promise.all([
    getPlayerMatchAnalytics(tagA),
    getPlayerMatchAnalytics(tagB),
  ]);

  if (!aAnalytics || !bAnalytics) return null;

  const bIds = new Set(bAnalytics.matches.map((match) => match.id));

  const shared = aAnalytics.matches
    .filter((match) => bIds.has(match.id))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  if (!shared.length) {
    const empty = emptySideStats();

    return {
      playerA: tagA,
      playerB: tagB,
      statsA: empty,
      statsB: empty,
      raceBreakdown: [],
      servers: [],
      mostUsedServer: null,
      maps: [],
      games: [],
    };
  }

  const durations: number[] = [];

  let winsA = 0;
  let winsB = 0;

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

  const heroA: Record<string, { games: number; wins: number }> = {};
  const heroB: Record<string, { games: number; wins: number }> = {};

  const mapAgg: Record<string, { games: number; winsA: number; winsB: number }> = {};
  const serverAgg: Record<
    string,
    { provider: string | null; nodeId: number | null; name: string | null; games: number }
  > = {};

  const raceAgg: Record<
    string,
    { aWins: number; aLosses: number; bWins: number; bLosses: number }
  > = {};

  for (let i = 0; i < shared.length; i++) {
    const game = shared[i];

    durations.push(game.durationSeconds);

    const sideA =
      game.me.battletag.toLowerCase() === tagA.toLowerCase() ? game.me : game.opp;
    const sideB =
      game.me.battletag.toLowerCase() === tagA.toLowerCase() ? game.opp : game.me;

    const aWon = sideA.won;
    if (aWon) winsA++;
    else winsB++;

    aGain.push(sideA.mmrGain);
    bGain.push(sideB.mmrGain);

    aGold.push(sideA.score.goldCollected);
    aLumber.push(sideA.score.lumberCollected);
    aUpkeep.push(sideA.score.goldUpkeepLost);

    bGold.push(sideB.score.goldCollected);
    bLumber.push(sideB.score.lumberCollected);
    bUpkeep.push(sideB.score.goldUpkeepLost);

    aUnitsProduced.push(sideA.score.unitsProduced);
    aUnitsKilled.push(sideA.score.unitsKilled);
    aLargestArmy.push(sideA.score.largestArmy);

    bUnitsProduced.push(sideB.score.unitsProduced);
    bUnitsKilled.push(sideB.score.unitsKilled);
    bLargestArmy.push(sideB.score.largestArmy);

    aHeroesKilled.push(sideA.score.heroesKilled);
    aItems.push(sideA.score.itemsObtained);
    aMercs.push(sideA.score.mercsHired);
    aXP.push(sideA.score.expGained);

    bHeroesKilled.push(sideB.score.heroesKilled);
    bItems.push(sideB.score.itemsObtained);
    bMercs.push(sideB.score.mercsHired);
    bXP.push(sideB.score.expGained);

    aAvgPing.push(sideA.avgPing);
    bAvgPing.push(sideB.avgPing);

    for (let j = 0; j < sideA.heroes.length; j++) {
      const hero = sideA.heroes[j];
      heroA[hero.name] ??= { games: 0, wins: 0 };
      heroA[hero.name].games++;
      if (sideA.won) heroA[hero.name].wins++;
    }

    for (let j = 0; j < sideB.heroes.length; j++) {
      const hero = sideB.heroes[j];
      heroB[hero.name] ??= { games: 0, wins: 0 };
      heroB[hero.name].games++;
      if (sideB.won) heroB[hero.name].wins++;
    }

    const raceA = sideA.race || "Unknown";
    const raceB = sideB.race || "Unknown";

    raceAgg[raceA] ??= { aWins: 0, aLosses: 0, bWins: 0, bLosses: 0 };
    raceAgg[raceB] ??= { aWins: 0, aLosses: 0, bWins: 0, bLosses: 0 };

    if (sideA.won) raceAgg[raceA].aWins++;
    else raceAgg[raceA].aLosses++;

    if (sideB.won) raceAgg[raceB].bWins++;
    else raceAgg[raceB].bLosses++;

    const map = game.map || "Unknown";
    mapAgg[map] ??= { games: 0, winsA: 0, winsB: 0 };
    mapAgg[map].games++;
    if (aWon) mapAgg[map].winsA++;
    else mapAgg[map].winsB++;

    const key = serverKey(game.server);
    serverAgg[key] ??= {
      provider: game.server.provider,
      nodeId: game.server.nodeId,
      name: game.server.name,
      games: 0,
    };
    serverAgg[key].games++;
  }

  const maps = Object.entries(mapAgg)
    .map(([map, value]) => ({
      map,
      games: value.games,
      winsA: value.winsA,
      winsB: value.winsB,
      winrateA: value.games ? value.winsA / value.games : 0,
      winrateB: value.games ? value.winsB / value.games : 0,
    }))
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return a.map.localeCompare(b.map);
    });

  const servers: ServerUsage[] = Object.values(serverAgg)
    .sort((a, b) => b.games - a.games)
    .map((server) => ({
      ...server,
      share: shared.length ? server.games / shared.length : 0,
    }));

  const mostUsedServer = servers.length ? servers[0] : null;

  const raceBreakdown: RaceBreakdownRow[] = Object.entries(raceAgg)
    .map(([race, value]) => {
      const aGames = value.aWins + value.aLosses;
      const bGames = value.bWins + value.bLosses;

      return {
        race,
        aGames,
        aWins: value.aWins,
        aLosses: value.aLosses,
        aWinrate: aGames ? value.aWins / aGames : 0,

        bGames,
        bWins: value.bWins,
        bLosses: value.bLosses,
        bWinrate: bGames ? value.bWins / bGames : 0,
      };
    })
    .sort((a, b) => {
      const totalA = a.aGames + a.bGames;
      const totalB = b.aGames + b.bGames;

      if (totalB !== totalA) return totalB - totalA;
      return a.race.localeCompare(b.race);
    });

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
    raceBreakdown,
    servers,
    mostUsedServer,
    maps,
    games: shared,
  };
}