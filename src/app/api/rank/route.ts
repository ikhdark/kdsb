import { fetchPlayerProfile } from "@/services/w3cApi";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const player = searchParams.get("player");
  if (!player) return Response.json(null);

  const profile = await fetchPlayerProfile(player);

  return Response.json(profile ?? null);
}