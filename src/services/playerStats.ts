import { fetchPlayerProfile, fetchAllMatches } from "../lib/w3cUtils";

type PlayerProfile = {
  battletag?: string;
  playerId?: string | null;
  countryCode?: string | null;
  location?: string | null;
};

type BasicPlayerStats = {
  battletag: string;
  profile: PlayerProfile;
  totalGames: number;
  wins: number;
  losses: number;
};

type AnyMatch = {
  result?: "WIN" | "LOSS" | string;
};

/**
 * Fetches basic player stats: profile, total games, win/loss count.
 */
export async function getBasicPlayerStats(
  battletag: string
): Promise<BasicPlayerStats> {
  if (!battletag) {
    throw new Error("Missing battletag");
  }

  let profile: PlayerProfile;

  try {
    profile = await fetchPlayerProfile(battletag);
  } catch (err) {
    console.error(`❌ Failed to fetch profile for ${battletag}:`, err);
    profile = {
      battletag,
      playerId: null,
      countryCode: null,
      location: null,
    };
  }

  let matches: AnyMatch[] = [];

  try {
    const res = await fetchAllMatches(battletag);
    matches = Array.isArray(res) ? res : [];
  } catch (err) {
    console.error(`❌ Failed to fetch matches for ${battletag}:`, err);
  }

  let wins = 0;
  let losses = 0;

  for (const m of matches) {
    if (m.result === "WIN") wins++;
    else if (m.result === "LOSS") losses++;
  }

  return {
    battletag,
    profile,
    totalGames: matches.length,
    wins,
    losses,
  };
}
