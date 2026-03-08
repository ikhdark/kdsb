// src/lib/w3cBattleTagResolver.ts
//
// SINGLE SOURCE OF TRUTH
// Replicates W3Champions search-bar behavior.
// DO NOT lowercase, uppercase, or guess casing elsewhere.

import { fetchJson } from "@/lib/w3cUtils";
import { W3C_MEMORY_CACHE_TTL_MS } from "@/lib/w3cConfig";

type GlobalSearchResult = {
  battleTag: string;
  name: string;
  seasons?: { id: number }[];
  relevanceId?: string;
};

/* =====================================================
   CACHE
===================================================== */

const SEARCH_CACHE_TTL = W3C_MEMORY_CACHE_TTL_MS;
const SEARCH_TIMEOUT_MS = 2500;

const searchCache = new Map<
  string,
  { ts: number; results: GlobalSearchResult[] | null }
>();

const searchInFlight = new Map<
  string,
  Promise<GlobalSearchResult[] | null>
>();

const resolvedTagCache = new Map<
  string,
  { ts: number; value: string | null }
>();

const resolvedTagInFlight = new Map<
  string,
  Promise<string | null>
>();

/* =====================================================
   HELPERS
===================================================== */

function decodeInput(input: unknown): string {
  let raw = String(input ?? "").trim();

  try {
    raw = decodeURIComponent(raw).trim();
  } catch {
    // ignore malformed encoding
  }

  return raw;
}

function parseBattleTag(raw: string): { name: string; id: string } | null {
  if (!raw.includes("#")) return null;

  const parts = raw.split("#");
  if (parts.length !== 2) return null;

  const name = parts[0]?.trim();
  const id = parts[1]?.trim();

  if (!name || !id) return null;

  return { name, id };
}

function buildGlobalSearchUrl(name: string) {
  return (
    "https://website-backend.w3champions.com/api/players/global-search" +
    `?search=${encodeURIComponent(name)}&pageSize=100`
  );
}

/* =====================================================
   SEARCH (cached + deduped + timeout)
===================================================== */

async function globalSearchByName(
  name: string
): Promise<GlobalSearchResult[] | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;

  const now = Date.now();

  const cached = searchCache.get(key);
  if (cached && now - cached.ts < SEARCH_CACHE_TTL) {
    return cached.results;
  }

  const inFlight = searchInFlight.get(key);
  if (inFlight) return inFlight;

  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      const json = await fetchJson<unknown>(buildGlobalSearchUrl(name), {
        signal: controller.signal,
      });

      return Array.isArray(json) ? (json as GlobalSearchResult[]) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();

  searchInFlight.set(key, request);

  try {
    const results = await request;

    searchCache.set(key, {
      ts: Date.now(),
      results,
    });

    return results;
  } finally {
    searchInFlight.delete(key);
  }
}

/* =====================================================
   PUBLIC
===================================================== */

/**
 * Resolves to EXACT canonical BattleTag casing from backend when available.
 * Falls back to the user-provided BattleTag if search fails or times out,
 * so routes do not hang on slow global-search responses.
 */
export async function resolveBattleTagViaSearch(
  input: unknown
): Promise<string | null> {
  const raw = decodeInput(input);
  const parsed = parseBattleTag(raw);
  if (!parsed) return null;

  const cacheKey = raw.toLowerCase();
  const now = Date.now();

  const cached = resolvedTagCache.get(cacheKey);
  if (cached && now - cached.ts < SEARCH_CACHE_TTL) {
    return cached.value;
  }

  const inFlight = resolvedTagInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    const results = await globalSearchByName(parsed.name);

    if (!results?.length) {
      return raw;
    }

    const targetSuffix = `#${parsed.id}`.toLowerCase();

    const matches = results.filter(
      (result) =>
        typeof result?.battleTag === "string" &&
        result.battleTag.toLowerCase().endsWith(targetSuffix)
    );

    if (!matches.length) {
      return raw;
    }

    matches.sort((a, b) => {
      const seasonDiff = (b.seasons?.length ?? 0) - (a.seasons?.length ?? 0);
      if (seasonDiff !== 0) return seasonDiff;

      return a.battleTag.localeCompare(b.battleTag);
    });

    return matches[0].battleTag;
  })();

  resolvedTagInFlight.set(cacheKey, request);

  try {
    const value = await request;

    resolvedTagCache.set(cacheKey, {
      ts: Date.now(),
      value,
    });

    return value;
  } finally {
    resolvedTagInFlight.delete(cacheKey);
  }
}