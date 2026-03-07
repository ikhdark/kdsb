// src/services/ladderCore.ts

import { unstable_cache } from "next/cache";

import {
  getPlayerAndOpponent,
  fetchJson,
} from "@/lib/w3cUtils";

import { getMatchesCached } from "@/services/matchCache";

import { flattenCountryLadder } from "@/lib/ranking";

import {
  type LadderRow,
  type LadderInputRow,
} from "@/lib/ladderEngine";

/* =====================================================
   CONFIG
===================================================== */

const SEASON = 24;
const GAME_MODE = 1;
const GATEWAY = 20;

const MIN_GAMES = 5;
const MIN_LEAGUE = 0;
const MAX_LEAGUE = 50;

const SOS_CONCURRENCY = 25;

/* =====================================================
   FETCH ALL LEAGUES (UNCACHED CORE)
===================================================== */

async function _fetchAllLeagues() {

  const requests = new Array(MAX_LEAGUE - MIN_LEAGUE + 1);

  for (let league = MIN_LEAGUE; league <= MAX_LEAGUE; league++) {

    const url =
      `https://website-backend.w3champions.com/api/ladder/${league}` +
      `?gateWay=${GATEWAY}` +
      `&gameMode=${GAME_MODE}` +
      `&season=${SEASON}`;

    requests[league] =
      fetchJson<any[]>(url).then((r) => r ?? []);
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
  { revalidate: 300 }
);

/* =====================================================
   BUILD INPUTS
===================================================== */

export function buildInputs(rows: any[]): LadderInputRow[] {

  const best = new Map<string, any>();

  for (let i = 0; i < rows.length; i++) {

    const r = rows[i];
    const key = r.battleTagLower;

    if (!key) continue;

    const prev = best.get(key);

    if (!prev || r.mmr > prev.mmr) {
      best.set(key, r);
    }
  }

  const inputs: LadderInputRow[] = [];

  for (const r of best.values()) {

    if ((r.games ?? 0) < MIN_GAMES) continue;
    if ((r.mmr ?? 0) <= 0) continue;

    inputs.push({
      battletag: r.battleTag,
      mmr: r.mmr,
      wins: r.wins,
      games: r.games,
      sos: null,
    });
  }

  return inputs;
}

/* =====================================================
   SoS ENGINE
===================================================== */

const SOS_DIFF_SCALE = 300;

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

        const matches =
          await getMatchesCached(row.battletag, [SEASON]);

        let weightedSum = 0;
        let weightSum = 0;

        for (let k = 0; k < matches.length; k++) {

          const m = matches[k];

          if (
            m.gameMode !== GAME_MODE ||
            m.durationInSeconds < 120
          ) continue;

          const pair = getPlayerAndOpponent(m, row.battletag);
          if (!pair) continue;

          if (raceId && raceId !== 0 && pair.me.race !== raceId)
            continue;

          const oppRaw =
            pair.opp.oldMmr ??
            pair.opp.newMmr ??
            pair.opp.mmr ??
            (pair.opp as any).oldMmrValue ??
            (pair.opp as any).rating ??
            (pair.opp as any).mmrValue;

          const opp =
            typeof oppRaw === "string"
              ? Number(oppRaw)
              : oppRaw;

          if (!Number.isFinite(opp)) continue;

          const diff = opp - row.mmr;

          const w = weightByDiffAbs(Math.abs(diff));

          weightedSum += diff * w;
          weightSum += w;
        }

        row.sos =
          weightSum ? weightedSum / weightSum : null;

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

  const start = (page - 1) * pageSize;

  return {
    ladder,
    visible: ladder.slice(start, start + pageSize),
    top: ladder.slice(0, pageSize),
  };
}