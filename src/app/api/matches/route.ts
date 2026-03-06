// src/app/api/match-history/route.ts

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver"
import { fetchMatchHistory } from "@/services/matchHistory"
import { unstable_cache } from "next/cache"

/* =====================================================
   Cached Match History (5 min)
===================================================== */

async function loadMatchHistory(player: string) {
  const canonical = await resolveBattleTagViaSearch(player)
  if (!canonical) return []
  return fetchMatchHistory(canonical)
}

const getCachedMatchHistory = (player: string) =>
  unstable_cache(
    () => loadMatchHistory(player),
    ["match-history", player],
    { revalidate: 300 }
  )()

export async function GET(req: Request) {
  const player = new URL(req.url).searchParams.get("player")?.trim()

  if (!player) return Response.json([])

  try {
    const matches = await getCachedMatchHistory(player)
    return Response.json(matches ?? [])
  } catch {
    return Response.json([])
  }
}