// src/services/playerLadder.ts

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

export type PlayerLadderResponse = {
  battletag: string;
  me: LadderRow | null;
  top: LadderRow[];
  poolSize: number;
  full: LadderRow[];
  updatedAtUtc: string;
};

/* =========================
   CORE
========================= */

async function _getPlayerLadder(
  inputBattleTag?: string,
  page = 1,
  pageSize = 50
): Promise<PlayerLadderResponse | null> {
  const battletag = inputBattleTag
    ? await resolveBattleTagViaSearch(inputBattleTag)
    : null;

  const battletagLower = battletag?.toLowerCase();

  const rows = await fetchAllLeagues();
  const inputs = buildInputs(rows);

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

  await computeSoS(pageInputs);

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
    me,
    top,
    poolSize: baseline.length,
    full: updatedVisible,
    updatedAtUtc: new Date().toISOString(),
  };
}

/* =========================
   EXPORT
========================= */

export async function getPlayerLadder(
  inputBattleTag?: string,
  page = 1,
  pageSize = 50
) {
  return _getPlayerLadder(inputBattleTag, page, pageSize);
}