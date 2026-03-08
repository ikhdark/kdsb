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
   HELPERS
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
  typeof v === "string" && v.trim().length > 0
    ? v.trim()
    : null;

const looksLikeBattleTag = (s: string) => s.includes("#");

function pickCountry(
  obj: Record<string, unknown>,
  player?: Record<string, unknown>
): string | null {
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

  return country ? country.toUpperCase() : null;
}

function pickBattleTag(
  obj: Record<string, unknown>,
  player?: Record<string, unknown>
): string | null {
  const player1Id = toStr(obj.player1Id ?? player?.player1Id);

  if (player1Id && looksLikeBattleTag(player1Id)) {
    return player1Id;
  }

  return (
    toStr(obj.battleTag) ??
    toStr(obj.battletag) ??
    toStr(player?.battleTag) ??
    toStr(player?.battletag) ??
    null
  );
}

function pickPlayerId(
  obj: Record<string, unknown>,
  player?: Record<string, unknown>
): string | null {
  const idCandidate =
    toStr(obj.playerId) ??
    toStr(player?.playerId) ??
    toStr(obj.id);

  if (!idCandidate || looksLikeBattleTag(idCandidate)) {
    return null;
  }

  return idCandidate;
}

/* =========================
   FLATTEN LADDER PAYLOAD
========================= */

export function flattenCountryLadder(payload: unknown): FlattenedLadderRow[] {
  const out: FlattenedLadderRow[] = [];
  const seen = new Set<string>();

  const pushRow = (row: FlattenedLadderRow) => {
    const id = row.battleTagLower ?? row.playerIdLower;
    if (!id) return;

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

    const race = toNum(obj.race);
    const mmr = toNum(obj.mmr ?? player?.mmr);
    const games = toNum(obj.games ?? player?.games);
    const wins =
      toNum(obj.wins ?? player?.wins ?? obj.won ?? player?.won) ?? 0;

    const battleTag = pickBattleTag(obj, player);
    const playerId = pickPlayerId(obj, player);
    const country = pickCountry(obj, player);

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
        wins: Math.trunc(wins),
        country,
        battleTag: battleTag ?? undefined,
        battleTagLower,
        playerIdLower,
      });
    }

    for (const key in obj) {
      const value = obj[key];
      if (value && typeof value === "object") {
        visit(value);
      }
    }
  };

  visit(payload);
  return out;
}