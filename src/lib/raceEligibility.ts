import { fetchAllMatches, getPlayerAndOpponent } from "@/lib/w3cUtils";

/* =========================
   CONFIG
========================= */

const ALL_SEASONS = [20, 21, 22, 23, 24]; // FIX: must explicitly pass seasons
const GAME_MODE = 1;
const MIN_DURATION_SECONDS = 120;

/* =========================
   LIFETIME RACE GAMES
========================= */

export async function getLifetimeRaceGames(
  battletag: string,
  raceId: number
): Promise<number> {
  // FIX: [] returns 0 matches — must pass real seasons
  const matches = await fetchAllMatches(battletag, ALL_SEASONS);

  let count = 0;

  for (const m of matches) {
    if (m.gameMode !== GAME_MODE) continue;
    if (m.durationInSeconds < MIN_DURATION_SECONDS) continue;

    const pair = getPlayerAndOpponent(m, battletag);
    if (!pair) continue;

    if (pair.me.race === raceId) count++;
  }

  return count;
}

/* =========================
   ELIGIBILITY
========================= */

export async function hasLifetimeRaceGames(
  battletag: string,
  raceId: number,
  minGames = 30
): Promise<boolean> {
  return (await getLifetimeRaceGames(battletag, raceId)) >= minGames;
}
