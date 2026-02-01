
import {
  fetchAllMatches,
  getPlayerAndOpponent,
  RACE_MAP,
} from "@/lib/w3cUtils";

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";


/* -------------------- CONSTANTS -------------------- */

const SEASONS = [24];
const MIN_GAMES = 1;
const MIN_TOTAL_GAMES = 1;
const MIN_DURATION_SECONDS = 120;
const MAX_EXTREME_ABS_MMR_CHANGE = 30;
const HIGH_GAIN_THRESHOLD = 15;

/* -------------------- TYPES -------------------- */

export type Game = {
  result: "W" | "L";
  myName: string;
  oppName: string;
  myRace: string;
  oppRace: string;
  myMMR: number;
  oppMMR: number;
  mmrChange: number;
  date: Date;
  raceCode: number;
};

type OpponentAgg = {
  wins: number;
  losses: number;
  totalGames: number;
  netMMR: number;
  oppMMRSum: number;
  myMMRSum: number;
  games: Game[];
};

/* -------------------- HELPERS -------------------- */

export function displayMyRace(g: Game): string {
  if (g.myRace !== "Random") return g.myRace;
  const rolled = RACE_MAP[g.raceCode] || "Unknown";
  return `Random (${rolled})`;
}

/* -------------------- OUTPUT TYPE -------------------- */

export type W3CVsPlayerContext = {
  battletag: string;
  seasons: number[];

  rules: {
    minGames: number;
    minTotalGames: number;
    minDurationSeconds: number;
    maxExtremeAbsMmrChange: number;
    highGainThreshold: number;
    seasonFilteredTo: number;
  };

  totals: {
    strictGamesAll: number;
    opponentsEligible: number;
  };

  extremes: {
    largestSingleGain: number | null;
    largestSingleLoss: number | null;
    largestLossGame: Game | null;

    largestGapWin: (Game & { gap: number }) | null;
    largestGapLoss: (Game & { gap: number }) | null;

    highGainGames: Game[];
    gainGamesToShow: Game[];
  };

  best: {
    tag: string;
    oppRace: string;
    wins: number;
    losses: number;
    totalGames: number;
    winrate: number;
    netMMR: number;
    gamesSortedByOppMMRDesc: Game[];
    avgOppMMR: number;
    avgMyMMR: number;
    adjustedWinrate: number;
  } | null;

  worst: {
    tag: string;
    oppRace: string;
    wins: number;
    losses: number;
    totalGames: number;
    winrate: number;
    netMMR: number;
    gamesSortedByOppMMRDesc: Game[];
    avgOppMMR: number;
    avgMyMMR: number;
    adjustedWinrate: number;
  } | null;

  opponents: {
    tag: string;
    wins: number;
    losses: number;
    totalGames: number;
    winrate: number;
    netMMR: number;
    oppRace: string;
    avgOppMMR: number;
    avgMyMMR: number;
    games: Game[];
  }[];
};

/* -------------------- SERVICE -------------------- */

