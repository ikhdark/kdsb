/**
 * Maps W3Champions race IDs to race names.
 */
const RACE_MAP = {
  0: "Random",
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
};

/**
 * Flattens ladder data across leagues into a list of player entries.
 *
 * @param {Array} countryPayload - Ladder data grouped by league.
 * @returns {Array<Object>} Flattened player data.
 */
function flattenCountryLadder(countryPayload) {
  if (!Array.isArray(countryPayload)) return [];

  return countryPayload.flatMap(league =>
    Array.isArray(league.ranks)
      ? league.ranks.map(rank => ({
          race: rank.race,
          mmr: rank.player?.mmr ?? null,
          games: rank.player?.games ?? 0,
          wins: rank.player?.wins ?? 0,
          battleTag: rank.player?.playerIds?.[0]?.battleTag ?? null,
          playerId: rank.player?.playerIds?.[0]?.id ?? null,
        }))
      : []
  );
}

/**
 * Calculates a player's rank for a given race based on MMR.
 *
 * @param {Array<Object>} rows - Flattened player rows.
 * @param {string} canonicalLower - Lowercased battleTag.
 * @param {number} raceId - Race to filter for (e.g., 1 = Human).
 * @param {number} minGames - Minimum games to be considered for ranking.
 * @param {string|null} fallbackPlayerIdLower - Optional player ID fallback.
 * @returns {{rank: number, total: number} | null}
 */
function rankByMMR(rows, canonicalLower, raceId, minGames, fallbackPlayerIdLower = null) {
  const pool = rows
    .filter(row =>
      row.race === raceId &&
      row.games >= minGames &&
      typeof row.mmr === "number" &&
      (typeof row.battleTag === "string" || typeof row.playerId === "string")
    )
    .map(row => ({
      ...row,
      battleTag: row.battleTag?.toLowerCase(),
      playerId: row.playerId?.toLowerCase(),
    }))
    .sort((a, b) => {
      // Primary sort: MMR
      if (b.mmr !== a.mmr) return b.mmr - a.mmr;

      // Secondary: win percentage
      const aWinPct = a.games ? a.wins / a.games : 0;
      const bWinPct = b.games ? b.wins / b.games : 0;
      if (bWinPct !== aWinPct) return bWinPct - aWinPct;

      // Tiebreaker: more games
      return b.games - a.games;
    });

  const idx = pool.findIndex(
    r => r.battleTag === canonicalLower || r.playerId === fallbackPlayerIdLower
  );

  if (idx === -1) return null;

  return {
    rank: idx + 1,
    total: pool.length,
  };
}

module.exports = {
  RACE_MAP,
  flattenCountryLadder,
  rankByMMR,
};
