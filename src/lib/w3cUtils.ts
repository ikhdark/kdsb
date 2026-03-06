// src/lib/w3cUtils.ts
// Central W3C network + match utilities
// SINGLE fetch layer (dedup + Next 5-min cache)

/* =====================================================
   FETCH (SINGLE SOURCE OF TRUTH)
===================================================== */

const fetchFn: typeof fetch =
  typeof globalThis !== "undefined" &&
  typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : fetch;

const inFlightRequests = new Map<string, Promise<Response>>();

function requestKey(url: string, init?: RequestInit) {
  return `${(init?.method ?? "GET").toUpperCase()}:${url}`;
}

async function fetchWithDedup(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const key = requestKey(url, init);

  let req = inFlightRequests.get(key);

  if (!req) {
    req = fetchFn(url, {
      next: { revalidate: 300 },
      ...init,
    });

    inFlightRequests.set(key, req);
  }

  try {
    const res = await req;
    return res.clone();
  } finally {
    if (inFlightRequests.get(key) === req) {
      inFlightRequests.delete(key);
    }
  }
}

export async function fetchJson<T = any>(
  url: string,
  init?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetchWithDedup(url, init);
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
   MATCH FETCH (Parallel + memory cache)
===================================================== */

const MATCH_CACHE_TTL = 10 * 60 * 1000;

const matchCache = new Map<string, { ts: number; data: any[] }>();

function normalizeMatches(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (payload.matches) return payload.matches;
  if (payload.data?.matches) return payload.data.matches;
  if (payload.match) return [payload.match];
  return [];
}

async function fetchSeasonMatches(
  encodedTag: string,
  season: number
): Promise<any[]> {
  const all: any[] = [];

  let offset = 0;
  let done = false;

  const BATCH_SIZE = 10;

  while (!done) {
    const promises: Promise<any[]>[] = new Array(BATCH_SIZE);

    for (let i = 0; i < BATCH_SIZE; i++) {
      const off = offset + i * PAGE_SIZE;

      const url =
        "https://website-backend.w3champions.com/api/matches/search" +
        `?playerId=${encodedTag}` +
        `&gateway=${GATEWAY}` +
        `&season=${season}` +
        `&offset=${off}` +
        `&pageSize=${PAGE_SIZE}`;

      promises[i] = fetchJson<any>(url).then(normalizeMatches);
    }

    const results = await Promise.all(promises);

    for (let i = 0; i < results.length; i++) {
      const matches = results[i];

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

export async function fetchAllMatches(
  canonicalBattleTag: string,
  seasons: number[] = [23]
): Promise<any[]> {
  if (!canonicalBattleTag) return [];

  const key =
    `${canonicalBattleTag.toLowerCase()}-${seasons.join(",")}`;

  const now = Date.now();
  const cached = matchCache.get(key);

  if (cached && now - cached.ts < MATCH_CACHE_TTL) {
    return cached.data;
  }

  const encodedTag = encodeURIComponent(canonicalBattleTag);

  const seasonResults = await Promise.all(
    seasons.map((s) => fetchSeasonMatches(encodedTag, s))
  );

  const allMatches = seasonResults.flat();

  matchCache.set(key, {
    ts: now,
    data: allMatches,
  });

  return allMatches;
}

/* =====================================================
   PLAYER RESOLUTION
===================================================== */

export function getPlayerAndOpponent(
  match: any,
  canonicalBattleTag: string
): { me: any; opp: any } | null {
  if (!match || !Array.isArray(match.teams)) return null;

  const lower = canonicalBattleTag.toLowerCase();

  const players: any[] = [];

  for (let i = 0; i < match.teams.length; i++) {
    const team = match.teams[i];
    if (Array.isArray(team?.players)) {
      players.push(...team.players);
    }
  }

  let me: any = null;
  let opp: any = null;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const tag = String(p?.battleTag ?? "").toLowerCase();

    if (tag === lower) {
      me = p;
    } else if (!opp) {
      opp = p;
    }
  }

  if (!me || !opp) return null;

  return { me, opp };
}

/* =====================================================
   MATCH DETAIL
===================================================== */

const MATCH_DETAIL_TTL = 10 * 60 * 1000;

const matchDetailCache = new Map<
  string,
  { ts: number; data: any }
>();

export async function fetchMatchDetail(
  matchId: string
): Promise<any | null> {
  if (!matchId) return null;

  const now = Date.now();

  const cached = matchDetailCache.get(matchId);

  if (cached && now - cached.ts < MATCH_DETAIL_TTL) {
    return cached.data;
  }

  const url =
    `https://website-backend.w3champions.com/api/matches/${matchId}`;

  const json = await fetchJson<any>(url);

  if (json) {
    matchDetailCache.set(matchId, {
      ts: now,
      data: json,
    });
  }

  return json;
}