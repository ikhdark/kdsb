import {
  fetchAllMatches,
  getPlayerAndOpponent,
} from "../lib/w3cUtils";

/* -------------------- CONSTANTS -------------------- */

const SEASONS = [23];
const MIN_DURATION_SECONDS = 120;
const MIN_MAP_GAMES = 10;

const DURATION_BUCKETS = [
  { label: "5-10 min", min: 300, max: 600 },
  { label: "11-15 min", min: 601, max: 900 },
  { label: "16-20 min", min: 901, max: 1200 },
  { label: "20-25 min", min: 1201, max: 1500 },
  { label: "26-30 min", min: 1501, max: 1800 },
  { label: "30+ min", min: 1801, max: Infinity },
] as const;

/* -------------------- TYPES -------------------- */

type DurationLabel = (typeof DURATION_BUCKETS)[number]["label"];

type DurationStat = {
  games: number;
  wins: number;
};

type Hero = {
  level?: number;
};

type GameHeroStats = {
  map: string;
  secs: number;
  myTag: string;
  myMMR: number;
  oppTag: string;
  oppMMR: number;
  mmrChange: number;
};

type MapAgg = {
  games: number;
  wins: number;
  totalSecs: number;
  netMMR: number;
  vsHigher: number;
  vsLower: number;
  heroLevelAvgSum: number;
  heroLevelAvgGames: number;
};

/* -------------------- HELPERS -------------------- */

