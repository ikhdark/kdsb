"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BattleTagInput from "@/components/BattleTagInput";

type Hero = { name: string; level: number };

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

  // Optional (if your API ever provides opponent mmr)
  oppOldMmr?: number;
  oppNewMmr?: number;
  oppMmrGain?: number;

  leagueId: number | null;
  division: number | null;
  ladderRank: number | null;

  myRace: number;
  myRndRace: number | null;

  oppRace: number | null;
  oppRndRace: number | null;

  opponentTag: string | null;
  opponentCountry: string | null;

  myHeroes: Hero[];
  oppHeroes: Hero[];
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const RACE_BASE = "https://w3champions.com/assets/raceIcons/";
const HERO_BASE = "https://w3champions.com/assets/heroes/";
const PROVIDER_BASE = "https://w3champions.com/assets/icons/";
const FLAG_BASE = "https://flagcdn.com/w20/";

const RACE_LABEL: Record<number, string> = {
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
  0: "Random",
};

const RACE_ICON: Record<number, string> = {
  1: "HUMAN.png",
  2: "ORC.png",
  4: "NIGHT_ELF.png",
  8: "UNDEAD.png",
};

const RANDOM_RACE_ICON: Record<number, string> = {
  1: "HumanRandom.png",
  2: "OrcRandom.png",
  4: "NightElfRandom.png",
  8: "UndeadRandom.png",
};

function raceIcon(raceId: number | null, rndRace?: number | null): string | undefined {
  if (raceId == null) return undefined;

  if (raceId === 0) {
    const file = rndRace ? RANDOM_RACE_ICON[rndRace] : undefined;
    return file ? RACE_BASE + file : undefined;
  }
  const file = RACE_ICON[raceId];
  return file ? RACE_BASE + file : undefined;
}

function heroIcon(name: string) {
  return `${HERO_BASE}${name.toLowerCase()}.png`;
}

function raceLabel(id: number | null) {
  if (id == null) return "Unknown";
  return RACE_LABEL[id] ?? "Unknown";
}

function winrate(w: number, l: number) {
  const t = w + l;
  return t ? Math.round((w / t) * 100) : 0;
}

function mmrDeltaClass(delta: number) {
  return delta >= 0 ? "text-emerald-600" : "text-rose-600";
}

