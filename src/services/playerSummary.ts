// src/services/playerSummary.ts

import { fetchPlayerProfile } from "@/services/w3cApi";
import { fetchJson, buildLadderLeagueUrl } from "@/lib/w3cUtils";
import { raceLabel, type RaceKey } from "@/lib/w3cRaces";
import { getCountryRaceLadder } from "@/services/countryRaceLadder";
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
import { getMatchesCached } from "@/services/matchCache";
import {
  W3C_CURRENT_SEASON,
  W3C_GATEWAY,
  W3C_GAME_MODE_1V1,
  W3C_MEMORY_CACHE_TTL_MS,
  W3C_MIN_DURATION_SECONDS,
  W3C_MIN_GAMES,
} from "@/lib/w3cConfig";

/* =====================================================
   GLOBAL CONSTANTS
===================================================== */

const GATEWAY = W3C_GATEWAY;
const GAMEMODE = W3C_GAME_MODE_1V1;

const SEASON = W3C_CURRENT_SEASON;
const SEASONS = [W3C_CURRENT_SEASON] as const;

const MIN_GAMES = W3C_MIN_GAMES;
const MIN_DURATION_SECONDS = W3C_MIN_DURATION_SECONDS;

const GLOBAL_CACHE_TTL = W3C_MEMORY_CACHE_TTL_MS;
const PLAYER_CACHE_TTL = W3C_MEMORY_CACHE_TTL_MS;
const COUNTRY_RACE_CACHE_TTL = W3C_MEMORY_CACHE_TTL_MS;

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

