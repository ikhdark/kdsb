/**
 * Determines whether a player's race has been played enough to be placed.
 *
 * @param {Object} options
 * @param {Object} options.raceCounters - A map tracking how many games have been played per race.
 * @param {number|string} options.race - The race ID or name to increment.
 * @param {number} [options.minGames=35] - Minimum number of games needed to be considered "placed".
 * @returns {boolean} - True if the player has played enough games as that race.
 */
function applyRacePlacement({ raceCounters, race, minGames = 35 }) {
  if (race == null) return false;

  // Initialize race count if it doesn't exist
  if (!raceCounters[race]) {
    raceCounters[race] = 1;
  } else {
    raceCounters[race]++;
  }

  return raceCounters[race] >= minGames;
}

module.exports = { applyRacePlacement };
