import {
  fetchAllMatches,
  getPlayerAndOpponent,
  fetchJson,
} from "@/lib/w3cUtils";

import { flattenCountryLadder } from "@/lib/ranking";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

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

const SOS_CONCURRENCY = 50;

/* =========================
   TYPES
========================= */

export type PlayerLadderResponse = {
  battletag: string;
  me: LadderRow | null;
  top: LadderRow[];
  poolSize: number;
  full: LadderRow[];
  updatedAtUtc: string;
};

/* =========================
   FETCH ALL LEAGUES
========================= */

async function fetchAllLeagues(): Promise<any[]> {
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
    urls.map(async (url) => {
      const json = await fetchJson<any[]>(url);
      return json ?? [];
    })
  );

  return results.flat();   // ← YOU MISSED THIS
}

/* =========================
   SoS FOR GIVEN ROWS
========================= */

async function computeSoS(rows: LadderRow[]) {
  // request-scoped cache → prevents duplicate fetchAllMatches calls
  const matchCache = new Map<string, any[]>();

  for (let i = 0; i < rows.length; i += SOS_CONCURRENCY) {
    const chunk = rows.slice(i, i + SOS_CONCURRENCY);

    await Promise.all(
      chunk.map(async (row) => {
        const key = row.battletag.toLowerCase();

        let matches = matchCache.get(key);

        if (!matches) {
          matches = await fetchAllMatches(row.battletag, [SEASON]);
          matchCache.set(key, matches);
        }

        let sum = 0;
        let n = 0;

        for (const m of matches) {
          if (m.gameMode !== GAME_MODE) continue;
          if (m.durationInSeconds < 120) continue;

          const pair = getPlayerAndOpponent(m, row.battletag);
          if (!pair || typeof pair.opp.oldMmr !== "number") continue;

          sum += pair.opp.oldMmr;
          n++;
        }

        row.sos = n ? sum / n : null;
      })
    );
  }
}

/* =========================
   PUBLIC SERVICE
========================= */

export async function getPlayerLadder(
  inputBattleTag?: string,
  page = 1,
  pageSize = 50
): Promise<PlayerLadderResponse | null> {

  /* ---------------------------
     optional battletag mode
  --------------------------- */

  const battletag = inputBattleTag
    ? await resolveBattleTagViaSearch(inputBattleTag)
    : null;

  /* ---------------------------
     fetch + build ladder (same)
  --------------------------- */

  const payload = await fetchAllLeagues();
  const rows = flattenCountryLadder(payload);
const map = new Map<string, any>();

for (const r of rows) {
  const key = r.battleTag?.toLowerCase();
  if (!key) continue;

  const existing = map.get(key);

  // keep highest mmr entry
  if (!existing || r.mmr > existing.mmr) {
    map.set(key, r);
  }
}

const dedupedRows = Array.from(map.values());
  const inputs: LadderInputRow[] = dedupedRows
    .filter((r) =>
      (r.games ?? 0) >= MIN_GAMES &&
      (r.mmr ?? 0) > 0
    )
    .map((r) => ({
      battletag: r.battleTag ?? "",
      mmr: r.mmr,
      wins: r.wins,
      games: r.games,
      sos: null,
    }));

  const ladder = buildLadder(inputs);

  /* ---------------------------
     paging
  --------------------------- */

  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const visible = ladder.slice(start, end);

  await computeSoS(visible);

  /* ---------------------------
     player-specific row
     (only if battletag exists)
  --------------------------- */

  let me: LadderRow | null = null;

  if (battletag) {
    me =
      ladder.find(
        (r) => r.battletag?.toLowerCase() === battletag.toLowerCase()
      ) ?? null;

    if (me && !visible.includes(me)) {
      await computeSoS([me]);
    }
  }

  /* ---------------------------
     return
  --------------------------- */

  return {
    battletag: battletag ?? "",   // empty when global
    me,
    top: ladder.slice(0, pageSize),
    poolSize: ladder.length,
    full: visible,
    updatedAtUtc: new Date().toISOString(),
  };
}
