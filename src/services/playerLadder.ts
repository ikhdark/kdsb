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

export type PlayerLadderResponse = {
  battletag: string;
  me: LadderRow | null;
  top: LadderRow[];
  poolSize: number;
  full: LadderRow[];
  updatedAtUtc: string;
};

/* =========================
   SERVICE
========================= */

export async function getPlayerLadder(
  inputBattleTag?: string,
  page = 1,
  pageSize = 50
): Promise<PlayerLadderResponse | null> {
  /* ---------------------------
     canonical battletag
  --------------------------- */

  const battletag = inputBattleTag
    ? await resolveBattleTagViaSearch(inputBattleTag)
    : null;

  /* ---------------------------
     fetch
  --------------------------- */

  const rows = await fetchAllLeagues();

  /* ---------------------------
     build ladder
  --------------------------- */

  const inputs = buildInputs(rows);

  const { ladder, visible, top } =
    buildPaged(inputs, page, pageSize);

  /* ---------------------------
     SoS (page only)
  --------------------------- */

  await computeSoS(visible);

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
    me,
    top,
    poolSize: ladder.length,
    full: visible,
    updatedAtUtc: new Date().toISOString(),
  };
}
