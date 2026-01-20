import axios from "axios";

const GATEWAY = 20;
const PAGE_SIZE = 50;

export const RACE_MAP: Record<number, string> = {
  0: "Random",
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
};

export function resolveQueuedRace(player: any): string {
  return RACE_MAP[player?.race] || "Unknown";
}

export function resolveEffectiveRace(player: any): string {
  return RACE_MAP[player?.race] || "Unknown";
}

export async function resolveBattleTagForMatches(
  inputTag: string
): Promise<string | null> {
  const tag = String(inputTag || "").trim();
  if (!tag.includes("#")) return null;

  const [name] = tag.split("#");
  if (!name) return null;

  const url = `https://website-backend.w3champions.com/api/players/search?name=${encodeURIComponent(
    name
  )}`;

  try {
    const res = await axios.get(url);
    const players = res.data;

    if (!Array.isArray(players)) return null;

    const targetLower = tag.toLowerCase();
    const hit = players.find(
      (p: any) =>
        typeof p?.battleTag === "string" &&
        p.battleTag.toLowerCase() === targetLower
    );

    return hit?.battleTag ?? null;
  } catch {
    return null;
  }
}

export async function fetchAllMatches(
  battleTag: string,
  seasons: number[] = [20, 21, 22, 23]
): Promise<any[]> {
  const encodedTag = encodeURIComponent(battleTag);
  const allMatches: any[] = [];

  for (const season of seasons) {
    let offset = 0;

    while (true) {
      const url =
        `https://website-backend.w3champions.com/api/matches/search` +
        `?playerId=${encodedTag}` +
        `&gateway=${GATEWAY}` +
        `&season=${season}` +
        `&offset=${offset}` +
        `&pageSize=${PAGE_SIZE}`;

      const res = await axios.get(url);
      const matches = res.data?.matches;

      if (!Array.isArray(matches) || matches.length === 0) break;

      allMatches.push(...matches);
      if (matches.length < PAGE_SIZE) break;

      offset += PAGE_SIZE;
    }
  }

  return allMatches;
}

export function getPlayerAndOpponent(
  match: any,
  battleTag: string
): { me: any; opp: any } | null {
  if (!Array.isArray(match?.teams)) return null;

  const players = match.teams.flatMap((t: any) => t.players ?? []);
  const target = String(battleTag || "").toLowerCase();

  const me = players.find(
    (p: any) => p?.battleTag?.toLowerCase() === target
  );
  if (!me) return null;

  const opp = players.find(
    (p: any) => p?.battleTag?.toLowerCase() !== target
  );
  if (!opp) return null;

  return { me, opp };
}
