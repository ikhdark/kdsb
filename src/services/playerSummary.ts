import { fetchAllMatches, resolveEffectiveRace } from "../lib/w3cUtils";
import { resolveBattleTagViaSearch } from "../lib/w3cBattleTagResolver";

/* -------------------- CONSTANTS -------------------- */

const SEASONS = [21, 22, 23, 24];
const CURRENT_SEASON = 24;
const LAST_3_SEASONS = new Set([22, 23, 24]);

const MIN_DURATION_SECONDS = 120;
const MAX_EXTREME_ABS_MMR_CHANGE = 30;
const HIGH_GAIN_THRESHOLD = 15;

/* -------------------- MATCH CACHE -------------------- */

const MATCH_CACHE_TTL = 5 * 60 * 1000;

const matchCache = new Map<
  string,
  { time: number; matches: any[] }
>();

async function fetchMatchesCached(tag: string) {
  const key = `${tag.toLowerCase()}|${SEASONS.join(",")}`;
  const now = Date.now();

  const cached = matchCache.get(key);
  if (cached && now - cached.time < MATCH_CACHE_TTL) {
    return cached.matches;
  }

  const matches = await fetchAllMatches(tag, SEASONS);

  matchCache.set(key, { time: now, matches });

  return matches;
}

/* -------------------- PAIRING (CI) -------------------- */

function getPlayerAndOpponentCI(match: any, lower: string) {
  const players = (match?.teams ?? []).flatMap((t: any) => t?.players ?? []);
  if (players.length < 2) return null;

  const me = players.find((p: any) => p?.battleTag?.toLowerCase() === lower);
  if (!me) return null;

  const opp = players.find((p: any) => p !== me);
  if (!opp) return null;

  return { me, opp };
}

/* -------------------- SERVICE -------------------- */

export async function getPlayerSummary(inputTag: string) {
  const raw = String(inputTag ?? "").trim();
  if (!raw) return null;

  const canonicalBattleTag = await resolveBattleTagViaSearch(raw);
  if (!canonicalBattleTag) return null;

  const matches = await fetchMatchesCached(canonicalBattleTag);
  if (!matches.length) return null;

  const lower = canonicalBattleTag.toLowerCase();

  /* ---------- accumulators ---------- */

  const raceGamesAllTime: Record<string, number> = {};
  const raceGamesCurrentSeason: Record<string, number> = {};
  const lastPlayedRace: Record<string, Date> = {};
  const raceMMRCurrent: Record<string, number> = {};
  const raceCounters: Record<string, number> = {};
  const racePeaks: Record<string, any> = {};

  let highestCurrentRace: string | null = null;
  let largestGapWin: any = null;
  let largestSingleGain: any = null;

  const highGainGames: any[] = [];

  let lastPlayedLadder: Date | null = null;

  /* =====================================================
     SINGLE PASS
  ===================================================== */

  for (const match of matches) {
    if (match.gameMode !== 1) continue;

    const date = new Date(match.startTime);
    const season = match.season;

    const pair = getPlayerAndOpponentCI(match, lower);
    if (!pair) continue;

    const { me, opp } = pair;

    const race = resolveEffectiveRace(me);

    /* ----- always stats ----- */

    raceGamesAllTime[race] = (raceGamesAllTime[race] || 0) + 1;

    if (season === CURRENT_SEASON) {
      raceGamesCurrentSeason[race] = (raceGamesCurrentSeason[race] || 0) + 1;
      raceMMRCurrent[race] = me.currentMmr;
    }

    lastPlayedRace[race] = date;
    if (!lastPlayedLadder || date > lastPlayedLadder)
  lastPlayedLadder = date;

    if (
      !highestCurrentRace ||
      (raceMMRCurrent[race] ?? 0) >
        (raceMMRCurrent[highestCurrentRace] ?? 0)
    ) {
      highestCurrentRace = race;
    }

    /* ----- heavy performance section filters ----- */

    if (
      match.durationInSeconds < MIN_DURATION_SECONDS ||
      !LAST_3_SEASONS.has(season) ||
      typeof me.mmrGain !== "number" ||
      Math.abs(me.mmrGain) > MAX_EXTREME_ABS_MMR_CHANGE
    ) {
      continue;
    }

    raceCounters[race] = (raceCounters[race] ?? 0) + 1;

    /* peaks */
    if (
      raceCounters[race] > 35 &&
      typeof me.currentMmr === "number"
    ) {
      if (!racePeaks[race] || me.currentMmr > racePeaks[race].mmr) {
        racePeaks[race] = {
          race,
          mmr: me.currentMmr,
          season,
          game: raceCounters[race],
        };
      }
    }

    /* gains */
    if (me.mmrGain >= HIGH_GAIN_THRESHOLD) {
      highGainGames.push({
        gain: me.mmrGain,
        myRace: race,
        myMMR: me.oldMmr,
        oppName: opp.battleTag,
        oppRace: resolveEffectiveRace(opp),
        oppMMR: opp.oldMmr,
      });
    }

    if (!largestSingleGain || me.mmrGain > largestSingleGain.gain) {
      largestSingleGain = {
        gain: me.mmrGain,
        myRace: race,
        myMMR: me.oldMmr,
        oppName: opp.battleTag,
        oppRace: resolveEffectiveRace(opp),
        oppMMR: opp.oldMmr,
      };
    }

const gap = Math.abs(me.oldMmr - opp.oldMmr);

if (me.won && me.oldMmr < opp.oldMmr) {
  if (!largestGapWin || gap > largestGapWin.gap) {
    largestGapWin = {
      gap,
      myRace: race,
      myMMR: me.oldMmr,
      oppName: opp.battleTag,
      oppRace: resolveEffectiveRace(opp),
      oppMMR: opp.oldMmr,
    };
  }
}
  }

  /* ---------- results ---------- */

  const mostPlayedAllTime =
    Object.entries(raceGamesAllTime).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Unknown";

  const mostPlayedThisSeason =
    Object.entries(raceGamesCurrentSeason).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Unknown";

  const top2Peaks = Object.values(racePeaks)
    .sort((a: any, b: any) => b.mmr - a.mmr)
    .slice(0, 2);

  return {
    summary: {
      battletag: canonicalBattleTag,
      mostPlayedAllTime,
      mostPlayedThisSeason,
      highestCurrentRace,
      highestCurrentMMR:
        highestCurrentRace && raceMMRCurrent[highestCurrentRace],
      lastPlayedLadder: lastPlayedLadder?.toISOString() ?? null,
      lastPlayedRace: Object.fromEntries(
        Object.entries(lastPlayedRace).map(([k, v]) => [
          k,
          v.toISOString(),
        ])
      ),
      top2Peaks,
      gainGamesToShow:
        highGainGames.length > 0
          ? highGainGames
          : largestSingleGain
          ? [largestSingleGain]
          : [],
      largestGapWin,
    },
  };
}
