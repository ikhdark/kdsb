import { unstable_cache } from "next/cache";

import { fetchAllMatches } from "../lib/w3cUtils";
import { resolveBattleTagViaSearch } from "../lib/w3cBattleTagResolver";

/* =========================
CONFIG
========================= */

const SEASONS = [24];
const MIN_DURATION_SECONDS = 120;
const GAMEMODE = 1;

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
  if (wl.games) wl.winrate = wl.wins / wl.games;
}

function bucketFloor(diff: number) {
  if (diff >= MAX_BUCKET_EDGE) return MAX_BUCKET_EDGE;
  if (diff <= -MAX_BUCKET_EDGE) return -MAX_BUCKET_EDGE;
  return Math.floor(diff / BUCKET_SIZE) * BUCKET_SIZE;
}

/* =========================
CORE
========================= */

async function _getPlayerPerformance(
  inputBattleTag: string
): Promise<PlayerPerformanceStats | null> {

  const battletag = await resolveBattleTagViaSearch(inputBattleTag);
  if (!battletag) return null;

  const matches = await fetchAllMatches(battletag, SEASONS);
  if (!matches?.length) return null;

  const myTagLower = battletag.toLowerCase();

  const overall = makeWL();
  const higher = makeWL();
  const lower = makeWL();
  const even = makeWL();

  const bucketMap = new Map<number, PerformanceBucket>();

  for (let i = 0; i < matches.length; i++) {

    const match = matches[i];

    if (
      match.durationInSeconds < MIN_DURATION_SECONDS ||
      match.gameMode !== GAMEMODE ||
      !match.teams ||
      match.teams.length !== 2
    ) continue;

    const teamA = match.teams[0];
    const teamB = match.teams[1];

    const pA = teamA.players?.[0];
    const pB = teamB.players?.[0];
    if (!pA || !pB) continue;

    const tagA = pA.battleTag?.toLowerCase();
    const tagB = pB.battleTag?.toLowerCase();

    let me;
    let opp;

    if (tagA === myTagLower) {
      me = pA;
      opp = pB;
    } else if (tagB === myTagLower) {
      me = pB;
      opp = pA;
    } else {
      continue;
    }

    const myMmr = me.oldMmr;
    const oppMmr = opp.oldMmr;

    if (typeof myMmr !== "number" || typeof oppMmr !== "number")
      continue;

    const diff = myMmr - oppMmr;
    const didWin = !!me.won;

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

  for (const b of bucketMap.values()) {

    if (b.games) b.winrate = b.wins / b.games;

    buckets.push(b);
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
CACHED EXPORT
========================= */

const _getPlayerPerformanceCached = unstable_cache(
  async (inputBattleTag: string) =>
    _getPlayerPerformance(inputBattleTag),
  ["w3c-player-performance-v1"],
  { revalidate: 300 }
);

export async function getPlayerPerformance(
  inputBattleTag: string
) {
  return _getPlayerPerformanceCached(inputBattleTag);
}