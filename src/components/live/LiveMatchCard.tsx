import Link from "next/link"

const RACE_MAP: Record<number, string> = {
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
  0: "Random",
}

type Player = {
  name: string
  battleTag: string
  oldMmr: number
  race: number
  mmrIfWin: number
  mmrIfLose: number
  ping: number
}

type Props = {
  match: {
    mapName: string
    serverName: string
    playerA: Player
    playerB: Player
    winProbA: number
    startedMinutesAgo: number
  }
}

function pingColor(ping: number) {
  if (ping > 120) return "text-rose-600 dark:text-rose-400"
  if (ping > 70) return "text-yellow-600 dark:text-yellow-400"
  return "text-emerald-600 dark:text-emerald-400"
}

function mmrDelta(v: number) {
  return v > 0 ? `+${v}` : v
}

function PlayerBlock({
  player,
  align,
}: {
  player: Player
  align: "left" | "right"
}) {
  const textAlign = align === "left" ? "text-left" : "text-right"

  return (
    <div className={`min-w-0 ${textAlign} space-y-1`}>
      <Link
        href={`/stats/player/${encodeURIComponent(player.battleTag)}/summary`}
        className={`block truncate text-base sm:text-xl font-semibold text-black dark:text-white hover:underline ${textAlign}`}
      >
        {player.name}
      </Link>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        {RACE_MAP[player.race] ?? "Unknown"}
      </div>

      {player.oldMmr > 0 ? (
        <>
          <div className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">
            {player.oldMmr}
          </div>

          <div className={`text-[11px] ${pingColor(player.ping)}`}>
            {player.ping}ms
          </div>

          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 pt-2">
            Predicted MMR change If Win / If Lose
          </div>

          <div className="text-[11px] tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400">
              {mmrDelta(player.mmrIfWin)}
            </span>
            <span className="text-gray-400"> / </span>
            <span className="text-rose-600 dark:text-rose-400">
              {player.mmrIfLose}
            </span>
          </div>
        </>
      ) : (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Not ranked
        </div>
      )}
    </div>
  )
}

export default function LiveMatchCard({ match }: Props) {
  const { mapName, serverName, playerA, playerB, winProbA, startedMinutesAgo } =
    match

  const winProbB = 100 - winProbA
  const isAFavored = winProbA >= winProbB

  return (
    <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-md overflow-hidden p-5">

      {/* Top Row */}
      <div className="flex justify-between text-xs sm:text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <span className="truncate max-w-[45%]">{mapName}</span>
        <span className="truncate max-w-[45%] text-right">{serverName}</span>
      </div>

      {/* Main Row */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 sm:gap-x-8">

        <PlayerBlock player={playerA} align="left" />

        {/* CENTER */}
        <div className="w-24 sm:w-36 text-center">
          <div className="text-[11px] sm:text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Win Probability
          </div>

          <div className="flex justify-between text-base sm:text-xl font-bold tabular-nums">
            <span
              className={
                isAFavored
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-600 dark:text-gray-400"
              }
            >
              {winProbA}%
            </span>

            <span
              className={
                !isAFavored
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-600 dark:text-gray-400"
              }
            >
              {winProbB}%
            </span>
          </div>
        </div>

        <PlayerBlock player={playerB} align="right" />

      </div>

      {/* Bottom Time */}
      <div className="mt-4 text-right text-xs text-gray-500 dark:text-gray-400">
        {startedMinutesAgo}m ago
      </div>

    </div>
  )
}