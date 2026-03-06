export const revalidate = 300;

import EmptyState from "@/components/EmptyState";
import type { Metadata } from "next";

import {
  getW3CRank,
  getPlayerSummary,
} from "@/services/playerSummary";

import { PlayerHeader, Section, StatCard } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

/* =====================================================
   SEO
===================================================== */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { battletag } = await params;
  const tag = decodeURIComponent(battletag);

  return {
    title: `${tag} W3Champions Stats – Ladder, MMR, Performance | W3C Stats`,
    description: `Full ladder and performance stats for ${tag}`,
    openGraph: {
      title: `${tag} W3Champions Stats`,
      description: `Live ladder and performance stats for ${tag}`,
      url: `https://www.w3cstats.com/stats/player/${encodeURIComponent(tag)}`,
      siteName: "W3C Stats",
      type: "website",
    },
  };
}

/* =====================================================
   PAGE
===================================================== */

export default async function PlayerPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) return <EmptyState message="Invalid player" />;

  const tag = decodeURIComponent(battletag);

  const [rankData, summaryData] = await Promise.all([
    getW3CRank(tag),
    getPlayerSummary(tag),
  ]);

  if (!rankData && !summaryData) {
    return <EmptyState message="Not enough data/recent games available" />;
  }

  const s = summaryData?.summary;
  const ranks = rankData?.ranks ?? [];
  const country = rankData?.country ?? "—";

  const lastPlayedAny = s?.lastPlayedLadder
    ? new Date(s.lastPlayedLadder).toLocaleDateString()
    : "N/A";

  const lastPlayedHighest =
    s?.highestCurrentRace && s.lastPlayedRace[s.highestCurrentRace]
      ? `${s.highestCurrentRace} — ${new Date(
          s.lastPlayedRace[s.highestCurrentRace]
        ).toLocaleDateString()}`
      : "N/A";

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-xs md:text-sm px-3 md:px-0">

      <PlayerHeader
        battletag={rankData?.battletag ?? s?.battletag ?? tag}
        subtitle="Player Stats · Seasons 23-24"
      />

      {s && (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Current Highest MMR Race"
              value={
                s.highestCurrentRace
                  ? `${s.highestCurrentRace} — ${s.highestCurrentMMR}`
                  : "N/A"
              }
            />
            <StatCard label="Most Played (All Time)" value={s.mostPlayedAllTime ?? "N/A"} />
            <StatCard label="Most Played (Current Season)" value={s.mostPlayedThisSeason ?? "N/A"} />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Last Ladder Game" value={lastPlayedAny} />
            <StatCard label="Last Highest-Race Game" value={lastPlayedHighest} />
          </section>
        </>
      )}

      {ranks.length > 0 && (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Country" value={country} />
            <StatCard label="Races Ranked" value={String(ranks.length)} />
          </section>

          <Section title="SoS Ladder Race Rankings">
            <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-dark overflow-x-auto">
              <table className="w-full table-fixed text-xs md:text-sm">

                <thead className="bg-gray-100 dark:bg-gray-800 text-xs uppercase">
                  <tr>
                    <th className="px-2 md:px-4 py-3 text-left">Race</th>
                    <th className="px-2 md:px-4 py-3 text-right">Global</th>
                    <th className="px-2 md:px-4 py-3 text-right">Country</th>
                    <th className="px-2 md:px-4 py-3 text-right">MMR</th>
                    <th className="px-2 md:px-4 py-3 text-right">Games</th>
                  </tr>
                </thead>

                <tbody>
                  {ranks.map((r, i) => {
                    const topGlobal = r.globalRank <= 10;
                    const topCountry =
                      r.countryRank != null && r.countryRank <= 10;

                    return (
                      <tr
                        key={r.raceId}
                        className={`border-t ${
                          i % 2 === 0
                            ? "bg-white dark:bg-gray-dark"
                            : "bg-gray-50/50 dark:bg-gray-800/40"
                        }`}
                      >
                        <td className="px-2 md:px-4 py-3 font-medium">{r.race}</td>

                        <td
                          className="px-2 md:px-4 py-3 text-right font-semibold"
                          style={topGlobal ? { color: "#059669" } : undefined}
                        >
                          #{r.globalRank}/{r.globalTotal}
                        </td>

                        <td
                          className="px-2 md:px-4 py-3 text-right font-semibold"
                          style={topCountry ? { color: "#059669" } : undefined}
                        >
                          {r.countryRank ? `#${r.countryRank}/${r.countryTotal}` : "—"}
                        </td>

                        <td className="px-2 md:px-4 py-3 text-right font-semibold">
                          {r.mmr}
                        </td>

                        <td className="px-2 md:px-4 py-3 text-right text-gray-500">
                          {r.games}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          </Section>
        </>
      )}

      {s && (
        <Section title="Top 2 Race Peak MMRs (Last 2 Seasons)">
          {s.top2Peaks.length ? (
            s.top2Peaks.map((p) => (
              <div key={p.race} className="flex justify-between text-sm tabular-nums">
                <span className="font-medium">{p.race}</span>
                <span className="font-semibold">
                  {p.mmr}{" "}
                  <span className="text-xs font-normal">
                    (Season {p.season})
                  </span>
                </span>
              </div>
            ))
          ) : (
            <div className="text-gray-500 text-sm">No peak data available</div>
          )}
        </Section>
      )}

    </div>
  );
}