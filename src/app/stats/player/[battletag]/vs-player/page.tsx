export const revalidate = 300;

import EmptyState from "@/components/EmptyState";
import { getPlayerVsPlayer, displayMyRace } from "@/services/playerVsPlayer";
import { PlayerHeader, Section } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function VsPlayerPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) return <EmptyState message="Invalid player" />;

  const tag = decodeURIComponent(battletag);

  const data = await getPlayerVsPlayer(tag);
  if (!data) {
    return <EmptyState message="Not enough data/recent games available" />;
  }

  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const myRace = (g: { myRace?: string | null }) =>
    g.myRace ?? displayMyRace(g as any) ?? "Unknown";

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-xs md:text-sm px-3 md:px-0">

      <PlayerHeader
        battletag={data.battletag}
        subtitle="Opponent Stats (All Races) · Season 24 (Games under 120 seconds excluded)"
      />

      <Section title="Largest Single-Game Gain/Loss (If +15 or more, all will be added)">
        {data.extremes.gainGamesToShow.length > 0 && (
          <div className="space-y-2">
            {data.extremes.gainGamesToShow.map((g, i) => {
              const race = myRace(g);
              return (
                <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-x-3">
                  <span className="font-semibold text-emerald-600">W</span>

                  <span className="min-w-0 break-words">
                    <span className="font-semibold">{g.myName}</span>{" "}
                    ({race} {g.myMMR}) vs{" "}
                    <span className="font-semibold">{g.oppName}</span>{" "}
                    ({g.oppRace} {g.oppMMR})
                  </span>

                  <span className="font-medium text-emerald-600">
                    {signed(g.mmrChange)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {data.extremes.largestLossGame && (() => {
          const g = data.extremes.largestLossGame;
          const race = myRace(g);

          return (
            <div className="mt-3 grid grid-cols-[auto_1fr_auto] gap-x-3">
              <span className="font-semibold text-rose-600">L</span>

              <span className="min-w-0 break-words">
                <span className="font-semibold">{g.myName}</span>{" "}
                ({race} {g.myMMR}) vs{" "}
                <span className="font-semibold">{g.oppName}</span>{" "}
                ({g.oppRace} {g.oppMMR})
              </span>

              <span className="font-medium text-rose-600">
                {signed(-Math.abs(data.extremes.largestSingleLoss ?? 0))}
              </span>
            </div>
          );
        })()}
      </Section>

      <Section title="Largest MMR Gap In Win/Loss">
        {data.extremes.largestGapWin && (() => {
          const g = data.extremes.largestGapWin;
          const race = myRace(g);

          return (
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-3">
              <span className="font-semibold text-emerald-600">W</span>

              <span className="min-w-0 break-words">
                <span className="font-semibold">{g.myName}</span>{" "}
                ({race} {g.myMMR}) vs{" "}
                <span className="font-semibold">{g.oppName}</span>{" "}
                ({g.oppRace} {g.oppMMR})
              </span>

              <span className="font-medium text-emerald-600">
                {signed(g.gap)}
              </span>
            </div>
          );
        })()}

        {data.extremes.largestGapLoss && (() => {
          const g = data.extremes.largestGapLoss;
          const race = myRace(g);

          return (
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 mt-1">
              <span className="font-semibold text-rose-600">L</span>

              <span className="min-w-0 break-words">
                <span className="font-semibold">{g.myName}</span>{" "}
                ({race} {g.myMMR}) vs{" "}
                <span className="font-semibold">{g.oppName}</span>{" "}
                ({g.oppRace} {g.oppMMR})
              </span>

              <span className="font-medium text-rose-600">
                {signed(-Math.abs(g.gap))}
              </span>
            </div>
          );
        })()}
      </Section>

      {data.best && (
        <Section title="Best Winrate vs Opponent (MMR-Weighted)">
          <div className="space-y-1 mb-2">
            <div>Opponent: {data.best.tag}</div>
            <div>Record: {data.best.wins}-{data.best.losses}</div>
            <div>Games: {data.best.totalGames}</div>
          </div>

          <div className="space-y-1">
            {data.best.gamesSortedByOppMMRDesc.map((g, i) => {
              const race = myRace(g);
              const win = g.result === "W";

              return (
                <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-x-3">
                  <span className={`font-semibold ${win ? "text-emerald-600" : "text-rose-600"}`}>
                    {g.result}
                  </span>

                  <span className="min-w-0 break-words">
                    <span className="font-semibold">{g.myName}</span>{" "}
                    ({race} {g.myMMR}) vs{" "}
                    <span className="font-semibold">{g.oppName}</span>{" "}
                    ({g.oppRace} {g.oppMMR})
                  </span>

                  <span className={`font-medium ${g.mmrChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {signed(g.mmrChange)}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {data.worst && (
        <Section title="Lowest Winrate vs Opponent">
          <div className="space-y-1 mb-2">
            <div>Opponent: {data.worst.tag}</div>
            <div>Record: {data.worst.wins}-{data.worst.losses}</div>
            <div>Games: {data.worst.totalGames}</div>
          </div>

          <div className="space-y-1">
            {data.worst.gamesSortedByOppMMRDesc.map((g, i) => {
              const race = myRace(g);
              const win = g.result === "W";

              return (
                <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-x-3">
                  <span className={`font-semibold ${win ? "text-emerald-600" : "text-rose-600"}`}>
                    {g.result}
                  </span>

                  <span className="min-w-0 break-words">
                    <span className="font-semibold">{g.myName}</span>{" "}
                    ({race} {g.myMMR}) vs{" "}
                    <span className="font-semibold">{g.oppName}</span>{" "}
                    ({g.oppRace} {g.oppMMR})
                  </span>

                  <span className={`font-medium ${g.mmrChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {signed(g.mmrChange)}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

    </div>
  );
}