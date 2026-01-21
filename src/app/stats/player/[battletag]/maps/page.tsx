import { notFound } from "next/navigation";
import { getW3CMapStats } from "@/services/playerMaps";

type PageProps = {
  params: {
    battletag: string;
  };
};

export default async function MapStatsPage({ params }: PageProps) {
  const battletag = params?.battletag;
  if (!battletag) notFound();

  // DO NOT decode or normalize here.
  // Service fully owns canonical resolution.
  const data = await getW3CMapStats(battletag);
  if (!data) notFound();

  return (
    <div className="space-y-12 text-sm leading-relaxed">
      {/* HEADER */}
      <h1 className="text-lg font-semibold">
        {data.battletag} — Season {data.seasons.join(", ")} Map Stats
      </h1>

      {/* W/L BY GAME LENGTH */}
      <section>
        <h2 className="font-semibold mb-3">W/L by Game Length</h2>

        <div className="space-y-1">
          {data.winrateByDuration.map((b) => (
            <div
              key={b.label}
              className="grid grid-cols-[110px_1fr_auto] gap-x-3 items-center"
            >
              <span className="text-muted-foreground">{b.label}</span>

              <div className="h-2 bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${b.winrate}%` }}
                />
              </div>

              <span className="tabular-nums">
                {b.winrate}% ({b.wins}-{b.losses})
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* AVG GAME DURATION */}
      <section>
        <h2 className="font-semibold mb-3">Average Game Duration</h2>

        <div className="grid grid-cols-2 gap-x-10 max-w-md">
          {data.avgWinMinutes !== null && (
            <div>
              <div className="text-muted-foreground">Avg Win</div>
              <div className="font-medium">{data.avgWinMinutes} min</div>
            </div>
          )}
          {data.avgLossMinutes !== null && (
            <div>
              <div className="text-muted-foreground">Avg Loss</div>
              <div className="font-medium">{data.avgLossMinutes} min</div>
            </div>
          )}
        </div>
      </section>

      {/* LONGEST WIN */}
      {data.longestWin && (
        <section>
          <h2 className="font-semibold mb-3">Longest Win</h2>

          <div className="space-y-1">
            <div className="font-medium">
              {data.longestWin.map} — {data.longestWin.minutes} min
            </div>
            <div className="text-muted-foreground">
              {data.longestWin.myTag} ({data.longestWin.myMMR}) vs{" "}
              {data.longestWin.oppTag} ({data.longestWin.oppMMR}) |{" "}
              <span className="text-emerald-600 font-medium">
                {data.longestWin.mmrChange >= 0 ? "+" : ""}
                {data.longestWin.mmrChange}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* TOP MAPS */}
      <section>
        <h2 className="font-semibold mb-3">Top 5 Best Maps</h2>

        <div className="space-y-1">
          {data.topMaps.map((m) => (
            <div key={m.map} className="grid grid-cols-[1fr_auto] gap-x-4">
              <span>{m.map}</span>
              <span className="tabular-nums text-emerald-600">
                {m.winrate}% ({m.record})
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* WORST MAPS */}
      <section>
        <h2 className="font-semibold mb-3">Top 5 Worst Maps</h2>

        <div className="space-y-1">
          {data.worstMaps.map((m) => (
            <div key={m.map} className="grid grid-cols-[1fr_auto] gap-x-4">
              <span>{m.map}</span>
              <span className="tabular-nums text-rose-600">
                {m.winrate}% ({m.record})
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* HERO LEVELS */}
      {(data.heroLevels.highestAvgHeroLevel ||
        data.heroLevels.lowestAvgHeroLevel) && (
        <section>
          <h2 className="font-semibold mb-3">Hero Level Tendencies</h2>

          <div className="space-y-1">
            {data.heroLevels.highestAvgHeroLevel && (
              <div>
                Highest Avg Hero Level:{" "}
                <span className="font-medium">
                  {data.heroLevels.highestAvgHeroLevel.map}
                </span>{" "}
                ({data.heroLevels.highestAvgHeroLevel.heroAvgLevel})
              </div>
            )}
            {data.heroLevels.lowestAvgHeroLevel && (
              <div>
                Lowest Avg Hero Level:{" "}
                <span className="font-medium">
                  {data.heroLevels.lowestAvgHeroLevel.map}
                </span>{" "}
                ({data.heroLevels.lowestAvgHeroLevel.heroAvgLevel})
              </div>
            )}
          </div>
        </section>
      )}

      {/* MAPS WITH MOST HERO COUNTS */}
      <section>
        <h2 className="font-semibold mb-3">
          Maps with Highest Average Hero Count
        </h2>

        <div className="space-y-1">
          {data.mapsWithHighestHeroCount.oneHeroMap && (
            <div>1 Hero: {data.mapsWithHighestHeroCount.oneHeroMap}</div>
          )}
          {data.mapsWithHighestHeroCount.twoHeroMap && (
            <div>2 Heroes: {data.mapsWithHighestHeroCount.twoHeroMap}</div>
          )}
          {data.mapsWithHighestHeroCount.threeHeroMap && (
            <div>3 Heroes: {data.mapsWithHighestHeroCount.threeHeroMap}</div>
          )}
        </div>
      </section>

      {/* SHORTEST / LONGEST MAPS */}
      <section>
        <h2 className="font-semibold mb-3">Shortest / Longest Games by W/L</h2>

        <div className="space-y-1">
          {data.shortestLongestByWL.shortestPositive && (
            <div>
              Shortest Win: {data.shortestLongestByWL.shortestPositive.map} (
              {data.shortestLongestByWL.shortestPositive.avgMinutes} min,{" "}
              {data.shortestLongestByWL.shortestPositive.winrate}%)
            </div>
          )}
          {data.shortestLongestByWL.shortestNegative && (
            <div>
              Shortest Loss: {data.shortestLongestByWL.shortestNegative.map} (
              {data.shortestLongestByWL.shortestNegative.avgMinutes} min,{" "}
              {data.shortestLongestByWL.shortestNegative.winrate}%)
            </div>
          )}
          {data.shortestLongestByWL.longestPositive && (
            <div>
              Longest Win: {data.shortestLongestByWL.longestPositive.map} (
              {data.shortestLongestByWL.longestPositive.avgMinutes} min,{" "}
              {data.shortestLongestByWL.longestPositive.winrate}%)
            </div>
          )}
          {data.shortestLongestByWL.longestNegative && (
            <div>
              Longest Loss: {data.shortestLongestByWL.longestNegative.map} (
              {data.shortestLongestByWL.longestNegative.avgMinutes} min,{" "}
              {data.shortestLongestByWL.longestNegative.winrate}%)
            </div>
          )}
        </div>
      </section>

      {/* MMR CONTEXT */}
      <section>
        <h2 className="font-semibold mb-3">Map MMR Context</h2>

        <div className="space-y-1">
          {data.mmrContext.mostPlayed && (
            <div>
              Most Played: {data.mmrContext.mostPlayed.map} (
              {data.mmrContext.mostPlayed.games})
            </div>
          )}
          {data.mmrContext.bestNet && (
            <div>
              Best Net MMR: {data.mmrContext.bestNet.map} (
              <span className="text-emerald-600">
                {data.mmrContext.bestNet.netMMR >= 0 ? "+" : ""}
                {data.mmrContext.bestNet.netMMR}
              </span>
              )
            </div>
          )}
          {data.mmrContext.worstNet && (
            <div>
              Worst Net MMR: {data.mmrContext.worstNet.map} (
              {data.mmrContext.worstNet.netMMR})
            </div>
          )}
          {data.mmrContext.mostVsHigher && (
            <div>
              Most vs Higher MMR: {data.mmrContext.mostVsHigher.map} (
              {data.mmrContext.mostVsHigher.vsHigher})
            </div>
          )}
          {data.mmrContext.mostVsLower && (
            <div>
              Most vs Lower MMR: {data.mmrContext.mostVsLower.map} (
              {data.mmrContext.mostVsLower.vsLower})
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
