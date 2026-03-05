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

export type PlayerLadderResponse = {
  battletag: string;
  me: LadderRow | null;
  top: LadderRow[];
  poolSize: number;
  full: LadderRow[];
  updatedAtUtc: string;
};

/* =========================
   CORE (UNCACHED)
========================= */

async function _getPlayerLadder(
  inputBattleTag?: string,
  page = 1,
  pageSize = 50
): Promise<PlayerLadderResponse | null> {

  const battletag = inputBattleTag
    ? await resolveBattleTagViaSearch(inputBattleTag)
    : null;

  const rows = await fetchAllLeagues();

  const inputs = buildInputs(rows);

  /* baseline ladder (MMR only) */
  const ladder = buildLadder(inputs);

  const { visible, top } =
    buildPaged(ladder, page, pageSize);

  /* compute SoS only for visible players */
  await computeSoS(visible as any);

  /* rebuild visible rows with SoS */
  const updatedVisible = buildLadder(
    visible.map((p) => ({
      battletag: p.battletag,
      mmr: p.mmr,
      wins: p.wins,
      games: p.games,
      sos: p.sos,
    }))
  );

  const me = battletag
    ? ladder.find(
        (r) =>
          r.battletag.toLowerCase() ===
          battletag.toLowerCase()
      ) ?? null
    : null;

  return {
    battletag: battletag ?? "",
    me,
    top,
    poolSize: ladder.length,
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
  return _getPlayerLadder(
    inputBattleTag,
    page,
    pageSize
  );
}