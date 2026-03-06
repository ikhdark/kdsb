// scripts/sosCalibration.ts
import { fetchAllMatches } from "../src/lib/w3cUtils";
import { resolveBattleTagViaSearch } from "../src/lib/w3cBattleTagResolver";
import { ALL_SOS_PLAYERS } from "./sosPlayers";

const SEASONS = [24];
const MIN_DURATION_SECONDS = 120;
const GAMEMODE = 1;

const BUCKET = 50;
const MAX_EDGE = 400;

const MIN_GAMES_PER_BUCKET = 200;

/* use players from sosPlayers.ts */
const TAGS: string[] = Array.from(new Set(ALL_SOS_PLAYERS));

function clampBucket(x: number) {
  if (x >= MAX_EDGE) return MAX_EDGE;
  if (x <= -MAX_EDGE) return -MAX_EDGE;
  return Math.floor(x / BUCKET) * BUCKET;
}

type BucketStat = {
  key: number;
  games: number;
};

async function main() {
  if (!TAGS.length) {
    console.log("No battletags loaded from sosPlayers.ts");
    process.exit(1);
  }

  const bucketMap = new Map<number, BucketStat>();

  let totalGames = 0;

  for (const input of TAGS) {
    const battletag = await resolveBattleTagViaSearch(input);
    if (!battletag) continue;

    const matches = await fetchAllMatches(battletag, SEASONS);
    if (!matches?.length) continue;

    const meTagLower = battletag.toLowerCase();

    for (const match of matches) {
      if (match.durationInSeconds < MIN_DURATION_SECONDS) continue;
      if (match.gameMode !== GAMEMODE) continue;
      if (!match.teams || match.teams.length !== 2) continue;

      const [teamA, teamB] = match.teams;
      const pA = teamA.players?.[0];
      const pB = teamB.players?.[0];
      if (!pA || !pB) continue;

      const tagA = pA.battleTag?.toLowerCase();
      const tagB = pB.battleTag?.toLowerCase();

      const me =
        tagA === meTagLower ? pA :
        tagB === meTagLower ? pB :
        null;

      if (!me) continue;

      const opp = me === pA ? pB : pA;

      if (typeof opp.oldMmr !== "number") continue;

      const key = clampBucket(opp.oldMmr);

      let b = bucketMap.get(key);
      if (!b) {
        b = { key, games: 0 };
        bucketMap.set(key, b);
      }

      b.games++;
      totalGames++;
    }
  }

  console.log(`\nTotal games used: ${totalGames}`);
  if (!totalGames) return;

  const rows = [...bucketMap.values()].sort((a, b) => a.key - b.key);

  console.log(`\nOpponent MMR buckets, bucket=${BUCKET}, cap=±${MAX_EDGE}`);
  console.log(`Only printing buckets with >= ${MIN_GAMES_PER_BUCKET} games\n`);

  for (const r of rows) {
    if (r.games < MIN_GAMES_PER_BUCKET) continue;

    const pct = (r.games / totalGames) * 100;

    const label =
      r.key === MAX_EDGE ? `>=${MAX_EDGE}` :
      r.key === -MAX_EDGE ? `<=-${MAX_EDGE}` :
      `${r.key}..${r.key + BUCKET}`;

    console.log(
      `${label.padStart(10)}  n=${String(r.games).padStart(6)}  ` +
      `share=${pct.toFixed(2).padStart(6)}%`
    );
  }

  console.log("\nInterpretation:");
  console.log("- Shows distribution of opponent MMR faced.");
  console.log("- If higher MMR buckets dominate, schedule is harder.");
  console.log("- If lower MMR buckets dominate, schedule is easier.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});