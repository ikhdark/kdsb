// src/lib/ranking.ts
// Shared ranking helpers for Next.js services (ESM/TS)

/* =========================
   RACE MAP
========================= */

export const RACE_MAP: Record<number, string> = {
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
  0: "Random",
};

/* =========================
   TYPES
========================= */

export type FlattenedLadderRow = {
  race: number;
  mmr: number;
  games: number;
  wins: number;

  // Pre-normalized identity fields for comparisons only.
  // These must be derived from API-provided strings (no guessing).
  battleTagLower?: string;
  playerIdLower?: string;
};

/* =========================
   FLATTEN COUNTRY LADDER
========================= */

/**
 * Flattens the country ladder payload into rows that rankByMMR() can consume.
 *
 * Identity rules:
 * - Never guesses casing.
 * - If a BattleTag-like string exists (contains "#"), battleTagLower is derived via `.toLowerCase()`.
 * - If a playerId exists (UUID-like; does NOT contain "#"), playerIdLower is derived via `.toLowerCase()`.
 */
export function flattenCountryLadder(payload: unknown): FlattenedLadderRow[] {
  const out: FlattenedLadderRow[] = [];
  const seen = new Set<string>();

  const toNum = (v: unknown): number | null => {
    const n =
      typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };

  const toStr = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length ? v.trim() : null;

  const looksLikeBattleTag = (s: string) => s.includes("#");
  const isLower = (s: string) => s === s.toLowerCase();

  const pushRow = (row: FlattenedLadderRow) => {
    const key =
      `${row.race}|${row.mmr}|${row.games}|${row.wins}|` +
      `${row.battleTagLower ?? ""}|${row.playerIdLower ?? ""}`;

    if (seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };

  const visit = (node: unknown) => {
    if (!node) return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    if (typeof node !== "object") return;

    const obj = node as Record<string, unknown>;
    const player =
      obj.player && typeof obj.player === "object"
        ? (obj.player as Record<string, unknown>)
        : null;

    // Core stats
    const race = toNum(obj.race);
    const mmr = toNum(obj.mmr ?? player?.mmr);
    const games = toNum(obj.games ?? player?.games);

    // wins is optional: default to 0 if missing so we don't drop rows
    const winsRaw =
      toNum(obj.wins ?? player?.wins ?? obj.won ?? player?.won) ?? 0;

    // Identity candidates (country ladder varies; include player1Id explicitly)
    const fromBattleTagFields =
      toStr(obj.battleTag) ??
      toStr(obj.battletag) ??
      toStr(player?.battleTag) ??
      toStr(player?.battletag);

    const fromPlayer1Id = toStr(obj.player1Id ?? player?.player1Id);

    const fromPlayerIdFields =
      toStr(obj.playerId) ?? toStr(player?.playerId) ?? toStr(obj.id);

    // Decide identity WITHOUT guessing:
    // - If player1Id looks like a BattleTag, treat it as BattleTag source.
    // - Otherwise, battleTag comes from explicit battleTag fields only.
    // - playerId only from fields that do NOT look like BattleTag.
    let battleTag: string | null = null;
    let playerId: string | null = null;

    if (fromPlayer1Id && looksLikeBattleTag(fromPlayer1Id)) {
      battleTag = fromPlayer1Id; // API-provided string
    } else {
      battleTag = fromBattleTagFields;
    }

    if (fromPlayerIdFields && !looksLikeBattleTag(fromPlayerIdFields)) {
      playerId = fromPlayerIdFields;
    }

    const battleTagLower = battleTag ? battleTag.toLowerCase() : undefined;
    const playerIdLower = playerId ? playerId.toLowerCase() : undefined;

    // Validate pre-normalized fields (we generate them here; should always be lower)
    if (battleTagLower && !isLower(battleTagLower)) return;
    if (playerIdLower && !isLower(playerIdLower)) return;

    // Only collect if it looks like a ladder row and has identity
    if (
      race !== null &&
      mmr !== null &&
      games !== null &&
      (battleTagLower || playerIdLower)
    ) {
      pushRow({
        race,
        mmr: Math.round(mmr),
        games: Math.max(0, Math.trunc(games)),
        wins: Math.max(0, Math.trunc(winsRaw)),
        battleTagLower,
        playerIdLower,
      });
    }

    // Recurse into children
    for (const v of Object.values(obj)) visit(v);
  };

  visit(payload);
  return out;
}

/* =========================
   RANK BY MMR
========================= */

/**
 * Calculates a player's rank for a given race based on MMR.
 *
 * STRICT IDENTITY RULES:
 * - canonicalLower MUST be: resolveBattleTagViaSearch(input).toLowerCase()
 * - This function NEVER guesses casing
 * - This function NEVER mutates identity
 *
 * Input invariants expected:
 * - rows[].battleTagLower (if present) is already lowercased upstream
 * - rows[].playerIdLower (if present) is already lowercased upstream
 */
export function rankByMMR(
  rows: FlattenedLadderRow[] | null | undefined,
  canonicalLower: string,
  raceId: number,
  minGames: number,
  fallbackPlayerIdLower: string | null = null
): { rank: number; total: number } | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (!canonicalLower) return null;

  // Require caller-provided lowercased identity (no transformation).
  if (canonicalLower !== canonicalLower.toLowerCase()) return null;

  const canon = canonicalLower;

  const pidLower = fallbackPlayerIdLower ?? null;
  if (pidLower && pidLower !== pidLower.toLowerCase()) return null;

  const pool = rows
    .filter((row) => {
      if (!row) return false;
      if (row.race !== raceId) return false;
      if (row.games < minGames) return false;
      if (typeof row.mmr !== "number") return false;

      const hasBtag =
        typeof row.battleTagLower === "string" && row.battleTagLower.length > 0;
      const hasPid =
        typeof row.playerIdLower === "string" && row.playerIdLower.length > 0;

      if (hasBtag && row.battleTagLower !== row.battleTagLower.toLowerCase())
        return false;
      if (hasPid && row.playerIdLower !== row.playerIdLower.toLowerCase())
        return false;

      return hasBtag || hasPid;
    })
    .sort((a, b) => {
      if (b.mmr !== a.mmr) return b.mmr - a.mmr;

      const aWinPct = a.games ? a.wins / a.games : 0;
      const bWinPct = b.games ? b.wins / b.games : 0;
      if (bWinPct !== aWinPct) return bWinPct - aWinPct;

      return b.games - a.games;
    });

  const idx = pool.findIndex((r) => {
    if (typeof r.battleTagLower === "string" && r.battleTagLower === canon)
      return true;
    if (pidLower && typeof r.playerIdLower === "string" && r.playerIdLower === pidLower)
      return true;
    return false;
  });

  if (idx === -1) return null;
  return { rank: idx + 1, total: pool.length };
}
