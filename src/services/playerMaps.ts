import { fetchAllMatches, getPlayerAndOpponent } from "@/lib/w3cUtils";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

/* -------------------- CONSTANTS -------------------- */

const SEASONS = [24];
const MIN_DURATION_SECONDS = 120;
const MIN_MAP_GAMES = 1;

const DURATION_BUCKETS = [
  { label: "5–10 min", min: 300, max: 600 },
  { label: "11–15 min", min: 601, max: 900 },
  { label: "16–20 min", min: 901, max: 1200 },
  { label: "20–25 min", min: 1201, max: 1500 },
  { label: "26–30 min", min: 1501, max: 1800 },
  { label: "30+ min", min: 1801, max: Infinity },
];

/* -------------------- MATCH CACHE -------------------- */

const MATCH_TTL = 5 * 60 * 1000;

const matchCache = new Map<
  string,
  { ts: number; matches: any[] }
>();

/* -------------------- HELPERS -------------------- */

function resolveMapName(match: any): string {
  if (typeof match?.mapName === "string" && match.mapName.trim()) {
    return match.mapName.trim();
  }

  if (typeof match?.map === "string") {
    return match.map
      .replace(/^.*?(?=[A-Z])/, "")
      .replace(/v\d+_.*/, "")
      .trim();
  }

  return "Unknown";
}

/* ===================================================
   SERVICE
=================================================== */

