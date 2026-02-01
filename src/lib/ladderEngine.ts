// src/lib/ladderEngine.ts
// PURE RANKING ENGINE
// deterministic, linear weighted model
// MMR + SoS + Activity only

/* =========================
   TYPES
========================= */

export type LadderInputRow = {
  battletag: string;
  mmr: number;
  wins: number;
  games: number;
  sos: number | null;
};

export type LadderRow = {
  rank: number;
  battletag: string;

  mmr: number;
  sos: number | null;

  score: number;

  wins: number;
  losses: number;
  games: number;
};

/* =========================
   CONFIG
========================= */

const MMR_CAP = 3000;

/*
Weights (sum = 1.0)
*/
const W_MMR = 0.50;
const W_SOS = 0.40;
const W_ACTIVITY = 0.10;

/*
Activity normalization
0–100 games → 0–2000 ladder-scale
*/
const ACTIVITY_TARGET = 100;

/* =========================
   HELPERS
========================= */

function activityScore(games: number) {
  const STEP = 5;              // every 5 games
  const MAX_GAMES = 200;       // full credit cap
  const MAX_SCORE = 2000;

  const bucket = Math.min(
    Math.floor(games / STEP) * STEP,
    MAX_GAMES
  );

  return (bucket / MAX_GAMES) * MAX_SCORE;
}

/* =========================
   SCORE
========================= */

function computeScore(
  mmr: number,
  sos: number | null,
  games: number
): number {
  const sosVal = sos ?? mmr;

  const raw =
    mmr * W_MMR +
    sosVal * W_SOS +
    activityScore(games) * W_ACTIVITY;

  return Math.round((raw / 10) * 10) / 10;
}

/* =========================
   MAIN ENGINE
========================= */

export function buildLadder(rows: LadderInputRow[]): LadderRow[] {
  const ladder: LadderRow[] = rows
    .filter((r) => r.mmr <= MMR_CAP)
    .map((r) => {
      const losses = r.games - r.wins;

      return {
        rank: 0,
        battletag: r.battletag,

        mmr: r.mmr,
        sos: r.sos,

        score: computeScore(r.mmr, r.sos, r.games),

        wins: r.wins,
        losses,
        games: r.games,
      };
    });

  ladder.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.mmr - a.mmr;
  });

  ladder.forEach((p, i) => {
    p.rank = i + 1;
  });

  return ladder;
}
