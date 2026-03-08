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
const SEASONS = [24] as const;

const MIN_GAMES = 5;
const MIN_DURATION_SECONDS = 120;

const GLOBAL_CACHE_TTL = 5 * 60 * 1000;
const PLAYER_CACHE_TTL = 5 * 60 * 1000;
const COUNTRY_RACE_CACHE_TTL = 5 * 60 * 1000;

const MAX_LEAGUE_PAGE = 50;
const COUNTRY_RACE_PAGE_SIZE = 50;

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

type TimedCacheEntry<T> = {
  value: T;
  fetchedAt: number;
};

type ProfileType = Awaited<ReturnType<typeof fetchPlayerProfile>>;

type PlayerSnapshot = {
  canonical: string;
  lower: string;
  profile: ProfileType;
  matches: any[];
  countryCode: string;
};

type CountryRankResult = {
  countryRank: number | null;
  countryTotal: number | null;
};

/* =====================================================
   MODULE CACHE
===================================================== */

let cachedGlobalSnapshot: GlobalSnapshot | null = null;
let globalSnapshotFetchedAt = 0;
let globalSnapshotPromise: Promise<GlobalSnapshot> | null = null;

const battletagResolveCache = new Map<string, TimedCacheEntry<string | null>>();
const battletagResolvePromiseCache = new Map<string, Promise<string | null>>();

const profileCache = new Map<string, TimedCacheEntry<ProfileType>>();
const profilePromiseCache = new Map<string, Promise<ProfileType>>();

const matchesCache = new Map<string, TimedCacheEntry<any[]>>();
const matchesPromiseCache = new Map<string, Promise<any[]>>();

const playerSnapshotCache = new Map<string, TimedCacheEntry<PlayerSnapshot>>();
const playerSnapshotPromiseCache = new Map<string, Promise<PlayerSnapshot | null>>();

const countryRaceCache = new Map<string, TimedCacheEntry<any>>();
const countryRacePromiseCache = new Map<string, Promise<any>>();

const countryRankCache = new Map<string, TimedCacheEntry<CountryRankResult>>();
const countryRankPromiseCache = new Map<string, Promise<CountryRankResult>>();

const rankCache = new Map<string, TimedCacheEntry<W3CRankResponse | null>>();
const rankPromiseCache = new Map<string, Promise<W3CRankResponse | null>>();

const summaryCache = new Map<string, TimedCacheEntry<any>>();
const summaryPromiseCache = new Map<string, Promise<any>>();

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

function getFreshCacheValue<T>(
  map: Map<string, TimedCacheEntry<T>>,
  key: string,
  ttl: number
): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt >= ttl) return null;
  return hit.value;
}

function setTimedCacheValue<T>(
  map: Map<string, TimedCacheEntry<T>>,
  key: string,
  value: T
) {
  map.set(key, {
    value,
    fetchedAt: Date.now(),
  });
}

function seasonsKey(seasons: readonly number[]) {
  return [...seasons].sort((a, b) => a - b).join(",");
}

async function getCanonicalBattletag(inputTag: string): Promise<string | null> {
  const key = inputTag.trim().toLowerCase();
  if (!key) return null;

  const cached = getFreshCacheValue(
    battletagResolveCache,
    key,
    PLAYER_CACHE_TTL
  );
  if (cached !== null) return cached;

  const inFlight = battletagResolvePromiseCache.get(key);
  if (inFlight) return inFlight;

  const promise = resolveBattleTagViaSearch(inputTag)
    .then((canonical) => {
      setTimedCacheValue(battletagResolveCache, key, canonical ?? null);
      battletagResolvePromiseCache.delete(key);
      return canonical ?? null;
    })
    .catch((err) => {
      battletagResolvePromiseCache.delete(key);
      throw err;
    });

  battletagResolvePromiseCache.set(key, promise);
  return promise;
}

async function getPlayerProfileCached(canonical: string): Promise<ProfileType> {
  const key = canonical.toLowerCase();

  const cached = getFreshCacheValue(profileCache, key, PLAYER_CACHE_TTL);
  if (cached) return cached;

  const inFlight = profilePromiseCache.get(key);
  if (inFlight) return inFlight;

  const promise = fetchPlayerProfile(canonical)
    .then((profile) => {
      setTimedCacheValue(profileCache, key, profile);
      profilePromiseCache.delete(key);
      return profile;
    })
    .catch((err) => {
      profilePromiseCache.delete(key);
      throw err;
    });

  profilePromiseCache.set(key, promise);
  return promise;
}

async function getMatchesCached(
  canonical: string,
  seasons: readonly number[]
): Promise<any[]> {
  const key = `${canonical.toLowerCase()}|${seasonsKey(seasons)}`;

  const cached = getFreshCacheValue(matchesCache, key, PLAYER_CACHE_TTL);
  if (cached) return cached;

  const inFlight = matchesPromiseCache.get(key);
  if (inFlight) return inFlight;

  const promise = fetchAllMatches(canonical, [...seasons])
    .then((matches) => {
      const safe = matches ?? [];
      setTimedCacheValue(matchesCache, key, safe);
      matchesPromiseCache.delete(key);
      return safe;
    })
    .catch((err) => {
      matchesPromiseCache.delete(key);
      throw err;
    });

  matchesPromiseCache.set(key, promise);
  return promise;
}

