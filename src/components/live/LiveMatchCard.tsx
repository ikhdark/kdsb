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
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 sm:px-6 py-4 shadow-md">
      
      {/* Top row */}
      <div className="flex justify-between text-xs sm:text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <span className="truncate max-w-[45%]">{mapName}</span>
        <span className="truncate max-w-[45%] text-right">{serverName}</span>
      </div>

      {/* Main row */}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 sm:gap-x-8">

        {/* Player A */}
        <div className="min-w-0 text-left">
          <div className="truncate text-base sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            {playerA.name}
          </div>
          <div className="text-xs sm:text-sm text-gray-500 tabular-nums">
            {playerA.oldMmr}
          </div>
        </div>

        {/* Probability */}
        <div className="w-20 sm:w-32 text-center">
          <div className="flex justify-between text-base sm:text-xl font-bold tabular-nums">
            <span className={isAFavored ? "text-emerald-500" : "text-gray-500"}>
              {winProbA}%
            </span>
            <span className={!isAFavored ? "text-emerald-500" : "text-gray-500"}>
              {winProbB}%
            </span>
          </div>
        </div>

        {/* Player B */}
        <div className="min-w-0 text-right">
          <div className="truncate text-base sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            {playerB.name}
          </div>
          <div className="text-xs sm:text-sm text-gray-500 tabular-nums">
            {playerB.oldMmr}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-3 flex justify-between text-xs sm:text-sm">
        <span className={pingColor}>Δ {pingDiff}ms</span>
        <span className="text-gray-500 dark:text-gray-400">
          {startedMinutesAgo}m ago
        </span>
      </div>
    </div>
  )
}