// src/app/api/match-history/route.ts

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { fetchMatchHistory } from "@/services/matchHistory";

async function loadMatchHistory(player: string) {
  const canonical = await resolveBattleTagViaSearch(player);
  if (!canonical) return [];
  return fetchMatchHistory(canonical);
}

export async function GET(req: Request) {
  const player = new URL(req.url).searchParams.get("player")?.trim();

  if (!player) return Response.json([]);

  try {
    const matches = await loadMatchHistory(player);
    return Response.json(matches ?? []);
  } catch {
    return Response.json([]);
  }
}