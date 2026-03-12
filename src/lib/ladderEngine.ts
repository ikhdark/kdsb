// src/lib/ladderEngine.ts
// PURE RANKING ENGINE

import { PLAYER_LABELS } from "@/lib/playerLabels";

export type LadderInputRow = {
  battletag: string;
  mmr: number;
  wins: number;
  games: number;
  sos: number | null; // SoS DELTA: avg(opp - me), weighted
};

export type LadderRow = {
  rank: number;

  // Canonical identifier (do not mutate)
  battletag: string;

  // UI-only display string (safe to show everywhere)
  displayName: string;

  mmr: number;
  sos: number | null; // delta

  score: number;

  wins: number;
  losses: number;
  games: number;
};

/* =========================================
   LADDER SCORING v2.3
   - MMR authoritative
   - SoS ramps slowly
   - Activity proportional (minor stabilizer)
   - Low-activity decay
========================================= */

const W_MMR = 0.80;
const W_SOS = 0.15;
const W_ACTIVITY = 0.05;

const SOS_CONFIDENCE_K = 10;
const SCORE_SCALE = 10;

/* =========================================
   DECAY SETTINGS
========================================= */

const DECAY_START_GAMES = 30;
const DECAY_FULL_GAMES = 5;
const MAX_DECAY_PENALTY = 150;

function activityScore(games: number): number {
  const STEP = 5;
  const MAX_GAMES = 200;
  const MAX_SCORE = 200;

  const safeGames = Number.isFinite(games)
    ? Math.max(0, Math.trunc(games))
    : 0;

  const bucket = Math.min(
    Math.floor(safeGames / STEP) * STEP,
    MAX_GAMES
  );

  return (bucket / MAX_GAMES) * MAX_SCORE;
}

function confidence(games: number, k: number): number {
  const safeGames = Number.isFinite(games)
    ? Math.max(0, games)
    : 0;

  return safeGames / (safeGames + k);
}

/* =========================================
   ACTIVITY DECAY
========================================= */

function decayPenalty(games: number): number {
  const safeGames = Number.isFinite(games)
    ? Math.max(0, games)
    : 0;

  if (safeGames >= DECAY_START_GAMES) return 0;

  const progress =
    (DECAY_START_GAMES - safeGames) /
    (DECAY_START_GAMES - DECAY_FULL_GAMES);

  const clamped = Math.min(1, Math.max(0, progress));

  return clamped * MAX_DECAY_PENALTY;
}

function computeScore(
  mmr: number,
  sosDelta: number | null,
  games: number
): number {
  const safeMmr = Number.isFinite(mmr) ? mmr : 0;
  const safeGames = Number.isFinite(games)
    ? Math.max(0, games)
    : 0;

  const delta =
    typeof sosDelta === "number" && Number.isFinite(sosDelta)
      ? sosDelta
      : 0;

  const conf = confidence(safeGames, SOS_CONFIDENCE_K);

  const sosEff = safeMmr + delta * conf;

  const activityNormalized =
    (activityScore(safeGames) / 200) * safeMmr;

  const raw =
    safeMmr * W_MMR +
    sosEff * W_SOS +
    activityNormalized * W_ACTIVITY;

  const decay = decayPenalty(safeGames);

  const finalScore = raw - decay;

  return Math.round((finalScore / SCORE_SCALE) * 10) / 10;
}

function formatDisplayName(battletag: string): string {
  const label = PLAYER_LABELS[battletag];
  return label ? `${battletag} (${label})` : battletag;
}

export function buildLadder(rows: LadderInputRow[]): LadderRow[] {
  const ladder: LadderRow[] = rows.map((row) => {
    const wins = Number.isFinite(row.wins)
      ? Math.max(0, Math.trunc(row.wins))
      : 0;

    const games = Number.isFinite(row.games)
      ? Math.max(0, Math.trunc(row.games))
      : 0;

    const losses = Math.max(0, games - wins);

    return {
      rank: 0,
      battletag: row.battletag,
      displayName: formatDisplayName(row.battletag),

      mmr: Number.isFinite(row.mmr)
        ? Math.round(row.mmr)
        : 0,

      sos:
        typeof row.sos === "number" &&
        Number.isFinite(row.sos)
          ? row.sos
          : null,

      score: computeScore(row.mmr, row.sos, games),

      wins,
      losses,
      games,
    };
  });

  ladder.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.mmr !== a.mmr) return b.mmr - a.mmr;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return a.battletag.localeCompare(b.battletag);
  });

  for (let i = 0; i < ladder.length; i++) {
    ladder[i].rank = i + 1;
  }

  return ladder;
}