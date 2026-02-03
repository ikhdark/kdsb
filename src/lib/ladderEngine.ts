// src/lib/ladderEngine.ts
// PURE RANKING ENGINE
// deterministic, linear weighted model
// MMR + SoS + Activity
// + BOTH MMR + SoS confidence

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
Weights
*/
const W_MMR = 0.55;
const W_SOS = 0.40;
const W_ACTIVITY = 0.05;

/*
Confidence ramps
Lower = faster full strength
*/
const SOS_CONFIDENCE_K = 1;
const MMR_CONFIDENCE_K = 1;

/*
Score scaling (visual only)
*/
const SCORE_SCALE = 10;

/* =========================
   HELPERS
========================= */

function activityScore(games: number) {
  const STEP = 5;
  const MAX_GAMES = 200;
  const MAX_SCORE = 200;

  const bucket = Math.min(
    Math.floor(games / STEP) * STEP,
    MAX_GAMES
  );

  return (bucket / MAX_GAMES) * MAX_SCORE;
}

function confidence(games: number, k: number) {
  return games / (games + k);
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

  // BOTH confidences applied independently
  const mmrEff = mmr * confidence(games, MMR_CONFIDENCE_K);
  const sosEff = sosVal * confidence(games, SOS_CONFIDENCE_K);

  const raw =
    mmrEff * W_MMR +
    sosEff * W_SOS +
    activityScore(games) * W_ACTIVITY;

  return Math.round((raw / SCORE_SCALE) * 10) / 10;
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
