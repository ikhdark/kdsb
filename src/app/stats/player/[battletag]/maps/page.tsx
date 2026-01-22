// src/app/stats/player/[battletag]/maps/page.tsx

import { notFound } from "next/navigation";
import { getW3CMapStats } from "@/services/playerMaps";
import { PlayerHeader, Section, StatCard } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

function signed(n: number) {
  return `${n >= 0 ? "+" : ""}${n}`;
}

export default async function MapStatsPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) notFound();

  const data = await getW3CMapStats(battletag);
  if (!data) notFound();

  return (
    <div className="space-y-10 rounded-lg bg-white p-6 shadow dark:bg-gray-dark">
      {/* HEADER */}
      <PlayerHeader
        battletag={data.battletag}
        subtitle={`Season ${data.seasons.join(", ")} · Maps`}
      />

      {/* TOP STATS */}
      <Section title="Map Summary Stats">
        <div className="grid gap-4 sm:grid-cols-3">
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
            value={data.longestWin ? `${data.longestWin.minutes} min` : "—"}
            sub={
              data.longestWin
                ? `${data.longestWin.map} · vs ${data.longestWin.oppTag} (${data.longestWin.oppMMR})`
                : undefined
            }
          />
        </div>
      </Section>

  {/* WINRATE BY GAME LENGTH */}
<Section title="Winrate by Game Length">
  <div className="space-y-2">
    {data.winrateByDuration.map((b) => {
      // determine color based on winrate
      let barColor = "bg-rose-500"; // red by default
      if (b.winrate >= 50) barColor = "bg-emerald-500"; // green
      else if (b.winrate >= 40) barColor = "bg-yellow-500"; // yellow

      // also text color
      let textColor = "text-rose-500";
      if (b.winrate >= 50) textColor = "text-emerald-500";
      else if (b.winrate >= 40) textColor = "text-yellow-500";

      return (
        <div
          key={b.label}
          className="grid grid-cols-[110px_1fr_auto] items-center gap-x-3"
        >
          <div className="text-gray-500">{b.label}</div>
          <div className="h-2 rounded bg-gray-200 overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all`}
              style={{ width: `${b.winrate}%` }}
            />
          </div>
          <div className={`tabular-nums font-medium ${textColor}`}>
            {b.winrate}% ({b.wins}-{b.losses})
          </div>
        </div>
      );
    })}
  </div>
</Section>


     {/* TOP/WORST MAPS */}
<Section title="Top / Worst Maps">
  <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-2">
    {[
      { title: "Top 5 Best Maps", data: data.topMaps },
      { title: "Top 5 Worst Maps", data: data.worstMaps },
    ].map((block) => (
      <div key={block.title}>
        <div className="font-medium">{block.title}</div>
        <div className="mt-2 space-y-2">
          {block.data.length ? (
            block.data.map((m) => {
              // determine color dynamically based on winrate
              let colorClass = "text-red-500"; // default red
              if (m.winrate >= 50) colorClass = "text-emerald-500"; // green
              else if (m.winrate >= 50) colorClass = "text-yellow-500"; // yellow

              return (
                <div key={m.map} className="flex justify-between tabular-nums">
                  <div>
                    <div>{m.map}</div>
                    <div className="text-xs text-gray-500">
                      {m.wins}-{m.losses} · {m.games} games · {m.avgMinutes} min avg
                    </div>
                  </div>
                  <div className={`tabular-nums font-medium ${colorClass}`}>
                    {m.winrate}%
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-gray-500 text-sm">Need ≥ 10 games per map.</div>
          )}
        </div>
      </div>
    ))}
  </div>
</Section>
{/* HERO TENDENCIES */}
<Section title="Hero Tendencies">
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <StatCard
      label="Highest Avg Hero Level"
      value={data.heroLevels.highestAvgHeroLevel?.map ?? "—"}
      sub={data.heroLevels.highestAvgHeroLevel ? (
        <span className="font-bold">
          Avg level: {data.heroLevels.highestAvgHeroLevel.heroAvgLevel}
        </span>
      ) : undefined}
    />
    <StatCard
      label="Lowest Avg Hero Level"
      value={data.heroLevels.lowestAvgHeroLevel?.map ?? "—"}
      sub={data.heroLevels.lowestAvgHeroLevel ? (
        <span className="font-bold">
          Avg level: {data.heroLevels.lowestAvgHeroLevel.heroAvgLevel}
        </span>
      ) : undefined}
    />
    <StatCard
      label="Most Games Ending with 1 Hero"
      value={data.mapsWithHighestHeroCount.oneHeroMap ?? "—"}
    />
    <StatCard
      label="Most Games Ending with 2 Heroes"
      value={data.mapsWithHighestHeroCount.twoHeroMap ?? "—"}
    />
    <StatCard
      label="Most Games Ending with 3 Heroes"
      value={data.mapsWithHighestHeroCount.threeHeroMap ?? "—"}
    />
  </div>
</Section>


 {/* MMR CONTEXT */}
<Section title="Map MMR Context">
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <StatCard
      label="Most Played"
      value={data.mmrContext.mostPlayed?.map ?? "—"}
      sub={data.mmrContext.mostPlayed ? (
        <span className="font-bold">{data.mmrContext.mostPlayed.games} games</span>
      ) : undefined}
    />
    <StatCard
      label="Best Net MMR Map"
      value={data.mmrContext.bestNet?.map ?? "—"}
      sub={data.mmrContext.bestNet ? (
        <span className="font-bold">Net {signed(data.mmrContext.bestNet.netMMR)}</span>
      ) : undefined}
    />
    <StatCard
      label="Worst Net MMR Map"
      value={data.mmrContext.worstNet?.map ?? "—"}
      sub={data.mmrContext.worstNet ? (
        <span className="font-bold">Net {signed(data.mmrContext.worstNet.netMMR)}</span>
      ) : undefined}
    />
    <StatCard
      label="Most games vs Higher MMR"
      value={data.mmrContext.mostVsHigher?.map ?? "—"}
      sub={data.mmrContext.mostVsHigher ? (
        <span className="font-bold">{data.mmrContext.mostVsHigher.vsHigher} games</span>
      ) : undefined}
    />
    <StatCard
      label="Most games vs Lower MMR"
      value={data.mmrContext.mostVsLower?.map ?? "—"}
      sub={data.mmrContext.mostVsLower ? (
        <span className="font-bold">{data.mmrContext.mostVsLower.vsLower} games</span>
      ) : undefined}
    />
  </div>
</Section>

    </div>
  );
}
