import { fetchAllMatches } from "@/lib/w3cUtils";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { fetchPlayerProfile } from "@/services/w3cApi";

const SEASONS = [24];
const MIN_GAMES = 1;

/* -------------------- MATCH CACHE (PERFORMANCE ONLY) -------------------- */

const MATCH_CACHE_TTL = 5 * 60 * 1000;

const matchCache = new Map<
  string,
  { time: number; matches: any[] }
>();

async function fetchMatchesCached(tag: string) {
  const key = tag.toLowerCase();
  const now = Date.now();

  const cached = matchCache.get(key);
  if (cached && now - cached.time < MATCH_CACHE_TTL) {
    return cached.matches;
  }

  const matches = await fetchAllMatches(tag, SEASONS);

  matchCache.set(key, { time: now, matches });

  return matches;
}


/* -------------------- HERO DISPLAY -------------------- */

const HERO_DISPLAY_NAMES: Record<string, string> = {
  archmage: "Archmage",
  mountainking: "Mountain King",
  paladin: "Paladin",
  sorceror: "Blood Mage",

  blademaster: "Blademaster",
  farseer: "Farseer",
  shadowhunter: "Shadow Hunter",
  taurenchieftain: "Tauren Chieftain",

  deathknight: "Death Knight",
  lich: "Lich",
  dreadlord: "Dreadlord",
  cryptlord: "Crypt Lord",

  demonhunter: "Demon Hunter",
  keeperofthegrove: "Keeper of the Grove",
  priestessofthemoon: "Priestess of the Moon",
  warden: "Warden",

  alchemist: "Alchemist",
  beastmaster: "Beastmaster",
  pitlord: "Pit Lord",
  tinker: "Tinker",

  avatarofflame: "Firelord",
  bansheeranger: "Dark Ranger",
  seawitch: "Naga Sea Witch",
  pandarenbrewmaster: "Pandaren Brewmaster",
};

function heroDisplay(name?: string): string {
  if (!name) return "Unknown";
  return HERO_DISPLAY_NAMES[name] ?? name;
}

/* -------------------- TYPES -------------------- */

type HeroStat = {
  games: number;
  wins: number;
  losses: number;
};

/* -------------------- SERVICE -------------------- */

