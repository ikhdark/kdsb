import { fetchAllMatches } from "../lib/w3cUtils";
import { resolveBattleTagViaSearch } from "../lib/w3cBattleTagResolver";

/* =========================
   CONFIG
========================= */

const SEASONS = [23];
const MIN_DURATION_SECONDS = 120;

const BUCKET_SIZE = 50;
const MAX_BUCKET_EDGE = 300;   // ← stop stepping here
const EVEN_THRESHOLD = 25;     // ±25 treated as even

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
  max: number | null; // null = 300+ bucket
  games: number;
  wins: number;
  losses: number;
  winrate: number;
};

export type PlayerPerformanceStats = {
  battletag: string;

  overall: WL;

  higherMMR: WL; // you favored
  lowerMMR: WL;  // you underdog
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

/*
  Buckets:
  -300 to -250
  ...
  250 to 300
  300+
  -300+
*/
function bucketFloor(diff: number) {
  if (diff >= MAX_BUCKET_EDGE) return MAX_BUCKET_EDGE;
  if (diff <= -MAX_BUCKET_EDGE) return -MAX_BUCKET_EDGE;

  return Math.floor(diff / BUCKET_SIZE) * BUCKET_SIZE;
}

/* =========================
   SERVICE
========================= */

export async function getPlayerPerformance(
  inputBattleTag: string
): Promise<PlayerPerformanceStats | null> {
  const battletag = await resolveBattleTagViaSearch(inputBattleTag);
  if (!battletag) return null;

  const matches = await fetchAllMatches(battletag);
  if (!matches?.length) return null;

  const myTagLower = battletag.toLowerCase();

  const overall = makeWL();
  const higher = makeWL();
  const lower = makeWL();
  const even = makeWL();

  const bucketMap = new Map<number, PerformanceBucket>();

  for (const match of matches) {
    if (match.durationInSeconds < MIN_DURATION_SECONDS) continue;
    if (!match.teams || match.teams.length !== 2) continue;

    /* ---------- FAST 1v1 RESOLVE ---------- */

    const [teamA, teamB] = match.teams;

    const pA = teamA.players?.[0];
    const pB = teamB.players?.[0];
    if (!pA || !pB) continue;

    const me =
      pA.battleTag?.toLowerCase() === myTagLower ? pA :
      pB.battleTag?.toLowerCase() === myTagLower ? pB :
      null;

    if (!me) continue;

    const opp = me === pA ? pB : pA;

    if (me.oldMmr == null || opp.oldMmr == null) continue;

    const diff = me.oldMmr - opp.oldMmr;
    const didWin = !!me.won;

    /* ---------- overall ---------- */

    overall.games++;
    didWin ? overall.wins++ : overall.losses++;

    /* ---------- higher / lower / even ---------- */

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

    /* ---------- bucket ---------- */

    const min = bucketFloor(diff);

    let bucket = bucketMap.get(min);

    if (!bucket) {
      bucket = {
        min,
        max:
          Math.abs(min) === MAX_BUCKET_EDGE
            ? null
            : min + BUCKET_SIZE,
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

  /* ---------- finalize ---------- */

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
