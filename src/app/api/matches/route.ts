import { fetchMatchHistory } from "@/services/matchHistory";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const player = searchParams.get("player");
  if (!player) return Response.json([]);

  const canonical = await resolveBattleTagViaSearch(player);
  if (!canonical) return Response.json([]);

  const matches = await fetchMatchHistory(canonical);

  return Response.json(matches ?? []);
}