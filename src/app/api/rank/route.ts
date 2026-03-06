import { fetchPlayerProfile } from "@/services/w3cApi";

export async function GET(req: Request) {
  const player = new URL(req.url).searchParams.get("player");
  if (!player) return Response.json(null);

  try {
    const profile = await fetchPlayerProfile(player);
    return Response.json(profile ?? null);
  } catch {
    return Response.json(null);
  }
}