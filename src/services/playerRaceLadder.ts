import { unstable_cache } from "next/cache";

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

import {
  fetchAllLeagues,
  buildInputs,
  buildPaged,
  computeSoS,
} from "./ladderCore";

import {
  buildLadder,
  type LadderRow,
} from "@/lib/ladderEngine";

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
   CORE (UNCACHED)
========================= */

async function _getPlayerRaceLadder(
  inputBattleTag: string | undefined,
  race: RaceKey,
  page = 1,
  pageSize = 50
): Promise<PlayerRaceLadderResponse | null> {

  const battletag = inputBattleTag
    ? await resolveBattleTagViaSearch(inputBattleTag)
    : null;

  const battletagLower = battletag?.toLowerCase();

  const raceId = RACE_ID[race];

  const allRows = await fetchAllLeagues();

  const raceRows = [];
  for (const r of allRows) {
    if (r.race === raceId) raceRows.push(r);
  }

  const inputs = buildInputs(raceRows);

  /* compute SoS BEFORE ranking */
  await computeSoS(inputs, raceId);

  /* build ladder after SoS exists */
  const ladder = buildLadder(inputs);

  /* paginate ladder */
  const { visible, top } = buildPaged(
    ladder,
    page,
    pageSize
  );

  const me = battletagLower
    ? ladder.find(
        (r) => r.battletag.toLowerCase() === battletagLower
      ) ?? null
    : null;

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

/* =========================
   CACHED EXPORT
========================= */

const _getPlayerRaceLadderCached = unstable_cache(
  async (
    inputBattleTag: string | undefined,
    race: RaceKey,
    page?: number,
    pageSize?: number
  ) =>
    _getPlayerRaceLadder(
      inputBattleTag,
      race,
      page,
      pageSize
    ),
  ["w3c-player-race-ladder-v1"],
  { revalidate: 300 }
);

export async function getPlayerRaceLadder(
  inputBattleTag: string | undefined,
  race: RaceKey,
  page = 1,
  pageSize = 50
) {
  return _getPlayerRaceLadderCached(
    inputBattleTag,
    race,
    page,
    pageSize
  );
}