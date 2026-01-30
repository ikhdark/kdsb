/* =========================================================
   W3C STATS PARSERS (HERO + MAP)
   Pure parsing / aggregation only
   ZERO fetch
   ZERO resolver
   ZERO ranking
   ========================================================= */

/* =========================================================
   SHARED HELPERS
   ========================================================= */

export function winrate(wins: number, games: number) {
  return games ? wins / games : 0;
}

export function groupBy<T, K extends string | number>(
  arr: T[],
  keyFn: (x: T) => K
): Record<K, T[]> {
  const map = {} as Record<K, T[]>;

  for (const item of arr) {
    const k = keyFn(item);
    (map[k] ??= []).push(item);
  }

  return map;
}

/* =========================================================
   HERO TYPES (from W3C hero API)
   ========================================================= */

export type HeroWinLoss = {
  race: number;
  wins: number;
  losses: number;
  games: number;
  winrate: number;
};

export type HeroMapEntry = {
  map: string;
  mapName: string | null;
  winLosses: HeroWinLoss[];
};

export type HeroRaceStats = {
  race: number;
  winLossesOnMap: HeroMapEntry[];
};

export type HeroStatsItem = {
  heroId: string;
  stats: HeroRaceStats[];
};

/* =========================================================
   HERO FLATTEN (canonical normalization)
   ========================================================= */

export function flattenHeroStats(items: HeroStatsItem[]) {
  const rows: {
    heroId: string;
    race: number;
    map: string;
    mapName: string | null;
    vsRace: number;
    wins: number;
    losses: number;
    games: number;
    winrate: number;
  }[] = [];

  for (const hero of items ?? []) {
    for (const raceStats of hero?.stats ?? []) {
      for (const mapEntry of raceStats?.winLossesOnMap ?? []) {
        for (const wl of mapEntry?.winLosses ?? []) {
          if (!wl?.games) continue;

          rows.push({
            heroId: hero.heroId,
            race: raceStats.race,
            map: mapEntry.map,
            mapName: mapEntry.mapName ?? null,
            vsRace: wl.race,
            wins: wl.wins,
            losses: wl.losses,
            games: wl.games,
            winrate: wl.winrate,
          });
        }
      }
    }
  }

  return rows;
}

/* =========================================================
   HERO AGGREGATIONS
   ========================================================= */

/* ---------- totals by hero ---------- */

export function aggregateHeroTotals(rows: ReturnType<typeof flattenHeroStats>) {
  const map = new Map<
    string,
    { wins: number; losses: number; games: number; winrate: number }
  >();

  for (const r of rows) {
    const cur = map.get(r.heroId) ?? {
      wins: 0,
      losses: 0,
      games: 0,
      winrate: 0,
    };

    cur.wins += r.wins;
    cur.losses += r.losses;
    cur.games += r.games;

    map.set(r.heroId, cur);
  }

  for (const v of map.values()) {
    v.winrate = winrate(v.wins, v.games);
  }

  return map;
}

/* ---------- by map ---------- */

export function aggregateByMap(rows: ReturnType<typeof flattenHeroStats>) {
  const map: Record<string, { wins: number; losses: number; games: number }> = {};

  for (const r of rows) {
    map[r.map] ??= { wins: 0, losses: 0, games: 0 };

    map[r.map].wins += r.wins;
    map[r.map].losses += r.losses;
    map[r.map].games += r.games;
  }

  return map;
}

/* ---------- by opponent race ---------- */

export function aggregateByOpponentRace(
  rows: ReturnType<typeof flattenHeroStats>
) {
  const map: Record<number, { wins: number; losses: number; games: number }> = {};

  for (const r of rows) {
    map[r.vsRace] ??= { wins: 0, losses: 0, games: 0 };

    map[r.vsRace].wins += r.wins;
    map[r.vsRace].losses += r.losses;
    map[r.vsRace].games += r.games;
  }

  return map;
}

/* ---------- by player race ---------- */

export function aggregateByRace(rows: ReturnType<typeof flattenHeroStats>) {
  const map: Record<number, { wins: number; losses: number; games: number }> = {};

  for (const r of rows) {
    map[r.race] ??= { wins: 0, losses: 0, games: 0 };

    map[r.race].wins += r.wins;
    map[r.race].losses += r.losses;
    map[r.race].games += r.games;
  }

  return map;
}

/* ---------- hero + map matrix (UI favorite) ---------- */

export function aggregateHeroMapMatrix(rows: ReturnType<typeof flattenHeroStats>) {
  const map: Record<string, Record<string, { wins: number; games: number }>> = {};

  for (const r of rows) {
    map[r.heroId] ??= {};
    map[r.heroId][r.map] ??= { wins: 0, games: 0 };

    map[r.heroId][r.map].wins += r.wins;
    map[r.heroId][r.map].games += r.games;
  }

  return map;
}

/* =========================================================
   MAP TYPES (raceWinsOnMapByPatch API)
   ========================================================= */

export type MapWL = {
  map: string;
  mapName: string | null;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
};

type RawWL = {
  race: number;
  wins: number;
  losses: number;
  games: number;
  winrate: number;
};

/* =========================================================
   MAP HELPERS
   ========================================================= */

export function sumWL(rows: RawWL[]) {
  let games = 0;
  let wins = 0;
  let losses = 0;

  for (const r of rows) {
    games += r.games;
    wins += r.wins;
    losses += r.losses;
  }

  return {
    games,
    wins,
    losses,
    winrate: winrate(wins, games),
  };
}

export function flattenMapsFromPatch(data: any): MapWL[] {
  const out: MapWL[] = [];

  for (const patch of Object.values(data ?? {})) {
    for (const raceEntry of patch as any[]) {
      for (const m of raceEntry.winLossesOnMap ?? []) {
        if (m.map === "Overall") continue;

        const totals = sumWL(m.winLosses);

        out.push({
          map: m.map,
          mapName: m.mapName,
          ...totals,
        });
      }
    }
  }

  return out;
}

export function groupMaps(rows: MapWL[]): MapWL[] {
  const map = new Map<string, MapWL>();

  for (const r of rows) {
    const existing = map.get(r.map);

    if (!existing) {
      map.set(r.map, { ...r });
      continue;
    }

    existing.games += r.games;
    existing.wins += r.wins;
    existing.losses += r.losses;
  }

  return [...map.values()].map((r) => ({
    ...r,
    winrate: winrate(r.wins, r.games),
  }));
}

export function extractMapStats(raw: any): MapWL[] {
  return groupMaps(flattenMapsFromPatch(raw));
}
