// src/lib/ranking.ts
// Ladder flattening only (no ranking logic here)
// Ranking is handled by ladderEngine

export type FlattenedLadderRow = {
  race: number;
  mmr: number;
  games: number;
  wins: number;

  battleTag?: string;
  battleTagLower?: string;
  playerIdLower?: string;
};

/* =========================
   FLATTEN COUNTRY LADDER
========================= */

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

  const pushRow = (row: FlattenedLadderRow) => {
    const key = `${row.race}|${row.battleTagLower ?? row.playerIdLower ?? ""}`;

    if (!key || seen.has(key)) return;

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

    const race = toNum(obj.race);
    const mmr = toNum(obj.mmr ?? player?.mmr);
    const games = toNum(obj.games ?? player?.games);
    const winsRaw =
      toNum(obj.wins ?? player?.wins ?? obj.won ?? player?.won) ?? 0;

    const fromBattleTagFields =
      toStr(obj.battleTag) ??
      toStr(obj.battletag) ??
      toStr(player?.battleTag) ??
      toStr(player?.battletag);

    const fromPlayer1Id = toStr(obj.player1Id ?? player?.player1Id);

    const fromPlayerIdFields =
      toStr(obj.playerId) ?? toStr(player?.playerId) ?? toStr(obj.id);

    let battleTag: string | null = null;
    let playerId: string | null = null;

    if (fromPlayer1Id && looksLikeBattleTag(fromPlayer1Id)) {
      battleTag = fromPlayer1Id;
    } else {
      battleTag = fromBattleTagFields;
    }

    if (fromPlayerIdFields && !looksLikeBattleTag(fromPlayerIdFields)) {
      playerId = fromPlayerIdFields;
    }

    const battleTagLower = battleTag?.toLowerCase();
    const playerIdLower = playerId?.toLowerCase();

    if (
      race !== null &&
      mmr !== null &&
      games !== null &&
      (battleTagLower || playerIdLower)
    ) {
      pushRow({
        race,
        mmr: Math.round(mmr),
        games: Math.trunc(games),
        wins: Math.trunc(winsRaw),
        battleTag: battleTag ?? undefined,
        battleTagLower,
        playerIdLower,
      });
    }

    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) visit(v);
    }
  };

  visit(payload);

  return out;
}