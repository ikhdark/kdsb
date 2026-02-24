import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import {
  fetchAllLeagues,
  buildInputs,
  buildPaged,
  computeSoS,
} from "./ladderCore";
import { fetchCountryLadder } from "@/services/w3cApi";
import { flattenCountryLadder } from "@/lib/ranking";
import { COUNTRY_OVERRIDE } from "@/lib/countryOverrides";

import type {
  LadderRow,
  LadderInputRow,
} from "@/lib/ladderEngine";

/* ========================= */

export type RaceKey =
  | "human"
  | "orc"
  | "elf"
  | "undead"
  | "random";

export type CountryRaceLadderResponse = {
  country: string;
  race: RaceKey;
  me: LadderRow | null;
  top: LadderRow[];
  poolSize: number;
  full: LadderRow[];
  updatedAtUtc: string;
};

/* ========================= */

const RACE_ID: Record<RaceKey, number> = {
  human: 1,
  orc: 2,
  elf: 4,
  undead: 8,
  random: 0,
};

/* ---------- helpers ---------- */

function getBT(r: any): string {
  return r?.battletag ?? r?.battleTag ?? "";
}

function uniqBy<T>(rows: T[], keyFn: (r: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = keyFn(r);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/* ========================= */

export async function getCountryRaceLadder(
  country: string,
  race: RaceKey,
  inputBattleTag?: string,
  page = 1,
  pageSize = 50
): Promise<CountryRaceLadderResponse | null> {

  const canonicalTag = inputBattleTag
    ? await resolveBattleTagViaSearch(inputBattleTag)
    : null;

  const raceId = RACE_ID[race];
  const countryUpper = country.toUpperCase();

  /* ---------- fetch country ladder ---------- */

  const payload = await fetchCountryLadder(
    countryUpper,
    20,
    1,
    24
  );

  if (!payload) return null;

  const flattened = flattenCountryLadder(payload);

  /* ---------- filter race ---------- */

  let raceRows = flattened.filter(
    (r: any) => r.race === raceId
  );

  /* ---------- APPLY COUNTRY OVERRIDES (LOGIC) ---------- */
  if (raceRows.length) {
    // (A) Remove battletags overridden OUT of this country
    raceRows = raceRows.filter((r: any) => {
      const bt = getBT(r);
      const o = COUNTRY_OVERRIDE[bt];
      if (!o) return true;
      return o.from.toUpperCase() !== countryUpper;
    });

    // (B) Inject battletags overridden INTO this country
    const injectTargets = Object.entries(COUNTRY_OVERRIDE)
      .filter(([, o]) => o.to.toUpperCase() === countryUpper);

    if (injectTargets.length) {
      // Group by FROM so we fetch each source country once
      const byFrom = new Map<string, string[]>();
      for (const [bt, o] of injectTargets) {
        const from = o.from.toUpperCase();
        byFrom.set(from, [...(byFrom.get(from) ?? []), bt]);
      }

      for (const [fromCountry, battletags] of byFrom.entries()) {
        const fromPayload = await fetchCountryLadder(
          fromCountry,
          20,
          1,
          24
        );
        if (!fromPayload) continue;

        const fromFlat = flattenCountryLadder(fromPayload);
        const fromRaceRows = fromFlat.filter((r: any) => r.race === raceId);

        for (const bt of battletags) {
          const hit = fromRaceRows.find((r: any) => getBT(r) === bt);
          if (hit) raceRows.push(hit);
        }
      }

      raceRows = uniqBy(raceRows, (r: any) => getBT(r));
    }
  }

  /* ---------- empty ---------- */

  if (!raceRows.length) {
    return {
      country: countryUpper,
      race,
      me: null,
      top: [],
      poolSize: 0,
      full: [],
      updatedAtUtc: new Date().toISOString(),
    };
  }

  /* ---------- build inputs ---------- */

  const inputs: LadderInputRow[] = buildInputs(raceRows);

  if (!inputs.length) {
    return {
      country: countryUpper,
      race,
      me: null,
      top: [],
      poolSize: 0,
      full: [],
      updatedAtUtc: new Date().toISOString(),
    };
  }

  /* ---------- build ladder FIRST (same as global) ---------- */

  const { ladder, visible, top } =
    buildPaged(inputs, page, pageSize);

  /* ---------- compute SoS AFTER (same as global) ---------- */

  await computeSoS(visible, raceId);

  /* ---------- find player ---------- */

  const me = canonicalTag
    ? ladder.find(
        (r) =>
          r.battletag.toLowerCase() ===
          canonicalTag.toLowerCase()
      ) ?? null
    : null;

  return {
    country: countryUpper,
    race,
    me,
    top,
    poolSize: ladder.length,
    full: visible,
    updatedAtUtc: new Date().toISOString(),
  };
}