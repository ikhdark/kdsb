/**
 * Minimum duration in seconds for a game to be considered ranked.
 */
const MIN_DURATION_SECONDS = 120;

/**
 * Checks whether a match is a valid 1v1 ranked game.
 *
 * @param {Object} options
 * @param {Object} options.match - The match object.
 * @param {Object} options.me - The current player object.
 * @param {Object} options.opp - The opponent player object.
 * @param {number} [options.targetSeason] - Optional season filter.
 * @returns {boolean} - True if the match is valid for ranked analysis.
 */
function isValidRankedGame({ match, me, opp, targetSeason }) {
  // Must be 1v1 game mode
  if (match.gameMode !== 1) return false;

  // Must have valid game duration
  if (
    typeof match.durationInSeconds !== "number" ||
    match.durationInSeconds < MIN_DURATION_SECONDS
  ) return false;

  // Must have MMR and game data for both players
  if (
    typeof me?.mmrGain !== "number" ||
    typeof me?.oldMmr !== "number" ||
    typeof opp?.oldMmr !== "number"
  ) return false;

  // Optional season filter
  if (targetSeason != null && match.season !== targetSeason) return false;

  return true;
}

module.exports = { isValidRankedGame };
