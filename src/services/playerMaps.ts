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

  const canonical =
    (await resolveBattleTagViaSearch(inputTag)) || inputTag;

  const matches = await fetchAllMatches(canonical, SEASONS);
  if (!matches.length) return null;

  const lower = canonical.toLowerCase();

  /* ===================================================
     COMPUTE
  =================================================== */

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

    for (let i = 0; i < DURATION_BUCKETS.length; i++) {
      const b = DURATION_BUCKETS[i];
      if (dur >= b.min && dur <= b.max) {
        me.won ? durationStats[i].wins++ : durationStats[i].losses++;
        break;
      }
    }

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
     OUTPUT
  =================================================== */

  const validMaps = Object.entries(mapAgg)
    .filter(([, m]) => m.games >= MIN_MAP_GAMES)
    .map(([map, m]) => ({
      map,
      games: m.games,
      wins: m.wins,
      losses: m.losses,
      winrate: +((m.wins / m.games) * 100).toFixed(1),
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

  const avgWinMinutes =
    winGames > 0 ? +(winTime / winGames / 60).toFixed(1) : null;

  const avgLossMinutes =
    lossGames > 0 ? +(lossTime / lossGames / 60).toFixed(1) : null;

  /* ---------- winrate by duration ---------- */

  const winrateByDuration = durationStats.map((b) => {
    const games = b.wins + b.losses;
    return {
      label: b.label,
      wins: b.wins,
      losses: b.losses,
      winrate: games > 0 ? +((b.wins / games) * 100).toFixed(1) : 0,
    };
  });

  /* ---------- hero levels ---------- */

  let highestAvgHeroLevel: any = null;
  let lowestAvgHeroLevel: any = null;

  for (const m of validMaps) {
    if (m.heroAvgLevel == null) continue;

    if (!highestAvgHeroLevel || m.heroAvgLevel > highestAvgHeroLevel.heroAvgLevel)
      highestAvgHeroLevel = m;

    if (!lowestAvgHeroLevel || m.heroAvgLevel < lowestAvgHeroLevel.heroAvgLevel)
      lowestAvgHeroLevel = m;
  }

  /* ---------- hero count leaders ---------- */

  const oneHeroMap =
    [...validMaps].sort((a, b) => b.heroCounts[1] - a.heroCounts[1])[0]?.map ?? null;

  const twoHeroMap =
    [...validMaps].sort((a, b) => b.heroCounts[2] - a.heroCounts[2])[0]?.map ?? null;

  const threeHeroMap =
    [...validMaps].sort((a, b) => b.heroCounts[3] - a.heroCounts[3])[0]?.map ?? null;

  /* ---------- mmr context ---------- */

  const mostPlayed = [...validMaps].sort((a, b) => b.games - a.games)[0] ?? null;
  const bestNet = [...validMaps].sort((a, b) => b.netMMR - a.netMMR)[0] ?? null;
  const worstNet = [...validMaps].sort((a, b) => a.netMMR - b.netMMR)[0] ?? null;
  const mostVsHigher = [...validMaps].sort((a, b) => b.vsHigher - a.vsHigher)[0] ?? null;
  const mostVsLower = [...validMaps].sort((a, b) => b.vsLower - a.vsLower)[0] ?? null;

  return {
    battletag: canonical,
    seasons: SEASONS,

    avgWinMinutes,
    avgLossMinutes,
    winrateByDuration,

    topMaps: byWinrate.slice(0, 5),
    worstMaps: [...byWinrate].reverse().slice(0, 5),
    longestWin,

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
