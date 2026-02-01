import { fetchAllMatches } from "../lib/w3cUtils";
import { resolveBattleTagViaSearch } from "../lib/w3cBattleTagResolver";

/* =========================
   CONFIG
========================= */

const SEASONS = [24];
const MIN_DURATION_SECONDS = 120;

const BUCKET_SIZE = 50;
const MAX_BUCKET_EDGE = 300;
const EVEN_THRESHOLD = 25;

/* ---------- cache ---------- */

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cache = new Map<
  string,
  { ts: number; data: PlayerPerformanceStats | null }
>();

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

function finalizeWL(wl: WL) {
  if (wl.games) wl.winrate = wl.wins / wl.games;
}

function bucketFloor(diff: number) {
  if (diff >= MAX_BUCKET_EDGE) return MAX_BUCKET_EDGE;
  if (diff <= -MAX_BUCKET_EDGE) return -MAX_BUCKET_EDGE;
  return Math.floor(diff / BUCKET_SIZE) * BUCKET_SIZE;
}

/* =========================
   SERVICE (single function)
========================= */

export async function getPlayerPerformance(
  inputBattleTag: string
): Promise<PlayerPerformanceStats | null> {

  /* resolve FIRST */
  const battletag = await resolveBattleTagViaSearch(inputBattleTag);
  if (!battletag) return null;

  const key = battletag.toLowerCase();
  const now = Date.now();

  /* cache hit */
  const cached = cache.get(key);
  if (cached && now - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  /* fetch matches AFTER cache miss */
  const matches = await fetchAllMatches(battletag, SEASONS);
  if (!matches?.length) return null;


  /* ---------- compute ---------- */

  const myTagLower = battletag.toLowerCase();

  const overall = makeWL();
  const higher = makeWL();
  const lower = makeWL();
  const even = makeWL();

  const bucketMap = new Map<number, PerformanceBucket>();

  for (const match of matches) {
    if (match.durationInSeconds < MIN_DURATION_SECONDS) continue;
     if (match.gameMode !== 1) continue;   // ← ADD THIS
    if (!match.teams || match.teams.length !== 2) continue;

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

   if (typeof me.oldMmr !== "number" || typeof opp.oldMmr !== "number") continue;


    const diff = me.oldMmr - opp.oldMmr;
    const didWin = !!me.won;

    /* overall */
    overall.games++;
    didWin ? overall.wins++ : overall.losses++;

    /* higher/lower/even */
    if (Math.abs(diff) <= EVEN_THRESHOLD) {
      even.games++;
      didWin ? even.wins++ : even.losses++;
    } else if (diff > 0) {
      higher.games++;
      didWin ? higher.wins++ : higher.losses++;
    } else {
      lower.games++;
      didWin ? lower.wins++ : lower.losses++;
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

    bucket.games++;
    didWin ? bucket.wins++ : bucket.losses++;
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

  const result: PlayerPerformanceStats = {
    battletag,
    overall,
    higherMMR: higher,
    lowerMMR: lower,
    evenMMR: even,
    buckets,
  };

  /* ---------- cache store ---------- */

  cache.set(key, { ts: now, data: result });

  return result;
}
