// src/services/countryRaceLadder.ts

import { unstable_cache } from "next/cache";

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
const GAMEMODE = 1;
const REVALIDATE_SECONDS = 300;

/* =====================================================
   HELPERS
===================================================== */

const getBT = (r: any) => r?.battleTag ?? r?.battletag ?? "";

function empty(country: string, race: RaceKey): CountryRaceLadderResponse {
  return {
    country,
    race,
    me: null,
    top: [],
    poolSize: 0,
    full: [],
    updatedAtUtc: new Date().toISOString(),
  };
}

/* =====================================================
   FULL COUNTRY/RACE SOS SNAPSHOT
===================================================== */

async function buildCountryRaceLadderSnapshot(
  country: string,
  race: RaceKey
): Promise<CountryRaceLadderResponse> {
  const raceId = RACE_ID[race];
  const countryUpper = country.toUpperCase();

  const payload = await fetchCountryLadder(
    countryUpper,
    GATEWAY,
    GAMEMODE,
    SEASON
  );

  const rows = flattenCountryLadder(payload ?? []);

  const byTag = new Map<string, any>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    if (r.race !== raceId) continue;

    const bt = getBT(r);
    if (!bt) continue;

    const override = COUNTRY_OVERRIDE[bt];

    if (override && override.from.toUpperCase() === countryUpper) continue;

    byTag.set(bt, r);
  }

  const injectTargets = Object.entries(COUNTRY_OVERRIDE).filter(
    ([, o]) => o.to.toUpperCase() === countryUpper
  );

  if (injectTargets.length) {
    const byFrom = new Map<string, string[]>();

    for (let i = 0; i < injectTargets.length; i++) {
      const [bt, o] = injectTargets[i];
      const from = o.from.toUpperCase();

      let arr = byFrom.get(from);
      if (!arr) {
        arr = [];
        byFrom.set(from, arr);
      }

      arr.push(bt);
    }

    const fromCountries = [...byFrom.keys()];
    const fromResults = await Promise.all(
      fromCountries.map((c) =>
        fetchCountryLadder(c, GATEWAY, GAMEMODE, SEASON)
      )
    );

    for (let idx = 0; idx < fromCountries.length; idx++) {
      const battletags = byFrom.get(fromCountries[idx]) ?? [];
      const fromPayload = fromResults[idx];
      if (!fromPayload) continue;

      const fromRows = flattenCountryLadder(fromPayload);
      const lookup = new Map<string, any>();

      for (let i = 0; i < fromRows.length; i++) {
        const r = fromRows[i];

        if (r.race !== raceId) continue;

        const bt = getBT(r);
        if (bt) lookup.set(bt, r);
      }

      for (let i = 0; i < battletags.length; i++) {
        const bt = battletags[i];
        const hit = lookup.get(bt);
        if (hit) byTag.set(bt, hit);
      }
    }
  }

  if (!byTag.size) return empty(countryUpper, race);

  const inputs: LadderInputRow[] = buildInputs(Array.from(byTag.values()));

  if (!inputs.length) return empty(countryUpper, race);

  const fullInputs: LadderInputRow[] = inputs.map((p) => ({
    battletag: p.battletag,
    mmr: p.mmr,
    wins: p.wins,
    games: p.games,
    sos: null,
  }));

  await computeSoS(fullInputs, raceId);

  const fullRanked = buildLadder(fullInputs);

  return {
    country: countryUpper,
    race,
    me: null,
    top: fullRanked.slice(0, 50),
    poolSize: fullRanked.length,
    full: fullRanked,
    updatedAtUtc: new Date().toISOString(),
  };
}

const cachedCountryRaceLadder = new Map<
  string,
  () => Promise<CountryRaceLadderResponse>
>();

function getCachedCountryRaceLadderFn(country: string, race: RaceKey) {
  const countryUpper = country.toUpperCase();
  const key = `${countryUpper}|${race}|${SEASON}|${GATEWAY}|${GAMEMODE}`;

  let fn = cachedCountryRaceLadder.get(key);

  if (!fn) {
    fn = unstable_cache(
      async () => buildCountryRaceLadderSnapshot(countryUpper, race),
      [`country-race-ladder:${key}`],
      { revalidate: REVALIDATE_SECONDS }
    );

    cachedCountryRaceLadder.set(key, fn);
  }

  return fn;
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
  const countryUpper = country.toUpperCase();

  const canonicalTag = inputBattleTag
    ? await resolveBattleTagViaSearch(inputBattleTag)
    : null;

  const canonicalLower = canonicalTag?.toLowerCase();

  const snapshot = await getCachedCountryRaceLadderFn(
    countryUpper,
    race
  )();

  if (!snapshot) return null;

  if (!snapshot.full.length) {
    return empty(countryUpper, race);
  }

  const { visible, top } = buildPaged(snapshot.full, page, pageSize);

  let me: LadderRow | null = null;

  if (canonicalLower) {
    for (let i = 0; i < snapshot.full.length; i++) {
      const r = snapshot.full[i];

      if (r.battletag.toLowerCase() === canonicalLower) {
        me = r;
        break;
      }
    }
  }

  return {
    country: snapshot.country,
    race: snapshot.race,
    me,
    top,
    poolSize: snapshot.poolSize,
    full: snapshot.full,
    updatedAtUtc: snapshot.updatedAtUtc,
  };
}