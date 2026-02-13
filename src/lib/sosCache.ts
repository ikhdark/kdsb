import {
  fetchAllLeagues,
  buildInputs,
  computeSoS,
} from "@/services/ladderCore"

import { buildLadder } from "@/lib/ladderEngine"
import type { LadderRow } from "@/lib/ladderEngine"

/* =========================
   CONFIG
========================= */

const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

/* =========================
   IN-MEMORY CACHE
========================= */

let lastBuild = 0
let sosMap = new Map<string, number>()

/* =========================
   BUILD / GET
========================= */

export async function getSoSMap(): Promise<Map<string, number>> {
  const now = Date.now()

  if (now - lastBuild < CACHE_TTL && sosMap.size > 0) {
    return sosMap
  }

  console.log("Rebuilding SoS cache...")

  const rows = await fetchAllLeagues()
  const inputs = buildInputs(rows)
  const ladder: LadderRow[] = buildLadder(inputs)

  await computeSoS(ladder)

  sosMap = new Map(
    ladder
      .filter((r) => r.sos != null)
      .map((r) => [
        r.battletag.toLowerCase(),
        r.sos as number,
      ])
  )

  lastBuild = now

  console.log(
    `SoS cache built with ${sosMap.size} players`
  )

  return sosMap
}

/* =========================
   FORCE REBUILD
========================= */

export async function rebuildSoSCache(): Promise<Map<string, number>> {
  lastBuild = 0
  sosMap.clear()
  return getSoSMap()
}