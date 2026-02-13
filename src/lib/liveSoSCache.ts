import { fetchAllMatches, getPlayerAndOpponent } from "@/lib/w3cUtils"

const SEASON = 24
const GAME_MODE = 1

const PLAYER_TTL = 10 * 60 * 1000 // 10 minutes

type CacheEntry = {
  value: number
  timestamp: number
}

const playerCache = new Map<string, CacheEntry>()

export async function getLiveSoS(
  battletag: string
): Promise<number | null> {
  const key = battletag.toLowerCase()
  const now = Date.now()

  const cached = playerCache.get(key)

  if (cached && now - cached.timestamp < PLAYER_TTL) {
    return cached.value
  }

  const matches = await fetchAllMatches(battletag, [SEASON])

  let sum = 0
  let n = 0

  for (const m of matches) {
    if (m.gameMode !== GAME_MODE) continue
    if (m.durationInSeconds < 120) continue

    const pair = getPlayerAndOpponent(m, battletag)
    if (!pair) continue

    const opp =
      pair.opp.oldMmr ??
      pair.opp.newMmr ??
      pair.opp.mmr

    if (typeof opp !== "number") continue

    sum += opp
    n++
  }

  const sos = n ? sum / n : null

  if (sos !== null) {
    playerCache.set(key, {
      value: sos,
      timestamp: now,
    })
  }

  return sos
}