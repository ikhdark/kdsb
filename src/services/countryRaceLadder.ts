// src/services/countryRaceLadder.ts

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { buildInputs, buildPaged, computeSoS } from "./ladderCore";
import { fetchCountryLadder } from "@/services/w3cApi";
import { flattenCountryLadder } from "@/lib/ranking";
import { COUNTRY_OVERRIDE } from "@/lib/countryOverrides";

import {
  buildLadder,
  type LadderRow,
  type LadderInputRow,
} from "@/lib/ladderEngine";

/* =====================================================
   TYPES
===================================================== */

export type RaceKey = "human" | "orc" | "elf" | "undead" | "random";

export type CountryRaceLadderResponse = {
  country: string;
  race: RaceKey;
  me: LadderRow | null;
  top: LadderRow[];
  poolSize: number;
  full: LadderRow[];
  updatedAtUtc: string;
};

/* =====================================================
   CONSTANTS
===================================================== */

const RACE_ID: Record<RaceKey, number> = {
  human: 1,
  orc: 2,
  elf: 4,
  undead: 8,
  random: 0,
};

const SEASON = 24;
const GATEWAY = 20;
const GAME_MODE = 1;

/* =====================================================
   HELPERS
===================================================== */

function getBT(r: any): string {
  return r?.battleTag ?? r?.battletag ?? "";
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

/* =====================================================
   MAIN
===================================================== */

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

  /* ---------------- FETCH COUNTRY LADDER ---------------- */

  const payload = await fetchCountryLadder(countryUpper, GATEWAY, GAME_MODE, SEASON);
  if (!payload) return null;

  const flattened = flattenCountryLadder(payload);

  /* ---------------- FILTER BY RACE ---------------- */

  let raceRows = flattened.filter((r: any) => r.race === raceId);

  /* ---------------- COUNTRY OVERRIDES ---------------- */

  if (raceRows.length) {
    // Remove players overridden OUT of this country
    raceRows = raceRows.filter((r: any) => {
      const bt = getBT(r);
      const override = COUNTRY_OVERRIDE[bt];
      if (!override) return true;
      return override.from.toUpperCase() !== countryUpper;
    });

    // Inject players overridden INTO this country
    const injectTargets = Object.entries(COUNTRY_OVERRIDE).filter(
      ([, o]) => o.to.toUpperCase() === countryUpper
    );

    if (injectTargets.length) {
      const byFrom = new Map<string, string[]>();

      for (const [bt, o] of injectTargets) {
        const from = o.from.toUpperCase();
        byFrom.set(from, [...(byFrom.get(from) ?? []), bt]);
      }

      for (const [fromCountry, battletags] of byFrom.entries()) {
        const fromPayload = await fetchCountryLadder(fromCountry, GATEWAY, GAME_MODE, SEASON);
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

  /* ---------------- EMPTY STATE ---------------- */

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

  /* ---------------- BUILD INPUTS ---------------- */

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

  /* ---------------- BASELINE LADDER (MMR ONLY) ---------------- */

  const baseline = buildLadder(inputs);

  const { visible, top } = buildPaged(baseline, page, pageSize);

  /* ---------------- COMPUTE SOS (PAGE ONLY) ---------------- */
  // computeSoS expects LadderInputRow[], so convert visible LadderRow -> input rows
  const pageInputs: LadderInputRow[] = visible.map((p) => ({
    battletag: p.battletag,
    mmr: p.mmr,
    wins: p.wins,
    games: p.games,
    sos: null,
  }));

  await computeSoS(pageInputs, raceId);

  /* ---------------- REBUILD VISIBLE WITH SOS + SCORE ---------------- */

  const updatedVisible = buildLadder(pageInputs);

  /* ---------------- FIND PLAYER ---------------- */

  const me = canonicalTag
    ? baseline.find(
        (r) => r.battletag.toLowerCase() === canonicalTag.toLowerCase()
      ) ?? null
    : null;

  return {
    country: countryUpper,
    race,
    me,
    top,
    poolSize: baseline.length,
    full: updatedVisible,
    updatedAtUtc: new Date().toISOString(),
  };
}