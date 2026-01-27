// src/lib/ladderEngine.ts
// PURE RANKING ENGINE
// deterministic, readable scores, activity decay

export type LadderInputRow = {
  battletag: string;
  mmr: number;
  wins: number;
  games: number;
  sos: number | null;

  // recent activity for decay
  recentGames?: number;
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
  winrate: number;

  // NEW — show on table
  decay: number;

  tier: string;
};

/* =========================
   CONFIG
========================= */

const MMR_CAP = 3000;

/*
Weights (sum ≈ 1)
Readable + stable
*/
const W_MMR = 0.45;
const W_SOS = 0.40;
const W_WR  = 0.05;

/*
Activity decay (UX tuned)
*/
const DECAY_MIN = 0.75;     // worst = 75%
const DECAY_TARGET = 100;   // games for full strength

/* =========================
   HELPERS
========================= */

function tierFromRank(rank: number): string {
  if (rank <= 100) return "Top 100";
  if (rank <= 200) return "Top 200";
  if (rank <= 500) return "Top 500";
  if (rank <= 1000) return "Top 1000";
  return "Field";
}

function winrate(wins: number, games: number) {
  return games ? wins / games : 0;
}

/*
Linear decay
0 games → 0.7
30+ games → 1.0
*/
function activityMultiplier(recentGames = 0) {
  const t = Math.min(recentGames / DECAY_TARGET, 1);
  return DECAY_MIN + (1 - DECAY_MIN) * t;
}

/* =========================
   SCORE (UX-optimized)
========================= */
/*
Final scale:
~400–800 typical
*/

function computeScore(
  mmr: number,
  sos: number | null,
  wr: number,
  recentGames: number
): number {
  const sosVal = sos ?? mmr;

  const raw =
    mmr * W_MMR +
    sosVal * W_SOS +
    wr * 2000 * W_WR;

  // shrink for readability
  const scaled = raw / 10;

  // apply decay
  const finalScore = scaled * activityMultiplier(recentGames);

  return Math.round(finalScore * 10) / 10;
}

/* =========================
   MAIN ENGINE
========================= */

export function buildLadder(
  rows: LadderInputRow[]
): LadderRow[] {

  /* ---------- eligibility filter ---------- */
  const eligible = rows.filter((r) => r.mmr <= MMR_CAP);

  /* ---------- build rows ---------- */
  const ladder: LadderRow[] = eligible.map((r) => {
    const losses = r.games - r.wins;
    const wr = winrate(r.wins, r.games);

    const recent = r.recentGames ?? 0;
    const decay = activityMultiplier(recent);

    return {
      rank: 0,
      battletag: r.battletag,

      mmr: r.mmr,
      sos: r.sos,

      score: computeScore(r.mmr, r.sos, wr, recent),

      wins: r.wins,
      losses,
      games: r.games,
      winrate: wr,

      decay,

      tier: "",
    };
  });

  /* ---------- sort ---------- */
  ladder.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.mmr !== a.mmr) return b.mmr - a.mmr;
    return b.winrate - a.winrate;
  });

  /* ---------- assign ranks ---------- */
  ladder.forEach((p, i) => {
    p.rank = i + 1;
    p.tier = tierFromRank(p.rank);
  });

  return ladder;
}


