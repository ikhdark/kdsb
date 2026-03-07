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
const GAMEMODE = 1;

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

  const baseline = buildLadder(inputs);
  const { visible, top } = buildPaged(baseline, page, pageSize);

  const pageInputs: LadderInputRow[] = new Array(visible.length);

  for (let i = 0; i < visible.length; i++) {
    const p = visible[i];

    pageInputs[i] = {
      battletag: p.battletag,
      mmr: p.mmr,
      wins: p.wins,
      games: p.games,
      sos: null,
    };
  }

  await computeSoS(pageInputs, raceId);

  const updatedVisible = buildLadder(pageInputs);

  let me: LadderRow | null = null;

  if (canonicalLower) {
    for (let i = 0; i < updatedVisible.length; i++) {
      const r = updatedVisible[i];

      if (r.battletag.toLowerCase() === canonicalLower) {
        me = r;
        break;
      }
    }

    if (!me) {
      for (let i = 0; i < baseline.length; i++) {
        const r = baseline[i];

        if (r.battletag.toLowerCase() === canonicalLower) {
          me = r;
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