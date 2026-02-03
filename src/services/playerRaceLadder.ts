import {
  fetchAllMatches,
  getPlayerAndOpponent,
  fetchJson,
} from "@/lib/w3cUtils";

import { flattenCountryLadder } from "@/lib/ranking";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { hasLifetimeRaceGames } from "@/lib/raceEligibility";

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
const MAX_LEAGUE = 30;

const SOS_CONCURRENCY = 25;

/* =========================
   TYPES
========================= */

export type RaceKey =
  | "human"
  | "orc"
  | "elf"
  | "undead"
  | "random";

export type PlayerRaceLadderResponse = {
  battletag: string;
  race: RaceKey;
  me: LadderRow | null;
  top: LadderRow[];
  poolSize: number;
  full: LadderRow[];
  updatedAtUtc: string;
};

const RACE_ID: Record<RaceKey, number> = {
  human: 1,
  orc: 2,
  elf: 4,
  undead: 8,
  random: 0,
};

/* =========================
   FETCH ALL LEAGUES
========================= */

async function fetchAllLeagues(): Promise<any[]> {
  const urls: string[] = [];

  for (let league = MIN_LEAGUE; league <= MAX_LEAGUE; league++) {
    urls.push(
      `https://website-backend.w3champions.com/api/ladder/${league}?gateWay=${GATEWAY}&gameMode=${GAME_MODE}&season=${SEASON}`
    );
  }

  const results = await Promise.all(
    urls.map(async (url) => {
      const json = await fetchJson<any[]>(url);
      return json ?? [];
    })
  );

  return results.flat();
}

/* =========================
   SHARED MATCH CACHE HELPER
========================= */

async function getMatchesCached(
  battletag: string,
  cache: Map<string, any[]>
) {
  const key = battletag.toLowerCase();

  let matches = cache.get(key);
  if (!matches) {
    matches = await fetchAllMatches(battletag, [SEASON]);
    cache.set(key, matches);
  }

  return matches;
}

/* =========================
   SoS (NOW USES SHARED CACHE)
========================= */

async function computeSoS(
  rows: LadderRow[],
  raceId: number,
  matchCache: Map<string, any[]>
) {
  for (let i = 0; i < rows.length; i += SOS_CONCURRENCY) {
    const chunk = rows.slice(i, i + SOS_CONCURRENCY);

    await Promise.all(
      chunk.map(async (row) => {
        const matches = await getMatchesCached(
          row.battletag,
          matchCache
        );

        let sum = 0;
        let n = 0;

        for (const m of matches) {
          if (m.gameMode !== GAME_MODE) continue;
          if (m.durationInSeconds < 120) continue;

          const pair = getPlayerAndOpponent(m, row.battletag);
          if (!pair) continue;

          if (raceId !== 0 && pair.me.race !== raceId) continue;

          const oppMmr =
            pair.opp.oldMmr ??
            pair.opp.newMmr ??
            pair.opp.mmr ??
            0;

          sum += oppMmr;
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

export async function getPlayerRaceLadder(
  inputBattleTag: string | undefined,
  race: RaceKey,
  page = 1,
  pageSize = 50
): Promise<PlayerRaceLadderResponse | null> {

  const battletag = inputBattleTag
    ? await resolveBattleTagViaSearch(inputBattleTag)
    : null;

  const raceId = RACE_ID[race];

  const payload = await fetchAllLeagues();
  const rows = flattenCountryLadder(payload);

  /* ---------------------------
     build ladder
  --------------------------- */

  const inputs: LadderInputRow[] = rows
    .filter(
      (r) =>
        r.race === raceId &&
        (r.games ?? 0) >= MIN_GAMES &&
        (r.mmr ?? 0) > 0 &&
        typeof r.battleTag === "string"
    )
    .map((r) => ({
      battletag: r.battleTag!,
      mmr: r.mmr,
      wins: r.wins,
      games: r.games,
      sos: null,
    }));

  const ladder = buildLadder(inputs);

  /* ---------------------------
     shared cache (KEY FIX)
  --------------------------- */

  const matchCache = new Map<string, any[]>();

  /* ---------------------------
     eligibility (ONLY visible)
  --------------------------- */

  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const visibleSlice = ladder.slice(start, end);

const checks = await Promise.all(
  visibleSlice.map(async (r) => {
    const matches = await getMatchesCached(
      r.battletag,
      matchCache
    );

    let games = 0;

    for (const m of matches) {
      if (m.gameMode !== GAME_MODE) continue;
      if (m.durationInSeconds < 120) continue;

      const pair = getPlayerAndOpponent(m, r.battletag);
      if (!pair) continue;

      if (raceId !== 0 && pair.me.race !== raceId) continue;

      games++;
      if (games >= 35) return true; // early exit
    }

    return false;
  })
);

  const eligibility = new Map<string, boolean>();
  visibleSlice.forEach((r, i) =>
    eligibility.set(r.battletag, checks[i])
  );

  const eligible = ladder.filter(
    (r) => eligibility.get(r.battletag) ?? true
  );

  const visible = eligible.slice(start, end);
  const top = eligible.slice(0, pageSize);

  /* ---------------------------
     me
  --------------------------- */

  let me: LadderRow | null = null;

  if (battletag) {
    me =
      eligible.find(
        (r) =>
          r.battletag.toLowerCase() === battletag.toLowerCase()
      ) ?? null;
  }

  /* ---------------------------
     SoS (reuses SAME cache)
  --------------------------- */

  const toCompute: LadderRow[] = [
    ...visible,
    ...top,
    ...(me ? [me] : []),
  ];

  await computeSoS(toCompute, raceId, matchCache);

  /* --------------------------- */

  return {
    battletag: battletag ?? "",
    race,
    me,
    top,
    poolSize: eligible.length,
    full: visible,
    updatedAtUtc: new Date().toISOString(),
  };
}
