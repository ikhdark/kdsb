// src/lib/w3cUtils.ts
// Next.js-friendly (no axios). Keep canonical resolver single-source-of-truth.

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

/* =====================================================
   FETCH
===================================================== */

const fetchFn: typeof fetch =
  typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : fetch;

async function fetchJson<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetchFn(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* =====================================================
   CONSTANTS
===================================================== */

const GATEWAY = 20;
const PAGE_SIZE = 50;
const MAX_PAGES_PER_SEASON = 2000;

/* =====================================================
   RACES
===================================================== */

export const RACE_MAP: Record<number, string> = {
  0: "Random",
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
};

export function resolveQueuedRace(player: any): string {
  return RACE_MAP[player?.race] || "Unknown";
}

export function resolveEffectiveRace(player: any): string {
  return RACE_MAP[player?.race] || "Unknown";
}

/* =====================================================
   CANONICAL RESOLUTION
===================================================== */

export async function resolveCanonicalBattleTag(
  input: string
): Promise<string | null> {
  return resolveBattleTagViaSearch(input);
}

/* =====================================================
   MATCH FETCH (CACHED + BATCHED PARALLEL)
===================================================== */

/* ---------- cache ---------- */

const MATCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const matchCache = new Map<
  string,
  { ts: number; data: any[] }
>();

/* ---------- helpers ---------- */

function normalizeMatches(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload?.matches) return payload.matches;
  if (payload?.data?.matches) return payload.data.matches;
  if (payload?.match) return [payload.match];
  return [];
}

/* ---------- season fetch (bounded concurrency) ---------- */

async function fetchSeasonMatches(
  encodedTag: string,
  season: number
): Promise<any[]> {

  const all: any[] = [];

  let offset = 0;
  let done = false;

  // SAFE CONCURRENCY LIMIT
  const BATCH_SIZE = 10;

  while (!done) {
    const offsets: number[] = [];

    for (let i = 0; i < BATCH_SIZE; i++) {
      offsets.push(offset + i * PAGE_SIZE);
    }

    const results = await Promise.all(
      offsets.map(async (off) => {
        const url =
          "https://website-backend.w3champions.com/api/matches/search" +
          `?playerId=${encodedTag}` +
          `&gateway=${GATEWAY}` +
          `&season=${season}` +
          `&offset=${off}` +
          `&pageSize=${PAGE_SIZE}`;

        const json = await fetchJson<any>(url);
        return normalizeMatches(json);
      })
    );

    for (const matches of results) {
      if (!matches.length) {
        done = true;
        break;
      }

      all.push(...matches);

      if (matches.length < PAGE_SIZE) {
        done = true;
        break;
      }
    }

    offset += BATCH_SIZE * PAGE_SIZE;

    if (offset >= PAGE_SIZE * MAX_PAGES_PER_SEASON) break;
  }

  return all;
}

/* ---------- public ---------- */

export async function fetchAllMatches(
  canonicalBattleTag: string,
  seasons: number[] = [23]
): Promise<any[]> {

  if (!canonicalBattleTag) return [];

  const key = `${canonicalBattleTag.toLowerCase()}-${seasons.join(",")}`;
  const now = Date.now();

  /* cache hit */
  const cached = matchCache.get(key);
  if (cached && now - cached.ts < MATCH_CACHE_TTL) {
    return cached.data;
  }

  const encodedTag = encodeURIComponent(canonicalBattleTag);

  /* parallel seasons */
  const seasonResults = await Promise.all(
    seasons.map((s) => fetchSeasonMatches(encodedTag, s))
  );

  const allMatches = seasonResults.flat();

  /* cache store */
  matchCache.set(key, {
    ts: now,
    data: allMatches,
  });

  return allMatches;
}

/* =====================================================
   TEAM RESOLUTION (TEAM MODES ONLY)
   Safe for 2v2 / 3v3 / 4v4
===================================================== */

export function getPlayerTeam(
  match: any,
  canonicalBattleTag: string
): { me: any; team: any; enemies: any[] } | null {
  if (!match || !Array.isArray(match?.teams)) return null;

  const lower = canonicalBattleTag.toLowerCase();

  for (const team of match.teams) {
    const players = Array.isArray(team?.players) ? team.players : [];

    const me = players.find(
      (p: any) =>
        String(p?.battleTag ?? "").toLowerCase() === lower
    );

    if (me) {
      const enemies = match.teams.filter((t: any) => t !== team);
      return { me, team, enemies };
    }
  }

  return null;
}



/* =====================================================
   PLAYER PAIR RESOLUTION
===================================================== */

export function getPlayerAndOpponent(
  match: any,
  canonicalBattleTag: string
): { me: any; opp: any } | null {

  if (!match || !Array.isArray(match?.teams)) return null;

  const players: any[] = match.teams.flatMap((t: any) =>
    Array.isArray(t?.players) ? t.players : []
  );

  const targetLower = canonicalBattleTag.toLowerCase();

  const me = players.find(
    (p) => String(p?.battleTag ?? "").toLowerCase() === targetLower
  );
  if (!me) return null;

  const opp = players.find((p) => p && p !== me);
  if (!opp) return null;

  return { me, opp };
}
