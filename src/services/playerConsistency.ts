// src/services/playerConsistency.ts

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { fetchAllMatches, getPlayerAndOpponent } from "@/lib/w3cUtils";

/* =========================
   CONSTANTS
========================= */

const SESSION_GAP_MS = 30 * 60 * 1000;
const MIN_DURATION_SECONDS = 120;
const SEASON = 24;
/* ---------- match cache ---------- */

const MATCH_TTL = 5 * 60 * 1000;

const matchCache = new Map<
  string,
  { ts: number; matches: any[] }
>();
/* =========================
   HELPERS
========================= */

const wr = (w: number, g: number) =>
  g ? +(w / g * 100).toFixed(2) : null;

const countWins = (arr: boolean[]) =>
  arr.reduce((n, v) => n + (v ? 1 : 0), 0);

/* =========================
   SERVICE
========================= */

export async function getPlayerConsistency(input: string) {
  const battletag = await resolveBattleTagViaSearch(
    decodeURIComponent(input)
  );
  if (!battletag) return null;

  const lower = battletag.toLowerCase();

  /* ---------- fetch ---------- */

  const key = battletag.toLowerCase();
const now = Date.now();

let allMatches: any[];

const cached = matchCache.get(key);

if (cached && now - cached.ts < MATCH_TTL) {
  allMatches = cached.matches;
} else {
  allMatches = await fetchAllMatches(battletag, [SEASON]);
  matchCache.set(key, { ts: now, matches: allMatches });
}

if (!allMatches.length) return null;

  /* ---------- pre-filter FIRST (faster) ---------- */

  const matches = allMatches
    .filter(
      (m: any) =>
        m.gameMode === 1 &&
        m.durationInSeconds >= MIN_DURATION_SECONDS
    )
    .sort(
      (a: any, b: any) =>
        Date.parse(a.startTime) - Date.parse(b.startTime)
    );

  /* ---------- accumulators ---------- */

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

  let session: {
    start: string;
    games: number;
    wins: number;
  } | null = null;

  const recentResults: boolean[] = [];
  const simpleMatches: { startTime: string; didWin: boolean }[] = [];

  /* ---------- single pass ---------- */

  for (const m of matches) {
    // ✅ FIX: pass real battletag, NOT lowercase
    const pair = getPlayerAndOpponent(m, battletag);
    if (!pair) continue;

    const didWin = !!pair.me?.won;

    /* raw match for heatmap */
    simpleMatches.push({
      startTime: m.startTime,
      didWin,
    });

    /* totals */
    if (didWin) wins++;
    else losses++;

    /* streaks */
    if (didWin) {
      current = current >= 0 ? current + 1 : 1;
      if (current > longestWin) longestWin = current;
    } else {
      current = current <= 0 ? current - 1 : -1;
      const abs = Math.abs(current);
      if (abs > longestLoss) longestLoss = abs;
    }

    /* sessions */
    const time = Date.parse(m.startTime);

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

    /* recent ring buffer (max 50) */
    recentResults.push(didWin);
    if (recentResults.length > 50) recentResults.shift();
  }

  if (session) sessions.push(session);

  /* ---------- derived ---------- */

  const totalGames = wins + losses;

  const last10 = recentResults.slice(-10);
  const last25 = recentResults.slice(-25);
  const last50 = recentResults.slice(-50);

  /* ---------- return ---------- */

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

    // timezone-neutral, client builds heatmap
    matches: simpleMatches,
  };
}
