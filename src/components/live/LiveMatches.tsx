"use client"

import { useEffect, useRef, useState } from "react"
import LiveMatchCard from "./LiveMatchCard"

type Player = {
  name: string
  battleTag: string
  oldMmr: number
  race: number
  mmrIfWin: number
  mmrIfLose: number
  ping: number
}

type ProcessedMatch = {
  id: string
  mapName: string
  serverName: string
  playerA: Player
  playerB: Player
  winProbA: number
  pingDiff: number
  startedMinutesAgo: number
  blendedAvg: number
}

const ENDPOINT =
  "https://website-backend.w3champions.com/api/matches/ongoing?offset=0&gateway=20&pageSize=50&gameMode=1&map=Overall&sort=startTimeDescending"

function calcMmrDelta(prob: number) {
  const confidence = Math.abs(prob - 0.5)

  const K =
    confidence > 0.40 ? 24 :
    confidence > 0.25 ? 18 :
    16

  const win = Math.round(K * (1 - prob))
  const lose = Math.round(K * (0 - prob))

  return { win, lose }
}

export default function LiveMatches() {
  const [matches, setMatches] = useState<ProcessedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const isFetchingRef = useRef(false)

  async function fetchMatches() {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    try {
      const res = await fetch(ENDPOINT, { cache: "no-store" })

      if (!res.ok) {
        console.error("Live endpoint failed:", res.status)
        return
      }

      const data = await res.json()
      const now = Date.now()

      const processed: ProcessedMatch[] = data.matches
        .filter((m: any) => m.teams?.length === 2)
        .map((m: any) => {
          const p1 = m.teams[0].players[0]
          const p2 = m.teams[1].players[0]

          const mmrA = p1.oldMmr ?? 0
          const mmrB = p2.oldMmr ?? 0

          const serverInfos = m.serverInfo?.playerServerInfos
          const pingA = serverInfos?.[0]?.averagePing ?? 0
          const pingB = serverInfos?.[1]?.averagePing ?? 0

          const diff = mmrA - mmrB
          const probA = 1 / (1 + Math.pow(10, -diff / 400))
          const winProbA = Math.round(probA * 100)

          const deltaA = calcMmrDelta(probA)
          const deltaB = calcMmrDelta(1 - probA)

          const startedMinutesAgo = Math.floor(
            (now - new Date(m.startTime).getTime()) / 60000
          )

          return {
            id: m.id,
            mapName: m.mapName,
            serverName: m.serverInfo?.name ?? "Unknown",

            playerA: {
              name: p1.name,
              battleTag: p1.battleTag,
              oldMmr: mmrA,
              race: typeof p1.race === "number" ? p1.race : 0,
              mmrIfWin: deltaA.win,
              mmrIfLose: deltaA.lose,
              ping: pingA,
            },

            playerB: {
              name: p2.name,
              battleTag: p2.battleTag,
              oldMmr: mmrB,
              race: typeof p2.race === "number" ? p2.race : 0,
              mmrIfWin: deltaB.win,
              mmrIfLose: deltaB.lose,
              ping: pingB,
            },

            winProbA,
            pingDiff: Math.abs(pingA - pingB),
            startedMinutesAgo,
            blendedAvg: (mmrA + mmrB) / 2,
          }
        })
        .sort((a: ProcessedMatch, b: ProcessedMatch) => b.blendedAvg - a.blendedAvg)

      setMatches(processed)
      setLoading(false)

    } catch (err) {
      console.error(err)
    } finally {
      isFetchingRef.current = false
    }
  }

  useEffect(() => {
    fetchMatches()

    const interval = setInterval(fetchMatches, 20000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div>Loading live matches...</div>

  return (
    <div className="space-y-4">
      {matches.map((match) => (
        <LiveMatchCard key={match.id} match={match} />
      ))}
    </div>
  )
}