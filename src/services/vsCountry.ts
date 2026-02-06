// src/services/vsCountry.ts
import { fetchPlayerProfile } from "./w3cApi";
import { fetchAllMatches } from "../lib/w3cUtils";
import { resolveBattleTagViaSearch } from "../lib/w3cBattleTagResolver";

import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

/* -------------------- CONSTANTS -------------------- */

const MIN_DURATION_SECONDS = 120;
const SEASONS = [24];

const UNKNOWN_COUNTRY = "UN";

const COUNTRY_SHORT: Record<string, string> = {
  US: "USA",
  GB: "UK",
  KR: "Korea",
  CN: "China",
  RU: "Russia",
  BR: "Brazil",
  DE: "Germany",
  FR: "France",
  PL: "Poland",
  PE: "Peru",
  PH: "Philippines",
  TW: "Taiwan",
  UA: "Ukraine",
  CF: "CAR",
};

// W3C race IDs: 1 Human, 2 Orc, 4 Night Elf, 8 Undead, 0 Random
const RACE_LABEL: Record<number, string> = {
  0: "Random",
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
};

/* -------------------- TYPES -------------------- */

type CountryRaceRow = {
  games: number;
  wins: number;
  losses: number;
};

type CountryAgg = {
  games: number;
  wins: number;
  losses: number;
  oppSet: Set<string>; // lowercased battletags
  race: Map<number, CountryRaceRow>;
  mmr: { sumOpp: number; sumSelf: number; n: number };
  time: { sum: number; n: number };
};

export type W3CCountryStatsResponse = {
  battletag: string; // canonical casing
  homeCountry: string;
  homeCountryLabel: string;
  countries: {
    country: string;
    label: string;
    games: number;
    wins: number;
    losses: number;
    winRate: number;
    uniqueOpponents: number;
    avgGamesPerOpponent: number;
    avgOpponentMMR: number | null;
    avgSelfMMR: number | null;
    timePlayedSeconds: number;
    timeShare: number;
    avgGameSeconds: number | null;
    races: {
      raceId: number;
      race: string;
      games: number;
      wins: number;
      losses: number;
      winRate: number;
    }[];
  }[];
};

/* -------------------- HELPERS -------------------- */

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function normalizeBT(bt: unknown): string {
  return String(bt ?? "").trim().toLowerCase();
}

function iso2(code: unknown): string {
  const c = String(code ?? "").trim().toUpperCase();
  return c.length === 2 ? c : "";
}

function resolveCountryFromProfile(profile: any): string {
  return iso2(profile?.countryCode || profile?.location || "");
}

function countryLabel(code: string): string {
  if (!code || code === UNKNOWN_COUNTRY) return "Unknown";
  return COUNTRY_SHORT[code] || countries.getName(code, "en") || code;
}

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

function pickOpponent1v1(
  match: any,
  selfLower: string
): { self: any; opp: any } | null {
  if (!Array.isArray(match?.teams)) return null;

  const players: any[] = [];
  for (const t of match.teams) {
    if (Array.isArray(t?.players)) {
      for (const p of t.players) players.push(p);
    }
  }

  if (players.length !== 2) return null;

  const self = players.find((p) => normalizeBT(p?.battleTag) === selfLower);
  if (!self) return null;

  const opp = players.find((p) => p !== self);
  if (!opp) return null;

  return { self, opp };
} 

/* -------------------- SERVICE -------------------- */

