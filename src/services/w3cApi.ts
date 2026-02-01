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
  battletag: string;           // canonical casing (best effort)
  playerId: string | null;
  countryCode: string | null;
  location: string | null;
  playerAkaCountry: string | null; // e.g. "us"
};

export type CountryLadderPayload = unknown[];

/* =========================
   HELPERS
========================= */

function pickString(x: any): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

/* =========================
   PROFILE
========================= */

/**
 * Fetches W3C player profile by BattleTag.
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
    playerAkaCountry: null,
  };

  if (!battletag) return safeDefault;

  const btEnc = encodeURIComponent(battletag);

  // 1) Prefer the richer players endpoint
  try {
    const res = await fetchFn(
      `https://website-backend.w3champions.com/api/players/${btEnc}`,
      { cache: "no-store" }
    );

    if (res.ok) {
      const json: any = await res.json();

      // Some payloads use battleTag, others battleTag; also id is often battletag
      const canonical =
        pickString(json?.battleTag) ||
        pickString(json?.battletag) ||
        pickString(json?.id) ||
        battletag;

      return {
        battletag: canonical,
        playerId: pickString(json?.playerId),
        countryCode: pickString(json?.countryCode),
        location: pickString(json?.location),
        playerAkaCountry: pickString(json?.playerAkaData?.country),
      };
    }
  } catch (e) {
    console.warn("players endpoint failed, falling back:", e);
  }

  // 2) Fallback to personal-settings (older endpoint)
  try {
    const res = await fetchFn(
      `https://website-backend.w3champions.com/api/personal-settings/${btEnc}`,
      { cache: "no-store" }
    );

    if (!res.ok) return safeDefault;

    const json: any = await res.json();

    return {
      battletag,
      playerId: pickString(json?.playerId),
      countryCode: pickString(json?.countryCode),
      location: pickString(json?.location),
      playerAkaCountry: null,
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
    )}?gateWay=${gateway}&gameMode=${gameMode}&season=${season}`;

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
