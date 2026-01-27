// src/services/playerLadder.ts
// GLOBAL CUSTOM LADDER — FAST + SINGLE-PASS SoS

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
   CACHE
========================= */

const cache = new Map<
  string,
  { ts: number; data: PlayerLadderResponse | null }
>();

const fetchFn: typeof fetch =
  typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : fetch;

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

  const flat = results.flat();

  const map = new Map<string, any>();

  for (const row of flat) {
    const id =
      row.playerId ??
      row.player?.playerId ??
      row.player1Id ??
      null;

    if (!id) continue;

    const prev = map.get(id);

    if (!prev || (row.mmr ?? 0) > (prev.mmr ?? 0)) {
      map.set(id, row);
    }
  }

  return Array.from(map.values());
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

export async function getPlayerLadder(
  inputBattleTag: string
): Promise<PlayerLadderResponse | null> {
  const key = inputBattleTag.toLowerCase();
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && now - cached.ts < CACHE_TTL) return cached.data;

  const battletag = await resolveBattleTagViaSearch(inputBattleTag);
  if (!battletag) return null;

  const canonLower = battletag.toLowerCase();

  const payload = await fetchGlobalLadder();
  if (!payload.length) return null;

  const rows = flattenCountryLadder(payload);
  if (!rows.length) return null;

  const tags = rows
    .map((r) => r.battleTag)
    .filter(Boolean) as string[];

  const sosMap = await computeAllSoS(tags);

  const inputs: LadderInputRow[] = rows.map((r) => {
    const lower = (r.battleTag ?? "").toLowerCase();

    return {
      battletag: r.battleTag ?? "",
      mmr: r.mmr,
      wins: r.wins,
      games: r.games,
      sos: sosMap.get(lower) ?? null,
    };
  });

  const ladder = buildLadder(inputs);

  const me =
    ladder.find((r) => r.battletag?.toLowerCase() === canonLower) ?? null;

  const updatedAtUtc = new Date().toISOString();

  const result: PlayerLadderResponse = {
    battletag,
    me,
    top: ladder.slice(0, 25),
    poolSize: ladder.length,
    full: ladder,
    updatedAtUtc,
  };

  cache.set(key, { ts: now, data: result });

  return result;
}