export async function getW3CHeroStats(inputTag: string) {
  const raw = String(inputTag ?? "").trim();
  if (!raw) return null;

  const canonicalBattleTag = await resolveBattleTagViaSearch(raw);
  if (!canonicalBattleTag) return null;

  let profile: any = null;
  try {
    profile = await fetchPlayerProfile(canonicalBattleTag);
  } catch {}

  const playerIdLower =
    typeof profile?.playerId === "string"
      ? profile.playerId.toLowerCase()
      : null;

  const canonicalLower = canonicalBattleTag.toLowerCase();

  const displayTag =
    canonicalBattleTag ||
    (typeof profile?.battleTag === "string" ? profile.battleTag : "") ||
    raw;

  const matches = await fetchMatchesCached(canonicalBattleTag);
  if (!matches.length) return null;

  /* -------------------- ACCUMULATORS -------------------- */

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

  /* -------------------- MATCH PROCESSING -------------------- */

  for (const match of matches) {
    if (match?.gameMode !== 1 || !Array.isArray(match?.teams)) continue;

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

    // 🔒 HARD CLAMP (THE ACTUAL FIX)
    const yourHeroCount = Math.min(Math.max(me.heroes.length, 1), 3) as 1 | 2 | 3;
    const oppHeroCount  = Math.min(Math.max(opp.heroes.length, 1), 3) as 1 | 2 | 3;

    yourHeroCountStats[yourHeroCount].games++;
    didWin
      ? yourHeroCountStats[yourHeroCount].wins++
      : yourHeroCountStats[yourHeroCount].losses++;

    opponentHeroCountStats[oppHeroCount].games++;
    didWin
      ? opponentHeroCountStats[oppHeroCount].wins++
      : opponentHeroCountStats[oppHeroCount].losses++;

const uniqueOppHeroes: Set<string> = new Set(
  opp.heroes
    .map((h: any) => h?.name)
    .filter(Boolean)
);
    for (const hero of uniqueOppHeroes) {
      opponentHeroStats[hero] ??= { games: 0, wins: 0, losses: 0 };
      opponentHeroStats[hero].games++;
      didWin
        ? opponentHeroStats[hero].wins++
        : opponentHeroStats[hero].losses++;
    }

    const primaryHero = opp.heroes[0]?.name;
    if (primaryHero) {
      opponentPrimaryHeroStats[primaryHero] ??= {
        games: 0,
        wins: 0,
        losses: 0,
      };
      opponentPrimaryHeroStats[primaryHero].games++;
      didWin
        ? opponentPrimaryHeroStats[primaryHero].wins++
        : opponentPrimaryHeroStats[primaryHero].losses++;
    }
  }

  /* -------------------- BASELINE -------------------- */

const totalGames = matches.length;

let totalWins = 0;

for (const match of matches) {
  const players = match.teams?.flatMap((t: any) => t.players ?? []) ?? [];

  const me = players.find(
    (p: any) =>
      p?.battleTag?.toLowerCase() === canonicalLower ||
      (playerIdLower && p?.playerId?.toLowerCase() === playerIdLower)
  );

  if (me?.won === true) totalWins++;
}

const baselineWinrate = totalGames ? totalWins / totalGames : 0;

  /* -------------------- OUTPUT (UNCHANGED) -------------------- */

  const out: string[] = [];
  const line = (t: string) => out.push(t);

  line(`📊 ${displayTag} — All races S23 Hero Stats`);

  line(`\nYour W/L by Your Hero Count`);
  Object.entries(yourHeroCountStats).forEach(([k, s]) => {
    if (!s.games) return;
    line(
      `${k} hero${Number(k) > 1 ? "es" : ""}: ${(
        (100 * s.wins) /
        s.games
      ).toFixed(1)}% (${s.wins}-${s.losses})`
    );
  });

  line(`\nYour W/L vs Opponent Hero Count`);
  Object.entries(opponentHeroCountStats).forEach(([k, s]) => {
    if (!s.games) return;
    line(
      `${k} hero${Number(k) > 1 ? "es" : ""}: ${(
        (100 * s.wins) /
        s.games
      ).toFixed(1)}% (${s.wins}-${s.losses})`
    );
  });

  line(`\nYour Top 5 Best Winrates vs Opponent Opening Hero`);
  Object.entries(opponentPrimaryHeroStats)
    .filter(([, s]) => s.games >= MIN_GAMES)
    .sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games)
    .slice(0, 5)
    .forEach(([hero, s]) =>
      line(
        `${heroDisplay(hero)}: ${(
          (100 * s.wins) /
          s.games
        ).toFixed(1)}% (${s.wins}-${s.losses})`
      )
    );

  line(`\nTop 5 Worst Winrates vs Opponent Opening Hero`);
  Object.entries(opponentPrimaryHeroStats)
    .filter(([, s]) => s.games >= MIN_GAMES)
    .sort((a, b) => a[1].wins / a[1].games - b[1].wins / b[1].games)
    .slice(0, 5)
    .forEach(([hero, s]) =>
      line(
        `${heroDisplay(hero)}: ${(
          (100 * s.wins) /
          s.games
        ).toFixed(1)}% (${s.wins}-${s.losses})`
      )
    );

/* ================= BEST OVERALL ================= */

line(`\nYour Top 5 Best Winrates vs Opponent Heroes Overall`);

const sortedByDelta = Object.entries(opponentHeroStats)
  .filter(([, s]) => s.games >= MIN_GAMES)
  .sort((a, b) => {
    const aDelta = a[1].wins / a[1].games - baselineWinrate;
    const bDelta = b[1].wins / b[1].games - baselineWinrate;
    return bDelta - aDelta;
  });

const bestFive = sortedByDelta.slice(0, 5);

bestFive.forEach(([hero, s]) => {
  const wr = ((100 * s.wins) / s.games).toFixed(1);
  const delta = (((s.wins / s.games) - baselineWinrate) * 100).toFixed(1);
  line(`${heroDisplay(hero)}: ${wr}% (+${delta}%)`);
});


/* ================= WORST OVERALL ================= */

line(`\nYour Top 5 Worst Winrates vs Opponent Heroes Overall`);

const bestSet = new Set(bestFive.map(([h]) => h));

sortedByDelta
  .filter(([hero]) => !bestSet.has(hero)) // prevent overlap
  .sort((a, b) => {
    const aDelta = a[1].wins / a[1].games - baselineWinrate;
    const bDelta = b[1].wins / b[1].games - baselineWinrate;
    return aDelta - bDelta;
  })
  .slice(0, 5)
  .forEach(([hero, s]) => {
    const wr = ((100 * s.wins) / s.games).toFixed(1);
    const delta = (((s.wins / s.games) - baselineWinrate) * 100).toFixed(1);
    line(`${heroDisplay(hero)}: ${wr}% (${delta}%)`);
  });


  return {
    battletag: displayTag,
    seasons: SEASONS,
    result: out.join("\n").slice(0, 1900),
  };
}