export async function getW3CMapStats(inputTag: string) {
  if (!inputTag) return null;

  /* ---------- resolve FIRST ---------- */

  const canonical =
    (await resolveBattleTagViaSearch(inputTag)) || inputTag;

  /* ---------- cache + fetch ---------- */

  const key = canonical.toLowerCase();
  const now = Date.now();

  let matches: any[];

  const cached = matchCache.get(key);

  if (cached && now - cached.ts < MATCH_TTL) {
    matches = cached.matches;
  } else {
    matches = await fetchAllMatches(canonical, SEASONS);
    matchCache.set(key, { ts: now, matches });
  }

  if (!matches.length) return null;

  /* ===================================================
     COMPUTE
  =================================================== */

  const lower = canonical.toLowerCase();

  const durationStats = DURATION_BUCKETS.map((b) => ({
    label: b.label,
    wins: 0,
    losses: 0,
  }));

  let winTime = 0;
  let lossTime = 0;
  let winGames = 0;
  let lossGames = 0;

  let longestWin: any = null;

  const mapAgg: Record<
    string,
    {
      games: number;
      wins: number;
      losses: number;
      totalSecs: number;
      netMMR: number;
      vsHigher: number;
      vsLower: number;
      heroAvgSum: number;
      heroAvgGames: number;
      heroCounts: { 1: number; 2: number; 3: number };
    }
  > = {};

  for (const m of matches) {
    if (m?.gameMode !== 1) continue;

    const pair = getPlayerAndOpponent(m, lower);
    if (!pair) continue;

    const { me, opp } = pair;

    const dur = Number(m?.durationInSeconds);

    if (!Number.isFinite(dur) || dur < MIN_DURATION_SECONDS) continue;
    if (!Number.isFinite(me?.mmrGain)) continue;

    const map = resolveMapName(m);

    if (!mapAgg[map]) {
      mapAgg[map] = {
        games: 0,
        wins: 0,
        losses: 0,
        totalSecs: 0,
        netMMR: 0,
        vsHigher: 0,
        vsLower: 0,
        heroAvgSum: 0,
        heroAvgGames: 0,
        heroCounts: { 1: 0, 2: 0, 3: 0 },
      };
    }

    const agg = mapAgg[map];

    agg.games++;
    agg.totalSecs += dur;
    agg.netMMR += me.mmrGain;

    if (me.oldMmr < opp.oldMmr) agg.vsHigher++;
    if (me.oldMmr > opp.oldMmr) agg.vsLower++;

    /* ---------- duration buckets ---------- */

    for (let i = 0; i < DURATION_BUCKETS.length; i++) {
      const b = DURATION_BUCKETS[i];
      if (dur >= b.min && dur <= b.max) {
        me.won ? durationStats[i].wins++ : durationStats[i].losses++;
        break;
      }
    }

    /* ---------- win/loss ---------- */

    if (me.won) {
      agg.wins++;
      winTime += dur;
      winGames++;

      if (!longestWin || dur > longestWin.secs) {
        longestWin = {
          map,
          minutes: +(dur / 60).toFixed(1),
          oppTag: opp.battleTag,
          oppMMR: opp.oldMmr,
          mmrChange: me.mmrGain,
          secs: dur,
        };
      }
    } else {
      agg.losses++;
      lossTime += dur;
      lossGames++;
    }

    /* ---------- hero tracking ---------- */

    const heroes = Array.isArray(me.heroes) ? me.heroes : [];

    if (heroes.length >= 1 && heroes.length <= 3) {
      agg.heroCounts[heroes.length as 1 | 2 | 3]++;
    }

    if (heroes.length) {
      const avg =
        heroes.reduce((a: number, h: any) => a + (h.level || 0), 0) /
        heroes.length;

      if (Number.isFinite(avg)) {
        agg.heroAvgSum += avg;
        agg.heroAvgGames++;
      }
    }
  }

  /* ===================================================
     FLATTEN MAP DATA
  =================================================== */

  const validMaps = Object.entries(mapAgg)
    .filter(([, m]) => m.games >= MIN_MAP_GAMES)
    .map(([map, m]) => ({
      map,
      games: m.games,
      wins: m.wins,
      losses: m.losses,
      winrate: +( (m.wins / m.games) * 100 ).toFixed(1),
      avgMinutes: +(m.totalSecs / m.games / 60).toFixed(1),
      netMMR: m.netMMR,
      vsHigher: m.vsHigher,
      vsLower: m.vsLower,
      heroAvgLevel:
        m.heroAvgGames > 0
          ? +(m.heroAvgSum / m.heroAvgGames).toFixed(2)
          : null,
      heroCounts: m.heroCounts,
    }));

  const byWinrate = [...validMaps].sort((a, b) => b.winrate - a.winrate);

  /* ===================================================
     HERO + MMR CONTEXT (what your page expects)
  =================================================== */

  let highestAvgHeroLevel: any = null;
  let lowestAvgHeroLevel: any = null;

  let oneHeroMap: string | null = null;
  let twoHeroMap: string | null = null;
  let threeHeroMap: string | null = null;

  let mostPlayed: any = null;
  let bestNet: any = null;
  let worstNet: any = null;
  let mostVsHigher: any = null;
  let mostVsLower: any = null;

  for (const m of validMaps) {
    if (m.heroAvgLevel != null) {
      if (!highestAvgHeroLevel || m.heroAvgLevel > highestAvgHeroLevel.heroAvgLevel)
        highestAvgHeroLevel = m;

      if (!lowestAvgHeroLevel || m.heroAvgLevel < lowestAvgHeroLevel.heroAvgLevel)
        lowestAvgHeroLevel = m;
    }

    if (!oneHeroMap || m.heroCounts[1] > mapAgg[oneHeroMap]?.heroCounts[1])
      oneHeroMap = m.map;

    if (!twoHeroMap || m.heroCounts[2] > mapAgg[twoHeroMap]?.heroCounts[2])
      twoHeroMap = m.map;

    if (!threeHeroMap || m.heroCounts[3] > mapAgg[threeHeroMap]?.heroCounts[3])
      threeHeroMap = m.map;

    if (!mostPlayed || m.games > mostPlayed.games) mostPlayed = m;
    if (!bestNet || m.netMMR > bestNet.netMMR) bestNet = m;
    if (!worstNet || m.netMMR < worstNet.netMMR) worstNet = m;
    if (!mostVsHigher || m.vsHigher > mostVsHigher.vsHigher) mostVsHigher = m;
    if (!mostVsLower || m.vsLower > mostVsLower.vsLower) mostVsLower = m;
  }

  /* ===================================================
     RETURN
  =================================================== */

  return {
    battletag: canonical,
    seasons: SEASONS,

    winrateByDuration: durationStats.map((b) => ({
      ...b,
      winrate:
        b.wins + b.losses > 0
          ? +((b.wins / (b.wins + b.losses)) * 100).toFixed(1)
          : 0,
    })),

    avgWinMinutes: winGames ? +(winTime / winGames / 60).toFixed(1) : null,
    avgLossMinutes: lossGames ? +(lossTime / lossGames / 60).toFixed(1) : null,
    longestWin,

    topMaps: byWinrate.slice(0, 5),
    worstMaps: [...byWinrate].reverse().slice(0, 5),

    heroLevels: {
      highestAvgHeroLevel,
      lowestAvgHeroLevel,
    },

    mapsWithHighestHeroCount: {
      oneHeroMap,
      twoHeroMap,
      threeHeroMap,
    },

    mmrContext: {
      mostPlayed,
      bestNet,
      worstNet,
      mostVsHigher,
      mostVsLower,
    },
  };
}