async function getCountryRaceLadderCached(
  country: string,
  raceKey: RaceKey,
  page = 1,
  pageSize = COUNTRY_RACE_PAGE_SIZE
) {
  const key = `${country}|${raceKey}|${page}|${pageSize}`;

  const cached = getFreshCacheValue(
    countryRaceCache,
    key,
    COUNTRY_RACE_CACHE_TTL
  );
  if (cached) return cached;

  const inFlight = countryRacePromiseCache.get(key);
  if (inFlight) return inFlight;

  const promise = getCountryRaceLadder(country, raceKey, undefined, page, pageSize)
    .then((data) => {
      setTimedCacheValue(countryRaceCache, key, data);
      countryRacePromiseCache.delete(key);
      return data;
    })
    .catch((err) => {
      countryRacePromiseCache.delete(key);
      throw err;
    });

  countryRacePromiseCache.set(key, promise);
  return promise;
}

async function resolveCountryFromMatches(
  canonical: string,
  profile: ProfileType,
  matches: any[]
): Promise<string> {
  const fromProfile =
    iso2(profile?.countryCode) ||
    iso2(profile?.location) ||
    "";

  if (fromProfile) return fromProfile;

  const lower = canonical.toLowerCase();

  for (const m of matches) {
    for (const t of m?.teams ?? []) {
      for (const p of t?.players ?? []) {
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

async function getPlayerSnapshot(
  inputTag: string
): Promise<PlayerSnapshot | null> {
  const cacheKey = inputTag.trim().toLowerCase();
  if (!cacheKey) return null;

  const cached = getFreshCacheValue(
    playerSnapshotCache,
    cacheKey,
    PLAYER_CACHE_TTL
  );
  if (cached) return cached;

  const inFlight = playerSnapshotPromiseCache.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<PlayerSnapshot | null> => {
    const canonical = await getCanonicalBattletag(inputTag);
    if (!canonical) return null;

    const lower = canonical.toLowerCase();

    const [profile, matches] = await Promise.all([
      getPlayerProfileCached(canonical),
      getMatchesCached(canonical, SEASONS),
    ]);

    const countryCode = await resolveCountryFromMatches(canonical, profile, matches);

    const snapshot: PlayerSnapshot = {
      canonical,
      lower,
      profile,
      matches,
      countryCode,
    };

    setTimedCacheValue(playerSnapshotCache, cacheKey, snapshot);
    return snapshot;
  })()
    .then((snapshot) => {
      playerSnapshotPromiseCache.delete(cacheKey);
      return snapshot;
    })
    .catch((err) => {
      playerSnapshotPromiseCache.delete(cacheKey);
      throw err;
    });

  playerSnapshotPromiseCache.set(cacheKey, promise);
  return promise;
}

function getPlayerRankFromRows(
  rows: any[],
  lower: string
): number | null {
  const found = rows.find(
    (p: { battletag?: string; battleTag?: string; rank?: number }) => {
      const tag = p?.battletag ?? p?.battleTag;
      return tag?.toLowerCase() === lower;
    }
  );

  if (!found) return null;

  if (typeof found.rank === "number" && Number.isFinite(found.rank)) {
    return found.rank;
  }

  const idx = rows.findIndex(
    (p: { battletag?: string; battleTag?: string }) => {
      const tag = p?.battletag ?? p?.battleTag;
      return tag?.toLowerCase() === lower;
    }
  );

  return idx === -1 ? null : idx + 1;
}

async function getCountryRaceRank(
  country: string,
  raceKey: RaceKey,
  lower: string
): Promise<CountryRankResult> {
  const cacheKey = `${country}|${raceKey}|${lower}`;

  const cached = getFreshCacheValue(
    countryRankCache,
    cacheKey,
    COUNTRY_RACE_CACHE_TTL
  );
  if (cached) return cached;

  const inFlight = countryRankPromiseCache.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<CountryRankResult> => {
    const firstPage = await getCountryRaceLadderCached(
      country,
      raceKey,
      1,
      COUNTRY_RACE_PAGE_SIZE
    );

    const firstRows = Array.isArray(firstPage?.full) ? firstPage.full : [];
    const poolSize =
      typeof firstPage?.poolSize === "number" ? firstPage.poolSize : null;

    const rankOnFirstPage = getPlayerRankFromRows(firstRows, lower);
    if (rankOnFirstPage != null) {
      return {
        countryRank: rankOnFirstPage,
        countryTotal: poolSize,
      };
    }

    if (poolSize == null || poolSize <= firstRows.length) {
      return {
        countryRank: null,
        countryTotal: poolSize,
      };
    }

    const totalPages = Math.ceil(poolSize / COUNTRY_RACE_PAGE_SIZE);

    for (let page = 2; page <= totalPages; page++) {
      const data = await getCountryRaceLadderCached(
        country,
        raceKey,
        page,
        COUNTRY_RACE_PAGE_SIZE
      );

      const rows = Array.isArray(data?.full) ? data.full : [];
      const rank = getPlayerRankFromRows(rows, lower);

      if (rank != null) {
        return {
          countryRank: rank,
          countryTotal: poolSize,
        };
      }
    }

    return {
      countryRank: null,
      countryTotal: poolSize,
    };
  })()
    .then((result) => {
      setTimedCacheValue(countryRankCache, cacheKey, result);
      countryRankPromiseCache.delete(cacheKey);
      return result;
    })
    .catch((err) => {
      countryRankPromiseCache.delete(cacheKey);
      throw err;
    });

  countryRankPromiseCache.set(cacheKey, promise);
  return promise;
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

      rowsByRace.get(row.race)?.push(row);
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
   PUBLIC — getW3CRank
===================================================== */

export async function getW3CRank(
  inputTag: string
): Promise<W3CRankResponse | null> {
  const cacheKey = inputTag.trim().toLowerCase();
  if (!cacheKey) return null;

  const cached = getFreshCacheValue(rankCache, cacheKey, PLAYER_CACHE_TTL);
  if (cached !== null) return cached;

  const inFlight = rankPromiseCache.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<W3CRankResponse | null> => {
    const [player, snapshot] = await Promise.all([
      getPlayerSnapshot(inputTag),
      getGlobalSnapshot(),
    ]);

    if (!player) return null;

    const { canonical, lower, countryCode } = player;

    const effectiveCountry = countryCode
      ? effectiveCountryForTag(canonical, countryCode)
      : "";

    const neededRaceIds = RACE_IDS.filter((raceId) => {
      const raceSnap = snapshot.byRace.get(raceId);
      return !!raceSnap?.rankByLower.has(lower);
    });

    const countryRankResults = new Map<RaceKey, CountryRankResult>();

    if (effectiveCountry && neededRaceIds.length) {
      const neededRaceKeys = Array.from(
        new Set(neededRaceIds.map((raceId) => RACE_KEY_MAP[raceId]))
      );

      const results = await Promise.all(
        neededRaceKeys.map((raceKey) =>
          getCountryRaceRank(effectiveCountry, raceKey, lower)
        )
      );

      for (let i = 0; i < neededRaceKeys.length; i++) {
        countryRankResults.set(neededRaceKeys[i], results[i]);
      }
    }

    const ranks: RankRow[] = [];

    for (const raceId of neededRaceIds) {
      const raceSnap = snapshot.byRace.get(raceId);
      if (!raceSnap) continue;

      const idx = raceSnap.rankByLower.get(lower);
      if (idx == null) continue;

      const p = raceSnap.ladder[idx];
      if (!p) continue;

      const countryInfo = effectiveCountry
        ? countryRankResults.get(RACE_KEY_MAP[raceId])
        : null;

      ranks.push({
        race: RACE_MAP[raceId],
        raceId,
        globalRank: idx + 1,
        globalTotal: raceSnap.ladder.length,
        countryRank: countryInfo?.countryRank ?? null,
        countryTotal: countryInfo?.countryTotal ?? null,
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
  })()
    .then((result) => {
      setTimedCacheValue(rankCache, cacheKey, result);
      rankPromiseCache.delete(cacheKey);
      return result;
    })
    .catch((err) => {
      rankPromiseCache.delete(cacheKey);
      throw err;
    });

  rankPromiseCache.set(cacheKey, promise);
  return promise;
}

/* =====================================================
   SUMMARY SERVICE
===================================================== */

export async function getPlayerSummary(inputTag: string) {
  const cacheKey = inputTag.trim().toLowerCase();
  if (!cacheKey) return null;

  const cached = getFreshCacheValue(summaryCache, cacheKey, PLAYER_CACHE_TTL);
  if (cached !== null) return cached;

  const inFlight = summaryPromiseCache.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const player = await getPlayerSnapshot(inputTag);
    if (!player) return null;

    const { canonical, lower, matches } = player;

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
      if (m?.gameMode !== GAMEMODE) continue;
      if ((m?.durationInSeconds ?? 0) < MIN_DURATION_SECONDS) continue;

      const date = toDate(m?.startTime);
      if (!date) continue;

      const players =
        m?.teams?.flatMap((t: { players?: any[] }) => t.players ?? []) ?? [];

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

      if (m?.season === SEASON) {
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
  })()
    .then((result) => {
      setTimedCacheValue(summaryCache, cacheKey, result);
      summaryPromiseCache.delete(cacheKey);
      return result;
    })
    .catch((err) => {
      summaryPromiseCache.delete(cacheKey);
      throw err;
    });

  summaryPromiseCache.set(cacheKey, promise);
  return promise;
}