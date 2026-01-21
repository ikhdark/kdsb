import axios from "axios";

/* -------------------- CONSTANTS -------------------- */

const GATEWAY = 20;
const PAGE_SIZE = 50;

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

/* -------------------- BATTLETAG CANONICAL RESOLUTION -------------------- */

/**
 * SINGLE AUTHORITY (UPDATED):
 * Mirrors W3C search-bar behavior via global-search.
 *
 * Rules:
 * - Identity is the numeric suffix (#XXXX)
 * - Casing matters AFTER resolution, never before
 * - Prefer active ladder accounts (most seasons)
 * - Return EXACT battleTag string from backend
 */
export async function resolveCanonicalBattleTag(
  input: string
): Promise<string | null> {
  const raw = String(input ?? "").trim();
  if (!raw.includes("#")) return null;

  const [name, id] = raw.split("#");
  if (!name || !id) return null;

  const url =
    "https://website-backend.w3champions.com/api/players/global-search" +
    `?search=${encodeURIComponent(name)}&pageSize=20`;

  try {
    const res = await axios.get(url);
    const players = res.data;

    if (!Array.isArray(players) || !players.length) return null;

    const targetSuffix = `#${id}`.toLowerCase();

    // 1) match same numeric BattleTag id (case-insensitive)
    const matches = players.filter(
      (p: any) =>
        typeof p?.battleTag === "string" &&
        p.battleTag.toLowerCase().endsWith(targetSuffix)
    );

    if (!matches.length) return null;

    // 2) prefer accounts with ladder history (most seasons)
    matches.sort((a: any, b: any) => {
      const aSeasons = Array.isArray(a.seasons) ? a.seasons.length : 0;
      const bSeasons = Array.isArray(b.seasons) ? b.seasons.length : 0;
      return bSeasons - aSeasons;
    });

    // 3) return EXACT canonical casing from backend
    return matches[0].battleTag;
  } catch {
    return null;
  }
}

/* -------------------- MATCH FETCH -------------------- */

/**
 * IMPORTANT:
 * - battleTag MUST already be canonical
 * - NO casing changes
 * - NO retries
 */
export async function fetchAllMatches(
  canonicalBattleTag: string,
  seasons: number[] = [20, 21, 22, 23]
): Promise<any[]> {
  const encodedTag = encodeURIComponent(canonicalBattleTag);
  const allMatches: any[] = [];

  for (const season of seasons) {
    let offset = 0;

    while (true) {
      const url =
        "https://website-backend.w3champions.com/api/matches/search" +
        `?playerId=${encodedTag}` +
        `&gateway=${GATEWAY}` +
        `&season=${season}` +
        `&offset=${offset}` +
        `&pageSize=${PAGE_SIZE}`;

      const res = await axios.get(url);
      const matches = res.data?.matches;

      if (!Array.isArray(matches) || matches.length === 0) break;

      allMatches.push(...matches);
      if (matches.length < PAGE_SIZE) break;

      offset += PAGE_SIZE;
    }
  }

  return allMatches;
}

/* -------------------- PLAYER PAIR RESOLUTION -------------------- */

/**
 * STRICT MATCH:
 * - battleTag comparison is EXACT
 * - caller must pass canonical BattleTag
 */
export function getPlayerAndOpponent(
  match: any,
  canonicalBattleTag: string
): { me: any; opp: any } | null {
  if (!Array.isArray(match?.teams)) return null;

  const players = match.teams.flatMap((t: any) => t.players ?? []);

  const me = players.find(
    (p: any) => p?.battleTag === canonicalBattleTag
  );
  if (!me) return null;

  const opp = players.find((p: any) => p !== me);
  if (!opp) return null;

  return { me, opp };
}
