import { notFound } from "next/navigation";
import { getPlayerSummary } from "@/services/playerSummary";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function SummaryPage({ params }: PageProps) {
  const { battletag } = await params;

  if (!battletag) notFound();

  const decoded = decodeURIComponent(battletag);

  const data = await getPlayerSummary(decoded);
  if (!data || !data.summary) notFound();

  const s = data.summary;

  return (
    <div className="space-y-6 rounded-lg bg-white p-6 shadow dark:bg-gray-dark">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">
          Player Summary
        </h1>
        <p className="text-sm text-gray-500">{s.battletag}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Most Played (All-Time)" value={s.mostPlayedAllTime} />
        <Stat
          label={`Most Played (Season ${23})`}
          value={s.mostPlayedThisSeason}
        />
        <Stat
          label="Highest Current MMR"
          value={
            s.highestCurrentRace
              ? `${s.highestCurrentRace} — ${s.highestCurrentMMR}`
              : "N/A"
          }
        />
      </div>

      <section>
        <h2 className="mb-2 font-semibold text-black dark:text-white">
          Peak MMRs (Last 3 Seasons)
        </h2>
        <ul className="space-y-1 text-sm text-black dark:text-white">
          {s.top2Peaks?.map((p: any) => (
            <li key={p.race}>
              {p.race}: {p.mmr} MMR (Season {p.season})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-black dark:text-white">
          Largest MMR Gains
        </h2>
        <div className="space-y-1 text-sm text-black dark:text-white">
          {s.gainGamesToShow?.map((g: any, i: number) => (
            <div key={i}>
              {g.myRace} ({g.myMMR}) vs {g.oppName} {g.oppRace} ({g.oppMMR}) —{" "}
              <span className="font-semibold">+{g.gain}</span>
            </div>
          ))}
        </div>
      </section>

      {s.largestGapWin && (
        <section>
          <h2 className="mb-2 font-semibold text-black dark:text-white">
            Largest MMR Gap Win
          </h2>
          <p className="text-sm text-black dark:text-white">
            {s.largestGapWin.myRace} ({s.largestGapWin.myMMR}) vs{" "}
            {s.largestGapWin.oppName} {s.largestGapWin.oppRace} (
            {s.largestGapWin.oppMMR}) —{" "}
            <span className="font-semibold">+{s.largestGapWin.gap}</span>
          </p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/30">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-black dark:text-white">
        {value}
      </div>
    </div>
  );
}
