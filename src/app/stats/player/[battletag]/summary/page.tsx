import { notFound } from "next/navigation";
import { getPlayerSummary } from "@/services/playerSummary";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function Page({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) notFound();

  const decoded = decodeURIComponent(battletag);
  const data = await getPlayerSummary(decoded);
  if (!data || !data.summary) notFound();

  const s = data.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Player Summary</h1>
        <p className="text-sm text-gray-500">{s.battletag}</p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat
          label="Highest MMR"
          value={
            s.highestCurrentRace
              ? `${s.highestCurrentRace} — ${s.highestCurrentMMR}`
              : "N/A"
          }
        />
        <Stat
          label="Most Played (All-Time)"
          value={s.mostPlayedAllTime}
        />
        <Stat
          label="Most Played (Current Season)"
          value={s.mostPlayedThisSeason}
        />
      </div>

      {/* Activity */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Stat
          label="Last Ladder Game"
          value={
            s.lastPlayedLadder
              ? new Date(s.lastPlayedLadder).toLocaleDateString()
              : "N/A"
          }
        />
        <Stat
          label="Races Played"
          value={Object.keys(s.lastPlayedRace ?? {}).length.toString()}
        />
      </div>

      {/* Top Peak MMRs */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Peak MMRs (Last 3 Seasons)
        </h2>

        <div className="mt-2 space-y-1 text-sm">
          {s.top2Peaks.length ? (
            s.top2Peaks.map(p => (
              <div
                key={p.race}
                className="flex justify-between tabular-nums"
              >
                <span>{p.race}</span>
                <span>
                  {p.mmr} (Season {p.season}, Game {p.game})
                </span>
              </div>
            ))
          ) : (
            <div className="text-gray-500">No peak data available</div>
          )}
        </div>
      </section>

      {/* Largest Gain Games */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Largest MMR Gains
        </h2>

        <div className="mt-2 space-y-2 text-sm">
          {s.gainGamesToShow.length ? (
            s.gainGamesToShow.map((g, i) => (
              <div
                key={i}
                className="flex justify-between tabular-nums rounded border p-2"
              >
                <span>
                  {g.myRace} vs {g.oppName} ({g.oppRace})
                </span>
                <span>
                  {g.myMMR} → +{g.gain}
                </span>
              </div>
            ))
          ) : (
            <div className="text-gray-500">
              No significant gain games
            </div>
          )}
        </div>
      </section>

      {/* Largest Gap Win */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Largest MMR Gap Win
        </h2>

        {s.largestGapWin ? (
          <div className="mt-2 rounded border p-3 text-sm tabular-nums">
            <div>
              {s.largestGapWin.myRace} vs {s.largestGapWin.oppName} (
              {s.largestGapWin.oppRace})
            </div>
            <div className="mt-1">
              {s.largestGapWin.myMMR} → +{s.largestGapWin.gap}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-gray-500">
            No gap wins recorded
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3 text-sm">
      <div className="text-xs uppercase text-gray-500">
        {label}
      </div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
