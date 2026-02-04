// src/app/stats/player/[battletag]/vs-player/page.tsx
export const revalidate = 300;
import EmptyState from "@/components/EmptyState";
import { getPlayerVsPlayer, displayMyRace } from "@/services/playerVsPlayer";
import { PlayerHeader, Section } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function VsPlayerPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) {
  return <EmptyState message="Invalid player" />;
}

  const data = await getPlayerVsPlayer(battletag);
  if (!data) {
  return <EmptyState message="Not enough data/recent games available" />;
}

  /* ================= helpers ================= */

  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const myRace = (g: any) => g.myRace ?? displayMyRace(g) ?? "Unknown";

  /* ================= render ================= */

  return (
    <div className="space-y-10 max-w-6xl mx-auto text-sm leading-relaxed">
      {/* HEADER */}
      <PlayerHeader
        battletag={data.battletag}
        subtitle="Opponent Stats (All Races) · Season 24 (Games under 120 seconds excluded)"
      />

      {/* ================= MMR Extremes ================= */}
      <Section title="MMR Extremes">
        {data.extremes.gainGamesToShow.length > 0 && (
          <div className="space-y-2">
            <div className="font-medium">Largest Single-Game Gain/Loss (If +15 or more, all will be added)</div>

            {data.extremes.gainGamesToShow.map((g, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-x-3">
                <span className="font-semibold text-emerald-600">W</span>

                <span>
                  <span className="font-semibold">{g.myName}</span>{" "}
                  ({myRace(g)} {g.myMMR}) vs{" "}
                  <span className="font-semibold">{g.oppName}</span>{" "}
                  ({g.oppRace} {g.oppMMR})
                </span>

                <span className="font-medium text-emerald-600">
                  {signed(g.mmrChange)}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.extremes.largestLossGame && (
          <div className="mt-3 grid grid-cols-[auto_1fr_auto] gap-x-3">
            <span className="font-semibold text-rose-600">L</span>

            <span>
              <span className="font-semibold">
                {data.extremes.largestLossGame.myName}
              </span>{" "}
              ({myRace(data.extremes.largestLossGame)}{" "}
              {data.extremes.largestLossGame.myMMR}) vs{" "}
              <span className="font-semibold">
                {data.extremes.largestLossGame.oppName}
              </span>{" "}
              ({data.extremes.largestLossGame.oppRace}{" "}
              {data.extremes.largestLossGame.oppMMR})
            </span>

            <span className="font-medium text-rose-600">
              {signed(-Math.abs(data.extremes.largestSingleLoss ?? 0))}
            </span>
          </div>
        )}
      </Section>

      {/* ================= Gap Extremes ================= */}
      <Section title="MMR Gap Extremes">
        {data.extremes.largestGapWin && (
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-3">
            <span className="font-semibold text-emerald-600">W</span>

            <span>
              <span className="font-semibold">
                {data.extremes.largestGapWin.myName}
              </span>{" "}
              ({myRace(data.extremes.largestGapWin)}{" "}
              {data.extremes.largestGapWin.myMMR}) vs{" "}
              <span className="font-semibold">
                {data.extremes.largestGapWin.oppName}
              </span>{" "}
              ({data.extremes.largestGapWin.oppRace}{" "}
              {data.extremes.largestGapWin.oppMMR})
            </span>

            <span className="font-medium text-emerald-600">
              {signed(data.extremes.largestGapWin.gap)}
            </span>
          </div>
        )}

        {data.extremes.largestGapLoss && (
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 mt-1">
            <span className="font-semibold text-rose-600">L</span>

            <span>
              <span className="font-semibold">
                {data.extremes.largestGapLoss.myName}
              </span>{" "}
              ({myRace(data.extremes.largestGapLoss)}{" "}
              {data.extremes.largestGapLoss.myMMR}) vs{" "}
              <span className="font-semibold">
                {data.extremes.largestGapLoss.oppName}
              </span>{" "}
              ({data.extremes.largestGapLoss.oppRace}{" "}
              {data.extremes.largestGapLoss.oppMMR})
            </span>

            <span className="font-medium text-rose-600">
              {signed(-Math.abs(data.extremes.largestGapLoss.gap))}
            </span>
          </div>
        )}
      </Section>

      {/* ================= Best ================= */}
      {data.best && (
        <Section title="Best Winrate vs Opponent (MMR-Weighted)">
          <div className="space-y-2 mb-2">
            <div>Opponent: {data.best.tag}</div>
            <div>Record: {data.best.wins}-{data.best.losses}</div>
            <div>Games: {data.best.totalGames}</div>
          </div>

          <div className="space-y-1">
            {data.best.gamesSortedByOppMMRDesc.map((g, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-x-3">
                <span
                  className={`font-semibold ${
                    g.result === "W" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {g.result}
                </span>

                <span>
                  <span className="font-semibold">{g.myName}</span>{" "}
                  ({myRace(g)} {g.myMMR}) vs{" "}
                  <span className="font-semibold">{g.oppName}</span>{" "}
                  ({g.oppRace} {g.oppMMR})
                </span>

                <span
                  className={`font-medium ${
                    g.mmrChange >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {signed(g.mmrChange)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ================= Worst ================= */}
      {data.worst && (
        <Section title="Lowest Winrate vs Opponent">
          {/* ✅ add summary like Best */}
          <div className="space-y-2 mb-2">
            <div>Opponent: {data.worst.tag}</div>
            <div>Record: {data.worst.wins}-{data.worst.losses}</div>
            <div>Games: {data.worst.totalGames}</div>
          </div>

          <div className="space-y-1">
            {data.worst.gamesSortedByOppMMRDesc.map((g, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-x-3">
                <span
                  className={`font-semibold ${
                    g.result === "W" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {g.result}
                </span>

                <span>
                  <span className="font-semibold">{g.myName}</span>{" "}
                  ({myRace(g)} {g.myMMR}) vs{" "}
                  <span className="font-semibold">{g.oppName}</span>{" "}
                  ({g.oppRace} {g.oppMMR})
                </span>

                <span
                  className={`font-medium ${
                    g.mmrChange >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {signed(g.mmrChange)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

    </div>
  );
}
