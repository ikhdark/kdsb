// src/services/vsCountry.ts

import { fetchPlayerProfile } from "@/services/w3cApi";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

import {
  iso2,
  countryLabel,
  resolveCountryFromProfile,
  UNKNOWN_COUNTRY,
} from "@/lib/countryIso";

import { raceLabel } from "@/lib/w3cRaces";
import { getMatchesCached } from "@/services/matchCache";

import {
  W3C_CURRENT_SEASON,
  W3C_MIN_DURATION_SECONDS,
} from "@/lib/w3cConfig";

/* -------------------- CONSTANTS -------------------- */

const MIN_DURATION_SECONDS = W3C_MIN_DURATION_SECONDS;
const SEASONS = [W3C_CURRENT_SEASON] as const;

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
  oppSet: Set<string>;
  race: Map<number, CountryRaceRow>;
  mmr: { sumOpp: number; sumSelf: number; n: number };
  time: { sum: number; n: number };
};

export type W3CCountryStatsResponse = {
  battletag: string;
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

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeBT(bt: unknown): string {
  return String(bt ?? "").trim().toLowerCase();
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

  for (let i = 0; i < match.teams.length; i++) {
    const team = match.teams[i];

    if (Array.isArray(team?.players)) {
      for (let j = 0; j < team.players.length; j++) {
        players.push(team.players[j]);
      }
    }
  }

  if (players.length !== 2) return null;

  const self = players.find(
    (player) => normalizeBT(player?.battleTag) === selfLower
  );
  if (!self) return null;

  const opp = players.find((player) => player !== self);
  if (!opp) return null;

  return { self, opp };
}

/* -------------------- CORE -------------------- */

async function _getW3CCountryStatsByCanonical(
  canonicalTag: string
): Promise<W3CCountryStatsResponse | null> {
  const profile = await fetchPlayerProfile(canonicalTag);
  const targetLower = canonicalTag.toLowerCase();

  let homeCountry = resolveCountryFromProfile(profile);
  const matches = await getMatchesCached(canonicalTag, SEASONS);

  if (!homeCountry) {
    const counts = new Map<string, number>();

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const pair = pickOpponent1v1(match, targetLower);
      if (!pair) continue;

      const cc =
        iso2(pair.self?.countryCode) ||
        iso2(pair.self?.location);

      if (!cc) continue;

      counts.set(cc, (counts.get(cc) ?? 0) + 1);
    }

    if (counts.size) {
      homeCountry = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  if (!homeCountry) homeCountry = UNKNOWN_COUNTRY;

  const countryStats = new Map<string, CountryAgg>();
  let totalTimeSec = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    const dur = Number(match?.durationInSeconds);
    if (!Number.isFinite(dur) || dur < MIN_DURATION_SECONDS) continue;

    const pair = pickOpponent1v1(match, targetLower);
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

    let agg = countryStats.get(oppCC);

    if (!agg) {
      agg = {
        games: 0,
        wins: 0,
        losses: 0,
        oppSet: new Set<string>(),
        race: new Map<number, CountryRaceRow>(),
        mmr: { sumOpp: 0, sumSelf: 0, n: 0 },
        time: { sum: 0, n: 0 },
      };

      countryStats.set(oppCC, agg);
    }

    agg.games++;
    if (won) agg.wins++;
    else agg.losses++;

    if (opp?.battleTag) {
      agg.oppSet.add(normalizeBT(opp.battleTag));
    }

    if (Number.isFinite(raceId)) {
      const raceAgg =
        agg.race.get(raceId) ?? {
          games: 0,
          wins: 0,
          losses: 0,
        };

      raceAgg.games++;
      if (won) raceAgg.wins++;
      else raceAgg.losses++;

      agg.race.set(raceId, raceAgg);
    }

    if (Number.isFinite(selfOld) && Number.isFinite(oppOld)) {
      agg.mmr.sumOpp += oppOld;
      agg.mmr.sumSelf += selfOld;
      agg.mmr.n++;
    }

    agg.time.sum += dur;
    agg.time.n++;
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

  const countries = [...countryStats.entries()]
    .map(([cc, agg]) => ({
      country: cc,
      label: countryLabel(cc),
      games: agg.games,
      wins: agg.wins,
      losses: agg.losses,
      winRate: safeDiv(agg.wins, agg.games),
      uniqueOpponents: agg.oppSet.size,
      avgGamesPerOpponent: safeDiv(agg.games, agg.oppSet.size),
      avgOpponentMMR: agg.mmr.n ? agg.mmr.sumOpp / agg.mmr.n : null,
      avgSelfMMR: agg.mmr.n ? agg.mmr.sumSelf / agg.mmr.n : null,
      timePlayedSeconds: agg.time.sum,
      timeShare: totalTimeSec ? agg.time.sum / totalTimeSec : 0,
      avgGameSeconds: agg.time.n ? agg.time.sum / agg.time.n : null,
      races: [...agg.race.entries()]
        .map(([id, raceAgg]) => ({
          raceId: id,
          race: raceLabel(id),
          games: raceAgg.games,
          wins: raceAgg.wins,
          losses: raceAgg.losses,
          winRate: safeDiv(raceAgg.wins, raceAgg.games),
        }))
        .sort((a, b) => b.games - a.games),
    }))
    .sort((a, b) => b.games - a.games);

  return {
    battletag: canonicalTag,
    homeCountry,
    homeCountryLabel: countryLabel(homeCountry),
    countries,
  };
}

/* -------------------- PUBLIC -------------------- */

export async function getW3CCountryStats(
  inputBattletag: string
): Promise<W3CCountryStatsResponse | null> {
  const raw = safeDecode(String(inputBattletag ?? "")).trim();
  if (!raw) return null;

  const canonicalTag =
    (await resolveBattleTagViaSearch(raw)) || raw;

  return _getW3CCountryStatsByCanonical(canonicalTag);
}