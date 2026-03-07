// src/services/playerSummary.ts

import { fetchPlayerProfile } from "@/services/w3cApi";
import { fetchAllMatches, fetchJson } from "@/lib/w3cUtils";
import { raceLabel } from "@/lib/w3cRaces";
import {
  getCountryRaceLadder,
  type RaceKey,
} from "@/services/countryRaceLadder";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import {
  flattenCountryLadder,
  type FlattenedLadderRow,
} from "@/lib/ranking";
import {
  buildLadder,
  type LadderInputRow,
} from "@/lib/ladderEngine";
import { COUNTRY_OVERRIDE } from "@/lib/countryOverrides";

/* =====================================================
   GLOBAL CONSTANTS
===================================================== */

const GATEWAY = 20;
const GAMEMODE = 1;

const SEASON = 24;
const SEASONS = [23, 24];

const MIN_GAMES = 5;
const MIN_DURATION_SECONDS = 120;

const GLOBAL_CACHE_TTL = 5 * 60 * 1000;
const MAX_LEAGUE_PAGE = 50;

/* =====================================================
   RACE MAPS
===================================================== */

const RACE_IDS = [1, 2, 4, 8, 0] as const;
type SupportedRaceId = (typeof RACE_IDS)[number];

const RACE_MAP: Record<SupportedRaceId, string> = {
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
  0: "Random",
};

const RACE_KEY_MAP: Record<SupportedRaceId, RaceKey> = {
  1: "human",
  2: "orc",
  4: "elf",
  8: "undead",
  0: "random",
};

/* =====================================================
   TYPES
===================================================== */

type RankRow = {
  race: string;
  raceId: number;
  globalRank: number;
  globalTotal: number;
  countryRank: number | null;
  countryTotal: number | null;
  mmr: number;
  games: number;
};

export type W3CRankResponse = {
  battletag: string;
  season: number;
  country: string;
  minGames: number;
  asOf: string;
  ranks: RankRow[];
};

type LadderPlayer = ReturnType<typeof buildLadder>[number];

type GlobalRaceSnapshot = {
  ladder: LadderPlayer[];
  rankByLower: Map<string, number>;
};

type GlobalSnapshot = {
  byRace: Map<SupportedRaceId, GlobalRaceSnapshot>;
};

/* =====================================================
   MODULE CACHE
===================================================== */

let cachedGlobalSnapshot: GlobalSnapshot | null = null;
let globalSnapshotFetchedAt = 0;
let globalSnapshotPromise: Promise<GlobalSnapshot> | null = null;

/* =====================================================
   HELPERS
===================================================== */

const iso2 = (v: unknown) =>
  String(v ?? "").toUpperCase().slice(0, 2);

const effectiveCountryForTag = (tag: string, country: string) =>
  (COUNTRY_OVERRIDE[tag]?.to ?? country).toUpperCase();

const toDate = (v: unknown): Date | null => {
  const n = Number(v);
  if (Number.isFinite(n)) return new Date(n < 1e12 ? n * 1000 : n);

  const d = new Date(String(v ?? ""));
  return Number.isFinite(d.getTime()) ? d : null;
};

const toNumber = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

function isSupportedRaceId(v: number): v is SupportedRaceId {
  return RACE_IDS.includes(v as SupportedRaceId);
}

/* =====================================================
   GLOBAL LADDER SNAPSHOT
===================================================== */

async function fetchGlobalPages(): Promise<unknown[][]> {
  return Promise.all(
    Array.from({ length: MAX_LEAGUE_PAGE + 1 }, (_, page) =>
      fetchJson<unknown[]>(
        `https://website-backend.w3champions.com/api/ladder/${page}?gateWay=${GATEWAY}&gameMode=${GAMEMODE}&season=${SEASON}`
      ).then((rows) => rows ?? [])
    )
  );
}

