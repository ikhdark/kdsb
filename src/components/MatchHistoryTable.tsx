"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BattleTagInput from "@/components/BattleTagInput";

type MatchRow = {
  id: string;
  won: boolean;

  map: string;
  startTime: string;
  duration: number;

  server: string;
  provider: string | null;

  oldMmr: number;
  newMmr: number;
  mmrGain: number;

  leagueId: number | null;
  division: number | null;
  ladderRank: number | null;

  myRace: number;
  myRndRace: number | null;

  oppRace: number;
  oppRndRace: number | null;

  opponentTag: string;
  opponentCountry: string | null;

  myHeroes: { name: string; level: number }[];
  oppHeroes: { name: string; level: number }[];
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// W3C exact filenames
function raceIcon(raceId: number, rndRace?: number | null): string | undefined {
  const base = "https://w3champions.com/assets/raceIcons/";

  // Random-specific
  if (raceId === 0) {
    if (rndRace) {
      const randomMap: Record<number, string> = {
        1: "HumanRandom.png",
        2: "OrcRandom.png",
        4: "NightElfRandom.png",
        8: "UndeadRandom.png",
      };

      const file = randomMap[rndRace];
      return file ? base + file : undefined;
    }

    return undefined;
  }

  const map: Record<number, string> = {
    1: "HUMAN.png",
    2: "ORC.png",
    4: "NIGHT_ELF.png",
    8: "UNDEAD.png",
  };

  const file = map[raceId];
  return file ? base + file : undefined;
}

function heroIcon(name: string) {
  return `https://w3champions.com/assets/heroes/${name.toLowerCase()}.png`;
}

function raceLabel(id: number) {
  const map: Record<number, string> = {
    1: "Human",
    2: "Orc",
    4: "Night Elf",
    8: "Undead",
    0: "Random",
  };
  return map[id] ?? "Unknown";
}

function winrate(w: number, l: number) {
  const t = w + l;
  return t ? Math.round((w / t) * 100) : 0;
}

function barClass(pct: number) {
  if (pct >= 55) return "bg-emerald-500";
  if (pct >= 48) return "bg-yellow-500";
  return "bg-rose-500";
}

export default function MatchHistoryTable({
  player,
  matches,
  rankData,
  vsFilter,
}: {
  player: string;
  matches: MatchRow[];
  rankData: any;
  vsFilter: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [vsInput, setVsInput] = useState(vsFilter ?? "");

  const filtered = useMemo(() => {
    const q = (vsFilter ?? "").trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((m) =>
      (m.opponentTag ?? "").toLowerCase().includes(q)
    );
  }, [matches, vsFilter]);

  const wins = useMemo(() => filtered.filter((m) => m.won).length, [filtered]);
  const losses = filtered.length - wins;

  const highestWin = useMemo(() => {
    return filtered
      .filter((m) => m.won && typeof m.oldMmr === "number")
      .reduce<MatchRow | null>(
        (best, m) => (!best || m.oldMmr > best.oldMmr ? m : best),
        null
      );
  }, [filtered]);

  const lowestLoss = useMemo(() => {
    return filtered
      .filter((m) => !m.won && typeof m.oldMmr === "number")
      .reduce<MatchRow | null>(
        (best, m) => (!best || m.oldMmr < best.oldMmr ? m : best),
        null
      );
  }, [filtered]);

  const vsRaceBreakdown = useMemo(() => {
    const out: Record<number, Record<number, { wins: number; losses: number }>> =
      {};

    for (const m of filtered) {
      if (!out[m.myRace]) out[m.myRace] = {};
      if (!out[m.myRace][m.oppRace])
        out[m.myRace][m.oppRace] = { wins: 0, losses: 0 };

      if (m.won) out[m.myRace][m.oppRace].wins++;
      else out[m.myRace][m.oppRace].losses++;
    }

    return out;
  }, [filtered]);

  const applyVsFilter = useCallback(() => {
    const query = new URLSearchParams(params.toString());
    query.set("player", player);

    const v = vsInput.trim();
    if (v) query.set("vs", v);
    else query.delete("vs");

    router.push(`/stats/matches?${query.toString()}`);
  }, [params, player, router, vsInput]);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* HEADER */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xl sm:text-2xl font-semibold truncate">
            {player}
          </div>

          <div className="text-sm text-gray-500">
            Last 50{vsFilter ? " (filtered)" : ""}: {wins}-{losses}
          </div>
        </div>
      </div>

      {/* INPUTS */}
      <div className="space-y-3">
        {/* Player (read-only) */}
        <div>
          <input
            value={player}
            disabled
            className="w-full border-b border-gray-300 bg-transparent py-2 text-sm outline-none opacity-80"
          />
        </div>

        {/* VS Filter with Autocomplete + Button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyVsFilter();
          }}
          className="space-y-2"
        >
          <BattleTagInput
            value={vsInput}
            onChange={setVsInput}
            placeholder="Filter vs specific player"
          />

          <button
            type="submit"
            className="w-full px-4 py-2 border rounded hover:bg-gray-100 text-sm"
          >
            Search
          </button>
        </form>
      </div>

      {/* W/L vs RACES (VISIBLE) */}
      <div className="space-y-2">
        <div className="text-xs uppercase text-gray-500">
          W/L vs Races (last 50)
        </div>

        <div className="space-y-6">
          {Object.entries(vsRaceBreakdown).map(([myRaceStr, opps]) => {
            const myRace = Number(myRaceStr);
            const myIcon = raceIcon(myRace);

            return (
              <div key={myRace} className="space-y-2">
                {/* Your race label */}
                <div className="flex items-center gap-2 font-semibold">
                  {myIcon && (
                    <img
                      src={myIcon}
                      width={20}
                      height={20}
                      alt=""
                      className="shrink-0"
                    />
                  )}
                  <span className="truncate">{raceLabel(myRace)}</span>
                </div>

                {/* Opponent rows */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pl-2 sm:pl-4 md:pl-6">
                  {Object.entries(opps).map(([oppRaceStr, rec]) => {
                    const oppRace = Number(oppRaceStr);
                    const pct = winrate(rec.wins, rec.losses);
                    const oppIcon = raceIcon(oppRace);

                    const colorClass =
                      pct >= 55
                        ? "text-emerald-600"
                        : pct >= 48
                        ? "text-yellow-600"
                        : "text-rose-600";

                    return (
                      <div
                        key={oppRace}
                        className="rounded border bg-white/60 dark:bg-gray-900/60 p-2 sm:p-3 space-y-1"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {oppIcon && (
                            <img
                              src={oppIcon}
                              width={16}
                              height={16}
                              alt=""
                              className="shrink-0"
                            />
                          )}
                          <span className="text-sm truncate">
                            vs {raceLabel(oppRace)}
                          </span>
                        </div>

                        <div className={`text-sm font-medium ${colorClass}`}>
                          {rec.wins}-{rec.losses} ({pct}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EXTREMES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 text-sm">
      {/* HIGHEST WIN */}
<div className="rounded border p-3 md:p-4 bg-white dark:bg-gray-900">
  <div className="text-xs uppercase text-gray-500">Highest MMR Win</div>

  <div className="mt-2">
    {highestWin ? (
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* YOU (MMR change) */}
        <div className="flex items-center gap-2 min-w-0">
          {raceIcon(highestWin.myRace, highestWin.myRndRace) && (
            <img
              src={raceIcon(highestWin.myRace, highestWin.myRndRace)}
              width={18}
              height={18}
              alt=""
              className="shrink-0"
            />
          )}

          <div className="flex items-baseline gap-2">
            <span className="font-medium">
              {highestWin.oldMmr} → {highestWin.newMmr}
            </span>
            <span className="text-emerald-600 font-medium">
              (+{highestWin.mmrGain})
            </span>
          </div>
        </div>

        <span className="text-gray-400">vs</span>

        {/* OPPONENT (tag only) */}
        <div className="flex items-center gap-2 min-w-0">
          {raceIcon(highestWin.oppRace, highestWin.oppRndRace) && (
            <img
              src={raceIcon(highestWin.oppRace, highestWin.oppRndRace)}
              width={18}
              height={18}
              alt=""
              className="shrink-0"
            />
          )}
          <span className="font-medium truncate max-w-[55vw] sm:max-w-none">
            {highestWin.opponentTag}
          </span>
        </div>
      </div>
    ) : (
      <span className="text-gray-500">—</span>
    )}
  </div>
</div>

{/* LOWEST LOSS */}
<div className="rounded border p-3 md:p-4 bg-white dark:bg-gray-900">
  <div className="text-xs uppercase text-gray-500">Lowest MMR Loss</div>

  <div className="mt-2">
    {lowestLoss ? (
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* YOU (MMR change) */}
        <div className="flex items-center gap-2 min-w-0">
          {raceIcon(lowestLoss.myRace, lowestLoss.myRndRace) && (
            <img
              src={raceIcon(lowestLoss.myRace, lowestLoss.myRndRace)}
              width={18}
              height={18}
              alt=""
              className="shrink-0"
            />
          )}

          <div className="flex items-baseline gap-2">
            <span className="font-medium">
              {lowestLoss.oldMmr} → {lowestLoss.newMmr}
            </span>
            <span className="text-rose-600 font-medium">
              ({lowestLoss.mmrGain >= 0 ? "+" : ""}
              {lowestLoss.mmrGain})
            </span>
          </div>
        </div>

        <span className="text-gray-400">vs</span>

        {/* OPPONENT (tag only) */}
        <div className="flex items-center gap-2 min-w-0">
          {raceIcon(lowestLoss.oppRace, lowestLoss.oppRndRace) && (
            <img
              src={raceIcon(lowestLoss.oppRace, lowestLoss.oppRndRace)}
              width={18}
              height={18}
              alt=""
              className="shrink-0"
            />
          )}
          <span className="font-medium truncate max-w-[55vw] sm:max-w-none">
            {lowestLoss.opponentTag}
          </span>
        </div>
      </div>
    ) : (
      <span className="text-gray-500">—</span>
    )}
  </div>
</div>
</div>

      {/* TABLE HEADER (desktop only) */}
      <div className="hidden md:grid grid-cols-7 gap-6 text-xs uppercase text-gray-500 border-b pb-2">
        <div>Result</div>
        <div>Players</div>
        <div>Map</div>
        <div>Date</div>
        <div>Length</div>
        <div>Server</div>
        <div>MMR</div>
      </div>

      {/* ROWS */}
      <div className="space-y-3">
        {filtered.map((m) => {
          const oppRaceSrc = raceIcon(m.oppRace, m.oppRndRace);
          const myRaceSrc = raceIcon(m.myRace, m.myRndRace);

          return (
            <div
              key={m.id}
              className="border rounded bg-white dark:bg-gray-900"
            >
              {/* MOBILE SUMMARY STRIP */}
              <div className="flex items-center justify-between gap-3 p-3 md:hidden border-b">
                <div
                  className={`text-sm font-semibold ${
                    m.won ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {m.won ? "Win" : "Loss"}
                </div>

                <div className="text-xs text-gray-500 shrink-0">
                  {formatDuration(m.duration)}
                </div>

                <div className="text-xs text-gray-500 truncate min-w-0 text-right">
                  {m.map}
                </div>
              </div>

              {/* CONTENT */}
              <div className="p-3 md:p-4">
                <div className="flex flex-col md:grid md:grid-cols-7 gap-4 md:gap-6">
                  {/* RESULT (desktop) */}
                  <div
                    className={`hidden md:block self-start font-medium ${
                      m.won ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {m.won ? "Win" : "Loss"}
                  </div>

                  {/* PLAYERS */}
                  <div className="md:col-span-1 md:col-start-2 md:col-end-3">
                    <div className="flex flex-col gap-3 md:gap-4">
                      {/* OPPONENT */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {oppRaceSrc && (
                            <img
                              src={oppRaceSrc}
                              width={18}
                              height={18}
                              alt=""
                              className="shrink-0"
                            />
                          )}

                          {m.opponentCountry && (
                            <img
                              src={`https://flagcdn.com/w20/${m.opponentCountry.toLowerCase()}.png`}
                              width={18}
                              height={14}
                              alt=""
                              className="shrink-0"
                            />
                          )}

                          <span className="font-medium truncate">
                            {m.opponentTag}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 ml-6">
                          {m.oppHeroes?.map((h, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <img
                                src={heroIcon(h.name)}
                                width={16}
                                height={16}
                                alt=""
                                className="shrink-0"
                              />
                              Lv{h.level}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* YOU */}
                      <div className="flex flex-col gap-1 border-t pt-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {myRaceSrc && (
                            <img
                              src={myRaceSrc}
                              width={18}
                              height={18}
                              alt=""
                              className="shrink-0"
                            />
                          )}
                          <span className="font-medium truncate">{player}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 ml-6">
                          {m.myHeroes?.map((h, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <img
                                src={heroIcon(h.name)}
                                width={16}
                                height={16}
                                alt=""
                                className="shrink-0"
                              />
                              Lv{h.level}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MOBILE DETAILS GRID */}
                  <div className="grid grid-cols-2 gap-3 md:hidden">
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase text-gray-500">
                        Date
                      </div>
                      <div className="text-sm">
                        {new Date(m.startTime).toLocaleString()}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] uppercase text-gray-500">
                        Server
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        {m.provider && (
                          <img
                            src={`https://w3champions.com/assets/icons/${m.provider}.png`}
                            width={16}
                            height={16}
                            alt=""
                            className="shrink-0"
                          />
                        )}
                        <span className="truncate text-sm">{m.server}</span>
                      </div>
                    </div>

                    <div className="space-y-1 col-span-2">
                      <div className="text-[11px] uppercase text-gray-500">
                        MMR
                      </div>
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <div className="text-sm">
                          {m.oldMmr} → {m.newMmr}
                        </div>
                        <div
                          className={`text-sm font-medium ${
                            m.mmrGain >= 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          ({m.mmrGain >= 0 ? "+" : ""}
                          {m.mmrGain})
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MAP (desktop) */}
                  <div className="hidden md:block self-start truncate">
                    {m.map}
                  </div>

                  {/* DATE (desktop) */}
                  <div className="hidden md:block self-start text-sm">
                    {new Date(m.startTime).toLocaleString()}
                  </div>

                  {/* LENGTH (desktop) */}
                  <div className="hidden md:block self-start text-sm">
                    {formatDuration(m.duration)}
                  </div>

                  {/* SERVER (desktop) */}
                  <div className="hidden md:flex self-start items-center gap-2 min-w-0">
                    {m.provider && (
                      <img
                        src={`https://w3champions.com/assets/icons/${m.provider}.png`}
                        width={16}
                        height={16}
                        alt=""
                        className="shrink-0"
                      />
                    )}
                    <span className="truncate">{m.server}</span>
                  </div>

                  {/* MMR (desktop) */}
                  <div className="hidden md:block self-start text-sm">
                    <div>
                      {m.oldMmr} → {m.newMmr}
                    </div>
                    <div
                      className={
                        m.mmrGain >= 0 ? "text-emerald-600" : "text-rose-600"
                      }
                    >
                      ({m.mmrGain >= 0 ? "+" : ""}
                      {m.mmrGain})
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}