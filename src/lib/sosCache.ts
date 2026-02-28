import {
  fetchAllLeagues,
  buildInputs,
  computeSoS,
} from "@/services/ladderCore"

import { buildLadder } from "@/lib/ladderEngine"
import type { LadderRow } from "@/lib/ladderEngine"
import { unstable_cache } from "next/cache"

/* =========================
   SoS (Next.js Data Cache - 5 min)
========================= */

export const getSoSMap = unstable_cache(
  async (): Promise<Map<string, number>> => {
    console.log("Rebuilding SoS cache (ISR 5 min)...")

    const rows = await fetchAllLeagues()
    const inputs = buildInputs(rows)
    const ladder: LadderRow[] = buildLadder(inputs)

    await computeSoS(ladder)

    const map = new Map<string, number>(
      ladder
        .filter((r) => r.sos != null)
        .map((r) => [
          r.battletag.toLowerCase(),
          r.sos as number,
        ])
    )

    console.log(`SoS cache built with ${map.size} players`)

    return map
  },
  ["global-sos-map"],
  { revalidate: 300 } // 5 minutes
)

/* =========================
   FORCE REBUILD (optional)
========================= */

export async function rebuildSoSCache(): Promise<Map<string, number>> {
  // In ISR world, this simply re-calls and lets revalidate window handle it
  return getSoSMap()
}