function buildGlobalSnapshotFromPages(pages: unknown[][]): GlobalSnapshot {
  const rowsByRace = new Map<SupportedRaceId, FlattenedLadderRow[]>();

  for (const raceId of RACE_IDS) {
    rowsByRace.set(raceId, []);
  }

  for (const raw of pages) {
    const flat = flattenCountryLadder(raw);

    for (const row of flat) {
      if (!row.battleTag) continue;
      if (row.games < MIN_GAMES) continue;
      if (!isSupportedRaceId(row.race)) continue;

      rowsByRace.get(row.race)!.push(row);
    }
  }

  const byRace = new Map<SupportedRaceId, GlobalRaceSnapshot>();

  for (const raceId of RACE_IDS) {
    const raceRows = rowsByRace.get(raceId) ?? [];

    const inputs: LadderInputRow[] = raceRows.map((r) => ({
      battletag: r.battleTag!,
      mmr: r.mmr,
      wins: r.wins,
      games: r.games,
      sos: null,
    }));

    const ladder = buildLadder(inputs);
    const rankByLower = new Map<string, number>();

    for (let i = 0; i < ladder.length; i++) {
      rankByLower.set(ladder[i].battletag.toLowerCase(), i);
    }

    byRace.set(raceId, {
      ladder,
      rankByLower,
    });
  }

  return { byRace };
}

async function getGlobalSnapshot(): Promise<GlobalSnapshot> {
  const now = Date.now();

  if (
    cachedGlobalSnapshot &&
    now - globalSnapshotFetchedAt < GLOBAL_CACHE_TTL
  ) {
    return cachedGlobalSnapshot;
  }

  if (globalSnapshotPromise) {
    return globalSnapshotPromise;
  }

  globalSnapshotPromise = (async () => {
    const pages = await fetchGlobalPages();
    const snapshot = buildGlobalSnapshotFromPages(pages);

    cachedGlobalSnapshot = snapshot;
    globalSnapshotFetchedAt = Date.now();
    globalSnapshotPromise = null;

    return snapshot;
  })().catch((err) => {
    globalSnapshotPromise = null;
    throw err;
  });

  return globalSnapshotPromise;
}

/* =====================================================
   COUNTRY RESOLUTION
===================================================== */

async function resolveCountryCode(
  canonical: string,
  profile: Awaited<ReturnType<typeof fetchPlayerProfile>>
): Promise<string> {
  const fromProfile =
    iso2(profile?.countryCode) ||
    iso2(profile?.location) ||
    "";

  if (fromProfile) return fromProfile;

  const lower = canonical.toLowerCase();
  const seasonMatches = await fetchAllMatches(canonical, [SEASON]);

  for (const m of seasonMatches) {
    for (const t of m?.teams ?? []) {
      for (const p of t.players ?? []) {
        if (p?.battleTag?.toLowerCase() !== lower) continue;

        const cc =
          iso2(p?.countryCode) ||
          iso2(p?.location);

        if (cc) return cc;
      }
    }
  }

  return "";
}

/* =====================================================
   PUBLIC — getW3CRank
===================================================== */

export async function getW3CRank(
  inputTag: string
): Promise<W3CRankResponse | null> {
  if (!inputTag) return null;

  const canonical = await resolveBattleTagViaSearch(inputTag);
  if (!canonical) return null;

  const lower = canonical.toLowerCase();

  const [profile, snapshot] = await Promise.all([
    fetchPlayerProfile(canonical),
    getGlobalSnapshot(),
  ]);

  const countryCode = await resolveCountryCode(canonical, profile);

  const effectiveCountry = countryCode
    ? effectiveCountryForTag(canonical, countryCode)
    : "";

  const countryRacePromises = new Map<RaceKey, Promise<any>>();

  if (effectiveCountry) {
    for (const raceId of RACE_IDS) {
      const raceSnap = snapshot.byRace.get(raceId);
      if (!raceSnap) continue;
      if (!raceSnap.rankByLower.has(lower)) continue;

      const raceKey = RACE_KEY_MAP[raceId];
      if (!countryRacePromises.has(raceKey)) {
        countryRacePromises.set(
          raceKey,
          getCountryRaceLadder(
            effectiveCountry,
            raceKey,
            undefined,
            1,
            50
          )
        );
      }
    }
  }

  const ranks: RankRow[] = [];

  for (const raceId of RACE_IDS) {
    const raceSnap = snapshot.byRace.get(raceId);
    if (!raceSnap) continue;

    const idx = raceSnap.rankByLower.get(lower);
    if (idx == null) continue;

    let countryRank: number | null = null;
    let countryTotal: number | null = null;

    if (effectiveCountry) {
      const ladderData = await countryRacePromises.get(RACE_KEY_MAP[raceId]);

      if (ladderData) {
        countryTotal = ladderData.poolSize ?? null;

        const i = Array.isArray(ladderData.full)
          ? ladderData.full.findIndex(
              (p: { battletag?: string }) =>
                p.battletag?.toLowerCase() === lower
            )
          : -1;

        countryRank = i === -1 ? null : i + 1;
      }
    }

    const p = raceSnap.ladder[idx];

    ranks.push({
      race: RACE_MAP[raceId],
      raceId,
      globalRank: idx + 1,
      globalTotal: raceSnap.ladder.length,
      countryRank,
      countryTotal,
      mmr: p.mmr,
      games: p.games,
    });
  }

  return {
    battletag: canonical,
    season: SEASON,
    country: effectiveCountry || countryCode || "—",
    minGames: MIN_GAMES,
    asOf: new Date().toLocaleString(),
    ranks,
  };
}

