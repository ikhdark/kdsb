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
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 shadow-sm">
      {/* Top meta */}
      <div className="flex justify-between text-[12px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <span className="truncate">{mapName}</span>
        <span className="truncate">{serverName}</span>
      </div>

      {/* Main row */}
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-x-4">
        {/* Player A (left) */}
        <div className="min-w-0 text-left">
          <div className="font-medium truncate text-gray-900 dark:text-gray-100">
            {playerA.name}
            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              ({playerA.oldMmr})
            </span>
          </div>
        </div>

        {/* Probability center */}
        <div className="w-24 text-center">
          <div className="flex justify-between text-sm font-semibold tabular-nums">
            <span className={isAFavored ? "text-emerald-500" : "text-gray-500"}>
              {winProbA}%
            </span>

            <span className={!isAFavored ? "text-emerald-500" : "text-gray-500"}>
              {winProbB}%
            </span>
          </div>

          <div className="mt-0.5 text-[12px] text-gray-400">
            {isAFavored ? ">" : "<"}
          </div>
        </div>

        {/* Player B (right / outer side) */}
        <div className="min-w-0 text-right">
          <div className="font-medium truncate text-gray-900 dark:text-gray-100">
            {playerB.name}
            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              ({playerB.oldMmr})
            </span>
          </div>
        </div>
      </div>

      {/* Bottom meta */}
      <div className="mt-2 flex justify-between text-[11px]">
        <span className={pingColor}>Δ {pingDiff}ms</span>
        <span className="text-gray-500 dark:text-gray-400">
          {startedMinutesAgo}m
        </span>
      </div>
    </div>
  )
}