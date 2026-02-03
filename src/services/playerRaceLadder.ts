import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

import {
  fetchAllLeagues,
  buildInputs,
  buildPaged,
  computeSoS,
} from "./ladderCore";

import type { LadderRow } from "@/lib/ladderEngine";

/* =========================
   TYPES
========================= */

export type RaceKey =
  | "human"
  | "orc"
  | "elf"
  | "undead"
  | "random";

export type PlayerRaceLadderResponse = {
  battletag: string;
  race: RaceKey;
  me: LadderRow | null;
  top: LadderRow[];
  poolSize: number;
  full: LadderRow[];
  updatedAtUtc: string;
};

/* =========================
   RACE MAP
========================= */

const RACE_ID: Record<RaceKey, number> = {
  human: 1,
  orc: 2,
  elf: 4,
  undead: 8,
  random: 0,
};

/* =========================
   SERVICE
========================= */

export async function getPlayerRaceLadder(
  inputBattleTag: string | undefined,
  race: RaceKey,
  page = 1,
  pageSize = 50
): Promise<PlayerRaceLadderResponse | null> {
  /* ---------------------------
     canonical battletag
  --------------------------- */

  const battletag = inputBattleTag
    ? await resolveBattleTagViaSearch(inputBattleTag)
    : null;

  const raceId = RACE_ID[race];

  /* ---------------------------
     fetch + race filter
  --------------------------- */

  const rows = (await fetchAllLeagues()).filter(
    (r) => r.race === raceId
  );

  /* ---------------------------
     build ladder
  --------------------------- */

  const inputs = buildInputs(rows);

  const { ladder, visible, top } =
    buildPaged(inputs, page, pageSize);

  /* ---------------------------
     SoS (race-aware)
  --------------------------- */

  await computeSoS(visible, raceId);

  /* ---------------------------
     find player
  --------------------------- */

  const me = battletag
    ? ladder.find(
        (r) =>
          r.battletag.toLowerCase() ===
          battletag.toLowerCase()
      ) ?? null
    : null;

  /* ---------------------------
     return
  --------------------------- */

  return {
    battletag: battletag ?? "",
    race,
    me,
    top,
    poolSize: ladder.length,
    full: visible,
    updatedAtUtc: new Date().toISOString(),
  };
}
