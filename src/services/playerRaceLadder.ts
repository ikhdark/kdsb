import { fetchAllMatches, getPlayerAndOpponent } from "@/lib/w3cUtils";
import { flattenCountryLadder } from "@/lib/ranking";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { hasLifetimeRaceGames } from "@/lib/raceEligibility";
import {
  buildLadder,
  type LadderRow,
  type LadderInputRow,
} from "@/lib/ladderEngine";

/* =========================
   CONFIG
========================= */

const SEASON = 24;
const GAME_MODE = 1;
const GATEWAY = 20;

const MIN_GAMES = 5;
const MIN_LEAGUE = 1;
const MAX_LEAGUE = 50;

const SOS_CONCURRENCY = 25;
const MATCH_TTL = 5 * 60 * 1000;

/* =========================
   MATCH CACHE
========================= */

const matchCache = new Map<
  string,
  { ts: number; matches: any[] }
>();

/* =========================
   TYPES
========================= */

export type RaceKey =
  | "human"
  | "orc"
  | "elf"
  | "undead"
  | "random";

export type PlayerRaceLadderResponse = {
  battletag: string;
  race: RaceKey;
  me: LadderRow | null;
  top: LadderRow[];
  poolSize: number;
  full: LadderRow[];
  updatedAtUtc: string;
};

const RACE_ID: Record<RaceKey, number> = {
  human: 1,
  orc: 2,
  elf: 4,
  undead: 8,
  random: 0,
};

/* =========================
   FETCH ALL LEAGUES
========================= */

async function fetchAllLeagues(): Promise<any[]> {
  const urls: string[] = [];

  for (let league = MIN_LEAGUE; league <= MAX_LEAGUE; league++) {
    urls.push(
      `https://website-backend.w3champions.com/api/ladder/${league}?gateWay=${GATEWAY}&gameMode=${GAME_MODE}&season=${SEASON}`
    );
  }

  const results = await Promise.all(
    urls.map((url) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])
    )
  );

  return results.flat();
}

/* =========================
   SoS
========================= */

async function computeSoS(rows: LadderRow[], raceId: number) {
  for (let i = 0; i < rows.length; i += SOS_CONCURRENCY) {
    const chunk = rows.slice(i, i + SOS_CONCURRENCY);

    await Promise.all(
      chunk.map(async (row) => {
        const key = row.battletag.toLowerCase();
        const now = Date.now();

        let matches: any[];

        const cached = matchCache.get(key);

        if (cached && now - cached.ts < MATCH_TTL) {
          matches = cached.matches;
        } else {
          matches = await fetchAllMatches(row.battletag, [SEASON]);
          matchCache.set(key, { ts: now, matches });
        }

        let sum = 0;
        let n = 0;

        for (const m of matches) {
          if (m.gameMode !== GAME_MODE) continue;
          if (m.durationInSeconds < 120) continue;

          const pair = getPlayerAndOpponent(m, row.battletag);
          if (!pair) continue;

          if (raceId !== 0 && pair.me.race !== raceId) continue;
          if (typeof pair.opp.oldMmr !== "number") continue;

          sum += pair.opp.oldMmr;
          n++;
        }

        row.sos = n ? sum / n : null;
      })
    );
  }
}

/* =========================
   PUBLIC SERVICE
========================= */

export async function getPlayerRaceLadder(
  inputBattleTag: string,
  race: RaceKey,
  page = 1,
  pageSize = 50
): Promise<PlayerRaceLadderResponse | null> {
  const battletag = await resolveBattleTagViaSearch(inputBattleTag);
  if (!battletag) return null;

  const raceId = RACE_ID[race];

  const payload = await fetchAllLeagues();
  const rows = flattenCountryLadder(payload);

  /* initial cheap filters */

  const inputs: LadderInputRow[] = rows
    .filter(
      (r) =>
        r.race === raceId &&
        (r.games ?? 0) >= MIN_GAMES &&
        (r.mmr ?? 0) > 0 &&
        typeof r.battleTag === "string"
    )
    .map((r) => ({
      battletag: r.battleTag!,
      mmr: r.mmr,
      wins: r.wins,
      games: r.games,
      sos: null,
    }));

  const ladder = buildLadder(inputs);

  /* lifetime eligibility check only for rows we might show */

  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const sample = [
    ...ladder.slice(start, end),
    ...ladder.slice(0, pageSize),
  ];

  const unique = new Map(sample.map((r) => [r.battletag, r]));

  const checks = await Promise.all(
    [...unique.values()].map((r) =>
      hasLifetimeRaceGames(r.battletag, raceId, 35)
    )
  );

  const eligibility = new Map<string, boolean>();

  [...unique.values()].forEach((r, i) =>
    eligibility.set(r.battletag, checks[i])
  );

  const eligible = ladder.filter(
    (r) => eligibility.get(r.battletag) ?? true
  );

  const visible = eligible.slice(start, end);
  const top = eligible.slice(0, pageSize);

  const me =
    eligible.find(
      (r) =>
        r.battletag.toLowerCase() === battletag.toLowerCase()
    ) ?? null;

  /* compute SoS only for rows we actually show */

  const sosNeeded = new Map<string, LadderRow>();

  for (const r of visible) sosNeeded.set(r.battletag, r);
  if (me) sosNeeded.set(me.battletag, me);

  await computeSoS([...sosNeeded.values()], raceId);

  return {
    battletag,
    race,
    me,
    top,
    poolSize: eligible.length,
    full: visible,
    updatedAtUtc: new Date().toISOString(),
  };
}
