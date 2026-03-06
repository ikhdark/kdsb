// src/lib/ranking.ts
// Ladder flattening only (no ranking logic here)
// Ranking is handled by ladderEngine

export type FlattenedLadderRow = {
  race: number;
  mmr: number;
  games: number;
  wins: number;

  country?: string | null;

  battleTag?: string;
  battleTagLower?: string;
  playerIdLower?: string;
};

/* =========================
   helpers
========================= */

const toNum = (v: unknown): number | null => {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
      ? Number(v)
      : NaN;

  return Number.isFinite(n) ? n : null;
};

const toStr = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length ? v.trim() : null;

const looksLikeBattleTag = (s: string) => s.includes("#");

/* =========================
   FLATTEN COUNTRY LADDER
========================= */

export function flattenCountryLadder(payload: unknown): FlattenedLadderRow[] {
  const out: FlattenedLadderRow[] = [];
  const seen = new Set<string>();

  const pushRow = (row: FlattenedLadderRow) => {
    const id = row.battleTagLower ?? row.playerIdLower ?? "";
    const key = `${row.race}|${id}`;

    if (seen.has(key)) return;

    seen.add(key);
    out.push(row);
  };

  const visit = (node: unknown): void => {
    if (!node) return;

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        visit(node[i]);
      }
      return;
    }

    if (typeof node !== "object") return;

    const obj = node as Record<string, unknown>;

    const player =
      obj.player && typeof obj.player === "object"
        ? (obj.player as Record<string, unknown>)
        : undefined;

    /* ===== numeric fields ===== */

    const race = toNum(obj.race);
    const mmr = toNum(obj.mmr ?? player?.mmr);
    const games = toNum(obj.games ?? player?.games);

    const winsRaw =
      toNum(obj.wins ?? player?.wins ?? obj.won ?? player?.won) ?? 0;

    /* ===== country ===== */

    const country =
      toStr(obj.country) ??
      toStr(obj.countryCode) ??
      toStr(obj.location) ??
      toStr(obj.region) ??
      toStr(player?.country) ??
      toStr(player?.countryCode) ??
      toStr(player?.location) ??
      toStr(player?.region) ??
      toStr(player?.profileCountry) ??
      null;

    /* ===== tag detection ===== */

    const tagCandidate =
      toStr(obj.battleTag) ??
      toStr(obj.battletag) ??
      toStr(player?.battleTag) ??
      toStr(player?.battletag);

    const player1Id = toStr(obj.player1Id ?? player?.player1Id);

    const idCandidate =
      toStr(obj.playerId) ??
      toStr(player?.playerId) ??
      toStr(obj.id);

    let battleTag: string | null = null;
    let playerId: string | null = null;

    if (player1Id && looksLikeBattleTag(player1Id)) {
      battleTag = player1Id;
    } else {
      battleTag = tagCandidate;
    }

    if (idCandidate && !looksLikeBattleTag(idCandidate)) {
      playerId = idCandidate;
    }

    const battleTagLower = battleTag?.toLowerCase();
    const playerIdLower = playerId?.toLowerCase();

    /* ===== push row ===== */

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
        country,
        battleTag: battleTag ?? undefined,
        battleTagLower,
        playerIdLower,
      });
    }

    /* ===== recurse ===== */

    for (const k in obj) {
      const v = obj[k];
      if (v && typeof v === "object") {
        visit(v);
      }
    }
  };

  visit(payload);
  return out;
}