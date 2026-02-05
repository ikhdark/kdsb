// src/app/stats/player/[battletag]/maps/page.tsx
export const revalidate = 300;
import EmptyState from "@/components/EmptyState";
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
 if (!battletag) return <EmptyState message="Player not found" />;

  const data = await getW3CMapStats(battletag);
  if (!data) return <EmptyState message="Not enough data/recent games available" />;

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-xs md:text-sm leading-relaxed px-3 md:px-0">



      {/* HEADER */}
      <PlayerHeader
        battletag={data.battletag}
        subtitle={`Map Stats (All Races) · Season 24 (Games under 120 seconds excluded)`}
      />

      {/* ================= SUMMARY ================= */}
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

      {/* ================= WINRATE BY LENGTH ================= */}
      <Section title="Winrate by Game Length">
  <div className="space-y-2">
    {data.winrateByDuration
      .filter((b) => b.wins + b.losses > 0) // only show brackets with games
      .map((b) => {
        let barColor = "bg-rose-500";
        if (b.winrate >= 50) barColor = "bg-emerald-500";
        else if (b.winrate >= 40) barColor = "bg-yellow-500";

        let textColor = "text-rose-500";
        if (b.winrate >= 50) textColor = "text-emerald-500";
        else if (b.winrate >= 40) textColor = "text-yellow-500";

        return (
          <div
            key={b.label}
            className="grid grid-cols-[80px_1fr_auto] md:grid-cols-[110px_1fr_auto] items-center gap-x-3"
          >
            <div className="text-gray-500">{b.label}</div>

            <div className="h-2 rounded bg-gray-200 overflow-hidden">
              <div
                className={`h-full ${barColor}`}
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

      {/* ================= TOP / WORST MAPS ================= */}
      <Section title="Top / Worst Maps">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[
            { title: "Top 5 Best Maps", data: data.topMaps },
            { title: "Top 5 Worst Maps", data: data.worstMaps },
          ].map((block) => (
            <div key={block.title}>
              <div className="font-medium">{block.title}</div>

              <div className="mt-2 space-y-2">
                {block.data.length ? (
                  block.data.map((m) => {
                    let colorClass = "text-rose-500";
                    if (m.winrate >= 50) colorClass = "text-emerald-500";
                    else if (m.winrate >= 40) colorClass = "text-yellow-500"; // FIXED

                    return (
                      <div
                        key={m.map}
                        className="flex justify-between tabular-nums text-xs md:text-sm"

                      >
                        <div>
                          <div>{m.map}</div>
                          <div className="text-[11px] md:text-xs text-gray-500">
                            {m.wins}-{m.losses} · {m.games} games · {m.avgMinutes} min avg
                          </div>
                        </div>

                        <div className={`font-medium ${colorClass}`}>
                          {m.winrate}%
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-gray-500 text-sm">
                    Need ≥ 10 games per map.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ================= HERO TENDENCIES ================= */}
      <Section title="Hero Tendencies">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <StatCard label="Most 1-Hero Games" value={data.mapsWithHighestHeroCount.oneHeroMap ?? "—"} />
          <StatCard label="Most 2-Hero Games" value={data.mapsWithHighestHeroCount.twoHeroMap ?? "—"} />
          <StatCard label="Most 3-Hero Games" value={data.mapsWithHighestHeroCount.threeHeroMap ?? "—"} />
        </div>
      </Section>

      {/* ================= MMR CONTEXT ================= */}
      <Section title="Map MMR Context">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Most Played"
            value={data.mmrContext.mostPlayed?.map ?? "—"}
            sub={data.mmrContext.mostPlayed ? `${data.mmrContext.mostPlayed.games} games` : undefined}
          />
          <StatCard
            label="Best Net MMR Map"
            value={data.mmrContext.bestNet?.map ?? "—"}
            sub={data.mmrContext.bestNet ? `Net ${signed(data.mmrContext.bestNet.netMMR)}` : undefined}
          />
          <StatCard
            label="Worst Net MMR Map"
            value={data.mmrContext.worstNet?.map ?? "—"}
            sub={data.mmrContext.worstNet ? `Net ${signed(data.mmrContext.worstNet.netMMR)}` : undefined}
          />
          <StatCard
            label="Most vs Higher MMR"
            value={data.mmrContext.mostVsHigher?.map ?? "—"}
            sub={data.mmrContext.mostVsHigher ? `${data.mmrContext.mostVsHigher.vsHigher} games` : undefined}
          />
          <StatCard
            label="Most vs Lower MMR"
            value={data.mmrContext.mostVsLower?.map ?? "—"}
            sub={data.mmrContext.mostVsLower ? `${data.mmrContext.mostVsLower.vsLower} games` : undefined}
          />
        </div>
      </Section>

    </div>
  );
}
