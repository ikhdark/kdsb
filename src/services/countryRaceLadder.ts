import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { buildInputs, buildPaged, computeSoS } from "./ladderCore";
import { fetchCountryLadder } from "@/services/w3cApi";
import { flattenCountryLadder } from "@/lib/ranking";

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
    20, // gateway
    1,  // gameMode
    24  // season
  );

  if (!payload) return null;

  /* ---------- flatten ---------- */

  const flattened = flattenCountryLadder(payload);

  /* ---------- filter race (API already country-scoped) ---------- */

  const raceRows = flattened.filter(
    (r: any) => r.race === raceId
  );

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

  /* ---------- compute SoS BEFORE ranking ---------- */

  await computeSoS(
    inputs as unknown as LadderRow[],
    raceId
  );

  /* ---------- build ladder AFTER SoS ---------- */

  const { ladder, visible, top } = buildPaged(
    inputs,
    page,
    pageSize
  );

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