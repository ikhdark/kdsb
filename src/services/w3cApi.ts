/* services/w3cApi.ts */

const fetchFn: typeof fetch = global.fetch;

/* -------------------- TYPES -------------------- */

export type PlayerProfile = {
  battletag: string;
  playerId: string | null;
  countryCode: string | null;
  location: string | null;
};

/* -------------------- PROFILE -------------------- */

/**
 * Fetches the W3C player profile by BattleTag.
 * Returns a safe default object if API fails.
 */
export async function fetchPlayerProfile(
  battletag: string
): Promise<PlayerProfile> {
  try {
    const res = await fetchFn(
      `https://website-backend.w3champions.com/api/personal-settings/${encodeURIComponent(
        battletag
      )}`
    );

    if (!res.ok) {
      console.warn(`⚠️ Player profile not found: ${battletag}`);
      return {
        battletag,
        playerId: null,
        countryCode: null,
        location: null,
      };
    }

    const json = (await res.json()) as Partial<PlayerProfile> | null;

    return {
      battletag,
      playerId: json?.playerId ?? null,
      countryCode: json?.countryCode ?? null,
      location: json?.location ?? null,
    };
  } catch (err) {
    console.error(`❌ Error fetching profile for ${battletag}:`, err);
    return {
      battletag,
      playerId: null,
      countryCode: null,
      location: null,
    };
  }
}

/* -------------------- COUNTRY LADDER -------------------- */

/**
 * Fetches the country-specific ladder data.
 * Returns an empty array if API fails.
 */
export async function fetchCountryLadder(
  country: string,
  gateway: number,
  gameMode: number,
  season: number
): Promise<any[]> {
  try {
    const url =
      `https://website-backend.w3champions.com/api/ladder/country/${country}` +
      `?gateWay=${gateway}&gameMode=${gameMode}&season=${season}`;

    const res = await fetchFn(url);

    if (!res.ok) {
      console.warn(`⚠️ Country ladder not found: ${country}`);
      return [];
    }

    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch (err) {
    console.error(`❌ Error fetching country ladder (${country}):`, err);
    return [];
  }
}
