// src/services/playerRaceLadder.ts
// RACE-SPECIFIC LADDER ONLY (separate service, single responsibility)

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

const CACHE_TTL = 30 * 1000;

const MIN_LEAGUE = 1;
const MAX_LEAGUE = 20;

const TOP_SLICE = 25;

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

/* =========================
   CACHE (per race)
========================= */

const cache = new Map<
  string,
  { ts: number; data: PlayerRaceLadderResponse | null }
>();

const fetchFn: typeof fetch =
  typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : fetch;

/* =========================
   RACE → ID
========================= */

const RACE_ID: Record<RaceKey, number> = {
  human: 1,
  orc: 2,
  elf: 4,
  undead: 8,
  random: 0,
};

/* =========================
   GLOBAL LADDER FETCH
========================= */

async function fetchGlobalLadder(): Promise<any[]> {
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
      fetchFn(url, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : []))
        .then((j) => (Array.isArray(j) ? j : []))
        .catch(() => [])
    )
  );

  return results.flat();
}

/* =========================
   SINGLE PASS SoS
========================= */

async function computeAllSoS(players: string[]) {
  const map = new Map<string, { sum: number; n: number }>();

  for (const p of players) {
    map.set(p.toLowerCase(), { sum: 0, n: 0 });
  }

  const CONCURRENCY = 100;

  for (let i = 0; i < players.length; i += CONCURRENCY) {
    const chunk = players.slice(i, i + CONCURRENCY);

    await Promise.all(
      chunk.map(async (tag) => {
        const lower = tag.toLowerCase();

        const matches = await fetchAllMatches(tag, [SEASON]);
        const bucket = map.get(lower);
        if (!bucket) return;

        for (const m of matches) {
          if (m.gameMode !== 1) continue;
          if (m.durationInSeconds < 120) continue;

          const pair = getPlayerAndOpponent(m, tag);
          if (!pair || typeof pair.opp.oldMmr !== "number") continue;

          bucket.sum += pair.opp.oldMmr;
          bucket.n++;
        }
      })
    );
  }

  const result = new Map<string, number | null>();

  for (const [k, v] of map) {
    result.set(k, v.n ? v.sum / v.n : null);
  }

  return result;
}

/* =========================
   SERVICE
========================= */

export async function getPlayerRaceLadder(
  inputBattleTag: string,
  race: RaceKey
): Promise<PlayerRaceLadderResponse | null> {
  const cacheKey = `${inputBattleTag.toLowerCase()}|${race}`;
  const now = Date.now();

  const cached = cache.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL) return cached.data;

  const battletag = await resolveBattleTagViaSearch(inputBattleTag);
  if (!battletag) return null;

  const canonLower = battletag.toLowerCase();
  const raceId = RACE_ID[race];

  const payload = await fetchGlobalLadder();
  if (!payload.length) return null;

  const rows = flattenCountryLadder(payload);
  if (!rows.length) return null;

  const raceRows = rows.filter((r) => r.race === raceId);
  if (!raceRows.length) return null;

  const tags = raceRows
    .map((r) => r.battleTag)
    .filter(Boolean) as string[];

  const sosMap = await computeAllSoS(tags);

  const inputs: LadderInputRow[] = raceRows.map((r) => {
    const lower = (r.battleTag ?? "").toLowerCase();

    return {
      battletag: r.battleTag ?? "",
      mmr: r.mmr,
      wins: r.wins,
      games: r.games,
      sos: sosMap.get(lower) ?? null,
      race: r.race,
    };
  });

  const ladder = buildLadder(inputs);

  const me =
    ladder.find((r) => r.battletag?.toLowerCase() === canonLower) ?? null;

  const updatedAtUtc = new Date().toISOString();

  const result: PlayerRaceLadderResponse = {
    battletag,
    race,
    me,
    top: ladder.slice(0, TOP_SLICE),
    poolSize: ladder.length,
    full: ladder,
    updatedAtUtc,
  };

  cache.set(cacheKey, { ts: now, data: result });

  return result;
}
