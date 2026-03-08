// src/services/playerHeroStats.ts

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { HERO_MAP } from "@/lib/heroMap";

import { fetchPlayerProfile } from "@/services/w3cApi";
import { getMatchesCached } from "@/services/matchCache";

import {
  W3C_CURRENT_SEASON,
  W3C_GAME_MODE_1V1,
} from "@/lib/w3cConfig";

const SEASONS = [W3C_CURRENT_SEASON] as const;
const MIN_GAMES = 5;
const GAMEMODE = W3C_GAME_MODE_1V1;

/* ---------------- TYPES ---------------- */

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

export type W3CHeroStatsResponse = {
  battletag: string;
  seasons: readonly number[];
  byHeroCount: Row[];
  vsOppHeroCount: Row[];
  bestOpeners: Row[];
  worstOpeners: Row[];
  bestOverall: Row[];
  worstOverall: Row[];
};

/* ---------------- HERO DISPLAY ---------------- */

function heroDisplay(name?: string): string {
  if (!name) return "Unknown";
  return HERO_MAP[name] ?? name;
}

/* ---------------- HELPERS ---------------- */

function recordStat(stat: HeroStat, didWin: boolean) {
  stat.games++;
  if (didWin) stat.wins++;
  else stat.losses++;
}

function toRow(label: string, stat: HeroStat): Row {
  return {
    label,
    wins: stat.wins,
    losses: stat.losses,
    games: stat.games,
    winrate: stat.games
      ? +((stat.wins / stat.games) * 100).toFixed(1)
      : 0,
  };
}

function toHeroRow(hero: string, stat: HeroStat): Row {
  return toRow(heroDisplay(hero), stat);
}

function sortHeroRows(
  stats: Record<string, HeroStat>,
  asc: boolean
): Row[] {
  const rows = Object.entries(stats)
    .filter(([, stat]) => stat.games >= MIN_GAMES)
    .map(([hero, stat]) => toHeroRow(hero, stat));

  rows.sort((a, b) => {
    if (a.winrate !== b.winrate) {
      return asc ? a.winrate - b.winrate : b.winrate - a.winrate;
    }

    if (a.games !== b.games) {
      return b.games - a.games;
    }

    return a.label.localeCompare(b.label);
  });

  return rows.slice(0, 5);
}

function sortCountRows(
  stats: Record<1 | 2 | 3, HeroStat>
): Row[] {
  return (Object.entries(stats) as Array<[string, HeroStat]>)
    .filter(([, stat]) => stat.games > 0)
    .map(([count, stat]) =>
      toRow(
        `${count} hero${Number(count) > 1 ? "es" : ""}`,
        stat
      )
    )
    .sort((a, b) => Number(a.label[0]) - Number(b.label[0]));
}

/* ===================================================
   SERVICE
=================================================== */

export async function getW3CHeroStats(
  inputTag: string
): Promise<W3CHeroStatsResponse | null> {
  if (!inputTag?.trim()) return null;

  const canonical =
    (await resolveBattleTagViaSearch(inputTag)) || inputTag.trim();

  let playerIdLower: string | null = null;

  try {
    const profile = await fetchPlayerProfile(canonical);
    playerIdLower =
      typeof profile?.playerId === "string"
        ? profile.playerId.toLowerCase()
        : null;
  } catch {
    playerIdLower = null;
  }

  const canonicalLower = canonical.toLowerCase();

  const matches = await getMatchesCached(canonical, SEASONS);
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

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    if (match?.gameMode !== GAMEMODE || !Array.isArray(match?.teams)) {
      continue;
    }

    const players = match.teams.flatMap((team: any) => team?.players ?? []);
    if (players.length !== 2) continue;

    const me = players.find(
      (player: any) =>
        player?.battleTag?.toLowerCase() === canonicalLower ||
        (playerIdLower &&
          typeof player?.playerId === "string" &&
          player.playerId.toLowerCase() === playerIdLower)
    );

    const opp = players.find((player: any) => player !== me);

    if (
      !me ||
      !opp ||
      !Array.isArray(me.heroes) ||
      !Array.isArray(opp.heroes)
    ) {
      continue;
    }

    const didWin = me.won === true;

    const yourCount = Math.min(Math.max(me.heroes.length, 1), 3) as 1 | 2 | 3;
    const oppCount = Math.min(Math.max(opp.heroes.length, 1), 3) as 1 | 2 | 3;

    recordStat(yourHeroCountStats[yourCount], didWin);
    recordStat(opponentHeroCountStats[oppCount], didWin);

    const uniqueOppHeroes = new Set<string>();

    for (let j = 0; j < opp.heroes.length; j++) {
      const heroName = opp.heroes[j]?.name;
      if (typeof heroName === "string" && heroName) {
        uniqueOppHeroes.add(heroName);
      }
    }

    for (const hero of uniqueOppHeroes) {
      opponentHeroStats[hero] ??= { games: 0, wins: 0, losses: 0 };
      recordStat(opponentHeroStats[hero], didWin);
    }

    const primaryHero = opp.heroes[0]?.name;

    if (typeof primaryHero === "string" && primaryHero) {
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
    byHeroCount: sortCountRows(yourHeroCountStats),
    vsOppHeroCount: sortCountRows(opponentHeroCountStats),
    bestOpeners: sortHeroRows(opponentPrimaryHeroStats, false),
    worstOpeners: sortHeroRows(opponentPrimaryHeroStats, true),
    bestOverall: sortHeroRows(opponentHeroStats, false),
    worstOverall: sortHeroRows(opponentHeroStats, true),
  };
}