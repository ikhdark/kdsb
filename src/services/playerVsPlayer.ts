import {
  fetchAllMatches,
  getPlayerAndOpponent,
  RACE_MAP,
} from "../lib/w3cUtils";

import { applyRacePlacement } from "../lib/racePlacement";

/* -------------------- CONSTANTS -------------------- */

const SEASONS = [20, 21, 22, 23];
const MIN_GAMES = 3;
const MIN_TOTAL_GAMES = 30;
const MIN_DURATION_SECONDS = 120;
const MAX_EXTREME_ABS_MMR_CHANGE = 30;
const HIGH_GAIN_THRESHOLD = 15;

/* -------------------- TYPES -------------------- */

type Game = {
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

function displayMyRace(g: Game): string {
  if (g.myRace !== "Random") return g.myRace;
  const rolled = RACE_MAP[g.raceCode] || "Unknown";
  return `Random (${rolled})`;
}

/* -------------------- SERVICE -------------------- */

export async function getVsPlayerStats(
  inputTag: string
): Promise<{ result: string } | null> {
  let BATTLETAG = inputTag.trim();
  let allMatches = await fetchAllMatches(BATTLETAG, SEASONS);

  // Case-normalized retry
  if (!allMatches.length && BATTLETAG.includes("#")) {
    const [name, id] = BATTLETAG.split("#");
    BATTLETAG = `${name.toLowerCase()}#${id}`;
    allMatches = await fetchAllMatches(BATTLETAG, SEASONS);
  }

  if (!allMatches.length) return null;

  const targetLower = BATTLETAG.toLowerCase();

  allMatches.sort(
    (a: any, b: any) =>
      new Date(a.startTime).getTime() -
      new Date(b.startTime).getTime()
  );

  const raceGameCount: Record<string, number> = {};
  const strictGamesAll: Game[] = [];

  for (const match of allMatches) {
    if (match.gameMode !== 1 || match.season !== 23) continue;

    const pair = getPlayerAndOpponent(match, targetLower);
    if (!pair) continue;

    const { me, opp } = pair;
    const race = RACE_MAP[me.race] || "Unknown";

    const isActive = applyRacePlacement({
      raceCounters: raceGameCount,
      race,
    });
    if (!isActive) continue;

    if (
      typeof match.durationInSeconds !== "number" ||
      match.durationInSeconds < MIN_DURATION_SECONDS
    )
      continue;

    if (
      typeof me.mmrGain !== "number" ||
      typeof me.oldMmr !== "number" ||
      typeof opp.oldMmr !== "number"
    )
      continue;

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

  if (strictGamesAll.length <= MIN_TOTAL_GAMES) return null;

  /* -------------------- AGGREGATION -------------------- */

  function aggregateFromGames(
    games: Game[]
  ): [string, OpponentAgg][] {
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

  function bestOpponent(
    list: [string, OpponentAgg][]
  ): [string, OpponentAgg] | undefined {
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

  function worstOpponent(
    list: [string, OpponentAgg][]
  ): [string, OpponentAgg] | undefined {
    return list.sort((a, b) => {
      const wrA = a[1].wins / a[1].totalGames;
      const wrB = b[1].wins / b[1].totalGames;
      return wrA - wrB;
    })[0];
  }

  const best = agg.length ? bestOpponent([...agg]) : undefined;
  const worst = agg.length ? worstOpponent([...agg]) : undefined;

  /* -------------------- EXTREMES -------------------- */

  let largestSingleGain: number | null = null;
  let largestSingleLoss: number | null = null;
  let largestLossGame: Game | null = null;
  let largestGapWin: (Game & { gap: number }) | null = null;
  let largestGapLoss: (Game & { gap: number }) | null = null;

  const highGainGames: Game[] = [];
  const lossCandidates: Game[] = [];

  for (const g of strictGamesAll) {
    if (Math.abs(g.mmrChange) <= MAX_EXTREME_ABS_MMR_CHANGE) {
      if (largestSingleGain === null || g.mmrChange > largestSingleGain) {
        largestSingleGain = g.mmrChange;
      }

      if (g.mmrChange >= HIGH_GAIN_THRESHOLD) {
        highGainGames.push(g);
      }

      if (g.mmrChange < 0) {
        lossCandidates.push(g);
      }
    }

    const gap = Math.abs(g.myMMR - g.oppMMR);

    if (g.result === "W" && g.myMMR < g.oppMMR) {
      if (!largestGapWin || gap > largestGapWin.gap) {
        largestGapWin = { gap, ...g };
      }
    }

    if (g.result === "L" && g.myMMR > g.oppMMR) {
      if (!largestGapLoss || gap > largestGapLoss.gap) {
        largestGapLoss = { gap, ...g };
      }
    }
  }

  if (lossCandidates.length) {
    lossCandidates.sort((a, b) => a.mmrChange - b.mmrChange);
    largestSingleLoss = lossCandidates[0].mmrChange;
    largestLossGame = lossCandidates[0];
  }

  const gainGamesToShow =
    highGainGames.length > 0
      ? highGainGames
      : largestSingleGain !== null
      ? strictGamesAll.filter(
          g => g.mmrChange === largestSingleGain
        ).slice(0, 1)
      : [];

  /* -------------------- RENDER -------------------- */

  function render(
    title: string,
    result?: [string, OpponentAgg]
  ): string {
    if (!result) return "";

    const [tag, r] = result;
    const wr = ((r.wins / r.totalGames) * 100).toFixed(1);
    const oppRace = r.games[0]?.oppRace ?? "Unknown";

    let out = `${title}\n`;
    out += `Opponent: ${tag} (${oppRace})\n`;
    out += `Record: ${r.wins}–${r.losses} (${wr}%)\n`;
    out += `Games: ${r.totalGames}\n`;
    out += `Net MMR: ${r.netMMR}\n`;
    out += `Games:\n`;

    out += [...r.games]
      .sort((a, b) => b.oppMMR - a.oppMMR)
      .map(
        g =>
          `${g.result === "W" ? "W" : "L"} ${displayMyRace(g)} (${g.myMMR}) vs ` +
          `${g.oppRace} (${g.oppMMR}) | ` +
          `${g.mmrChange > 0 ? "+" : ""}${g.mmrChange}`
      )
      .join("\n");

    return out + "\n\n";
  }

  /* -------------------- MESSAGE -------------------- */

  let message =
    `📊 ${BATTLETAG} — Opponent Breakdown (Min ${MIN_GAMES} games, Season 23)\n\n` +
    `MMR Extremes (All valid games)\n`;

  if (gainGamesToShow.length) {
    message +=
      `Largest single-game gain (If +15 or more, all games will show)\n` +
      gainGamesToShow
        .map(
          g =>
            `${g.result === "W" ? "W" : "L"} ${g.myName} ${displayMyRace(g)} (${g.myMMR}) vs ` +
            `${g.oppName} ${g.oppRace} (${g.oppMMR}) | ` +
            `${g.mmrChange > 0 ? "+" : ""}${g.mmrChange}`
        )
        .join("\n") +
      "\n";
  }

  if (largestLossGame) {
    message +=
      `Largest single-game loss: ` +
      `${largestLossGame.myRace} (${largestLossGame.myMMR}) vs ` +
      `${largestLossGame.oppName} ${largestLossGame.oppRace} (${largestLossGame.oppMMR}) | ` +
      `${largestSingleLoss}\n`;
  }

  message += `\nMMR Gap Extremes\n`;

  if (largestGapWin) {
    message +=
      `Largest gap in MMR win: ` +
      `${largestGapWin.myRace} (${largestGapWin.myMMR}) vs ` +
      `${largestGapWin.oppName} ${largestGapWin.oppRace} (${largestGapWin.oppMMR}) | +${largestGapWin.gap}\n`;
  }

  if (largestGapLoss) {
    message +=
      `Largest gap in MMR loss: ` +
      `${largestGapLoss.myRace} (${largestGapLoss.myMMR}) vs ` +
      `${largestGapLoss.oppName} ${largestGapLoss.oppRace} (${largestGapLoss.oppMMR}) | -${largestGapLoss.gap}\n`;
  }

  message += render(
    "Best Winrate vs Opponent (% + MMR-weighted)",
    best
  );
  message += render(
    "Lowest Winrate vs Opponent (Min game length ≥2 min)",
    worst
  );

  if (message.length > 1900) {
    message = message.slice(0, 1900) + "\n…(truncated)";
  }

  return { result: message };
}
