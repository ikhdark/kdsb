// src/lib/w3cUtils.ts
// Central W3C network + URL + match utilities

import {
  W3C_CURRENT_SEASON,
  W3C_GATEWAY,
  W3C_MATCH_CACHE_TTL_MS,
  W3C_MATCH_DETAIL_CACHE_TTL_MS,
  W3C_MATCH_PAGE_SIZE,
  W3C_MAX_MATCH_PAGES_PER_SEASON,
  W3C_REVALIDATE_SECONDS,
} from "@/lib/w3cConfig";

/* =====================================================
   URL BUILDERS
===================================================== */

const API_BASE = "https://website-backend.w3champions.com/api";

export function buildPlayerProfileUrl(battletag: string) {
  return `${API_BASE}/players/${encodeURIComponent(battletag)}`;
}

export function buildPersonalSettingsUrl(battletag: string) {
  return `${API_BASE}/personal-settings/${encodeURIComponent(battletag)}`;
}

export function buildLadderLeagueUrl(
  league: number,
  gateway = W3C_GATEWAY,
  gameMode = 1,
  season = W3C_CURRENT_SEASON
) {
  return (
    `${API_BASE}/ladder/${league}` +
    `?gateWay=${gateway}` +
    `&gameMode=${gameMode}` +
    `&season=${season}`
  );
}

export function buildCountryLadderUrl(
  country: string,
  gateway = W3C_GATEWAY,
  gameMode = 1,
  season = W3C_CURRENT_SEASON
) {
  return (
    `${API_BASE}/ladder/country/${encodeURIComponent(country)}` +
    `?gateWay=${gateway}` +
    `&gameMode=${gameMode}` +
    `&season=${season}`
  );
}

export function buildMatchSearchUrl(
  battletag: string,
  season = W3C_CURRENT_SEASON,
  offset = 0,
  pageSize = W3C_MATCH_PAGE_SIZE,
  gateway = W3C_GATEWAY
) {
  return (
    `${API_BASE}/matches/search` +
    `?playerId=${encodeURIComponent(battletag)}` +
    `&gateway=${gateway}` +
    `&season=${season}` +
    `&offset=${offset}` +
    `&pageSize=${pageSize}`
  );
}

export function buildMatchDetailUrl(matchId: string) {
  return `${API_BASE}/matches/${matchId}`;
}

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
      next: { revalidate: W3C_REVALIDATE_SECONDS },
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
   MATCH FETCH (SINGLE MATCH PATH)
===================================================== */

const matchCache = new Map<string, { ts: number; data: any[] }>();
const matchDetailCache = new Map<string, { ts: number; data: any }>();

function normalizeMatches(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.matches)) return payload.matches;
  if (Array.isArray(payload.data?.matches)) return payload.data.matches;
  if (payload.match) return [payload.match];
  return [];
}

async function fetchSeasonMatches(
  canonicalBattleTag: string,
  season: number
): Promise<any[]> {
  const all: any[] = [];

  let offset = 0;
  let done = false;

  const batchSize = 10;

  while (!done) {
    const tasks: Promise<any[]>[] = new Array(batchSize);

    for (let i = 0; i < batchSize; i++) {
      const off = offset + i * W3C_MATCH_PAGE_SIZE;

      tasks[i] = fetchJson<any>(
        buildMatchSearchUrl(
          canonicalBattleTag,
          season,
          off,
          W3C_MATCH_PAGE_SIZE,
          W3C_GATEWAY
        )
      ).then(normalizeMatches);
    }

    const results = await Promise.all(tasks);

    for (let i = 0; i < results.length; i++) {
      const rows = results[i];

      if (!rows.length) {
        done = true;
        break;
      }

      all.push(...rows);

      if (rows.length < W3C_MATCH_PAGE_SIZE) {
        done = true;
        break;
      }
    }

    offset += batchSize * W3C_MATCH_PAGE_SIZE;

    if (offset >= W3C_MATCH_PAGE_SIZE * W3C_MAX_MATCH_PAGES_PER_SEASON) {
      break;
    }
  }

  return all;
}

export async function fetchAllMatches(
  canonicalBattleTag: string,
  seasons: number[] = [W3C_CURRENT_SEASON]
): Promise<any[]> {
  if (!canonicalBattleTag) return [];

  const orderedSeasons = [...seasons].sort((a, b) => a - b);
  const key = `${canonicalBattleTag.toLowerCase()}|${orderedSeasons.join(",")}`;

  const now = Date.now();
  const cached = matchCache.get(key);

  if (cached && now - cached.ts < W3C_MATCH_CACHE_TTL_MS) {
    return cached.data;
  }

  const seasonResults = await Promise.all(
    orderedSeasons.map((season) => fetchSeasonMatches(canonicalBattleTag, season))
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

export async function fetchMatchDetail(
  matchId: string
): Promise<any | null> {
  if (!matchId) return null;

  const now = Date.now();
  const cached = matchDetailCache.get(matchId);

  if (cached && now - cached.ts < W3C_MATCH_DETAIL_CACHE_TTL_MS) {
    return cached.data;
  }

  const json = await fetchJson<any>(buildMatchDetailUrl(matchId));

  if (json) {
    matchDetailCache.set(matchId, {
      ts: now,
      data: json,
    });
  }

  return json;
}