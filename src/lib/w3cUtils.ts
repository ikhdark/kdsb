// src/lib/w3cUtils.ts
// Next.js-friendly (no axios). Keep canonical resolver single-source-of-truth.

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

/* -------------------- FETCH -------------------- */

const fetchFn: typeof fetch =
  typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : fetch;

/*
  PERFORMANCE FIX:
  - use Next request cache instead of no-store
  - prevents refetching the same pages repeatedly
*/
async function fetchJson<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetchFn(url, {
      next: { revalidate: 300 }, // 5 minutes cache
    });

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* -------------------- CONSTANTS -------------------- */

const GATEWAY = 20;
const PAGE_SIZE = 50;

// Safety: prevent any chance of an infinite loop if API misbehaves
const MAX_PAGES_PER_SEASON = 2000;

/* -------------------- RACES -------------------- */

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

/* -------------------- CANONICAL RESOLUTION -------------------- */
/**
 * DO NOT create another canonical resolver.
 * Use the locked single source of truth.
 */
export async function resolveCanonicalBattleTag(
  input: string
): Promise<string | null> {
  return resolveBattleTagViaSearch(input);
}

/* -------------------- MATCH FETCH -------------------- */

function normalizeMatches(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.matches)) return payload.matches;
  if (payload?.data && Array.isArray(payload.data.matches)) return payload.data.matches;
  if (payload?.match) return [payload.match];
  return [];
}

/**
 * IMPORTANT:
 * - canonicalBattleTag MUST already be canonical
 * - NO casing changes
 * - returns a flat array of matches
 */
export async function fetchAllMatches(
  canonicalBattleTag: string,
  seasons: number[] = [23]
): Promise<any[]> {
  if (!canonicalBattleTag) return [];

  const encodedTag = encodeURIComponent(canonicalBattleTag);
  const allMatches: any[] = [];

  for (const season of seasons) {
    let offset = 0;
    let pageGuard = 0;

    while (true) {
      pageGuard++;
      if (pageGuard > MAX_PAGES_PER_SEASON) break;

      const url =
        "https://website-backend.w3champions.com/api/matches/search" +
        `?playerId=${encodedTag}` +
        `&gateway=${GATEWAY}` +
        `&season=${season}` +
        `&offset=${offset}` +
        `&pageSize=${PAGE_SIZE}`;

      const json = await fetchJson<any>(url);
      const matches = normalizeMatches(json);

      if (matches.length === 0) break;

      allMatches.push(...matches);

      if (matches.length < PAGE_SIZE) break;

      offset += PAGE_SIZE;
    }
  }

  return allMatches;
}

/* -------------------- PLAYER PAIR RESOLUTION -------------------- */

export function getPlayerAndOpponent(
  match: any,
  canonicalBattleTag: string
): { me: any; opp: any } | null {
  if (!match || !Array.isArray(match?.teams)) return null;

  const players: any[] = match.teams.flatMap((t: any) =>
    Array.isArray(t?.players) ? t.players : []
  );

  const targetLower = String(canonicalBattleTag ?? "").toLowerCase();
  if (!targetLower) return null;

  const me = players.find(
    (p: any) => String(p?.battleTag ?? "").toLowerCase() === targetLower
  );
  if (!me) return null;

  const opp = players.find((p: any) => p && p !== me);
  if (!opp) return null;

  return { me, opp };
}
