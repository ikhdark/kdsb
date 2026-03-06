import { fetchAllMatches } from "@/lib/w3cUtils";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { fetchPlayerProfile } from "@/services/w3cApi";
import { HERO_MAP } from "@/lib/heroMap";

const SEASONS = [24];
const MIN_GAMES = 5;
const GAMEMODE = 1;

/* ---------------- HERO DISPLAY ---------------- */

function heroDisplay(name?: string): string {
  if (!name) return "Unknown";
  return HERO_MAP[name] ?? name;
}

type HeroStat = {
  games: number;
  wins: number;
  losses: number;
};

type Row = {
  label: string;
  wins: number;
  losses: number;
  games: number;
  winrate: number;
};

/* ---------------- HELPERS ---------------- */

function recordStat(stat: HeroStat, didWin: boolean) {
  stat.games++;
  didWin ? stat.wins++ : stat.losses++;
}

function toRow(hero: string, s: HeroStat): Row {
  return {
    label: heroDisplay(hero),
    wins: s.wins,
    losses: s.losses,
    games: s.games,
    winrate: +((s.wins / s.games) * 100).toFixed(1),
  };
}

function sortRows(
  obj: Record<string, HeroStat>,
  asc: boolean
): Row[] {
  const rows = Object.entries(obj)
    .filter(([, s]) => s.games >= MIN_GAMES)
    .map(([hero, s]) => toRow(hero, s));

  rows.sort((a, b) =>
    asc ? a.winrate - b.winrate : b.winrate - a.winrate
  );

  return rows.slice(0, 5);
}

/* ===================================================
   SERVICE
=================================================== */

export async function getW3CHeroStats(inputTag: string) {
  if (!inputTag) return null;

  const canonical =
    (await resolveBattleTagViaSearch(inputTag)) || inputTag;

  let profile: any = null;

  try {
    profile = await fetchPlayerProfile(canonical);
  } catch {}

  const playerIdLower =
    typeof profile?.playerId === "string"
      ? profile.playerId.toLowerCase()
      : null;

  const canonicalLower = canonical.toLowerCase();

  const matches = await fetchAllMatches(canonical, SEASONS);
  if (!matches.length) return null;

  const opponentHeroStats: Record<string, HeroStat> = {};
  const opponentPrimaryHeroStats: Record<string, HeroStat> = {};

  const opponentHeroCountStats: Record<1 | 2 | 3, HeroStat> = {
    1: { games: 0, wins: 0, losses: 0 },
    2: { games: 0, wins: 0, losses: 0 },
    3: { games: 0, wins: 0, losses: 0 },
  };

  const yourHeroCountStats: Record<1 | 2 | 3, HeroStat> = {
    1: { games: 0, wins: 0, losses: 0 },
    2: { games: 0, wins: 0, losses: 0 },
    3: { games: 0, wins: 0, losses: 0 },
  };

  for (const match of matches) {
    if (match?.gameMode !== GAMEMODE || !Array.isArray(match?.teams)) continue;

    const players = match.teams.flatMap((t: any) => t.players ?? []);
    if (players.length !== 2) continue;

    const me = players.find(
      (p: any) =>
        p?.battleTag?.toLowerCase() === canonicalLower ||
        (playerIdLower && p?.playerId?.toLowerCase() === playerIdLower)
    );

    const opp = players.find((p: any) => p !== me);

    if (!me || !opp || !Array.isArray(me.heroes) || !Array.isArray(opp.heroes))
      continue;

    const didWin = me.won === true;

    const yourCount = Math.min(Math.max(me.heroes.length, 1), 3) as 1 | 2 | 3;
    const oppCount = Math.min(Math.max(opp.heroes.length, 1), 3) as 1 | 2 | 3;

    recordStat(yourHeroCountStats[yourCount], didWin);
    recordStat(opponentHeroCountStats[oppCount], didWin);

    const uniqueOppHeroes = new Set<string>(
      opp.heroes.map((h: any) => h?.name).filter(Boolean)
    );

    for (const hero of uniqueOppHeroes) {
      opponentHeroStats[hero] ??= { games: 0, wins: 0, losses: 0 };
      recordStat(opponentHeroStats[hero], didWin);
    }

    const primaryHero = opp.heroes[0]?.name;

    if (primaryHero) {
      opponentPrimaryHeroStats[primaryHero] ??= {
        games: 0,
        wins: 0,
        losses: 0,
      };
      recordStat(opponentPrimaryHeroStats[primaryHero], didWin);
    }
  }

  return {
    battletag: canonical,
    seasons: SEASONS,

    byHeroCount: Object.entries(yourHeroCountStats)
      .filter(([, s]) => s.games > 0)
      .map(([k, s]) => ({
        label: `${k} hero${Number(k) > 1 ? "es" : ""}`,
        wins: s.wins,
        losses: s.losses,
        games: s.games,
        winrate: +((s.wins / s.games) * 100).toFixed(1),
      })),

    vsOppHeroCount: Object.entries(opponentHeroCountStats)
      .filter(([, s]) => s.games > 0)
      .map(([k, s]) => ({
        label: `${k} hero${Number(k) > 1 ? "es" : ""}`,
        wins: s.wins,
        losses: s.losses,
        games: s.games,
        winrate: +((s.wins / s.games) * 100).toFixed(1),
      })),

    bestOpeners: sortRows(opponentPrimaryHeroStats, false),
    worstOpeners: sortRows(opponentPrimaryHeroStats, true),

    bestOverall: sortRows(opponentHeroStats, false),
    worstOverall: sortRows(opponentHeroStats, true),
  };
}