import { fetchAllMatches, resolveEffectiveRace } from "../lib/w3cUtils";
import { resolveBattleTagViaSearch } from "../lib/w3cBattleTagResolver";

/* -------------------- CONSTANTS -------------------- */

const SEASONS = [20, 21, 22, 23];
const CURRENT_SEASON = SEASONS[SEASONS.length - 1];
const LAST_3_SEASONS = SEASONS.slice(-3);

const MIN_DURATION_SECONDS = 120;
const MAX_EXTREME_ABS_MMR_CHANGE = 30;
const HIGH_GAIN_THRESHOLD = 15;

/* -------------------- TYPES -------------------- */

type AnyMatch = any;

type GainGame = {
  gain: number;
  myRace: string;
  myMMR: number;
  oppName: string;
  oppRace: string;
  oppMMR: number;
};

type Peak = {
  mmr: number;
  season: number;
  game: number;
};

/* -------------------- PAIRING (CASE-INSENSITIVE) -------------------- */
// This is the bugfix: your "advanced sections" depended on a pairing function.
// If pairing is case-sensitive, it silently fails for most users (but works for you).
function getPlayerAndOpponentCI(match: any, targetKeyLower: string) {
  const teams = match?.teams ?? [];
  const players: any[] = teams.flatMap((t: any) => t?.players ?? []);

  if (players.length < 2) return null;

  const me = players.find(
    (p: any) =>
      typeof p?.battleTag === "string" &&
      p.battleTag.toLowerCase() === targetKeyLower
  );
  if (!me) return null;

  // 1v1 assumption: opponent is the "other" player
  const opp = players.find(
    (p: any) =>
      p !== me &&
      typeof p?.battleTag === "string" &&
      p.battleTag.toLowerCase() !== targetKeyLower
  );
  if (!opp) return null;

  return { me, opp };
}

/* -------------------- SERVICE -------------------- */

