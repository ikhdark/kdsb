// src/services/playerConsistency.ts

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { fetchAllMatches, getPlayerAndOpponent } from "@/lib/w3cUtils";

/* =========================
   CONSTANTS
========================= */

const SESSION_GAP_MS = 30 * 60 * 1000;
const MIN_DURATION_SECONDS = 120;

/* =========================
   HELPERS
========================= */

const wr = (w: number, g: number) =>
  g ? +(w / g * 100).toFixed(2) : null;

const countWins = (arr: boolean[]) =>
  arr.reduce((n, v) => n + (v ? 1 : 0), 0);

/* =========================
   SERVICE (timezone neutral)
========================= */

export async function getPlayerConsistency(input: string) {
  const battletag = await resolveBattleTagViaSearch(
    decodeURIComponent(input)
  );
  if (!battletag) return null;

  const targetLower = battletag.toLowerCase();

  const matches = await fetchAllMatches(battletag);
  if (!matches.length) return null;

  matches.sort(
    (a: any, b: any) =>
      Date.parse(a.startTime) - Date.parse(b.startTime)
  );

  let wins = 0;
  let losses = 0;

  let longestWin = 0;
  let longestLoss = 0;
  let current = 0;

  const sessions: any[] = [];
  const recentResults: boolean[] = [];

  // ✅ NEW: raw matches for client-side time bucketing
  const simpleMatches: { startTime: string; didWin: boolean }[] = [];

  let lastTime = 0;
  let session: any = null;

  for (const m of matches) {
    if (m.gameMode !== 1 || m.durationInSeconds < MIN_DURATION_SECONDS) continue;

    const pair = getPlayerAndOpponent(m, targetLower);
    if (!pair) continue;

    const didWin = !!pair.me?.won;

    /* store raw match (timezone neutral) */
    simpleMatches.push({
      startTime: m.startTime,
      didWin,
    });

    /* totals */
    didWin ? wins++ : losses++;

    /* streaks */
    if (didWin) {
      current = current >= 0 ? current + 1 : 1;
      longestWin = Math.max(longestWin, current);
    } else {
      current = current <= 0 ? current - 1 : -1;
      longestLoss = Math.max(longestLoss, Math.abs(current));
    }

    const time = new Date(m.startTime).getTime();

    /* sessions */
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

    /* recent */
    recentResults.push(didWin);
    if (recentResults.length === 51) recentResults.shift();
  }

  if (session) sessions.push(session);

  const totalGames = wins + losses;

  const last10 = recentResults.slice(-10);
  const last25 = recentResults.slice(-25);
  const last50 = recentResults.slice(-50);

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
      last10: wr(countWins(last10), last10.length),
      last25: wr(countWins(last25), last25.length),
      last50: wr(countWins(last50), last50.length),
    },

    // ✅ client will compute heatmap locally
    matches: simpleMatches,
  };
}
