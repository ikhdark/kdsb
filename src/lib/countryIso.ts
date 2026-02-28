// src/lib/countryIso.ts

import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

/* =========================
   CONSTANTS
========================= */

export const UNKNOWN_COUNTRY = "UN";

export const COUNTRY_SHORT: Record<string, string> = {
  US: "USA",
  GB: "UK",
  KR: "Korea",
  CN: "China",
  RU: "Russia",
  BR: "Brazil",
  DE: "Germany",
  FR: "France",
  PL: "Poland",
  PE: "Peru",
  PH: "Philippines",
  TW: "Taiwan",
  UA: "Ukraine",
  CF: "CAR",
};

/* =========================
   HELPERS
========================= */

export function iso2(code: unknown): string {
  const c = String(code ?? "").trim().toUpperCase();
  return c.length === 2 ? c : "";
}

export function resolveCountryFromProfile(profile: any): string {
  return iso2(profile?.countryCode || profile?.location || "");
}

export function countryLabel(code: string): string {
  if (!code || code === UNKNOWN_COUNTRY) return "Unknown";

  return (
    COUNTRY_SHORT[code] ||
    countries.getName(code, "en") ||
    code
  );
}