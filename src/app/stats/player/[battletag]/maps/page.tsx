export const revalidate = 300;

import EmptyState from "@/components/EmptyState";
import { getW3CMapStats } from "@/services/playerMaps";
import { PlayerHeader, Section, StatCard } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

const wrColor = (wr: number) => {
  if (wr >= 50) return "text-emerald-500";
  if (wr >= 40) return "text-yellow-500";
  return "text-rose-500";
};

const wrBar = (wr: number) => {
  if (wr >= 50) return "bg-emerald-500";
  if (wr >= 40) return "bg-yellow-500";
  return "bg-rose-500";
};

export default async function MapStatsPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) return <EmptyState message="Player not found" />;

  const tag = decodeURIComponent(battletag);

  const data = await getW3CMapStats(tag);
  if (!data) {
    return <EmptyState message="Not enough data/recent games available" />;
  }

  const {
    battletag: canonicalBt,
    avgWinMinutes,
    avgLossMinutes,
    longestWin,
    winrateByDuration,
    topMaps,
    worstMaps,
    heroLevels,
    mapsWithHighestHeroCount,
    mmrContext,
  } = data;

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-xs md:text-sm leading-relaxed px-3 md:px-0">

      <PlayerHeader
        battletag={canonicalBt}
        subtitle="Map Stats (All Races) · Season 24 (Games under 120 seconds excluded)"
      />

      <Section title="Map Summary Stats">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Avg Win"
            value={avgWinMinutes ? `${avgWinMinutes} min` : "—"}
          />
          <StatCard
            label="Avg Loss"
            value={avgLossMinutes ? `${avgLossMinutes} min` : "—"}
          />
          <StatCard
            label="Longest Win"
            value={longestWin ? `${longestWin.minutes} min` : "—"}
            sub={
              longestWin
                ? `${longestWin.map} · vs ${longestWin.oppTag} (${longestWin.oppMMR})`
                : undefined
            }
          />
        </div>
      </Section>

      <Section title="Winrate by Game Length">
        <div className="space-y-2">
          {winrateByDuration
            .filter((b) => b.wins + b.losses > 0)
            .map((b) => (
              <div
                key={b.label}
                className="grid grid-cols-[80px_1fr_auto] md:grid-cols-[110px_1fr_auto] items-center gap-x-3"
              >
                <div className="text-gray-500">{b.label}</div>

                <div className="h-2 rounded bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full ${wrBar(b.winrate)}`}
                    style={{ width: `${b.winrate}%` }}
                  />
                </div>

                <div className={`tabular-nums font-medium ${wrColor(b.winrate)}`}>
                  {b.winrate}% ({b.wins}-{b.losses})
                </div>
              </div>
            ))}
        </div>
      </Section>

      <Section title="Top / Worst Maps">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[
            { title: "Top 5 Best Maps", data: topMaps },
            { title: "Top 5 Worst Maps", data: worstMaps },
          ].map((block) => (
            <div key={block.title}>
              <div className="font-medium">{block.title}</div>

              <div className="mt-2 space-y-2">
                {block.data.length ? (
                  block.data.map((m) => (
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

                      <div className={`font-medium ${wrColor(m.winrate)}`}>
                        {m.winrate}%
                      </div>
                    </div>
                  ))
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

      <Section title="Hero Tendencies">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Highest Avg Hero Level"
            value={heroLevels.highestAvgHeroLevel?.map ?? "—"}
            sub={
              heroLevels.highestAvgHeroLevel
                ? `Avg level: ${heroLevels.highestAvgHeroLevel.heroAvgLevel}`
                : undefined
            }
          />
          <StatCard
            label="Lowest Avg Hero Level"
            value={heroLevels.lowestAvgHeroLevel?.map ?? "—"}
            sub={
              heroLevels.lowestAvgHeroLevel
                ? `Avg level: ${heroLevels.lowestAvgHeroLevel.heroAvgLevel}`
                : undefined
            }
          />
          <StatCard label="Most 1-Hero Games" value={mapsWithHighestHeroCount.oneHeroMap ?? "—"} />
          <StatCard label="Most 2-Hero Games" value={mapsWithHighestHeroCount.twoHeroMap ?? "—"} />
          <StatCard label="Most 3-Hero Games" value={mapsWithHighestHeroCount.threeHeroMap ?? "—"} />
        </div>
      </Section>

      <Section title="Map MMR Context">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Most Played"
            value={mmrContext.mostPlayed?.map ?? "—"}
            sub={mmrContext.mostPlayed ? `${mmrContext.mostPlayed.games} games` : undefined}
          />
          <StatCard
            label="Best Net MMR Map"
            value={mmrContext.bestNet?.map ?? "—"}
            sub={mmrContext.bestNet ? `Net ${signed(mmrContext.bestNet.netMMR)}` : undefined}
          />
          <StatCard
            label="Worst Net MMR Map"
            value={mmrContext.worstNet?.map ?? "—"}
            sub={mmrContext.worstNet ? `Net ${signed(mmrContext.worstNet.netMMR)}` : undefined}
          />
          <StatCard
            label="Most vs Higher MMR"
            value={mmrContext.mostVsHigher?.map ?? "—"}
            sub={mmrContext.mostVsHigher ? `${mmrContext.mostVsHigher.vsHigher} games` : undefined}
          />
          <StatCard
            label="Most vs Lower MMR"
            value={mmrContext.mostVsLower?.map ?? "—"}
            sub={mmrContext.mostVsLower ? `${mmrContext.mostVsLower.vsLower} games` : undefined}
          />
        </div>
      </Section>

    </div>
  );
}