// src/app/stats/player/[battletag]/rank/page.tsx

import { notFound } from "next/navigation";
import { getW3CRank, type W3CRankResponse } from "@/services/playerRank";
import { PlayerHeader, StatCard } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function RankPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) notFound();

  const input = battletag;

  let data: W3CRankResponse | null = null;
  let serviceError: { message: string } | null = null;

  try {
    data = await getW3CRank(input);
  } catch (e: unknown) {
    serviceError = { message: e instanceof Error ? e.message : String(e) };
  }

  if (!data && !serviceError) notFound();

  const titleTag = data?.battletag ?? decodeURIComponent(input);
  const season = data?.season ?? "—";
  const country = data?.country ?? "—";
  const ranks = Array.isArray(data?.ranks) ? data.ranks : [];
  const topRace =
    ranks.length > 0
      ? [...ranks].sort((a, b) => b.mmr - a.mmr)[0]
      : null;
  const showEmpty = !serviceError && (!data || ranks.length === 0);

  // Helper function to get color based on percentile
  const getColorByPercentile = (rank: number, total: number) => {
    if (rank <= total * 0.03) return "text-yellow-500 font-bold";      // top 3%
    if (rank <= total * 0.10) return "text-amber-500 font-semibold";   // top 10%
    if (rank <= total * 0.25) return "text-emerald-500 font-semibold"; // top 25%
    if (rank <= total * 0.50) return "text-cyan-500 font-medium";      // top 50%
    if (rank <= total * 0.75) return "text-blue-500 font-medium";      // top 75%
    return "text-gray-500 dark:text-gray-400 font-medium";             // below 75%
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10">

      {/* HEADER */}
      <PlayerHeader
        battletag={titleTag}
        subtitle={`Season ${season} · 1v1 Ladder`}
      />

      {/* ERROR */}
      {serviceError && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm">
          <div className="font-semibold text-red-700">Service Error</div>
          <div className="mt-1 text-red-600">{serviceError.message}</div>
        </div>
      )}

      {/* EMPTY */}
      {showEmpty && (
        <div className="rounded-lg border p-4 text-sm text-gray-600">
          No ranked ladder data available for this season / min-games filter.
        </div>
      )}

      {/* HERO/STATS CARDS */}
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Highest Current MMR Race"
          value={topRace ? `${topRace.mmr}` : "—"}
          sub={topRace?.race}
        />
        <StatCard label="Country" value={country} />
        <StatCard label="Races Ranked" value={ranks.length.toString()} />
      </section>

      {/* RANK TABLE */}
      {ranks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Race Rankings
          </h2>

          <div className="overflow-hidden rounded-xl border bg-white shadow-md dark:bg-gray-dark">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <tr className="text-left text-base font-semibold">
                  <th className="px-5 py-3">Race</th>
                  <th className="px-5 py-3">Global</th>
                  <th className="px-5 py-3">Country</th>
                  <th className="px-5 py-3 text-right">MMR</th>
                  <th className="px-5 py-3 text-right">Games</th>
                </tr>
              </thead>

              <tbody>
                {ranks.map((r, i) => {
                  const globalColor = getColorByPercentile(r.globalRank, r.globalTotal);
                  const countryColor = r.countryRank && r.countryTotal
                    ? getColorByPercentile(r.countryRank, r.countryTotal)
                    : "font-semibold";

                  return (
                    <tr
                      key={r.raceId}
                      className={`border-t ${
                        i % 2 === 0
                          ? "bg-white dark:bg-gray-dark"
                          : "bg-gray-50/50 dark:bg-gray-800/50"
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-lg">{r.race}</td>

                      <td className={`px-5 py-3 tabular-nums text-lg ${globalColor}`}>
                        #{r.globalRank}/{r.globalTotal}
                      </td>

                      <td className={`px-5 py-3 tabular-nums text-lg ${countryColor}`}>
                        {r.countryRank && r.countryTotal
                          ? `#${r.countryRank}/${r.countryTotal}`
                          : "—"}
                      </td>

                      <td className="px-5 py-3 text-right font-semibold text-lg tabular-nums">
                        {r.mmr}
                      </td>

                      <td className="px-5 py-3 text-right text-gray-600 font-medium tabular-nums">
                        {r.games}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* FOOTNOTE */}
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 px-5 pb-2">
              <strong>Color Legend:</strong> Yellow = Top 3%, Amber = Top 10%, Green = Top 25%, Cyan/Blue = Mid ranks, Gray = Lower ranks
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
