import { fetchAllMatches, getPlayerAndOpponent } from "@/lib/w3cUtils";
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

const MIN_LEAGUE = 1;
const MAX_LEAGUE = 30;

const SOS_CONCURRENCY = 25;
const MATCH_TTL = 5 * 60 * 1000;

/* =========================
   MATCH CACHE
========================= */

const matchCache = new Map<string, { ts: number; matches: any[] }>();

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
    urls.map((url) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])
    )
  );

  return results.flat();
}

/* =========================
   SoS FOR GIVEN ROWS
========================= */

async function computeSoS(rows: LadderRow[]) {
  for (let i = 0; i < rows.length; i += SOS_CONCURRENCY) {
    const chunk = rows.slice(i, i + SOS_CONCURRENCY);

    await Promise.all(
      chunk.map(async (row) => {
        const key = row.battletag.toLowerCase();
        const now = Date.now();

        let matches: any[];

        const cached = matchCache.get(key);

        if (cached && now - cached.ts < MATCH_TTL) {
          matches = cached.matches;
        } else {
          matches = await fetchAllMatches(row.battletag, [SEASON]);
          matchCache.set(key, { ts: now, matches });
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
  inputBattleTag: string,
  page = 1,
  pageSize = 50
): Promise<PlayerLadderResponse | null> {

  const battletag = await resolveBattleTagViaSearch(inputBattleTag);
  if (!battletag) return null;

  const payload = await fetchAllLeagues();
  const rows = flattenCountryLadder(payload);

  /*
    ✅ THIS IS THE ONLY eligibility gate
    (same pattern as playerRank.ts)
  */
  const inputs: LadderInputRow[] = rows
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

  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const visible = ladder.slice(start, end);

  await computeSoS(visible);

  const me =
    ladder.find(
      (r) => r.battletag?.toLowerCase() === battletag.toLowerCase()
    ) ?? null;

  if (me && !visible.includes(me)) {
    await computeSoS([me]);
  }

  return {
    battletag,
    me,
    top: ladder.slice(0, pageSize),
    poolSize: ladder.length,
    full: visible,
    updatedAtUtc: new Date().toISOString(),
  };
}
