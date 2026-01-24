/**
 * Increments a race counter and returns whether the race is now "placed".
 */
function applyRacePlacement({ raceCounters, race, minGames = 35 }) {
  if (race == null) return false;

  raceCounters[race] = (raceCounters[race] ?? 0) + 1;

  return raceCounters[race] >= minGames;
}

module.exports = { applyRacePlacement };
