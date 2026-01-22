// src/app/stats/player/[battletag]/maps/page.tsx

import React from "react";
import { notFound } from "next/navigation";
import { getW3CMapStats } from "@/services/playerMaps";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function signed(n: number) {
  return `${n >= 0 ? "+" : ""}${n}`;
}

export default async function MapStatsPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) notFound();

  const data = await getW3CMapStats(battletag);
  if (!data) notFound();

  return (
    <div className="space-y-10 text-sm leading-relaxed">
      {/* HEADER */}
      <div className="rounded-lg border bg-background p-6">
        <div className="text-xs text-muted-foreground">Maps</div>
        <h1 className="mt-1 text-xl font-semibold">
          {data.battletag} — Season {data.seasons.join(", ")}
        </h1>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Avg Win"
            value={data.avgWinMinutes ? `${data.avgWinMinutes} min` : "—"}
          />
          <StatCard
            label="Avg Loss"
            value={data.avgLossMinutes ? `${data.avgLossMinutes} min` : "—"}
          />
         <StatCard
  label="Longest Win"
  value={
    data.longestWin
      ? `${data.longestWin.minutes} min`
      : "—"
  }
  sub={
    data.longestWin
      ? `${data.longestWin.map} · vs ${data.longestWin.oppTag} (${data.longestWin.oppMMR})`
      : null
  }
/>
        </div>
      </div>

      {/* WINRATE BY GAME LENGTH */}
      <section className="rounded-lg border bg-background p-6">
        <h2 className="text-base font-semibold">Winrate by Game Length</h2>
        <div className="mt-4 space-y-2">
          {data.winrateByDuration.map(b => (
            <div
              key={b.label}
              className="grid grid-cols-[110px_1fr_auto] items-center gap-x-3"
            >
              <div className="text-muted-foreground">{b.label}</div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${b.winrate}%` }}
                />
              </div>
              <div className="tabular-nums">
                {b.winrate}% ({b.wins}-{b.losses})
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TOP / WORST MAPS */}
      <section className="rounded-lg border bg-background p-6">
        <h2 className="text-base font-semibold">Map Winrate</h2>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[
            { title: "Top 5 Best Maps", data: data.topMaps, color: "text-emerald-600" },
            { title: "Top 5 Worst Maps", data: data.worstMaps, color: "text-rose-600" },
          ].map(block => (
            <div key={block.title}>
              <div className="font-medium">{block.title}</div>
              <div className="mt-2 space-y-2">
                {block.data.length ? (
                  block.data.map(m => (
                    <div key={m.map} className="flex justify-between">
                      <div>
                        <div>{m.map}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.wins}-{m.losses} · {m.games} games · {m.avgMinutes} min avg
                        </div>
                      </div>
                      <div className={`tabular-nums ${block.color}`}>
                        {m.winrate}%
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">
                    Need ≥ {10} games per map.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HERO TENDENCIES */}
      <section className="rounded-lg border bg-background p-6">
        <h2 className="text-base font-semibold">Hero Tendencies</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Highest Avg Hero Level"
            value={data.heroLevels.highestAvgHeroLevel?.map ?? "—"}
            sub={
              data.heroLevels.highestAvgHeroLevel
                ? `Avg level: ${data.heroLevels.highestAvgHeroLevel.heroAvgLevel}`
                : undefined
            }
          />
          <StatCard
            label="Lowest Avg Hero Level"
            value={data.heroLevels.lowestAvgHeroLevel?.map ?? "—"}
            sub={
              data.heroLevels.lowestAvgHeroLevel
                ? `Avg level: ${data.heroLevels.lowestAvgHeroLevel.heroAvgLevel}`
                : undefined
            }
          />
          <StatCard label="Most Games by Map Ending with 1 Hero" value={data.mapsWithHighestHeroCount.oneHeroMap ?? "—"} />
          <StatCard label="Most Games by Map Ending with 2 Heroes" value={data.mapsWithHighestHeroCount.twoHeroMap ?? "—"} />
          <StatCard label="Most Games by Map Ending with 3 Heroes" value={data.mapsWithHighestHeroCount.threeHeroMap ?? "—"} />
        </div>
      </section>

      {/* SHORTEST / LONGEST */}
      <section className="rounded-lg border bg-background p-6">
        <h2 className="text-base font-semibold">Maps with the Shortest/Longest wins / Shortest/Longest Losses sorted by avg time</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Map with shortest win time avg", data.shortestLongestByWL.shortestPositive],
            ["Map with longest win time avg", data.shortestLongestByWL.longestPositive],
            ["Map with shortest loss time avg", data.shortestLongestByWL.shortestNegative],
            ["Map with longest loss time avg", data.shortestLongestByWL.longestNegative],
          ].map(([label, m]) => (
            <StatCard
              key={label as string}
              label={label as string}
              value={m?.map ?? "—"}
              sub={m ? `${m.avgMinutes} min · ${m.winrate}%` : undefined}
            />
          ))}
        </div>
      </section>

      {/* MMR CONTEXT */}
      <section className="rounded-lg border bg-background p-6">
        <h2 className="text-base font-semibold">Map MMR Context</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Most Played"
            value={data.mmrContext.mostPlayed?.map ?? "—"}
            sub={data.mmrContext.mostPlayed ? `${data.mmrContext.mostPlayed.games} games` : undefined}
          />
          <StatCard
            label="Map with the Best Net MMR"
            value={data.mmrContext.bestNet?.map ?? "—"}
            sub={
              data.mmrContext.bestNet
                ? `Net ${signed(data.mmrContext.bestNet.netMMR)}`
                : undefined
            }
          />
          <StatCard
            label="Map with the Worst Net MMR"
            value={data.mmrContext.worstNet?.map ?? "—"}
            sub={
              data.mmrContext.worstNet
                ? `Net ${signed(data.mmrContext.worstNet.netMMR)}`
                : undefined
            }
          />
          <StatCard
            label="Map with the Most games vs Higher MMR"
            value={data.mmrContext.mostVsHigher?.map ?? "—"}
            sub={
              data.mmrContext.mostVsHigher
                ? `${data.mmrContext.mostVsHigher.vsHigher} games`
                : undefined
            }
          />
          <StatCard
            label="Map with the most games vs Lower MMR"
            value={data.mmrContext.mostVsLower?.map ?? "—"}
            sub={
              data.mmrContext.mostVsLower
                ? `${data.mmrContext.mostVsLower.vsLower} games`
                : undefined
            }
          />
        </div>
      </section>
    </div>
  );
}
