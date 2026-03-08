// src/services/countryRaceLadder.ts

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { flattenCountryLadder } from "@/lib/ranking";
import { COUNTRY_OVERRIDE } from "@/lib/countryOverrides";

import { fetchCountryLadder } from "@/services/w3cApi";
import {
  buildInputs,
  buildPaged,
  computeSoS,
} from "@/services/ladderCore";

import {
  buildLadder,
  type LadderInputRow,
  type LadderRow,
} from "@/lib/ladderEngine";

import {
  W3C_CURRENT_SEASON,
  W3C_GATEWAY,
  W3C_GAME_MODE_1V1,
} from "@/lib/w3cConfig";

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

const SEASON = W3C_CURRENT_SEASON;
const GATEWAY = W3C_GATEWAY;
const GAMEMODE = W3C_GAME_MODE_1V1;

/* =====================================================
   HELPERS
===================================================== */

const getBT = (row: any) => row?.battleTag ?? row?.battletag ?? "";

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
   MAIN (VISIBLE-ONLY SoS)
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

  const canonicalLower = canonicalTag?.toLowerCase();
  const raceId = RACE_ID[race];
  const countryUpper = country.toUpperCase();

  const payload = await fetchCountryLadder(
    countryUpper,
    GATEWAY,
    GAMEMODE,
    SEASON
  );

  if (!payload) return null;

  const rows = flattenCountryLadder(payload);
  const byTag = new Map<string, any>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.race !== raceId) continue;

    const bt = getBT(row);
    if (!bt) continue;

    const override = COUNTRY_OVERRIDE[bt];
    if (override && override.from.toUpperCase() === countryUpper) {
      continue;
    }

    byTag.set(bt, row);
  }

  const injectTargets = Object.entries(COUNTRY_OVERRIDE).filter(
    ([, override]) => override.to.toUpperCase() === countryUpper
  );

  if (injectTargets.length) {
    const byFrom = new Map<string, string[]>();

    for (let i = 0; i < injectTargets.length; i++) {
      const [bt, override] = injectTargets[i];
      const from = override.from.toUpperCase();

      let list = byFrom.get(from);
      if (!list) {
        list = [];
        byFrom.set(from, list);
      }

      list.push(bt);
    }

    const fromCountries = [...byFrom.keys()];
    const fromResults = await Promise.all(
      fromCountries.map((fromCountry) =>
        fetchCountryLadder(fromCountry, GATEWAY, GAMEMODE, SEASON)
      )
    );

    for (let idx = 0; idx < fromCountries.length; idx++) {
      const battletags = byFrom.get(fromCountries[idx]) ?? [];
      const fromPayload = fromResults[idx];

      if (!fromPayload) continue;

      const fromRows = flattenCountryLadder(fromPayload);
      const lookup = new Map<string, any>();

      for (let i = 0; i < fromRows.length; i++) {
        const row = fromRows[i];

        if (row.race !== raceId) continue;

        const bt = getBT(row);
        if (bt) lookup.set(bt, row);
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

  const baseline = buildLadder(inputs);
  const { visible, top } = buildPaged(baseline, page, pageSize);

  const pageInputs: LadderInputRow[] = new Array(visible.length);

  for (let i = 0; i < visible.length; i++) {
    const row = visible[i];

    pageInputs[i] = {
      battletag: row.battletag,
      mmr: row.mmr,
      wins: row.wins,
      games: row.games,
      sos: null,
    };
  }

  await computeSoS(pageInputs, raceId);

  const updatedVisible = buildLadder(pageInputs);

  let me: LadderRow | null = null;

  if (canonicalLower) {
    for (let i = 0; i < updatedVisible.length; i++) {
      const row = updatedVisible[i];

      if (row.battletag.toLowerCase() === canonicalLower) {
        me = row;
        break;
      }
    }

    if (!me) {
      for (let i = 0; i < baseline.length; i++) {
        const row = baseline[i];

        if (row.battletag.toLowerCase() === canonicalLower) {
          me = row;
          break;
        }
      }
    }
  }

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