// src/services/playerPerformance.ts

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { getPlayerAndOpponent } from "@/lib/w3cUtils";

import { getMatchesCached } from "@/services/matchCache";

import {
  W3C_CURRENT_SEASON,
  W3C_GAME_MODE_1V1,
  W3C_MIN_DURATION_SECONDS,
} from "@/lib/w3cConfig";

/* =========================
   CONFIG
========================= */

const SEASONS = [W3C_CURRENT_SEASON] as const;
const MIN_DURATION_SECONDS = W3C_MIN_DURATION_SECONDS;
const GAMEMODE = W3C_GAME_MODE_1V1;

const BUCKET_SIZE = 50;
const MAX_BUCKET_EDGE = 300;
const EVEN_THRESHOLD = 25;

/* =========================
   TYPES
========================= */

type WL = {
  games: number;
  wins: number;
  losses: number;
  winrate: number;
};

export type PerformanceBucket = {
  min: number;
  max: number | null;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
};

export type PlayerPerformanceStats = {
  battletag: string;
  overall: WL;
  higherMMR: WL;
  lowerMMR: WL;
  evenMMR: WL;
  buckets: PerformanceBucket[];
};

/* =========================
   HELPERS
========================= */

function makeWL(): WL {
  return { games: 0, wins: 0, losses: 0, winrate: 0 };
}

function recordWL(wl: WL, didWin: boolean) {
  wl.games++;
  if (didWin) wl.wins++;
  else wl.losses++;
}

function finalizeWL(wl: WL) {
  wl.winrate = wl.games ? wl.wins / wl.games : 0;
}

function bucketFloor(diff: number) {
  if (diff >= MAX_BUCKET_EDGE) return MAX_BUCKET_EDGE;
  if (diff <= -MAX_BUCKET_EDGE) return -MAX_BUCKET_EDGE;
  return Math.floor(diff / BUCKET_SIZE) * BUCKET_SIZE;
}

/* =========================
   CORE
========================= */

async function _getPlayerPerformanceByCanonical(
  battletag: string
): Promise<PlayerPerformanceStats | null> {
  const matches = await getMatchesCached(battletag, SEASONS);
  if (!matches?.length) return null;

  const overall = makeWL();
  const higher = makeWL();
  const lower = makeWL();
  const even = makeWL();

  const bucketMap = new Map<number, PerformanceBucket>();

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    if (
      match?.durationInSeconds < MIN_DURATION_SECONDS ||
      match?.gameMode !== GAMEMODE
    ) {
      continue;
    }

    const pair = getPlayerAndOpponent(match, battletag);
    if (!pair) continue;

    const me = pair.me;
    const opp = pair.opp;

    const myMmr = me?.oldMmr;
    const oppMmr = opp?.oldMmr;

    if (typeof myMmr !== "number" || typeof oppMmr !== "number") {
      continue;
    }

    const diff = myMmr - oppMmr;
    const didWin = !!me?.won;

    recordWL(overall, didWin);

    if (Math.abs(diff) <= EVEN_THRESHOLD) {
      recordWL(even, didWin);
    } else if (diff > 0) {
      recordWL(higher, didWin);
    } else {
      recordWL(lower, didWin);
    }

    const min = bucketFloor(diff);

    let bucket = bucketMap.get(min);

    if (!bucket) {
      bucket = {
        min,
        max: Math.abs(min) === MAX_BUCKET_EDGE ? null : min + BUCKET_SIZE,
        games: 0,
        wins: 0,
        losses: 0,
        winrate: 0,
      };

      bucketMap.set(min, bucket);
    }

    recordWL(bucket, didWin);
  }

  finalizeWL(overall);
  finalizeWL(higher);
  finalizeWL(lower);
  finalizeWL(even);

  const buckets: PerformanceBucket[] = [];

  for (const bucket of bucketMap.values()) {
    bucket.winrate = bucket.games ? bucket.wins / bucket.games : 0;
    buckets.push(bucket);
  }

  buckets.sort((a, b) => a.min - b.min);

  return {
    battletag,
    overall,
    higherMMR: higher,
    lowerMMR: lower,
    evenMMR: even,
    buckets,
  };
}

/* =========================
   PUBLIC
========================= */

export async function getPlayerPerformance(
  inputBattleTag: string
): Promise<PlayerPerformanceStats | null> {
  if (!inputBattleTag?.trim()) return null;

  const battletag = await resolveBattleTagViaSearch(inputBattleTag);
  if (!battletag) return null;

  return _getPlayerPerformanceByCanonical(battletag);
}