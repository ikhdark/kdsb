// src/lib/ladderEngine.ts
// PURE RANKING ENGINE

import { PLAYER_LABELS } from "@/lib/playerLabels";

export type LadderInputRow = {
  battletag: string;
  mmr: number;
  wins: number;
  games: number;
  sos: number | null;
};

export type LadderRow = {
  rank: number;

  // Canonical identifier (do not mutate)
  battletag: string;

  // UI-only display string (safe to show everywhere)
  displayName: string;

  mmr: number;
  sos: number | null;

  score: number;

  wins: number;
  losses: number;
  games: number;
};

/* =========================================
   LADDER SCORING v2.2
   - MMR authoritative
   - SoS ramps slowly
   - Activity proportional (minor stabilizer)
   ========================================= */

const W_MMR = 0.80;
const W_SOS = 0.15;
const W_ACTIVITY = 0.02;

const SOS_CONFIDENCE_K = 10;

const SCORE_SCALE = 10;

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

function computeScore(
  mmr: number,
  sos: number | null,
  games: number
): number {
  const sosVal = sos ?? mmr;

  // SoS ramps with sample size
  const sosEff =
    sosVal * confidence(games, SOS_CONFIDENCE_K);

  // Activity normalized relative to rating scale
  const activityNormalized =
    (activityScore(games) / 200) * mmr;

  const raw =
    mmr * W_MMR +
    sosEff * W_SOS +
    activityNormalized * W_ACTIVITY;

  return Math.round((raw / SCORE_SCALE) * 10) / 10;
}

function formatDisplayName(battletag: string) {
  const label = PLAYER_LABELS[battletag];
  return label ? `${battletag} (${label})` : battletag;
}

export function buildLadder(
  rows: LadderInputRow[]
): LadderRow[] {
  const ladder: LadderRow[] = rows.map((r) => {
    const losses = r.games - r.wins;

    return {
      rank: 0,
      battletag: r.battletag,
      displayName: formatDisplayName(r.battletag),
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