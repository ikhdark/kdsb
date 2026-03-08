// src/services/playerRaceLadder.ts

import { unstable_cache } from "next/cache";

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

import {
  buildInputs,
  buildPaged,
  computeSoS,
  fetchAllLeagues,
} from "@/services/ladderCore";

import {
  buildLadder,
  type LadderInputRow,
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

  const raceRows: any[] = [];
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    if (row.race === raceId) raceRows.push(row);
  }

  const inputs = buildInputs(raceRows);
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

  if (battletagLower) {
    for (let i = 0; i < updatedVisible.length; i++) {
      const row = updatedVisible[i];

      if (row.battletag.toLowerCase() === battletagLower) {
        me = row;
        break;
      }
    }

    if (!me) {
      for (let i = 0; i < baseline.length; i++) {
        const row = baseline[i];

        if (row.battletag.toLowerCase() === battletagLower) {
          me = row;
          break;
        }
      }
    }
  }

  return {
    battletag: battletag ?? "",
    race,
    me,
    top,
    poolSize: baseline.length,
    full: updatedVisible,
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
  ) => _getPlayerRaceLadder(inputBattleTag, race, page, pageSize),
  ["w3c-player-race-ladder-v2"],
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