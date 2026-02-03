import {
  fetchAllMatches,
  getPlayerAndOpponent,
  fetchJson,
} from "@/lib/w3cUtils";

import { flattenCountryLadder } from "@/lib/ranking";

import {
  buildLadder,
  type LadderRow,
  type LadderInputRow,
} from "@/lib/ladderEngine";

/* =========================
   CONFIG
========================= */

const SEASON = 24;
const GAME_MODE = 1;
const GATEWAY = 20;

const MIN_GAMES = 5;
const MIN_LEAGUE = 0;
const MAX_LEAGUE = 25;

const SOS_CONCURRENCY = 25;

/* =========================
   FETCH ALL LEAGUES
========================= */

export async function fetchAllLeagues() {
  const urls: string[] = [];

  for (let league = MIN_LEAGUE; league <= MAX_LEAGUE; league++) {
    urls.push(
      `https://website-backend.w3champions.com/api/ladder/${league}` +
        `?gateWay=${GATEWAY}` +
        `&gameMode=${GAME_MODE}` +
        `&season=${SEASON}`
    );
  }

  const results = await Promise.all(
    urls.map(async (url) => (await fetchJson<any[]>(url)) ?? [])
  );

  return flattenCountryLadder(results.flat());
}

/* =========================
   BUILD INPUTS (dedupe)
========================= */

export function buildInputs(rows: any[]): LadderInputRow[] {
  const map = new Map<string, any>();

  for (const r of rows) {
    const key = r.battleTagLower;
    if (!key) continue;

    const existing = map.get(key);
    if (!existing || r.mmr > existing.mmr) {
      map.set(key, r);
    }
  }

  return [...map.values()]
    .filter(
      (r) =>
        (r.games ?? 0) >= MIN_GAMES &&
        (r.mmr ?? 0) > 0
    )
    .map((r) => ({
      battletag: r.battleTag,
      mmr: r.mmr,
      wins: r.wins,
      games: r.games,
      sos: null,
    }));
}

/* =========================
   SoS (page only)
========================= */

export async function computeSoS(
  rows: LadderRow[],
  raceId?: number
) {
  const cache = new Map<string, any[]>();

  for (let i = 0; i < rows.length; i += SOS_CONCURRENCY) {
    const chunk = rows.slice(i, i + SOS_CONCURRENCY);

    await Promise.all(
      chunk.map(async (row) => {
        const key = row.battletag.toLowerCase();

        let matches = cache.get(key);

        if (!matches) {
          matches = await fetchAllMatches(row.battletag, [SEASON]);
          cache.set(key, matches);
        }

        let sum = 0;
        let n = 0;

        for (const m of matches) {
          if (m.gameMode !== GAME_MODE) continue;
          if (m.durationInSeconds < 120) continue;

          const pair = getPlayerAndOpponent(m, row.battletag);
          if (!pair) continue;

          if (raceId && raceId !== 0 && pair.me.race !== raceId) continue;

          const opp =
            pair.opp.oldMmr ??
            pair.opp.newMmr ??
            pair.opp.mmr;

          if (typeof opp !== "number") continue;

          sum += opp;
          n++;
        }

        row.sos = n ? sum / n : null;
      })
    );
  }
}

/* =========================
   PAGING
========================= */

export function buildPaged(
  inputs: LadderInputRow[],
  page: number,
  pageSize: number
) {
  const ladder = buildLadder(inputs);

  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    ladder,
    visible: ladder.slice(start, end),
    top: ladder.slice(0, pageSize),
  };
}