/* =====================================================
   SUMMARY SERVICE
===================================================== */

export async function getPlayerSummary(inputTag: string) {
  const canonical = await resolveBattleTagViaSearch(inputTag);
  if (!canonical) return null;

  const lower = canonical.toLowerCase();
  const matches = await fetchAllMatches(canonical, SEASONS);

  if (!matches.length) {
    return {
      summary: {
        battletag: canonical,
        mostPlayedAllTime: "Unknown",
        mostPlayedThisSeason: "Unknown",
        highestCurrentRace: null,
        highestCurrentMMR: null,
        lastPlayedLadder: null,
        lastPlayedRace: {},
        top2Peaks: [],
      },
    };
  }

  const raceGamesAll: Record<string, number> = {};
  const raceGamesSeason: Record<string, number> = {};
  const lastPlayedRace: Record<string, Date> = {};

  const raceMMR: Record<string, number> = {};
  const raceMMRAt: Record<string, number> = {};
  const peaks: Record<string, { race: string; mmr: number; season: number }> =
    {};

  let lastPlayedLadder: Date | null = null;

  for (const m of matches) {
    if (m.gameMode !== GAMEMODE) continue;
    if (m.durationInSeconds < MIN_DURATION_SECONDS) continue;

    const date = toDate(m.startTime);
    if (!date) continue;

    const players =
      m.teams?.flatMap((t: { players?: any[] }) => t.players ?? []) ?? [];

    const me = players.find(
      (p: { battleTag?: string }) =>
        p?.battleTag?.toLowerCase() === lower
    );

    if (!me) continue;

    const race = raceLabel(me?.race) ?? "Unknown";

    raceGamesAll[race] = (raceGamesAll[race] || 0) + 1;

    if (!lastPlayedRace[race] || date > lastPlayedRace[race]) {
      lastPlayedRace[race] = date;
    }

    if (!lastPlayedLadder || date > lastPlayedLadder) {
      lastPlayedLadder = date;
    }

    if (m.season === SEASON) {
      raceGamesSeason[race] = (raceGamesSeason[race] || 0) + 1;

      const mmr =
        toNumber(me?.newMmr) ??
        toNumber(me?.currentMmr) ??
        toNumber(me?.oldMmr);

      if (mmr != null) {
        const t = date.getTime();
        if (t >= (raceMMRAt[race] ?? -1)) {
          raceMMRAt[race] = t;
          raceMMR[race] = mmr;
        }
      }
    }

    const currentMmr = toNumber(me?.currentMmr);
    if (currentMmr != null) {
      if (!peaks[race] || currentMmr > peaks[race].mmr) {
        peaks[race] = {
          race,
          mmr: currentMmr,
          season: m.season,
        };
      }
    }
  }

  const mostPlayedAllTime =
    Object.entries(raceGamesAll).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Unknown";

  const mostPlayedThisSeason =
    Object.entries(raceGamesSeason).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Unknown";

  const highest =
    Object.entries(raceMMR).sort((a, b) => b[1] - a[1])[0];

  const highestRace = highest?.[0] ?? null;

  const top2Peaks = Object.values(peaks)
    .sort((a, b) => b.mmr - a.mmr)
    .slice(0, 2);

  return {
    summary: {
      battletag: canonical,
      mostPlayedAllTime,
      mostPlayedThisSeason,
      highestCurrentRace: highestRace,
      highestCurrentMMR: highestRace
        ? raceMMR[highestRace] ?? null
        : null,
      lastPlayedLadder: lastPlayedLadder?.toISOString() ?? null,
      lastPlayedRace: Object.fromEntries(
        Object.entries(lastPlayedRace).map(([k, v]) => [
          k,
          v.toISOString(),
        ])
      ),
      top2Peaks,
    },
  };
}