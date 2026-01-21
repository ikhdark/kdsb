// src/services/w3cApi.ts
// Next.js-friendly ESM/TypeScript (no Discord logic)

const fetchFn: typeof fetch =
  typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : fetch;

/* =========================
   TYPES
========================= */

export type PlayerProfile = {
  battletag: string;
  playerId: string | null;
  countryCode: string | null;
  location: string | null;
};

export type CountryLadderPayload = unknown[];

/* =========================
   PROFILE
========================= */

/**
 * Fetches the W3C player profile by BattleTag.
 * Returns a safe default object if API fails.
 *
 * IMPORTANT:
 * - battletag MUST already be canonical (from resolveBattleTagViaSearch)
 * - NO casing/identity logic here
 */
export async function fetchPlayerProfile(battletag: string): Promise<PlayerProfile> {
  const safeDefault: PlayerProfile = {
    battletag,
    playerId: null,
    countryCode: null,
    location: null,
  };

  if (!battletag) return safeDefault;

  try {
    const res = await fetchFn(
      `https://website-backend.w3champions.com/api/personal-settings/${encodeURIComponent(
        battletag
      )}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.warn(`⚠️ Player profile not found: ${battletag}`);
      return safeDefault;
    }

    const json = (await res.json()) as Partial<PlayerProfile> | null;

    return {
      battletag,
      playerId: typeof json?.playerId === "string" ? json.playerId : null,
      countryCode: typeof json?.countryCode === "string" ? json.countryCode : null,
      location: typeof json?.location === "string" ? json.location : null,
    };
  } catch (err) {
    console.error(`❌ Error fetching profile for ${battletag}:`, err);
    return safeDefault;
  }
}

/* =========================
   COUNTRY LADDER
========================= */

/**
 * Fetches the country-specific ladder data.
 * Returns an empty array if API fails.
 *
 * IMPORTANT:
 * - country should already be normalized (usually upper-case)
 * - NO identity logic here
 */
export async function fetchCountryLadder(
  country: string,
  gateway: number,
  gameMode: number,
  season: number
): Promise<CountryLadderPayload> {
  if (!country) return [];

  const url =
    `https://website-backend.w3champions.com/api/ladder/country/${encodeURIComponent(
      country
    )}` + `?gateWay=${gateway}&gameMode=${gameMode}&season=${season}`;

  try {
    const res = await fetchFn(url, { cache: "no-store" });

    if (!res.ok) {
      console.warn(`⚠️ Country ladder not found: ${country}`);
      return [];
    }

    const json = (await res.json()) as unknown;
    return Array.isArray(json) ? json : [];
  } catch (err) {
    console.error(`❌ Error fetching country ladder (${country}):`, err);
    return [];
  }
}
