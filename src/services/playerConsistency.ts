// src/services/playerConsistency.ts

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { getPlayerAndOpponent } from "@/lib/w3cUtils";

import { getMatchesCached } from "@/services/matchCache";

import {
  W3C_CURRENT_SEASON,
  W3C_GAME_MODE_1V1,
  W3C_MIN_DURATION_SECONDS,
} from "@/lib/w3cConfig";

/* =====================================================
   CONSTANTS
===================================================== */

const SESSION_GAP_MS = 30 * 60 * 1000;
const SEASONS = [W3C_CURRENT_SEASON] as const;
const GAME_MODE = W3C_GAME_MODE_1V1;
const MIN_DURATION_SECONDS = W3C_MIN_DURATION_SECONDS;

/* =====================================================
   HELPERS
===================================================== */

const wr = (wins: number, games: number) =>
  games ? +((wins / games) * 100).toFixed(2) : null;

/* =====================================================
   SERVICE
===================================================== */

export async function getPlayerConsistency(input: string) {
  const battletag = await resolveBattleTagViaSearch(
    decodeURIComponent(input)
  );

  if (!battletag) return null;

  const allMatches = await getMatchesCached(battletag, SEASONS);
  if (!allMatches.length) return null;

  const matches = allMatches
    .filter(
      (match: any) =>
        match?.gameMode === GAME_MODE &&
        match?.durationInSeconds >= MIN_DURATION_SECONDS
    )
    .sort(
      (a: any, b: any) =>
        Date.parse(a.startTime) - Date.parse(b.startTime)
    );

  if (!matches.length) return null;

  let wins = 0;
  let losses = 0;

  let longestWin = 0;
  let longestLoss = 0;
  let current = 0;

  let lastTime = 0;

  const sessions: {
    start: string;
    games: number;
    wins: number;
  }[] = [];

  let session:
    | {
        start: string;
        games: number;
        wins: number;
      }
    | null = null;

  const recent: boolean[] = [];

  const simpleMatches: {
    startTime: string;
    didWin: boolean;
  }[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    const pair = getPlayerAndOpponent(match, battletag);
    if (!pair) continue;

    const didWin = !!pair.me?.won;

    simpleMatches.push({
      startTime: match.startTime,
      didWin,
    });

    if (didWin) wins++;
    else losses++;

    if (didWin) {
      current = current >= 0 ? current + 1 : 1;
      if (current > longestWin) longestWin = current;
    } else {
      current = current <= 0 ? current - 1 : -1;
      const abs = -current;
      if (abs > longestLoss) longestLoss = abs;
    }

    const time = Date.parse(match.startTime);

    if (!session || time - lastTime > SESSION_GAP_MS) {
      if (session) sessions.push(session);

      session = {
        start: new Date(time).toISOString(),
        games: 0,
        wins: 0,
      };
    }

    session.games++;
    if (didWin) session.wins++;

    lastTime = time;
    recent.push(didWin);
  }

  if (session) sessions.push(session);

  const totalGames = wins + losses;
  const len = recent.length;

  let w10 = 0;
  let w25 = 0;
  let w50 = 0;

  for (let i = Math.max(0, len - 50); i < len; i++) {
    if (!recent[i]) continue;

    if (i >= len - 10) w10++;
    if (i >= len - 25) w25++;
    if (i >= len - 50) w50++;
  }

  const last10 = Math.min(10, len);
  const last25 = Math.min(25, len);
  const last50 = Math.min(50, len);

  return {
    battletag,

    totals: {
      games: totalGames,
      wins,
      losses,
      winrate: wr(wins, totalGames),
    },

    streaks: {
      longestWin,
      longestLoss,
      current,
    },

    sessionCount: sessions.length,

    sessions: sessions.map((s) => ({
      start: s.start,
      games: s.games,
      wins: s.wins,
      losses: s.games - s.wins,
    })),

    recent: {
      last10: wr(w10, last10),
      last25: wr(w25, last25),
      last50: wr(w50, last50),
    },

    matches: simpleMatches,
  };
}