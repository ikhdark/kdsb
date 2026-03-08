// src/services/playerVsPlayer.ts

import {
  getPlayerAndOpponent,
} from "@/lib/w3cUtils";
import { raceLabel } from "@/lib/w3cRaces";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

import { getMatchesCached } from "@/services/matchCache";

import {
  W3C_CURRENT_SEASON,
  W3C_GAME_MODE_1V1,
  W3C_MIN_DURATION_SECONDS,
} from "@/lib/w3cConfig";

/* -------------------- CONSTANTS -------------------- */

const SEASONS = [W3C_CURRENT_SEASON] as const;
const GAMEMODE = W3C_GAME_MODE_1V1;
const MIN_GAMES = 1;
const MIN_TOTAL_GAMES = 1;
const MIN_DURATION_SECONDS = W3C_MIN_DURATION_SECONDS;
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

export function displayMyRace(game: Game): string {
  if (game.myRace !== "Random") return game.myRace;
  return `Random (${raceLabel(game.raceCode)})`;
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

function emptyResponse(battletag: string): W3CVsPlayerContext {
  return {
    battletag,
    seasons: [...SEASONS],
    rules: {
      minGames: MIN_GAMES,
      minTotalGames: MIN_TOTAL_GAMES,
      minDurationSeconds: MIN_DURATION_SECONDS,
      maxExtremeAbsMmrChange: MAX_EXTREME_ABS_MMR_CHANGE,
      highGainThreshold: HIGH_GAIN_THRESHOLD,
      seasonFilteredTo: SEASONS[0],
    },
    totals: {
      strictGamesAll: 0,
      opponentsEligible: 0,
    },
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

function aggregateFromGames(games: Game[]): [string, OpponentAgg][] {
  const opponents: Record<string, OpponentAgg> = {};

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const tag = game.oppName;

    opponents[tag] ??= {
      wins: 0,
      losses: 0,
      totalGames: 0,
      netMMR: 0,
      oppMMRSum: 0,
      myMMRSum: 0,
      games: [],
    };

    const agg = opponents[tag];

    agg.totalGames++;
    agg.games.push(game);
    agg.oppMMRSum += game.oppMMR;
    agg.myMMRSum += game.myMMR;

    if (game.result === "W") {
      agg.wins++;
      agg.netMMR += game.mmrChange;
    } else {
      agg.losses++;
      agg.netMMR -= Math.abs(game.mmrChange);
    }
  }

  return Object.entries(opponents).filter(
    ([, opp]) => opp.totalGames >= MIN_GAMES
  );
}

function adjustedWinrate(opp: OpponentAgg): number {
  const PRIOR_GAMES = 10;
  const PRIOR_WR = 0.5;

  return (opp.wins + PRIOR_GAMES * PRIOR_WR) / (opp.totalGames + PRIOR_GAMES);
}

function bestOpponent(list: [string, OpponentAgg][]) {
  return list
    .filter(([, opp]) => {
      const avgOpp = opp.oppMMRSum / opp.totalGames;
      const avgMe = opp.myMMRSum / opp.totalGames;
      return avgOpp >= avgMe - 100;
    })
    .sort((a, b) => {
      const wrA = adjustedWinrate(a[1]);
      const wrB = adjustedWinrate(b[1]);

      if (wrA !== wrB) return wrB - wrA;
      if (b[1].totalGames !== a[1].totalGames) {
        return b[1].totalGames - a[1].totalGames;
      }

      return a[0].localeCompare(b[0]);
    })[0];
}

function worstOpponent(list: [string, OpponentAgg][]) {
  return list.sort((a, b) => {
    const wrA = a[1].wins / a[1].totalGames;
    const wrB = b[1].wins / b[1].totalGames;

    if (wrA !== wrB) return wrA - wrB;
    if (b[1].totalGames !== a[1].totalGames) {
      return b[1].totalGames - a[1].totalGames;
    }

    return a[0].localeCompare(b[0]);
  })[0];
}

function packOpponent(result?: [string, OpponentAgg]) {
  if (!result) return null;

  const [tag, opp] = result;
  const oppRace = opp.games[0]?.oppRace ?? "Unknown";

  return {
    tag,
    oppRace,
    wins: opp.wins,
    losses: opp.losses,
    totalGames: opp.totalGames,
    winrate: +((opp.wins / opp.totalGames) * 100).toFixed(1),
    netMMR: opp.netMMR,
    gamesSortedByOppMMRDesc: [...opp.games].sort((a, b) => b.oppMMR - a.oppMMR),
    avgOppMMR: opp.oppMMRSum / opp.totalGames,
    avgMyMMR: opp.myMMRSum / opp.totalGames,
    adjustedWinrate: adjustedWinrate(opp),
  };
}

/* -------------------- SERVICE -------------------- */

export async function getPlayerVsPlayer(
  inputTag: string
): Promise<W3CVsPlayerContext | null> {
  const raw = String(inputTag ?? "").trim();
  if (!raw) return null;

  const canonicalTag = await resolveBattleTagViaSearch(raw);
  if (!canonicalTag) return null;

  const allMatches = await getMatchesCached(canonicalTag, SEASONS);

  if (!allMatches.length) {
    return emptyResponse(canonicalTag);
  }

  allMatches.sort(
    (a: any, b: any) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const strictGamesAll: Game[] = [];

  for (let i = 0; i < allMatches.length; i++) {
    const match = allMatches[i];

    if (match?.gameMode !== GAMEMODE || !SEASONS.includes(match?.season)) {
      continue;
    }

    if (
      typeof match?.durationInSeconds !== "number" ||
      match.durationInSeconds < MIN_DURATION_SECONDS
    ) {
      continue;
    }

    const pair = getPlayerAndOpponent(match, canonicalTag);
    if (!pair) continue;

    const { me, opp } = pair;

    if (
      typeof me?.mmrGain !== "number" ||
      typeof me?.oldMmr !== "number" ||
      typeof opp?.oldMmr !== "number"
    ) {
      continue;
    }

    const raceCode =
      me?.race !== 0
        ? me?.race
        : typeof me?.rndRace === "number"
        ? me.rndRace
        : 0;

    const date = new Date(match.startTime);
    if (!Number.isFinite(date.getTime())) continue;

    strictGamesAll.push({
      result: me.won ? "W" : "L",
      myName: String(me.battleTag ?? canonicalTag),
      oppName: String(opp.battleTag ?? "Unknown"),
      myRace: raceLabel(me.race),
      oppRace: raceLabel(opp.race),
      myMMR: me.oldMmr,
      oppMMR: opp.oldMmr,
      mmrChange: me.mmrGain,
      date,
      raceCode,
    });
  }

  if (strictGamesAll.length < MIN_TOTAL_GAMES) {
    return emptyResponse(canonicalTag);
  }

  const agg = aggregateFromGames(strictGamesAll);

  const best = agg.length ? bestOpponent([...agg]) : undefined;
  const worst = agg.length ? worstOpponent([...agg]) : undefined;

  let largestSingleGain: number | null = null;
  let largestSingleLoss: number | null = null;
  let largestLossGame: Game | null = null;
  let largestGapWin: (Game & { gap: number }) | null = null;
  let largestGapLoss: (Game & { gap: number }) | null = null;

  const highGainGames: Game[] = [];
  const lossCandidates: Game[] = [];

  for (let i = 0; i < strictGamesAll.length; i++) {
    const game = strictGamesAll[i];

    if (Math.abs(game.mmrChange) <= MAX_EXTREME_ABS_MMR_CHANGE) {
      if (largestSingleGain === null || game.mmrChange > largestSingleGain) {
        largestSingleGain = game.mmrChange;
      }

      if (game.mmrChange >= HIGH_GAIN_THRESHOLD) {
        highGainGames.push(game);
      }

      if (game.mmrChange < 0) {
        lossCandidates.push(game);
      }
    }

    const gap = Math.abs(game.myMMR - game.oppMMR);

    if (game.result === "W" && game.myMMR < game.oppMMR) {
      if (!largestGapWin || gap > largestGapWin.gap) {
        largestGapWin = { gap, ...game };
      }
    }

    if (game.result === "L" && game.myMMR > game.oppMMR) {
      if (!largestGapLoss || gap > largestGapLoss.gap) {
        largestGapLoss = { gap, ...game };
      }
    }
  }

  if (lossCandidates.length) {
    lossCandidates.sort((a, b) => a.mmrChange - b.mmrChange);
    largestSingleLoss = lossCandidates[0].mmrChange;
    largestLossGame = lossCandidates[0];
  }

  const gainGamesToShow = highGainGames.length
    ? highGainGames
    : largestSingleGain !== null
    ? strictGamesAll
        .filter((game) => game.mmrChange === largestSingleGain)
        .slice(0, 1)
    : [];

  return {
    battletag: canonicalTag,
    seasons: [...SEASONS],

    rules: {
      minGames: MIN_GAMES,
      minTotalGames: MIN_TOTAL_GAMES,
      minDurationSeconds: MIN_DURATION_SECONDS,
      maxExtremeAbsMmrChange: MAX_EXTREME_ABS_MMR_CHANGE,
      highGainThreshold: HIGH_GAIN_THRESHOLD,
      seasonFilteredTo: SEASONS[0],
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

    opponents: agg
      .map(([tag, opp]) => ({
        tag,
        wins: opp.wins,
        losses: opp.losses,
        totalGames: opp.totalGames,
        winrate: +((opp.wins / opp.totalGames) * 100).toFixed(1),
        netMMR: opp.netMMR,
        oppRace: opp.games[0]?.oppRace ?? "Unknown",
        avgOppMMR: opp.oppMMRSum / opp.totalGames,
        avgMyMMR: opp.myMMRSum / opp.totalGames,
        games: opp.games,
      }))
      .sort((a, b) => {
        if (b.totalGames !== a.totalGames) return b.totalGames - a.totalGames;
        if (b.winrate !== a.winrate) return b.winrate - a.winrate;
        return a.tag.localeCompare(b.tag);
      }),
  };
}