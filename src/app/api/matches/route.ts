// src/app/api/match-history/route.ts

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver"
import { fetchMatchHistory } from "@/services/matchHistory"
import { unstable_cache } from "next/cache"

/* =====================================================
   Cached Match History (5 min)
===================================================== */

const getCachedMatchHistory = unstable_cache(
  async (player: string) => {
    const canonical = await resolveBattleTagViaSearch(player)
    if (!canonical) return []
    return fetchMatchHistory(canonical)
  },
  ["match-history"],
  { revalidate: 300 } // 5 minutes
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const player = searchParams.get("player")

  if (!player) return Response.json([])

  const matches = await getCachedMatchHistory(player)

  return Response.json(matches ?? [])
}