function mmrDeltaText(delta: number) {
  return `${delta >= 0 ? "+" : ""}${delta}`;
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
    .filter((m) => m.won && typeof m.oppOldMmr === "number")
    .reduce<MatchRow | null>(
      (best, m) =>
        !best || (m.oppOldMmr ?? 0) > (best.oppOldMmr ?? 0) ? m : best,
      null
    );
}, [filtered]);

  const lowestLoss = useMemo(() => {
  return filtered
    .filter((m) => !m.won && typeof m.oppOldMmr === "number")
    .reduce<MatchRow | null>(
      (best, m) =>
        !best || (m.oppOldMmr ?? Infinity) < (best.oppOldMmr ?? Infinity)
          ? m
          : best,
      null
    );
}, [filtered]);

  const vsRaceBreakdown = useMemo(() => {
    const out: Record<number, Record<number, { wins: number; losses: number }>> =
      {};
    for (const m of filtered) {
      if (!out[m.myRace]) out[m.myRace] = {};
      const oppRaceKey = typeof m.oppRace === "number" ? m.oppRace : -1;
      if (!out[m.myRace][oppRaceKey]) out[m.myRace][oppRaceKey] = { wins: 0, losses: 0 };
      if (m.won) out[m.myRace][oppRaceKey].wins++;
      else out[m.myRace][oppRaceKey].losses++;
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
                        key={oppRaceStr}
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
                            vs {raceLabel(oppRace === -1 ? null : oppRace)}
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
                {/* YOU */}
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
                    <span className="font-medium">{player}</span>
                    <span className="text-gray-500">
                      {highestWin.oldMmr} → {highestWin.newMmr}
                    </span>
                    <span
                      className={`${mmrDeltaClass(
                        highestWin.mmrGain
                      )} font-medium`}
                    >
                      ({mmrDeltaText(highestWin.mmrGain)})
                    </span>
                  </div>
                </div>

                <span className="text-gray-400">vs</span>

                {/* OPPONENT */}
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
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-medium truncate max-w-[55vw] sm:max-w-none">
                      {highestWin.opponentTag}
                    </span>

                    {typeof highestWin.oppOldMmr === "number" ? (
                      <span className="text-gray-500">
                        {highestWin.oppOldMmr}
                        {typeof highestWin.oppNewMmr === "number"
                          ? ` → ${highestWin.oppNewMmr}`
                          : ""}
                      </span>
                    ) : null}

                  </div>
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
                {/* YOU */}
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
                    <span className="font-medium">{player}</span>
                    <span className="text-gray-500">
                      {lowestLoss.oldMmr} → {lowestLoss.newMmr}
                    </span>
                    <span
                      className={`${mmrDeltaClass(
                        lowestLoss.mmrGain
                      )} font-medium`}
                    >
                      ({mmrDeltaText(lowestLoss.mmrGain)})
                    </span>
                  </div>
                </div>

                <span className="text-gray-400">vs</span>

                {/* OPPONENT */}
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
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-medium truncate max-w-[55vw] sm:max-w-none">
                      {lowestLoss.opponentTag}
                    </span>

                    {typeof lowestLoss.oppOldMmr === "number" ? (
                      <span className="text-gray-500">
                        {lowestLoss.oppOldMmr}
                        {typeof lowestLoss.oppNewMmr === "number"
                          ? ` → ${lowestLoss.oppNewMmr}`
                          : ""}
                      </span>
                    ) : null}

                  </div>
                </div>
              </div>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </div>
        </div>
      </div>

      {/* ROWS (unified; mobile-first layout) */}
      <div className="space-y-3">
        {filtered.map((m) => {
          const oppRaceSrc = raceIcon(m.oppRace, m.oppRndRace);
          const myRaceSrc = raceIcon(m.myRace, m.myRndRace);
          const start = new Date(m.startTime).toLocaleString();
          const resultClass = m.won ? "text-emerald-600" : "text-rose-600";
          const resultText = m.won ? "Win" : "Loss";

          const myDelta = m.mmrGain;
          const oppDelta =
            typeof m.oppMmrGain === "number" ? m.oppMmrGain : -m.mmrGain;

          return (
            <div key={m.id} className="border rounded bg-white dark:bg-gray-900">
              {/* TOP STRIP (now used on all sizes) */}
              <div className="flex items-center justify-between gap-3 p-3 border-b">
                <div className={`text-sm font-semibold ${resultClass}`}>
                  {resultText}
                </div>

                <div className="text-xs text-gray-500 shrink-0">
                  {formatDuration(m.duration)}
                </div>

                <div className="text-xs text-gray-500 truncate min-w-0 text-right">
                  {m.map}
                </div>
              </div>

              {/* CONTENT (single layout, scales up naturally) */}
              <div className="p-3 md:p-4 space-y-4">
                {/* Players block */}
                <div className="flex flex-col gap-3">
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
                          src={`${FLAG_BASE}${m.opponentCountry.toLowerCase()}.png`}
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

                    {/* Opp MMR numbers (show if we have old OR new) */}
                    {typeof m.oppOldMmr === "number" ? (
                      <div className="text-xs text-gray-500 ml-6">
                        {m.oppOldMmr}
                        {typeof m.oppNewMmr === "number" ? ` → ${m.oppNewMmr}` : ""}
                      </div>
                    ) : typeof m.oppNewMmr === "number" ? (
                      <div className="text-xs text-gray-500 ml-6">
                        {m.oppNewMmr}
                      </div>
                    ) : null}

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

                      <span
                        className={`${mmrDeltaClass(
                          myDelta
                        )} text-xs font-medium shrink-0`}
                      >
                        ({mmrDeltaText(myDelta)})
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 ml-6">
                      {m.oldMmr} → {m.newMmr}
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

                {/* Details grid (now used on all sizes) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase text-gray-500">
                      Date
                    </div>
                    <div className="text-sm">{start}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] uppercase text-gray-500">
                      Server
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      {m.provider && (
                        <img
                          src={`${PROVIDER_BASE}${m.provider}.png`}
                          width={16}
                          height={16}
                          alt=""
                          className="shrink-0"
                        />
                      )}
                      <span className="truncate text-sm">{m.server}</span>
                    </div>
                  </div>
                </div>

                {/* Desktop-only columns removed; MMR column still intentionally not shown separately */}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}