function resolveMapName(match: any): string {
  if (match?.mapName && match.mapName.trim()) {
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

function fmtSigned(n: number): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  return `${num >= 0 ? "+" : ""}${num}`;
}

function getMyHeroes(match: any, me: any): Hero[] {
  if (Array.isArray(me?.heroes)) return me.heroes;

  if (Array.isArray(match?.playerScores)) {
    const ps = match.playerScores.find(
      (p: any) =>
        typeof p?.battleTag === "string" &&
        typeof me?.battleTag === "string" &&
        p.battleTag.toLowerCase() === me.battleTag.toLowerCase()
    );

    if (Array.isArray(ps?.heroes)) return ps.heroes;
  }

  return [];
}

/* -------------------- SERVICE -------------------- */

export async function getW3CMapStats(
  inputTag: string
): Promise<{ result: string } | null> {
  let BATTLETAG = inputTag.trim();
  let allMatches = await fetchAllMatches(BATTLETAG, SEASONS);

  // Case-normalized retry
  if (!allMatches.length && BATTLETAG.includes("#")) {
    const [name, id] = BATTLETAG.split("#");
    BATTLETAG = `${name.toLowerCase()}#${id}`;
    allMatches = await fetchAllMatches(BATTLETAG, SEASONS);
  }

  if (!allMatches.length) return null;

  const targetLower = BATTLETAG.toLowerCase();

  allMatches.sort(
    (a: any, b: any) =>
      new Date(a.startTime).getTime() -
      new Date(b.startTime).getTime()
  );

  const durationStats: Record<DurationLabel, DurationStat> = {} as any;
  for (const b of DURATION_BUCKETS) {
    durationStats[b.label] = { games: 0, wins: 0 };
  }

  const winTime = { total: 0, games: 0 };
  const lossTime = { total: 0, games: 0 };

  const mapStats: Record<string, MapAgg> = {};
  const heroCountByMap: Record<string, Record<number, number>> = {};
  let longestWin: GameHeroStats | null = null;

  for (const match of allMatches) {
    if (match?.gameMode !== 1) continue;

    const pair = getPlayerAndOpponent(match, targetLower);
    if (!pair) continue;

    const { me, opp } = pair;
    const dur = match?.durationInSeconds;

    if (
      typeof dur !== "number" ||
      dur < MIN_DURATION_SECONDS ||
      typeof me?.mmrGain !== "number" ||
      typeof me?.oldMmr !== "number" ||
      typeof opp?.oldMmr !== "number"
    )
      continue;

    const map = resolveMapName(match);

    for (const b of DURATION_BUCKETS) {
      if (dur >= b.min && dur <= b.max) {
        durationStats[b.label].games++;
        if (me.won) durationStats[b.label].wins++;
        break;
      }
    }

    if (me.won) {
      winTime.total += dur;
      winTime.games++;

      if (!longestWin || dur > longestWin.secs) {
        longestWin = {
          map,
          secs: dur,
          myTag: me.battleTag,
          myMMR: me.oldMmr,
          oppTag: opp.battleTag,
          oppMMR: opp.oldMmr,
          mmrChange: me.mmrGain,
        };
      }
    } else {
      lossTime.total += dur;
      lossTime.games++;
    }

    if (!mapStats[map]) {
      mapStats[map] = {
        games: 0,
        wins: 0,
        totalSecs: 0,
        netMMR: 0,
        vsHigher: 0,
        vsLower: 0,
        heroLevelAvgSum: 0,
        heroLevelAvgGames: 0,
      };
    }

    if (!heroCountByMap[map]) {
      heroCountByMap[map] = { 1: 0, 2: 0, 3: 0 };
    }

    const ms = mapStats[map];
    ms.games++;
    ms.totalSecs += dur;
    ms.netMMR += me.mmrGain;
    if (me.won) ms.wins++;

    if (me.oldMmr < opp.oldMmr) ms.vsHigher++;
    if (me.oldMmr > opp.oldMmr) ms.vsLower++;

    const heroes = getMyHeroes(match, me);
    const heroCount = heroes.length;
    if (heroCount >= 1 && heroCount <= 3) {
      heroCountByMap[map][heroCount]++;
    }

    if (heroes.length) {
      const sumLevels = heroes.reduce(
        (acc, h) => acc + (Number(h?.level) || 0),
        0
      );
      const avg = sumLevels / heroes.length;
      if (Number.isFinite(avg)) {
        ms.heroLevelAvgSum += avg;
        ms.heroLevelAvgGames++;
      }
    }
  }

  /* -------------------- OUTPUT -------------------- */

  const lines: string[] = [];

  lines.push(`📊 ${BATTLETAG} — Season 23 Game Stats (Gamelengths, Maps)\n`);

  lines.push("🕒 Winrate by Game Length");
  for (const b of DURATION_BUCKETS) {
    const s = durationStats[b.label];
    if (!s.games) continue;
    const wr = ((s.wins / s.games) * 100).toFixed(1);
    lines.push(`${b.label}: ${s.wins}-${s.games - s.wins} (${wr}%)`);
  }

  lines.push("\n⏱️ Average Game Duration");
  if (winTime.games) {
    lines.push(`Avg Win: ${(winTime.total / winTime.games / 60).toFixed(1)} min`);
  }
  if (lossTime.games) {
    lines.push(`Avg Loss: ${(lossTime.total / lossTime.games / 60).toFixed(1)} min`);
  }

  if (longestWin) {
    lines.push(`\nLongest Win:\n ${longestWin.map} ${(longestWin.secs / 60).toFixed(1)} min`);
    lines.push(
      `${longestWin.myTag} (${longestWin.myMMR}) vs ${longestWin.oppTag} (${longestWin.oppMMR}) | ${fmtSigned(longestWin.mmrChange)}`
    );
  }

  const validMaps = Object.entries(mapStats)
    .filter(([, s]) => s.games >= MIN_MAP_GAMES)
    .map(([map, s]) => ({
      map,
      games: s.games,
      avgMin: s.totalSecs / s.games / 60,
      winRate: s.wins / s.games,
      netMMR: s.netMMR,
      vsHigher: s.vsHigher,
      vsLower: s.vsLower,
      heroAvgLevel:
        s.heroLevelAvgGames > 0
          ? s.heroLevelAvgSum / s.heroLevelAvgGames
          : null,
    }));

  if (validMaps.length) {
    const heroEligible = validMaps.filter(
      m => Number.isFinite(m.heroAvgLevel)
    );

    if (heroEligible.length) {
      const hi = heroEligible.reduce((a, b) =>
        b.heroAvgLevel! > a.heroAvgLevel! ? b : a
      );
      const lo = heroEligible.reduce((a, b) =>
        b.heroAvgLevel! < a.heroAvgLevel! ? b : a
      );

      lines.push("\nHero Levels:");
      lines.push(`Highest Avg Hero Level: ${hi.map} (${hi.heroAvgLevel!.toFixed(2)})`);
      lines.push(`Lowest Avg Hero Level: ${lo.map} (${lo.heroAvgLevel!.toFixed(2)})`);
    }

    const bestForCount = (count: number): string | null => {
      let best: { map: string; v: number } | null = null;
      for (const m of validMaps) {
        const v = heroCountByMap[m.map]?.[count] || 0;
        if (!best || v > best.v) best = { map: m.map, v };
      }
      return best?.v ? best.map : null;
    };

    const oneHero = bestForCount(1);
    const twoHero = bestForCount(2);
    const threeHero = bestForCount(3);

    if (oneHero || twoHero || threeHero) {
      lines.push("\nMaps with highest average hero count:");
      if (oneHero) lines.push(`1 Hero: ${oneHero}`);
      if (twoHero) lines.push(`2 Hero: ${twoHero}`);
      if (threeHero) lines.push(`3 Hero: ${threeHero}`);
    }

    const pos = validMaps.filter(m => m.winRate >= 0.5);
    const neg = validMaps.filter(m => m.winRate < 0.5);

    if (pos.length && neg.length) {
      const sp = pos.reduce((a, b) => (b.avgMin < a.avgMin ? b : a));
      const sn = neg.reduce((a, b) => (b.avgMin < a.avgMin ? b : a));
      const lp = pos.reduce((a, b) => (b.avgMin > a.avgMin ? b : a));
      const ln = neg.reduce((a, b) => (b.avgMin > a.avgMin ? b : a));

      lines.push("\nMaps with shortest/longest games + W/L:");
      lines.push(
        `Shortest: ${sp.map} ${sp.avgMin.toFixed(2)} min (${(sp.winRate * 100).toFixed(0)}%) / ` +
        `${sn.map} ${sn.avgMin.toFixed(2)} min (${(sn.winRate * 100).toFixed(0)}%)`
      );
      lines.push(
        `Longest: ${lp.map} ${lp.avgMin.toFixed(2)} min (${(lp.winRate * 100).toFixed(0)}%) / ` +
        `${ln.map} ${ln.avgMin.toFixed(2)} min (${(ln.winRate * 100).toFixed(0)}%)`
      );
    }

    const mostPlayed = validMaps.reduce((a, b) =>
      b.games > a.games ? b : a
    );
    const bestNet = validMaps.reduce((a, b) =>
      b.netMMR > a.netMMR ? b : a
    );
    const worstNet = validMaps.reduce((a, b) =>
      b.netMMR < a.netMMR ? b : a
    );
    const mostVsHigher = validMaps.reduce((a, b) =>
      b.vsHigher > a.vsHigher ? b : a
    );
    const mostVsLower = validMaps.reduce((a, b) =>
      b.vsLower > a.vsLower ? b : a
    );

    lines.push("\nMap MMR Context:");
    lines.push(`Most Played Map: ${mostPlayed.map} (${mostPlayed.games})`);
    lines.push(`Best Net MMR: ${bestNet.map} (${fmtSigned(bestNet.netMMR)})`);
    lines.push(`Worst Net MMR: ${worstNet.map} (${fmtSigned(worstNet.netMMR)})`);
    lines.push(`Most Games vs Higher MMR: ${mostVsHigher.map} (${mostVsHigher.vsHigher})`);
    lines.push(`Most Games vs Lower MMR: ${mostVsLower.map} (${mostVsLower.vsLower})`);
  }

  return {
    result: lines.join("\n").slice(0, 1900),
  };
}
