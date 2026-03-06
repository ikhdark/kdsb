import { fetchAllMatches } from "@/lib/w3cUtils";

type CacheEntry = {
  ts: number;
  promise: Promise<any[]>;
};

const CACHE_TTL = 5 * 60 * 1000;

const cache = new Map<string, CacheEntry>();

function makeKey(tag: string, seasons: number[]) {
  return `${tag.toLowerCase()}:${seasons.join(",")}`;
}

export function getMatchesCached(
  battletag: string,
  seasons: number[]
): Promise<any[]> {

  const now = Date.now();
  const key = makeKey(battletag, seasons);

  const existing = cache.get(key);

  if (existing && now - existing.ts < CACHE_TTL) {
    return existing.promise;
  }

  const promise = fetchAllMatches(battletag, seasons)
    .catch(err => {
      cache.delete(key);
      throw err;
    });

  cache.set(key, {
    ts: now,
    promise,
  });

  return promise;
}