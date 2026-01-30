// src/lib/w3cBattleTagResolver.ts
//
// SINGLE SOURCE OF TRUTH
// Replicates W3Champions search-bar behavior.
// DO NOT lowercase, uppercase, or guess casing elsewhere.

export type GlobalSearchResult = {
  battleTag: string;
  name: string;
  seasons?: { id: number }[];
  relevanceId?: string;
};

function decodeInput(input: unknown): string {
  let raw = String(input ?? "").trim();
  try {
    raw = decodeURIComponent(raw).trim();
  } catch {
    // keep raw if malformed encoding
  }
  return raw;
}

function parseBattleTag(raw: string): { name: string; id: string } | null {
  if (!raw.includes("#")) return null;
  const [name, id] = raw.split("#");
  if (!name || !id) return null;
  return { name, id };
}

async function globalSearchByName(name: string): Promise<GlobalSearchResult[] | null> {
  let res: Response;

  try {
    res = await fetch(
      `https://website-backend.w3champions.com/api/players/global-search` +
        `?search=${encodeURIComponent(name)}&pageSize=20`
    );
  } catch {
    return null;
  }

  if (!res.ok) return null;

  try {
    const json = (await res.json()) as unknown;
    return Array.isArray(json) ? (json as GlobalSearchResult[]) : null;
  } catch {
    return null;
  }
}

/**
 * Baseline: resolves to EXACT casing BattleTag from backend.
 */
export async function resolveBattleTagViaSearch(input: unknown): Promise<string | null> {
  const raw = decodeInput(input);
  const parsed = parseBattleTag(raw);
  if (!parsed) return null;

  const results = await globalSearchByName(parsed.name);
  if (!results?.length) return null;

  const targetSuffix = `#${parsed.id}`.toLowerCase();

  const matches = results.filter(
    (r) =>
      typeof r.battleTag === "string" &&
      r.battleTag.toLowerCase().endsWith(targetSuffix)
  );

  if (!matches.length) return null;

  matches.sort((a, b) => (b.seasons?.length ?? 0) - (a.seasons?.length ?? 0));

  return matches[0].battleTag;
}

/**
 * Same resolver rules, but also returns relevanceId (useful as playerId fallback).
 * Identity rules unchanged: we return exact backend strings only.
 */
export async function resolveBattleTagAndPlayerIdViaSearch(
  input: unknown
): Promise<{ battleTag: string; playerId: string | null } | null> {
  const raw = decodeInput(input);
  const parsed = parseBattleTag(raw);
  if (!parsed) return null;

  const results = await globalSearchByName(parsed.name);
  if (!results?.length) return null;

  const targetSuffix = `#${parsed.id}`.toLowerCase();

  const matches = results.filter(
    (r) =>
      typeof r.battleTag === "string" &&
      r.battleTag.toLowerCase().endsWith(targetSuffix)
  );

  if (!matches.length) return null;

  matches.sort((a, b) => (b.seasons?.length ?? 0) - (a.seasons?.length ?? 0));

  const top = matches[0];

  return {
    battleTag: top.battleTag,
    playerId: typeof top.relevanceId === "string" && top.relevanceId.length ? top.relevanceId : null,
  };
}