export async function getPlayerSummary(inputTag: string) {
  const raw = String(inputTag ?? "").trim();
  if (!raw) return null;

  /* =====================================================
     CANONICAL RESOLUTION (SEARCH BAR AUTHORITY)
     ===================================================== */

  const canonicalBattleTag = await resolveBattleTagViaSearch(raw);
  if (!canonicalBattleTag) return null;

  const allMatches: AnyMatch[] = await fetchAllMatches(canonicalBattleTag, SEASONS);
  if (!allMatches.length) return null;

  const targetKeyLower = canonicalBattleTag.toLowerCase();

  allMatches.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  /* ───────── Recent Stats ───────── */

  const raceGamesAllTime: Record<string, number> = {};
  const raceGamesCurrentSeason: Record<string, number> = {};
  const lastPlayedRace: Record<string, Date> = {};
  const raceMMRCurrent: Record<string, number> = {};
  let highestCurrentRace: string | null = null;

  for (const match of allMatches) {
    if (match.gameMode !== 1) continue;

    const date = new Date(match.startTime);
    const season = match.season;

    for (const team of match.teams ?? []) {
      for (const player of team.players ?? []) {
        if (player?.battleTag?.toLowerCase() !== targetKeyLower) continue;

        const race = resolveEffectiveRace(player);
        const mmr = player.currentMmr;

        raceGamesAllTime[race] = (raceGamesAllTime[race] || 0) + 1;

        if (season === CURRENT_SEASON) {
          raceGamesCurrentSeason[race] = (raceGamesCurrentSeason[race] || 0) + 1;
        }

        lastPlayedRace[race] = date;

        if (typeof mmr === "number") {
          raceMMRCurrent[race] = mmr;
          if (!highestCurrentRace || mmr > (raceMMRCurrent[highestCurrentRace] ?? 0)) {
            highestCurrentRace = race;
          }
        }
      }
    }
  }

  const lastPlayedLadder = Object.values(lastPlayedRace).sort(
    (a, b) => b.getTime() - a.getTime()
  )[0];

  /* ───────── Filtered Matches ───────── */

  const filteredMatches = allMatches.filter((match) => {
    if (match.gameMode !== 1) return false;
    if (match.durationInSeconds < MIN_DURATION_SECONDS) return false;

    const pair = getPlayerAndOpponentCI(match, targetKeyLower);
    if (!pair) return false;

    const { me, opp } = pair;

    if (
      typeof me.mmrGain !== "number" ||
      typeof me.oldMmr !== "number" ||
      typeof opp.oldMmr !== "number"
    ) {
      return false;
    }

    return Math.abs(me.mmrGain) <= MAX_EXTREME_ABS_MMR_CHANGE;
  });

  /* ───────── Performance Stats ───────── */

  const raceCounters: Record<string, number> = {};
  const racePeaks: Record<string, Peak> = {};

  let largestSingleGain: number | null = null;
  let fallbackMaxGame: GainGame | null = null;
  const highGainGames: GainGame[] = [];

  let largestGapWin: (GainGame & { gap: number }) | null = null;

  for (const match of filteredMatches) {
    if (!LAST_3_SEASONS.includes(match.season)) continue;

    const pair = getPlayerAndOpponentCI(match, targetKeyLower);
    if (!pair) continue;

    const { me, opp } = pair;
    const race = resolveEffectiveRace(me);

    raceCounters[race] ??= 0;
    raceCounters[race]++;

    // Your original rule (kept): only start peaks after 35 games per race
    if (raceCounters[race] <= 35) continue;

    if (typeof me.currentMmr === "number") {
      if (!racePeaks[race] || me.currentMmr > racePeaks[race].mmr) {
        racePeaks[race] = {
          mmr: me.currentMmr,
          season: match.season,
          game: raceCounters[race],
        };
      }
    }

    if (me.mmrGain >= HIGH_GAIN_THRESHOLD) {
      highGainGames.push({
        gain: me.mmrGain,
        myRace: race,
        myMMR: me.oldMmr,
        oppName: opp.battleTag,
        oppRace: resolveEffectiveRace(opp),
        oppMMR: opp.oldMmr,
      });
    }

    if (largestSingleGain === null || me.mmrGain > largestSingleGain) {
      largestSingleGain = me.mmrGain;
      fallbackMaxGame = {
        gain: me.mmrGain,
        myRace: race,
        myMMR: me.oldMmr,
        oppName: opp.battleTag,
        oppRace: resolveEffectiveRace(opp),
        oppMMR: opp.oldMmr,
      };
    }

    const gap = Math.abs(me.oldMmr - opp.oldMmr);
    if (me.won && me.oldMmr < opp.oldMmr) {
      if (!largestGapWin || gap > largestGapWin.gap) {
        largestGapWin = {
          gap,
          gain: me.mmrGain,
          myRace: race,
          myMMR: me.oldMmr,
          oppName: opp.battleTag,
          oppRace: resolveEffectiveRace(opp),
          oppMMR: opp.oldMmr,
        };
      }
    }
  }

  const gainGamesToShow =
    highGainGames.length > 0 ? highGainGames : fallbackMaxGame ? [fallbackMaxGame] : [];

  const mostPlayedAllTime =
    Object.entries(raceGamesAllTime).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

  const mostPlayedThisSeason =
    Object.entries(raceGamesCurrentSeason).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Unknown";

  const timeAgo = (d: Date) => {
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return days === 0 ? "0 days ago" : `${days} days ago`;
  };

  const top2PeaksText = Object.entries(racePeaks)
    .sort((a, b) => b[1].mmr - a[1].mmr)
    .slice(0, 2)
    .map(([race, d]) => `${race}: ${d.mmr} MMR (Season ${d.season}, Game ${d.game})`)
    .join("\n");

  const result = `
📊 W3Champions Summary — ${canonicalBattleTag}
Most played race (all-time): ${mostPlayedAllTime}
Most played race (Season ${CURRENT_SEASON}): ${mostPlayedThisSeason}
Race with current highest MMR: ${highestCurrentRace}: ${
    highestCurrentRace ? raceMMRCurrent[highestCurrentRace] : "N/A"
  } MMR
Last played current highest MMR race: ${highestCurrentRace}, ${
    highestCurrentRace && lastPlayedRace[highestCurrentRace]
      ? `${lastPlayedRace[highestCurrentRace].toLocaleDateString()} (${timeAgo(
          lastPlayedRace[highestCurrentRace]
        )})`
      : "N/A"
  }
Last played ladder (any race): ${
    lastPlayedLadder ? `${lastPlayedLadder.toLocaleDateString()} (${timeAgo(lastPlayedLadder)})` : "N/A"
  }

📈 Top 2 Race Peak MMRs in last 3 seasons
${top2PeaksText}

📊 MMR/Performance (Last 3 Seasons)
${
    gainGamesToShow.length
      ? `Largest single-game gain in last 3 seasons (If +15 or more, all games will show)\n` +
        Object.entries(
          gainGamesToShow.reduce<Record<string, GainGame[]>>((acc, g) => {
            acc[g.myRace] ??= [];
            acc[g.myRace].push(g);
            return acc;
          }, {})
        )
          .map(
            ([race, games]) =>
              `${race}\n` +
              games
                .map(
                  (g) =>
                    `(${g.myMMR}) vs ${g.oppName} ${g.oppRace} (${g.oppMMR}) | +${g.gain}`
                )
                .join("\n")
          )
          .join("\n\n")
      : "Largest single-game MMR gain: N/A"
  }

${
    largestGapWin
      ? `Largest gap MMR win in last 3 seasons: ${largestGapWin.myRace} (${largestGapWin.myMMR}) vs ${largestGapWin.oppName} ${largestGapWin.oppRace} (${largestGapWin.oppMMR}) | +${largestGapWin.gap}`
      : "Largest gap win: N/A"
  }
`.trim();

  return {
    result,
    summary: {
      battletag: canonicalBattleTag,
      mostPlayedAllTime,
      mostPlayedThisSeason,
      highestCurrentRace,
      highestCurrentMMR: highestCurrentRace ? raceMMRCurrent[highestCurrentRace] : null,
      lastPlayedLadder: lastPlayedLadder?.toISOString() ?? null,
      lastPlayedRace: Object.fromEntries(
        Object.entries(lastPlayedRace).map(([k, v]) => [k, v.toISOString()])
      ),
      top2Peaks: Object.entries(racePeaks)
        .sort((a, b) => b[1].mmr - a[1].mmr)
        .slice(0, 2)
        .map(([race, d]) => ({ race, ...d })),
      gainGamesToShow,
      largestGapWin,
    },
  };
}
