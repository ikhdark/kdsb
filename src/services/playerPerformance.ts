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
  didWin ? wl.wins++ : wl.losses++;
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
   CORE (UNCACHED)
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

  for (const match of matches) {
    if (
      match.durationInSeconds < MIN_DURATION_SECONDS ||
      match.gameMode !== GAMEMODE ||
      !match.teams ||
      match.teams.length !== 2
    ) continue;

    const [teamA, teamB] = match.teams;

    const pA = teamA.players?.[0];
    const pB = teamB.players?.[0];
    if (!pA || !pB) continue;

    const tagA = pA.battleTag?.toLowerCase();
    const tagB = pB.battleTag?.toLowerCase();

    const me =
      tagA === myTagLower ? pA :
      tagB === myTagLower ? pB :
      null;

    if (!me) continue;

    const opp = me === pA ? pB : pA;

    if (typeof me.oldMmr !== "number" || typeof opp.oldMmr !== "number")
      continue;

    const diff = me.oldMmr - opp.oldMmr;
    const didWin = !!me.won;

    /* overall */
    recordWL(overall, didWin);

    /* higher/lower/even */
    if (Math.abs(diff) <= EVEN_THRESHOLD) {
      recordWL(even, didWin);
    } else if (diff > 0) {
      recordWL(higher, didWin);
    } else {
      recordWL(lower, didWin);
    }

    /* bucket */
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

  const buckets = [...bucketMap.values()]
    .sort((a, b) => a.min - b.min)
    .map((b) => ({
      ...b,
      winrate: b.games ? b.wins / b.games : 0,
    }));

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