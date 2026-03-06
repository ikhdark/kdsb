// src/services/playerConsistency.ts

import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver"
import { fetchAllMatches, getPlayerAndOpponent } from "@/lib/w3cUtils"

/* =====================================================
   CONSTANTS
===================================================== */

const SESSION_GAP_MS = 30 * 60 * 1000
const MIN_DURATION_SECONDS = 120
const SEASON = 24
const GAME_MODE = 1

/* =====================================================
   HELPERS
===================================================== */

const wr = (w: number, g: number) =>
  g ? +(w / g * 100).toFixed(2) : null

/* =====================================================
   SERVICE
===================================================== */

export async function getPlayerConsistency(input: string) {

  const battletag =
    await resolveBattleTagViaSearch(decodeURIComponent(input))

  if (!battletag) return null

  const allMatches = await fetchAllMatches(battletag, [SEASON])
  if (!allMatches.length) return null

  const matches = allMatches
    .filter(
      (m: any) =>
        m.gameMode === GAME_MODE &&
        m.durationInSeconds >= MIN_DURATION_SECONDS
    )
    .sort(
      (a: any, b: any) =>
        Date.parse(a.startTime) - Date.parse(b.startTime)
    )

  if (!matches.length) return null

  let wins = 0
  let losses = 0

  let longestWin = 0
  let longestLoss = 0
  let current = 0

  let lastTime = 0

  const sessions: {
    start: string
    games: number
    wins: number
  }[] = []

  let session:
    | {
        start: string
        games: number
        wins: number
      }
    | null = null

  const recent: boolean[] = []

  const simpleMatches: {
    startTime: string
    didWin: boolean
  }[] = []

  for (let i = 0; i < matches.length; i++) {

    const m = matches[i]

    const pair = getPlayerAndOpponent(m, battletag)
    if (!pair) continue

    const didWin = !!pair.me?.won

    simpleMatches.push({
      startTime: m.startTime,
      didWin,
    })

    if (didWin) wins++
    else losses++

    if (didWin) {
      current = current >= 0 ? current + 1 : 1
      if (current > longestWin) longestWin = current
    } else {
      current = current <= 0 ? current - 1 : -1
      const abs = -current
      if (abs > longestLoss) longestLoss = abs
    }

    const time = Date.parse(m.startTime)

    if (!session || time - lastTime > SESSION_GAP_MS) {

      if (session) sessions.push(session)

      session = {
        start: new Date(time).toISOString(),
        games: 0,
        wins: 0,
      }
    }

    session.games++
    if (didWin) session.wins++

    lastTime = time

    recent.push(didWin)
  }

  if (session) sessions.push(session)

  const totalGames = wins + losses

  const len = recent.length

  let w10 = 0
  let w25 = 0
  let w50 = 0

  for (let i = Math.max(0, len - 50); i < len; i++) {

    if (!recent[i]) continue

    if (i >= len - 10) w10++
    if (i >= len - 25) w25++
    if (i >= len - 50) w50++
  }

  const last10 = Math.min(10, len)
  const last25 = Math.min(25, len)
  const last50 = Math.min(50, len)

  return {
    battletag,

    totals: {
      games: totalGames,
      wins,
      losses,
      winrate: wr(wins, totalGames),
    },

    streaks: {
      longestWin,
      longestLoss,
      current,
    },

    sessionCount: sessions.length,

    sessions: sessions.map((s) => ({
      start: s.start,
      games: s.games,
      wins: s.wins,
      losses: s.games - s.wins,
    })),

    recent: {
      last10: wr(w10, last10),
      last25: wr(w25, last25),
      last50: wr(w50, last50),
    },

    matches: simpleMatches,
  }
}