export async function getPlayerVsPlayer(
  inputTag: string
): Promise<W3CVsPlayerContext | null> {
  const raw = String(inputTag ?? "").trim();
  if (!raw) return null;

  /* =====================================================
     CANONICAL RESOLUTION (SEARCH BAR AUTHORITY)
     ===================================================== */

  const canonicalTag = await resolveBattleTagViaSearch(raw);
  if (!canonicalTag) return null;

  /* -------------------- MATCH FETCH -------------------- */

  const allMatches = await fetchAllMatches(canonicalTag, SEASONS);

  if (!allMatches.length) {
  return {
    battletag: canonicalTag,
    seasons: SEASONS,
    rules: {
      minGames: MIN_GAMES,
      minTotalGames: MIN_TOTAL_GAMES,
      minDurationSeconds: MIN_DURATION_SECONDS,
      maxExtremeAbsMmrChange: MAX_EXTREME_ABS_MMR_CHANGE,
      highGainThreshold: HIGH_GAIN_THRESHOLD,
      seasonFilteredTo: SEASONS[0],
    },
    totals: { strictGamesAll: 0, opponentsEligible: 0 },
    extremes: {
      largestSingleGain: null,
      largestSingleLoss: null,
      largestLossGame: null,
      largestGapWin: null,
      largestGapLoss: null,
      highGainGames: [],
      gainGamesToShow: [],
    },
    best: null,
    worst: null,
    opponents: [],
  };
}
  const targetLower = canonicalTag.toLowerCase();

  allMatches.sort(
    (a: any, b: any) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const strictGamesAll: Game[] = [];

  for (const match of allMatches) {
    // Explicitly filter to S24 only (existing behavior)
    if (match.gameMode !== 1 || !SEASONS.includes(match.season)) continue;

    const pair = getPlayerAndOpponent(match, targetLower);
    if (!pair) continue;

    const { me, opp } = pair;
    const race = RACE_MAP[me.race] || "Unknown";


    if (
      typeof match.durationInSeconds !== "number" ||
      match.durationInSeconds < MIN_DURATION_SECONDS
    ) continue;

    if (
      typeof me.mmrGain !== "number" ||
      typeof me.oldMmr !== "number" ||
      typeof opp.oldMmr !== "number"
    ) continue;

    strictGamesAll.push({
      result: me.won ? "W" : "L",
      myName: me.battleTag,
      oppName: opp.battleTag,
      myRace: race,
      oppRace: RACE_MAP[opp.race] || "Unknown",
      myMMR: me.oldMmr,
      oppMMR: opp.oldMmr,
      mmrChange: me.mmrGain,
      date: new Date(match.startTime),
      raceCode:
        me.race !== 0
          ? me.race
          : typeof me.rndRace === "number"
          ? me.rndRace
          : 0,
    });
  }

  if (strictGamesAll.length < MIN_TOTAL_GAMES) {
  // allow page to render with limited data
}

  /* -------------------- AGGREGATION -------------------- */

  function aggregateFromGames(games: Game[]): [string, OpponentAgg][] {
    const opponents: Record<string, OpponentAgg> = {};

    for (const g of games) {
      const tag = g.oppName;
      opponents[tag] ??= {
        wins: 0,
        losses: 0,
        totalGames: 0,
        netMMR: 0,
        oppMMRSum: 0,
        myMMRSum: 0,
        games: [],
      };

      const o = opponents[tag];
      o.totalGames++;
      o.games.push(g);
      o.oppMMRSum += g.oppMMR;
      o.myMMRSum += g.myMMR;

      if (g.result === "W") {
        o.wins++;
        o.netMMR += g.mmrChange;
      } else {
        o.losses++;
        o.netMMR -= Math.abs(g.mmrChange);
      }
    }

    return Object.entries(opponents).filter(
      ([, o]) => o.totalGames >= MIN_GAMES
    );
  }

  const agg = aggregateFromGames(strictGamesAll);

  function adjustedWinrate(o: OpponentAgg): number {
    const PRIOR_GAMES = 10;
    const PRIOR_WR = 0.5;
    return (o.wins + PRIOR_GAMES * PRIOR_WR) / (o.totalGames + PRIOR_GAMES);
  }

  function bestOpponent(list: [string, OpponentAgg][]) {
    return list
      .filter(([, o]) => {
        const avgOpp = o.oppMMRSum / o.totalGames;
        const avgMe = o.myMMRSum / o.totalGames;
        return avgOpp >= avgMe - 100;
      })
      .sort((a, b) => {
        const wrA = adjustedWinrate(a[1]);
        const wrB = adjustedWinrate(b[1]);
        if (wrA !== wrB) return wrB - wrA;
        return b[1].totalGames - a[1].totalGames;
      })[0];
  }

  function worstOpponent(list: [string, OpponentAgg][]) {
    return list.sort(
      (a, b) =>
        a[1].wins / a[1].totalGames -
        b[1].wins / b[1].totalGames
    )[0];
  }

  const best = agg.length ? bestOpponent([...agg]) : undefined;
  const worst = agg.length ? worstOpponent([...agg]) : undefined;

  /* -------------------- EXTREMES (UNCHANGED) -------------------- */

  let largestSingleGain: number | null = null;
  let largestSingleLoss: number | null = null;
  let largestLossGame: Game | null = null;
  let largestGapWin: (Game & { gap: number }) | null = null;
  let largestGapLoss: (Game & { gap: number }) | null = null;

  const highGainGames: Game[] = [];
  const lossCandidates: Game[] = [];

  for (const g of strictGamesAll) {
    if (Math.abs(g.mmrChange) <= MAX_EXTREME_ABS_MMR_CHANGE) {
      if (largestSingleGain === null || g.mmrChange > largestSingleGain)
        largestSingleGain = g.mmrChange;

      if (g.mmrChange >= HIGH_GAIN_THRESHOLD)
        highGainGames.push(g);

      if (g.mmrChange < 0)
        lossCandidates.push(g);
    }

    const gap = Math.abs(g.myMMR - g.oppMMR);

    if (g.result === "W" && g.myMMR < g.oppMMR) {
      if (!largestGapWin || gap > largestGapWin.gap)
        largestGapWin = { gap, ...g };
    }

    if (g.result === "L" && g.myMMR > g.oppMMR) {
      if (!largestGapLoss || gap > largestGapLoss.gap)
        largestGapLoss = { gap, ...g };
    }
  }

  if (lossCandidates.length) {
    lossCandidates.sort((a, b) => a.mmrChange - b.mmrChange);
    largestSingleLoss = lossCandidates[0].mmrChange;
    largestLossGame = lossCandidates[0];
  }

  const gainGamesToShow =
    highGainGames.length
      ? highGainGames
      : largestSingleGain !== null
      ? strictGamesAll.filter(g => g.mmrChange === largestSingleGain).slice(0, 1)
      : [];

  /* -------------------- OUTPUT -------------------- */

  const packOpponent = (result?: [string, OpponentAgg]) => {
    if (!result) return null;

    const [tag, r] = result;
    const oppRace = r.games[0]?.oppRace ?? "Unknown";

    return {
      tag,
      oppRace,
      wins: r.wins,
      losses: r.losses,
      totalGames: r.totalGames,
      winrate: +(r.wins / r.totalGames * 100).toFixed(1),
      netMMR: r.netMMR,
      gamesSortedByOppMMRDesc: [...r.games].sort(
        (a, b) => b.oppMMR - a.oppMMR
      ),
      avgOppMMR: r.oppMMRSum / r.totalGames,
      avgMyMMR: r.myMMRSum / r.totalGames,
      adjustedWinrate: adjustedWinrate(r),
    };
  };

  return {
    battletag: canonicalTag,
    seasons: SEASONS,

    rules: {
      minGames: MIN_GAMES,
      minTotalGames: MIN_TOTAL_GAMES,
      minDurationSeconds: MIN_DURATION_SECONDS,
      maxExtremeAbsMmrChange: MAX_EXTREME_ABS_MMR_CHANGE,
      highGainThreshold: HIGH_GAIN_THRESHOLD,
      seasonFilteredTo: 24,
    },

    totals: {
      strictGamesAll: strictGamesAll.length,
      opponentsEligible: agg.length,
    },

    extremes: {
      largestSingleGain,
      largestSingleLoss,
      largestLossGame,
      largestGapWin,
      largestGapLoss,
      highGainGames,
      gainGamesToShow,
    },

    best: packOpponent(best),
    worst: packOpponent(worst),

    opponents: agg.map(([tag, o]) => ({
      tag,
      wins: o.wins,
      losses: o.losses,
      totalGames: o.totalGames,
      winrate: +(o.wins / o.totalGames * 100).toFixed(1),
      netMMR: o.netMMR,
      oppRace: o.games[0]?.oppRace ?? "Unknown",
      avgOppMMR: o.oppMMRSum / o.totalGames,
      avgMyMMR: o.myMMRSum / o.totalGames,
      games: o.games,
    })),
  };
}
