// src/services/matchCache.ts

import { fetchAllMatches } from "@/lib/w3cUtils";
import { W3C_MEMORY_CACHE_TTL_MS } from "@/lib/w3cConfig";

type CacheEntry = {
  ts: number;
  promise: Promise<any[]>;
};

const cache = new Map<string, CacheEntry>();

function makeKey(tag: string, seasons: readonly number[]) {
  return `${tag.toLowerCase()}|${[...seasons].sort((a, b) => a - b).join(",")}`;
}

export function getMatchesCached(
  battletag: string,
  seasons: readonly number[]
): Promise<any[]> {
  const now = Date.now();
  const key = makeKey(battletag, seasons);

  const existing = cache.get(key);

  if (existing && now - existing.ts < W3C_MEMORY_CACHE_TTL_MS) {
    return existing.promise;
  }

  const promise = fetchAllMatches(battletag, [...seasons]).catch((err) => {
    cache.delete(key);
    throw err;
  });

  cache.set(key, {
    ts: now,
    promise,
  });

  return promise;
}