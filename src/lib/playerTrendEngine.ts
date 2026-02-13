export type TrendPoint = {
  mmr: number
  mmrDelta: number
}

export type PlayerTrendAnalysis = {
  last20Net: number
  last50Net: number
  avgSwing: number
  direction: "up" | "down" | "flat"
  improving: boolean
  plateau: boolean
}

/* =========================
   MAIN ENTRY
========================= */

export function analyzeTrend(
  timeline: TrendPoint[]
): PlayerTrendAnalysis {

  if (timeline.length < 2) {
    return {
      last20Net: 0,
      last50Net: 0,
      avgSwing: 0,
      direction: "flat",
      improving: false,
      plateau: false,
    }
  }

  const mmrSeries = timeline.map(t => t.mmr)
  const deltas = timeline.map(t => t.mmrDelta)

  const last20 = mmrSeries.slice(-20)
  const last50 = mmrSeries.slice(-50)

  const last20Net =
    last20.length >= 2
      ? last20[last20.length - 1] - last20[0]
      : 0

  const last50Net =
    last50.length >= 2
      ? last50[last50.length - 1] - last50[0]
      : 0

  const avgSwing =
    deltas.length
      ? Math.round(
          deltas.reduce((sum, d) => sum + Math.abs(d), 0) /
          deltas.length
        )
      : 0

  const direction =
    last20Net > 15
      ? "up"
      : last20Net < -15
      ? "down"
      : "flat"

  const improving = last20Net > last50Net / 2

  const plateau =
    Math.abs(last20Net) < 10 &&
    avgSwing < 10 &&
    timeline.length >= 30

  return {
    last20Net,
    last50Net,
    avgSwing,
    direction,
    improving,
    plateau,
  }
}
