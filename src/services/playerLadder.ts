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
  type LadderInputRow,
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

  /* baseline ladder (MMR only) */

  const ladder = buildLadder(inputs);

  const { visible, top } = buildPaged(
    ladder,
    page,
    pageSize
  );

  /* compute SoS only for visible players */

  await computeSoS(visible);

  /* rebuild visible rows with SoS */

  const pageInputs: LadderInputRow[] = new Array(visible.length);

  for (let i = 0; i < visible.length; i++) {

    const p = visible[i];

    pageInputs[i] = {
      battletag: p.battletag,
      mmr: p.mmr,
      wins: p.wins,
      games: p.games,
      sos: p.sos,
    };
  }

  const updatedVisible = buildLadder(pageInputs);

  let me: LadderRow | null = null;

  if (battletagLower) {

    for (let i = 0; i < ladder.length; i++) {

      const r = ladder[i];

      if (r.battletag.toLowerCase() === battletagLower) {
        me = r;
        break;
      }
    }
  }

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