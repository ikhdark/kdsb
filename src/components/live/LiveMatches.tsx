"use client"

import { useEffect, useState } from "react"
import LiveMatchCard from "./LiveMatchCard"

type Player = {
  name: string
  battleTag: string
  oldMmr: number
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

export default function LiveMatches() {
  const [matches, setMatches] = useState<ProcessedMatch[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchMatches(currentTime: number) {
    try {
      const res = await fetch(ENDPOINT)
      const data = await res.json()

      // Collect unique live players
      const livePlayers = new Set<string>()

      data.matches.forEach((m: any) => {
        if (m.teams?.length === 2) {
          livePlayers.add(m.teams[0].players[0].battleTag)
          livePlayers.add(m.teams[1].players[0].battleTag)
        }
      })

      // Request SoS only for live players
      const sosRes = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: Array.from(livePlayers),
        }),
      })

      const sosData = await sosRes.json()

      const processed: ProcessedMatch[] = data.matches
        .filter((m: any) => m.teams?.length === 2)
        .map((m: any) => {
          const p1 = m.teams[0].players[0]
          const p2 = m.teams[1].players[0]

          const mmrA = p1.oldMmr ?? 0
          const mmrB = p2.oldMmr ?? 0

          const sosA = sosData[p1.battleTag.toLowerCase()]
          const sosB = sosData[p2.battleTag.toLowerCase()]

          // Directional ping advantage
          const pingA =
            m.serverInfo?.playerServerInfos?.[0]?.averagePing ?? 0
          const pingB =
            m.serverInfo?.playerServerInfos?.[1]?.averagePing ?? 0

          const pingAdvantage = pingB - pingA
          const pingRatingImpact = pingAdvantage * 0.5 // 10ms ≈ 5 rating

          // Balanced blended model
          const blendedA =
            (sosA ?? mmrA) * 0.7 +
            mmrA * 0.3 +
            pingRatingImpact * 0.1

          const blendedB =
            (sosB ?? mmrB) * 0.7 +
            mmrB * 0.3 -
            pingRatingImpact * 0.1

          const diff = blendedA - blendedB

          const probA =
            1 / (1 + Math.pow(10, -diff / 400))

          const winProbA = Math.round(probA * 100)

          const pingDiff = Math.abs(pingA - pingB)

          const startedMinutesAgo = Math.floor(
            (currentTime - new Date(m.startTime).getTime()) / 60000
          )

          return {
            id: m.id,
            mapName: m.mapName,
            serverName: m.serverInfo?.name ?? "Unknown",
            playerA: {
              name: p1.name,
              battleTag: p1.battleTag,
              oldMmr: mmrA,
            },
            playerB: {
              name: p2.name,
              battleTag: p2.battleTag,
              oldMmr: mmrB,
            },
            winProbA,
            pingDiff,
            startedMinutesAgo,
            blendedAvg: (blendedA + blendedB) / 2,
          }
        })
        .sort(
          (a: ProcessedMatch, b: ProcessedMatch) =>
            b.blendedAvg - a.blendedAvg
        )

      setMatches(processed)
      setLoading(false)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchMatches(Date.now())

    const interval = setInterval(() => {
      fetchMatches(Date.now())
    }, 20000)

    return () => clearInterval(interval)
  }, [])

  if (loading)
    return <div>Loading live matches...</div>

  return (
    <div className="space-y-4">
      {matches.map((match) => (
        <LiveMatchCard key={match.id} match={match} />
      ))}
    </div>
  )
}