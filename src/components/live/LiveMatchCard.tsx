type Props = {
  match: {
    mapName: string
    serverName: string
    playerA: {
      name: string
      oldMmr: number
    }
    playerB: {
      name: string
      oldMmr: number
    }
    winProbA: number
    pingDiff: number
    startedMinutesAgo: number
  }
}

export default function LiveMatchCard({ match }: Props) {
  const {
    mapName,
    serverName,
    playerA,
    playerB,
    winProbA,
    pingDiff,
    startedMinutesAgo,
  } = match

  const winProbB = 100 - winProbA
  const isAFavored = winProbA >= winProbB

  const pingColor =
    pingDiff > 70
      ? "text-rose-500"
      : pingDiff > 30
      ? "text-yellow-500"
      : "text-emerald-500"

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-2 shadow-md">
      {/* Top meta */}
      <div className="flex justify-between text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <span>{mapName}</span>
        <span>{serverName}</span>
      </div>

      {/* Main row */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-x-8">
        {/* Player A */}
        <div className="text-left">
          <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {playerA.name}
          </div>
          <div className="text-sm text-gray-500 tabular-nums">
            {playerA.oldMmr}
          </div>
        </div>

        {/* Probability */}
        <div className="w-32 text-center">
          <div className="flex justify-between text-xl font-bold tabular-nums">
            <span className={isAFavored ? "text-emerald-500" : "text-gray-500"}>
              {winProbA}%
            </span>
            <span className={!isAFavored ? "text-emerald-500" : "text-gray-500"}>
              {winProbB}%
            </span>
          </div>
        </div>

        {/* Player B */}
        <div className="text-right">
          <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {playerB.name}
          </div>
          <div className="text-sm text-gray-500 tabular-nums">
            {playerB.oldMmr}
          </div>
        </div>
      </div>

      {/* Bottom meta */}
      <div className="mt-4 flex justify-between text-sm">
        <span className={pingColor}>Δ {pingDiff}ms</span>
        <span className="text-gray-500 dark:text-gray-400">
          {startedMinutesAgo}m ago
        </span>
      </div>
    </div>
  )
}