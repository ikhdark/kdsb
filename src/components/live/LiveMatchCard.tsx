const RACE_MAP: Record<number, string> = {
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
  0: "Random",
}

type Props = {
  match: {
    mapName: string
    serverName: string
    playerA: {
      name: string
      oldMmr: number
      race: number
      mmrIfWin: number
      mmrIfLose: number
      ping: number
    }
    playerB: {
      name: string
      oldMmr: number
      race: number
      mmrIfWin: number
      mmrIfLose: number
      ping: number
    }
    winProbA: number
    pingDiff: number
    startedMinutesAgo: number
  }
}

function pingColor(ping: number) {
  if (ping > 120) return "text-rose-500"
  if (ping > 70) return "text-yellow-500"
  return "text-emerald-500"
}

export default function LiveMatchCard({ match }: Props) {
  const {
    mapName,
    serverName,
    playerA,
    playerB,
    winProbA,
    startedMinutesAgo,
  } = match

  const winProbB = 100 - winProbA
  const isAFavored = winProbA >= winProbB

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 sm:px-6 py-4 shadow-md">

      {/* Top Row */}
      <div className="flex justify-between text-xs sm:text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <span className="truncate max-w-[45%]">{mapName}</span>
        <span className="truncate max-w-[45%] text-right">{serverName}</span>
      </div>

      {/* Main Row */}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 sm:gap-x-8">

        {/* PLAYER A */}
        <div className="min-w-0 text-left">
          <div className="truncate text-base sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            {playerA.name}
          </div>

          <div className="text-xs text-gray-400">
            {RACE_MAP[playerA.race] ?? "Unknown"}
          </div>

          {playerA.oldMmr > 0 ? (
            <>
              <div className="text-xs sm:text-sm text-gray-500 tabular-nums">
                {playerA.oldMmr}
              </div>

              <div className={`text-[11px] ${pingColor(playerA.ping)}`}>
                {playerA.ping}ms
              </div>

              <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-2">
                Predicted MMR change If Win / If Lose
              </div>

              <div className="text-[11px] tabular-nums">
                <span className="text-emerald-500">
                  {playerA.mmrIfWin > 0 ? `+${playerA.mmrIfWin}` : playerA.mmrIfWin}
                </span>
                <span className="text-gray-400"> / </span>
                <span className="text-rose-500">
                  {playerA.mmrIfLose}
                </span>
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-500 mt-1">
              Not ranked
            </div>
          )}
        </div>

        {/* CENTER */}
        <div className="w-24 sm:w-36 text-center">
          <div className="text-[11px] sm:text-xs uppercase tracking-wide text-gray-400 mb-1">
            Win Probability
          </div>

          <div className="flex justify-between text-base sm:text-xl font-bold tabular-nums">
            <span className={isAFavored ? "text-emerald-500" : "text-gray-500"}>
              {winProbA}%
            </span>
            <span className={!isAFavored ? "text-emerald-500" : "text-gray-500"}>
              {winProbB}%
            </span>
          </div>
        </div>

        {/* PLAYER B */}
        <div className="min-w-0 text-right">
          <div className="truncate text-base sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            {playerB.name}
          </div>

          <div className="text-xs text-gray-400">
            {RACE_MAP[playerB.race] ?? "Unknown"}
          </div>

          {playerB.oldMmr > 0 ? (
            <>
              <div className="text-xs sm:text-sm text-gray-500 tabular-nums">
                {playerB.oldMmr}
              </div>

              <div className={`text-[11px] ${pingColor(playerB.ping)}`}>
                {playerB.ping}ms
              </div>

              <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-2">
                Predicted MMR change If Win / If Lose
              </div>

              <div className="text-[11px] tabular-nums">
                <span className="text-emerald-500">
                  {playerB.mmrIfWin > 0 ? `+${playerB.mmrIfWin}` : playerB.mmrIfWin}
                </span>
                <span className="text-gray-400"> / </span>
                <span className="text-rose-500">
                  {playerB.mmrIfLose}
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500 mt-1">
              Not ranked
            </div>
          )}
        </div>
      </div>

      {/* Bottom Right Time */}
      <div className="mt-3 text-right text-xs text-gray-500">
        {startedMinutesAgo}m ago
      </div>
    </div>
  )
}