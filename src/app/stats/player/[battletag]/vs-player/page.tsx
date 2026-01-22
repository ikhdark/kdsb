import { notFound } from "next/navigation";
import { getPlayerVsPlayer } from "@/services/playervsPlayer";

type PageProps = {
  params: Promise<{
    battletag: string;
  }>;
};

export default async function VsPlayerPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) notFound();

  // DO NOT decode or normalize here.
  // Service fully owns canonical resolution.
  const data = await getPlayerVsPlayer(battletag);
  if (!data) notFound();

  return (
    <div className="space-y-10 text-sm leading-relaxed rounded-lg bg-white p-6 shadow dark:bg-gray-dark">
      {/* HEADER */}
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-white">
          {data.battletag} — Opponent Breakdown
        </h1>
        <p className="text-sm text-gray-500">
          Season 23 · 1v1 Ladder
        </p>
      </div>

      {/* MMR EXTREMES */}
      <section>
        <h2 className="font-semibold mb-2">MMR Extremes</h2>

        {data.extremes.gainGamesToShow.length > 0 && (
          <div className="space-y-1">
            <div className="font-medium">Largest Single-Game Gain</div>

            {data.extremes.gainGamesToShow.map((g, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_auto] gap-x-3"
              >
                <span className="font-medium text-emerald-600">W</span>
                <span>
                  {g.myRace} ({g.myMMR}) vs {g.oppName}{" "}
                  {g.oppRace} ({g.oppMMR})
                </span>
                <span className="font-medium text-emerald-600">
                  +{g.mmrChange}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.extremes.largestLossGame && (
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-x-3">
            <span>
              Largest Single-Game Loss:{" "}
              {data.extremes.largestLossGame.myRace} (
              {data.extremes.largestLossGame.myMMR}) vs{" "}
              {data.extremes.largestLossGame.oppName}{" "}
              {data.extremes.largestLossGame.oppRace} (
              {data.extremes.largestLossGame.oppMMR})
            </span>
            <span className="font-medium text-rose-600">
              {data.extremes.largestSingleLoss}
            </span>
          </div>
        )}
      </section>

      {/* MMR GAP EXTREMES */}
      <section>
        <h2 className="font-semibold mb-2">MMR Gap Extremes</h2>

        {data.extremes.largestGapWin && (
          <div className="grid grid-cols-[1fr_auto] gap-x-3">
            <span>
              Largest Gap Win:{" "}
              {data.extremes.largestGapWin.myRace} (
              {data.extremes.largestGapWin.myMMR}) vs{" "}
              {data.extremes.largestGapWin.oppName}{" "}
              {data.extremes.largestGapWin.oppRace} (
              {data.extremes.largestGapWin.oppMMR})
            </span>
            <span className="font-medium text-emerald-600">
              +{data.extremes.largestGapWin.gap}
            </span>
          </div>
        )}

        {data.extremes.largestGapLoss && (
          <div className="grid grid-cols-[1fr_auto] gap-x-3 mt-1">
            <span>
              Largest Gap Loss:{" "}
              {data.extremes.largestGapLoss.myRace} (
              {data.extremes.largestGapLoss.myMMR}) vs{" "}
              {data.extremes.largestGapLoss.oppName}{" "}
              {data.extremes.largestGapLoss.oppRace} (
              {data.extremes.largestGapLoss.oppMMR})
            </span>
            <span className="font-medium text-rose-600">
              -{data.extremes.largestGapLoss.gap}
            </span>
          </div>
        )}
      </section>

      {/* BEST OPPONENT */}
      {data.best && (
        <section>
          <h2 className="font-semibold mb-2">
            Best Winrate vs Opponent (MMR-Weighted)
          </h2>

          <div className="space-y-1 mb-3">
            <div>
              Opponent: {data.best.tag} ({data.best.oppRace})
            </div>
            <div>
              Record: {data.best.wins}-{data.best.losses} (
              {data.best.winrate}%)
            </div>
            <div>Games: {data.best.totalGames}</div>
            <div>Net MMR: +{data.best.netMMR}</div>
          </div>

          <div className="space-y-1">
            {data.best.gamesSortedByOppMMRDesc.map((g, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_auto] gap-x-3"
              >
                <span className="font-semibold text-emerald-600">
                  {g.result}
                </span>
                <span>
                  {g.myRace} ({g.myMMR}) vs{" "}
                  {g.oppRace} ({g.oppMMR})
                </span>
                <span className="font-medium text-emerald-600">
                  +{g.mmrChange}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* WORST OPPONENT */}
      {data.worst && (
        <section>
          <h2 className="font-semibold mb-2">
            Lowest Winrate vs Opponent
          </h2>

          <div className="space-y-1 mb-3">
            <div>
              Opponent: {data.worst.tag} ({data.worst.oppRace})
            </div>
            <div>
              Record: {data.worst.wins}-{data.worst.losses} (
              {data.worst.winrate}%)
            </div>
            <div>Games: {data.worst.totalGames}</div>
            <div>Net MMR: {data.worst.netMMR}</div>
          </div>

          <div className="space-y-1">
            {data.worst.gamesSortedByOppMMRDesc.map((g, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_auto] gap-x-3"
              >
                <span className="font-semibold text-rose-600">
                  {g.result}
                </span>
                <span>
                  {g.myRace} ({g.myMMR}) vs{" "}
                  {g.oppRace} ({g.oppMMR})
                </span>
                <span className="font-medium text-rose-600">
                  {g.mmrChange}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