export async function getW3CCountryStats(
  inputBattletag: string
): Promise<W3CCountryStatsResponse | null> {
  const raw = safeDecode(String(inputBattletag ?? "")).trim();
  if (!raw) return null;

const canonicalTag =
  (await resolveBattleTagViaSearch(raw)) || raw;

  const profile = await fetchPlayerProfile(canonicalTag);

  const targetLower = canonicalTag.toLowerCase();

  let homeCountry = resolveCountryFromProfile(profile);

// matches: try canonical first, then lowercase fallback (some endpoints behave that way)
const matches = await fetchAllMatches(canonicalTag, SEASONS);


// TEMP: do NOT early-return

  // Fallback: infer home country from YOUR match rows (majority vote)
if (!homeCountry) {
  const counts = new Map<string, number>();

  for (const m of matches) {
    const pair = pickOpponent1v1(m, targetLower);
    if (!pair) continue;

    const cc =
      iso2(pair.self?.countryCode) ||
      iso2(pair.self?.location);

    if (!cc) continue;

    counts.set(cc, (counts.get(cc) ?? 0) + 1);
  }

  if (counts.size) {
    homeCountry = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])[0][0];
  }
}

if (!homeCountry) homeCountry = UNKNOWN_COUNTRY;

  const countryStats = new Map<string, CountryAgg>();
  let totalTimeSec = 0;

  for (const m of matches) {
    const dur = Number(m?.durationInSeconds);
    if (!Number.isFinite(dur) || dur < MIN_DURATION_SECONDS) continue;



    const pair = pickOpponent1v1(m, targetLower);
    if (!pair) continue;

    const { self, opp } = pair;

const oppCC =
  iso2(opp?.countryCode) ||
  iso2(opp?.location);

if (!oppCC) continue;

    const won = !!self?.won;
    const raceId = Number(opp?.race);
    const selfOld = Number(self?.oldMmr);
    const oppOld = Number(opp?.oldMmr);

    let cs = countryStats.get(oppCC);
    if (!cs) {
      cs = {
        games: 0,
        wins: 0,
        losses: 0,
        oppSet: new Set(),
        race: new Map(),
        mmr: { sumOpp: 0, sumSelf: 0, n: 0 },
        time: { sum: 0, n: 0 },
      };
      countryStats.set(oppCC, cs);
    }

    cs.games++;
    won ? cs.wins++ : cs.losses++;

    if (opp?.battleTag) cs.oppSet.add(normalizeBT(opp.battleTag));

    if (Number.isFinite(raceId)) {
      const r = cs.race.get(raceId) ?? { games: 0, wins: 0, losses: 0 };
      r.games++;
      won ? r.wins++ : r.losses++;
      cs.race.set(raceId, r);
    }

    if (Number.isFinite(selfOld) && Number.isFinite(oppOld)) {
      cs.mmr.sumOpp += oppOld;
      cs.mmr.sumSelf += selfOld;
      cs.mmr.n++;
    }

    cs.time.sum += dur;
    cs.time.n++;
    totalTimeSec += dur;
  }

if (!countryStats.size) {
  return {
    battletag: canonicalTag,
    homeCountry,
    homeCountryLabel: countryLabel(homeCountry),
    countries: [],
  };
}

  const rows = [...countryStats.entries()].map(([cc, cs]) => ({
    country: cc,
    label: countryLabel(cc),
    games: cs.games,
    wins: cs.wins,
    losses: cs.losses,
    winRate: safeDiv(cs.wins, cs.games),
    uniqueOpponents: cs.oppSet.size,
    avgGamesPerOpponent: safeDiv(cs.games, cs.oppSet.size),
    avgOpponentMMR: cs.mmr.n ? cs.mmr.sumOpp / cs.mmr.n : null,
    avgSelfMMR: cs.mmr.n ? cs.mmr.sumSelf / cs.mmr.n : null,
    timePlayedSeconds: cs.time.sum,
    timeShare: totalTimeSec ? cs.time.sum / totalTimeSec : 0,
    avgGameSeconds: cs.time.n ? cs.time.sum / cs.time.n : null,
    races: [...cs.race.entries()].map(([id, r]) => ({
      raceId: id,
      race: RACE_LABEL[id] || `Race ${id}`,
      games: r.games,
      wins: r.wins,
      losses: r.losses,
      winRate: safeDiv(r.wins, r.games),
    })),
  }));

  return {
    battletag: canonicalTag,
    homeCountry,
    homeCountryLabel: countryLabel(homeCountry),
    countries: rows.sort((a, b) => b.games - a.games),
  };
}
