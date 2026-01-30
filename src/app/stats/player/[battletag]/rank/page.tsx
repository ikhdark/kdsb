// src/app/stats/player/[battletag]/rank/page.tsx
export const revalidate = 300;

import { notFound } from "next/navigation";
import { getW3CRank, type W3CRankResponse } from "@/services/playerRank";
import { PlayerHeader, StatCard, Section } from "@/components/PlayerUI";

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
  const country = data?.country ?? "—";

  const ranks = Array.isArray(data?.ranks) ? data.ranks : [];

  const topRace =
    ranks.length > 0
      ? [...ranks].sort((a, b) => b.mmr - a.mmr)[0]
      : null;

  const showEmpty = !serviceError && (!data || ranks.length === 0);

  /* ================= render ================= */

  return (
    <div className="space-y-10 max-w-6xl mx-auto text-sm leading-relaxed">

      {/* HEADER */}
      <PlayerHeader
        battletag={titleTag}
        subtitle={`Rank Stats · Season 24 (Min 5 Games Played per Race)`}
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

      {/* PRIMARY STATS */}
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
        <Section title="Race Rankings sorted by MMR">
          <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-dark">

            <div className="w-full overflow-x-auto">
              <table className="min-w-[620px] w-full text-sm table-fixed">

                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">
                  <tr>
                  <th className="px-5 py-3 text-left w-28">Race</th>
<th className="px-5 py-3 text-right w-28">Global</th>
<th className="px-5 py-3 text-right w-28">Country</th>
<th className="px-5 py-3 text-right w-20">MMR</th>
<th className="px-5 py-3 text-right w-20">Games</th>

                  </tr>
                </thead>

                <tbody>
                  {ranks.map((r, i) => {
                    const getRankColor = (rank?: number) => {
                      if (!rank) return "";

                      if (rank <= 10) return "text-green-600 dark:text-green-400";
                      if (rank <= 25) return "text-yellow-600 dark:text-yellow-400";
                      if (rank <= 50) return "text-blue-600 dark:text-blue-400";
                      return "";
                    };

                    return (
                      <tr
                        key={r.raceId}
                        className={`border-t ${
                          i % 2 === 0
                            ? "bg-white dark:bg-gray-dark"
                            : "bg-gray-50/50 dark:bg-gray-800/40"
                        }`}
                      >
                        <td className="px-5 py-3 font-medium">{r.race}</td>

                        {/* Global */}
                        <td className={`px-5 py-3 text-right tabular-nums font-semibold ${getRankColor(r.globalRank)}`}>

                          #{r.globalRank}/{r.globalTotal}
                        </td>

                        {/* Country */}
                        <td className={`px-5 py-3 text-right tabular-nums font-semibold ${getRankColor(r.countryRank ?? undefined)}`}>


                          {r.countryRank && r.countryTotal
                            ? `#${r.countryRank}/${r.countryTotal}`
                            : "—"}
                        </td>

                        <td className="px-5 py-3 text-right font-semibold tabular-nums">
                          {r.mmr}
                        </td>

                        <td className="px-5 py-3 text-right text-gray-500 tabular-nums">
                          {r.games}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>

          </div>
        </Section>
      )}
    </div>
  );
}
