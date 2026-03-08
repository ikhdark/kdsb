// src/services/ladderCore.ts

import { unstable_cache } from "next/cache";

import {
  buildLadder,
  type LadderInputRow,
  type LadderRow,
} from "@/lib/ladderEngine";

import { flattenCountryLadder } from "@/lib/ranking";
import {
  buildLadderLeagueUrl,
  fetchJson,
  getPlayerAndOpponent,
} from "@/lib/w3cUtils";

import {
  W3C_CURRENT_SEASON,
  W3C_GATEWAY,
  W3C_GAME_MODE_1V1,
  W3C_MIN_DURATION_SECONDS,
  W3C_MIN_GAMES,
  W3C_REVALIDATE_SECONDS,
} from "@/lib/w3cConfig";

import { getMatchesCached } from "@/services/matchCache";

/* =====================================================
   CONFIG
===================================================== */

const SEASON = W3C_CURRENT_SEASON;
const GAME_MODE = W3C_GAME_MODE_1V1;
const GATEWAY = W3C_GATEWAY;

const MIN_GAMES = W3C_MIN_GAMES;
const MIN_LEAGUE = 0;
const MAX_LEAGUE = 50;

const SOS_CONCURRENCY = 25;
const SOS_DIFF_SCALE = 300;

/* =====================================================
   FETCH ALL LEAGUES (UNCACHED CORE)
===================================================== */

async function _fetchAllLeagues() {
  const requests: Promise<any[]>[] = new Array(MAX_LEAGUE - MIN_LEAGUE + 1);

  for (let league = MIN_LEAGUE; league <= MAX_LEAGUE; league++) {
    requests[league - MIN_LEAGUE] = fetchJson<any[]>(
      buildLadderLeagueUrl(league, GATEWAY, GAME_MODE, SEASON)
    ).then((rows) => rows ?? []);
  }

  const results = await Promise.all(requests);

  return flattenCountryLadder(results.flat());
}

/* =====================================================
   CACHED EXPORT
===================================================== */

export const fetchAllLeagues = unstable_cache(
  async () => _fetchAllLeagues(),
  ["w3c-all-leagues"],
  { revalidate: W3C_REVALIDATE_SECONDS }
);

/* =====================================================
   BUILD INPUTS
===================================================== */

export function buildInputs(rows: any[]): LadderInputRow[] {
  const best = new Map<string, any>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = row?.battleTagLower;

    if (!key || !row?.battleTag) continue;

    const prev = best.get(key);

    if (!prev || (row.mmr ?? 0) > (prev.mmr ?? 0)) {
      best.set(key, row);
    }
  }

  const inputs: LadderInputRow[] = [];

  for (const row of best.values()) {
    if ((row.games ?? 0) < MIN_GAMES) continue;
    if ((row.mmr ?? 0) <= 0) continue;
    if (!row.battleTag) continue;

    inputs.push({
      battletag: row.battleTag,
      mmr: row.mmr,
      wins: row.wins,
      games: row.games,
      sos: null,
    });
  }

  return inputs;
}

/* =====================================================
   SoS ENGINE
===================================================== */

function weightByDiffAbs(diffAbs: number) {
  return 1 / (1 + diffAbs / SOS_DIFF_SCALE);
}

export async function computeSoS(
  rows: LadderInputRow[],
  raceId?: number
) {
  for (let i = 0; i < rows.length; i += SOS_CONCURRENCY) {
    const end = Math.min(i + SOS_CONCURRENCY, rows.length);
    const tasks = new Array(end - i);

    for (let j = i; j < end; j++) {
      const row = rows[j];

      tasks[j - i] = (async () => {
        const matches = await getMatchesCached(row.battletag, [SEASON]);

        let weightedSum = 0;
        let weightSum = 0;

        for (let k = 0; k < matches.length; k++) {
          const match = matches[k];

          if (
            match?.gameMode !== GAME_MODE ||
            match?.durationInSeconds < W3C_MIN_DURATION_SECONDS
          ) {
            continue;
          }

          const pair = getPlayerAndOpponent(match, row.battletag);
          if (!pair) continue;

          if (raceId && raceId !== 0 && pair.me?.race !== raceId) {
            continue;
          }

          const oppRaw =
            pair.opp?.oldMmr ??
            pair.opp?.newMmr ??
            pair.opp?.mmr ??
            (pair.opp as any)?.oldMmrValue ??
            (pair.opp as any)?.rating ??
            (pair.opp as any)?.mmrValue;

          const oppMmr =
            typeof oppRaw === "string" ? Number(oppRaw) : oppRaw;

          if (!Number.isFinite(oppMmr)) continue;

          const diff = oppMmr - row.mmr;
          const weight = weightByDiffAbs(Math.abs(diff));

          weightedSum += diff * weight;
          weightSum += weight;
        }

        row.sos = weightSum ? weightedSum / weightSum : null;
      })();
    }

    await Promise.all(tasks);
  }
}

/* =====================================================
   PAGING
===================================================== */

export function buildPaged(
  ladder: LadderRow[],
  page: number,
  pageSize: number
) {
  const safePage = Math.max(1, Math.trunc(page || 1));
  const safePageSize = Math.max(1, Math.trunc(pageSize || 50));
  const start = (safePage - 1) * safePageSize;

  return {
    ladder,
    visible: ladder.slice(start, start + safePageSize),
    top: ladder.slice(0, safePageSize),
  };
}