export type PlayerSummaryResponse = {
  summary: {
    battletag: string;
    mostPlayedThisSeason: string;
    highestCurrentRace: string | null;
    highestCurrentMMR: number | null;
    lastPlayedLadder: string | null;
    lastPlayedRace: Record<string, string>;
    top2Peaks: { race: string; mmr: number; season: number }[];
  };
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

const playerSnapshotCache = new Map<string, TimedCacheEntry<PlayerSnapshot>>();
const playerSnapshotPromiseCache = new Map<string, Promise<PlayerSnapshot | null>>();

const countryRaceCache = new Map<
  string,
  TimedCacheEntry<Awaited<ReturnType<typeof getCountryRaceLadder>>>
>();
const countryRacePromiseCache = new Map<
  string,
  Promise<Awaited<ReturnType<typeof getCountryRaceLadder>>>
>();

const countryRankCache = new Map<string, TimedCacheEntry<CountryRankResult>>();
const countryRankPromiseCache = new Map<string, Promise<CountryRankResult>>();

const rankCache = new Map<string, TimedCacheEntry<W3CRankResponse | null>>();
const rankPromiseCache = new Map<string, Promise<W3CRankResponse | null>>();

const summaryCache = new Map<string, TimedCacheEntry<PlayerSummaryResponse | null>>();
const summaryPromiseCache = new Map<string, Promise<PlayerSummaryResponse | null>>();

/* =====================================================
   HELPERS
===================================================== */

const iso2 = (v: unknown) =>
  String(v ?? "").toUpperCase().slice(0, 2);

const effectiveCountryForTag = (tag: string, country: string) =>
  (COUNTRY_OVERRIDE[tag]?.to ?? country).toUpperCase();

const toDate = (v: unknown): Date | null => {
  const n = Number(v);
  if (Number.isFinite(n)) {
    return new Date(n < 1e12 ? n * 1000 : n);
  }

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
      const safe = canonical ?? null;
      setTimedCacheValue(battletagResolveCache, key, safe);
      battletagResolvePromiseCache.delete(key);
      return safe;
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

async function getCountryRaceLadderCached(
  country: string,
  raceKey: RaceKey,
  page = 1,
  pageSize = COUNTRY_RACE_PAGE_SIZE
) {
  const key = `${country.toUpperCase()}|${raceKey}|${page}|${pageSize}`;

  const cached = getFreshCacheValue(
    countryRaceCache,
    key,
    COUNTRY_RACE_CACHE_TTL
  );
  if (cached) return cached;

  const inFlight = countryRacePromiseCache.get(key);
  if (inFlight) return inFlight;

  const promise = getCountryRaceLadder(
    country,
    raceKey,
    undefined,
    page,
    pageSize
  )
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

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    for (const team of match?.teams ?? []) {
      for (const player of team?.players ?? []) {
        if (player?.battleTag?.toLowerCase() !== lower) continue;

        const cc =
          iso2(player?.countryCode) ||
          iso2(player?.location);

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

    const countryCode = await resolveCountryFromMatches(
      canonical,
      profile,
      matches
    );

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
  rows: Array<{ battletag?: string; battleTag?: string; rank?: number }>,
  lower: string
): number | null {
  const found = rows.find((row) => {
    const tag = row?.battletag ?? row?.battleTag;
    return tag?.toLowerCase() === lower;
  });

  if (!found) return null;

  if (typeof found.rank === "number" && Number.isFinite(found.rank)) {
    return found.rank;
  }

  const idx = rows.findIndex((row) => {
    const tag = row?.battletag ?? row?.battleTag;
    return tag?.toLowerCase() === lower;
  });

  return idx === -1 ? null : idx + 1;
}

async function getCountryRaceRank(
  country: string,
  raceKey: RaceKey,
  lower: string
): Promise<CountryRankResult> {
  const cacheKey = `${country.toUpperCase()}|${raceKey}|${lower}`;

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
        buildLadderLeagueUrl(page, GATEWAY, GAMEMODE, SEASON)
      ).then((rows) => rows ?? [])
    )
  );
}

function buildGlobalSnapshotFromPages(pages: unknown[][]): GlobalSnapshot {
  const rowsByRace = new Map<SupportedRaceId, FlattenedLadderRow[]>();

  for (const raceId of RACE_IDS) {
    rowsByRace.set(raceId, []);
  }

  for (let i = 0; i < pages.length; i++) {
    const flat = flattenCountryLadder(pages[i]);

    for (let j = 0; j < flat.length; j++) {
      const row = flat[j];

      if (!row.battleTag) continue;
      if (row.games < MIN_GAMES) continue;
      if (!isSupportedRaceId(row.race)) continue;

      rowsByRace.get(row.race)?.push(row);
    }
  }

  const byRace = new Map<SupportedRaceId, GlobalRaceSnapshot>();

  for (const raceId of RACE_IDS) {
    const raceRows = rowsByRace.get(raceId) ?? [];

    const inputs: LadderInputRow[] = raceRows.map((row) => ({
      battletag: row.battleTag!,
      mmr: row.mmr,
      wins: row.wins,
      games: row.games,
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

    for (let i = 0; i < neededRaceIds.length; i++) {
      const raceId = neededRaceIds[i];
      const raceSnap = snapshot.byRace.get(raceId);
      if (!raceSnap) continue;

      const idx = raceSnap.rankByLower.get(lower);
      if (idx == null) continue;

      const playerRow = raceSnap.ladder[idx];
      if (!playerRow) continue;

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
        mmr: playerRow.mmr,
        games: playerRow.games,
      });
    }

    return {
      battletag: canonical,
      season: SEASON,
      country: effectiveCountry || countryCode || "—",
      minGames: MIN_GAMES,
      asOf: new Date().toISOString(),
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

export async function getPlayerSummary(
  inputTag: string
): Promise<PlayerSummaryResponse | null> {
  const cacheKey = inputTag.trim().toLowerCase();
  if (!cacheKey) return null;

  const cached = getFreshCacheValue(summaryCache, cacheKey, PLAYER_CACHE_TTL);
  if (cached !== null) return cached;

  const inFlight = summaryPromiseCache.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<PlayerSummaryResponse | null> => {
    const player = await getPlayerSnapshot(inputTag);
    if (!player) return null;

    const { canonical, lower } = player;

    /* ---------------------------------------------
       CURRENT LADDER DATA
    --------------------------------------------- */

    const rankData = await getW3CRank(canonical);

    const ranks = rankData?.ranks ?? [];

    const highest = ranks
      .slice()
      .sort((a, b) => b.mmr - a.mmr)[0];

    const highestCurrentRace = highest?.race ?? null;
    const highestCurrentMMR = highest?.mmr ?? null;

    /* ---------------------------------------------
       FETCH MATCHES
    --------------------------------------------- */

    const recentMatches = await getMatchesCached(
      canonical,
      [SEASON]
    );

    /* ---------------------------------------------
       MOST PLAYED (CURRENT SEASON)
    --------------------------------------------- */

    const raceGamesSeason: Record<string, number> = {};

    for (const match of recentMatches ?? []) {

      if (match?.gameMode !== GAMEMODE) continue;

      const players =
        match?.teams?.flatMap((t: any) => t.players ?? []) ?? [];

      const me = players.find(
        (p: any) => p?.battleTag?.toLowerCase() === lower
      );

      if (!me) continue;

      const race = raceLabel(me?.race) ?? "Unknown";

      if (match?.season === SEASON) {
        raceGamesSeason[race] = (raceGamesSeason[race] ?? 0) + 1;
      }
    }

    const mostPlayedThisSeason =
      Object.entries(raceGamesSeason)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

    /* ---------------------------------------------
       LAST PLAYED MATCH
    --------------------------------------------- */

    let lastPlayedLadder: Date | null = null;
    const lastPlayedRace: Record<string, Date> = {};

    for (const match of recentMatches ?? []) {

      if (match?.gameMode !== GAMEMODE) continue;

      const date = toDate(match?.startTime);
      if (!date) continue;

      if (!lastPlayedLadder || date > lastPlayedLadder) {
        lastPlayedLadder = date;
      }

      const players =
        match?.teams?.flatMap((t: any) => t.players ?? []) ?? [];

      const me = players.find(
        (p: any) => p?.battleTag?.toLowerCase() === lower
      );

      if (!me) continue;

      const race = raceLabel(me?.race) ?? "Unknown";

      if (!lastPlayedRace[race] || date > lastPlayedRace[race]) {
        lastPlayedRace[race] = date;
      }
    }

    /* ---------------------------------------------
       PEAKS
    --------------------------------------------- */

    const top2Peaks = ranks
      .map((r) => ({
        race: r.race,
        mmr: r.mmr,
        season: SEASON,
      }))
      .sort((a, b) => b.mmr - a.mmr)
      .slice(0, 2);

    /* ---------------------------------------------
       RESULT
    --------------------------------------------- */

    return {
      summary: {
        battletag: canonical,

        mostPlayedThisSeason,

        highestCurrentRace,
        highestCurrentMMR,

        lastPlayedLadder: lastPlayedLadder
          ? lastPlayedLadder.toISOString()
          : null,

        lastPlayedRace: Object.fromEntries(
          Object.entries(lastPlayedRace).map(([race, date]) => [
            race,
            date.toISOString(),
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