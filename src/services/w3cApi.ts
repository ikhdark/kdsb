// src/services/w3cApi.ts
// Next.js-friendly ESM/TypeScript (network layer only)

import { fetchJson } from "@/lib/w3cUtils";

/* =========================
   TYPES
========================= */

export type PlayerProfile = {
  battletag: string;
  playerId: string | null;
  countryCode: string | null;
  location: string | null;
  playerAkaCountry: string | null;
};

export type CountryLadderPayload = unknown[];

/* =========================
   HELPERS
========================= */

const pickString = (v: any): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const pickCountry = (v: any): string | null => {
  const s = pickString(v);
  return s ? s.toUpperCase() : null;
};

/* =========================
   PROFILE
========================= */

export async function fetchPlayerProfile(
  battletag: string
): Promise<PlayerProfile> {
  if (!battletag) {
    return {
      battletag,
      playerId: null,
      countryCode: null,
      location: null,
      playerAkaCountry: null,
    };
  }

  const btEnc = encodeURIComponent(battletag);

  const base: PlayerProfile = {
    battletag,
    playerId: null,
    countryCode: null,
    location: null,
    playerAkaCountry: null,
  };

  const json =
    await fetchJson<any>(
      `https://website-backend.w3champions.com/api/players/${btEnc}`
    );

  if (json) {
    const canonical =
      pickString(json?.battleTag) ||
      pickString(json?.battletag) ||
      pickString(json?.id) ||
      battletag;

    return {
      battletag: canonical,
      playerId: pickString(json?.playerId),
      countryCode: pickCountry(json?.countryCode),
      location: pickCountry(json?.location),
      playerAkaCountry: pickCountry(json?.playerAkaData?.country),
    };
  }

  const fallback =
    await fetchJson<any>(
      `https://website-backend.w3champions.com/api/personal-settings/${btEnc}`
    );

  if (!fallback) return base;

  return {
    battletag,
    playerId: pickString(fallback?.playerId),
    countryCode: pickCountry(fallback?.countryCode),
    location: pickCountry(fallback?.location),
    playerAkaCountry: null,
  };
}

/* =========================
   COUNTRY LADDER
========================= */

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

  const json = await fetchJson<unknown[]>(url);
  return Array.isArray(json) ? json : [];
}