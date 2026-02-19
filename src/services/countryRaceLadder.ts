import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { buildInputs, buildPaged, computeSoS } from "./ladderCore";
import { fetchCountryLadder } from "@/services/w3cApi";
import { flattenCountryLadder } from "@/lib/ranking";

import type { LadderRow } from "@/lib/ladderEngine";

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
  const battletag = inputBattleTag
    ? await resolveBattleTagViaSearch(inputBattleTag)
    : null;

  const raceId = RACE_ID[race];

  /* ---------- fetch country ladder ---------- */

  const payload = await fetchCountryLadder(
    country,
    20,
    1,
    24
  );

  const rows = flattenCountryLadder(payload).filter(
    (r) => r.race === raceId
  );

  /* ---------- ladder ---------- */

  const inputs = buildInputs(rows);
  const { ladder, visible, top } = buildPaged(
    inputs,
    page,
    pageSize
  );

  /* ---------- SoS ---------- */

  await computeSoS(visible, raceId);

  /* ---------- find player ---------- */

  const me = battletag
    ? ladder.find(
        (r) =>
          r.battletag.toLowerCase() ===
          battletag.toLowerCase()
      ) ?? null
    : null;

  return {
    country,
    race,
    me,
    top,
    poolSize: ladder.length,
    full: visible,
    updatedAtUtc: new Date().toISOString(),
  };
}