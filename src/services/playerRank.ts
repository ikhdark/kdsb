import {
  fetchPlayerProfile,
  fetchCountryLadder,
} from "../services/w3cApi";

import {
  RACE_MAP,
  flattenCountryLadder,
  rankByMMR,
} from "../lib/ranking";

/* -------------------- CONSTANTS -------------------- */

const GATEWAY = 20;
const GAMEMODE = 1;
const SEASON = 23;
const MAX_LEAGUE_PAGE = 76;
const MIN_GAMES = 25;

/* -------------------- GLOBAL LADDER CACHE -------------------- */

let cachedGlobalRows: Map<number, any[]> | null = null;
let lastFetchTime = 0;
const GLOBAL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchGlobalRows(): Promise<Map<number, any[]>> {
  const now = Date.now();

  // Serve from cache
  if (cachedGlobalRows && now - lastFetchTime < GLOBAL_CACHE_TTL) {
    return cachedGlobalRows;
  }

  const requests: Promise<any[]>[] = [];

  for (let page = 0; page <= MAX_LEAGUE_PAGE; page++) {
    const url =
      `https://website-backend.w3champions.com/api/ladder/${page}` +
      `?gateWay=${GATEWAY}&gameMode=${GAMEMODE}&season=${SEASON}`;

    requests.push(
      fetch(url)
        .then(r => (r.ok ? r.json() : []))
        .catch(() => [])
    );
  }

  const pages = await Promise.all(requests);
  const rowsByPage = new Map<number, any[]>();

  pages.forEach((rows, page) => {
    if (Array.isArray(rows)) {
      rowsByPage.set(page, rows);
    }
  });

  cachedGlobalRows = rowsByPage;
  lastFetchTime = now;

  return rowsByPage;
}

/* -------------------- SERVICE -------------------- */

export async function getW3CRank(
  inputTag: string
): Promise<{ result: string } | null> {
  let profile = await fetchPlayerProfile(inputTag);

  // Case-normalized retry
  if (!profile && inputTag.includes("#")) {
    const [name, id] = inputTag.split("#");
    profile = await fetchPlayerProfile(`${name.toLowerCase()}#${id}`);
  }

  if (!profile) return null;

  const canonicalTag =
    profile.battleTag || profile.playerId || inputTag;

  const canonicalLower = canonicalTag.toLowerCase();
  const playerIdLower: string | null = profile.playerId
    ? profile.playerId.toLowerCase()
    : null;

  const country =
    profile.countryCode?.toUpperCase() ||
    profile.location?.toUpperCase() ||
    "UNK";

  const [rowsByPage, countryPayload] = await Promise.all([
    fetchGlobalRows(),
    fetchCountryLadder(country, GATEWAY, GAMEMODE, SEASON),
  ]);

  const countryRows = countryPayload
    ? flattenCountryLadder(countryPayload)
    : [];

  /* -------------------- PRE-BUILD GLOBAL POOLS -------------------- */

  const globalPools: Record<
    number,
    {
      id: string;
      mmr: number;
      games: number;
      winPct: number;
    }[]
  > = {};

  for (const raceId of Object.keys(RACE_MAP)) {
    globalPools[Number(raceId)] = [];
  }

  for (const rows of rowsByPage.values()) {
    for (const e of rows) {
      if (
        e.player?.games >= MIN_GAMES &&
        e.player1Id &&
        globalPools[e.race]
      ) {
        const games = e.player.games;
        const wins = e.player.wins ?? e.player.won ?? 0;

        globalPools[e.race].push({
          id: String(e.player1Id).toLowerCase(),
          mmr: Math.round(e.player.mmr ?? 0),
          games,
          winPct: games ? wins / games : 0,
        });
      }
    }
  }

  for (const pool of Object.values(globalPools)) {
    pool.sort((a, b) =>
      b.mmr !== a.mmr
        ? b.mmr - a.mmr
        : b.winPct !== a.winPct
        ? b.winPct - a.winPct
        : b.games - a.games
    );
  }

  /* -------------------- OUTPUT -------------------- */

  let output =
    `📊 ${canonicalTag} — 1v1 Race Rank by MMR (Season ${SEASON})\n\n` +
    `— Min ${MIN_GAMES} Games —\n\n`;

  output += `As of: ${new Date().toLocaleString()}\n\n`;

  let foundAny = false;

  for (const [raceIdStr, raceName] of Object.entries(RACE_MAP)) {
    const raceId = Number(raceIdStr);
    const pool = globalPools[raceId];

    const idx = pool.findIndex(
      p =>
        p.id === canonicalLower ||
        (playerIdLower && p.id === playerIdLower)
    );

    if (idx === -1) continue;

    const globalRes = {
      rank: idx + 1,
      total: pool.length,
      mmr: pool[idx].mmr,
      games: pool[idx].games,
    };

    const countryRes = rankByMMR(
      countryRows,
      canonicalLower,
      raceId,
      MIN_GAMES,
      playerIdLower
    );

    foundAny = true;

    output +=
      `${raceName} — ` +
      `#${globalRes.rank}/${globalRes.total} globally` +
      (countryRes
        ? ` | #${countryRes.rank} in ${country} (of ${countryRes.total})`
        : "") +
      ` — ${globalRes.mmr} MMR, ${globalRes.games} games\n`;
  }

  if (!foundAny) {
    output += "_No ranked ladder data found._";
  }

  return { result: output };
}
