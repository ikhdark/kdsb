import { fetchAllMatches } from "@/lib/w3cUtils";

const SEASONS = [23];
const MIN_GAMES = 10;

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

type HeroStat = {
  games: number;
  wins: number;
  losses: number;
};

export async function getW3CHeroStats(inputTag: string) {
  let battleTag = String(inputTag || "").trim();
  let matches: any[] = await fetchAllMatches(battleTag, SEASONS);

  // Case-normalized fallback
  if (!matches.length && battleTag.includes("#")) {
    const [name, id] = battleTag.split("#");
    battleTag = `${name.toLowerCase()}#${id}`;
    matches = await fetchAllMatches(battleTag, SEASONS);
  }

  if (!matches.length) return null;

  const target = battleTag.toLowerCase();

  const opponentHeroStats: Record<string, HeroStat> = {};
  const opponentPrimaryHeroStats: Record<string, HeroStat> = {};

  const opponentHeroCountStats: Record<number, HeroStat> = {
    1: { games: 0, wins: 0, losses: 0 },
    2: { games: 0, wins: 0, losses: 0 },
    3: { games: 0, wins: 0, losses: 0 },
  };

  const yourHeroCountStats: Record<number, HeroStat> = {
    1: { games: 0, wins: 0, losses: 0 },
    2: { games: 0, wins: 0, losses: 0 },
    3: { games: 0, wins: 0, losses: 0 },
  };

  for (const match of matches) {
    if (match.gameMode !== 1 || !Array.isArray(match.teams)) continue;

    const players = match.teams.flatMap((t: any) => t.players || []);
    if (players.length !== 2) continue;

    const me = players.find(
      (p: any) => p?.battleTag?.toLowerCase() === target
    );
    const opp = players.find(
      (p: any) => p?.battleTag?.toLowerCase() !== target
    );

    if (!me || !opp || !me.heroes?.length || !opp.heroes?.length) continue;

    const didWin = me.won === true;

    const yourHeroCount = Math.min(me.heroes.length, 3);
    const oppHeroCount = Math.min(opp.heroes.length, 3);

    yourHeroCountStats[yourHeroCount].games++;
    didWin
      ? yourHeroCountStats[yourHeroCount].wins++
      : yourHeroCountStats[yourHeroCount].losses++;

    opponentHeroCountStats[oppHeroCount].games++;
    didWin
      ? opponentHeroCountStats[oppHeroCount].wins++
      : opponentHeroCountStats[oppHeroCount].losses++;

    const uniqueHeroes = new Set(
      opp.heroes.map((h: any) => h.name).filter(Boolean)
    );

    for (const hero of uniqueHeroes) {
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

  let totalGames = 0;
  let totalWins = 0;

  for (const s of Object.values(opponentHeroStats)) {
    totalGames += s.games;
    totalWins += s.wins;
  }

  const baselineWinrate = totalGames ? totalWins / totalGames : 0;

  const out: string[] = [];
  const line = (t: string) => out.push(t);

  line(`📊 ${battleTag} — All races S23 Hero Stats`);

  line(`\nYour W/L by Your Hero Count`);
  Object.entries(yourHeroCountStats).forEach(([k, s]) => {
    if (!s.games) return;
    line(
      `${k} hero${Number(k) > 1 ? "es" : ""}: ${(
        (100 * s.wins) / s.games
      ).toFixed(1)}% (${s.wins}-${s.losses})`
    );
  });

  line(`\nYour W/L vs Opponent Hero Count`);
  Object.entries(opponentHeroCountStats).forEach(([k, s]) => {
    if (!s.games) return;
    line(
      `${k} hero${Number(k) > 1 ? "es" : ""}: ${(
        (100 * s.wins) / s.games
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
          (100 * s.wins) / s.games
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
          (100 * s.wins) / s.games
        ).toFixed(1)}% (${s.wins}-${s.losses})`
      )
    );

  line(`\nYour Top 5 Best Winrates vs Opponent Heroes Overall`);
  Object.entries(opponentHeroStats)
    .filter(([, s]) => s.games >= MIN_GAMES)
    .sort(
      (a, b) =>
        (b[1].wins / b[1].games - baselineWinrate) -
        (a[1].wins / a[1].games - baselineWinrate)
    )
    .slice(0, 5)
    .forEach(([hero, s]) => {
      const wr = ((100 * s.wins) / s.games).toFixed(1);
      const delta = (((s.wins / s.games) - baselineWinrate) * 100).toFixed(1);
      line(`${heroDisplay(hero)}: ${wr}% (+${delta}%)`);
    });

  line(`\nYour Top 5 Worst Winrates vs Opponent Heroes Overall`);
  Object.entries(opponentHeroStats)
    .filter(([, s]) => s.games >= MIN_GAMES)
    .sort(
      (a, b) =>
        (a[1].wins / a[1].games - baselineWinrate) -
        (b[1].wins / b[1].games - baselineWinrate)
    )
    .slice(0, 5)
    .forEach(([hero, s]) => {
      const wr = ((100 * s.wins) / s.games).toFixed(1);
      const delta = (((s.wins / s.games) - baselineWinrate) * 100).toFixed(1);
      line(`${heroDisplay(hero)}: ${wr}% (${delta}%)`);
    });

  return { result: out.join("\n").slice(0, 1900) };
}
