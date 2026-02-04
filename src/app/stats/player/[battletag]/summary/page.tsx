export const revalidate = 300;
import EmptyState from "@/components/EmptyState";
import type { Metadata } from "next";


import {
  getW3CRank,
  getPlayerSummary,
} from "@/services/playerSummary";

import { displayMyRace } from "@/services/playerVsPlayer";
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
if (!battletag) {
  return <EmptyState message="Invalid player" />;
}

  const decoded = decodeURIComponent(battletag);

  const [rankData, summaryData] = await Promise.all([
    getW3CRank(decoded),
    getPlayerSummary(decoded),
  ]);

 if (!rankData && !summaryData) {
  return <EmptyState message="No stats available yet" />;
}

  const s = summaryData?.summary;
  const ranks = rankData?.ranks ?? [];

  /* helpers */

  const myRace = (g: any) => g.myRace ?? displayMyRace(g) ?? "Unknown";

  const lastPlayedAny = s?.lastPlayedLadder
    ? new Date(s.lastPlayedLadder).toLocaleDateString()
    : "N/A";

  const lastPlayedHighest =
    s?.highestCurrentRace && s.lastPlayedRace[s.highestCurrentRace]
      ? `${s.highestCurrentRace} — ${new Date(
          s.lastPlayedRace[s.highestCurrentRace]
        ).toLocaleDateString()}`
      : "N/A";

  const topRace =
    ranks.length > 0
      ? [...ranks].sort((a, b) => b.mmr - a.mmr)[0]
      : null;

  const country = rankData?.country ?? "—";

  /* =====================================================
     render
  ===================================================== */

  return (
    <div className="space-y-12 max-w-6xl mx-auto text-sm">

      <PlayerHeader
        battletag={rankData?.battletag ?? s?.battletag ?? decoded}
        subtitle="Player Stats · Season 24"
      />

      {/* =================================================
         SUMMARY
      ================================================= */}

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
            <StatCard label="Most Played (All Time)" value={s.mostPlayedAllTime} />
            <StatCard label="Most Played (Current Season)" value={s.mostPlayedThisSeason} />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Last Ladder Game" value={lastPlayedAny} />
            <StatCard label="Last Highest-Race Game" value={lastPlayedHighest} />
          </section>
        </>
      )}

      {/* =================================================
         RANK  ← MOVED HERE
      ================================================= */}

{ranks.length > 0 && (
  <>
    <section className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Country" value={country} />
      <StatCard label="Races Ranked" value={ranks.length.toString()} />
    </section>

    <Section title="SoS Ladder Race Rankings">
      <div className="rounded-xl border bg-white shadow-sm dark:bg-gray-dark overflow-x-auto">
        <table className="min-w-[620px] w-full table-fixed">

          <thead className="bg-gray-100 dark:bg-gray-800 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Race</th>
              <th className="px-4 py-3 text-right">Global</th>
              <th className="px-4 py-3 text-right">Country</th>
              <th className="px-4 py-3 text-right">MMR</th>
              <th className="px-4 py-3 text-right">Games</th>
            </tr>
          </thead>

          <tbody>
            {ranks.map((r, i) => {
              const isTop10Global = r.globalRank <= 10;
              const isTop10Country =
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
                  <td className="px-4 py-3 font-medium">{r.race}</td>

                  {/* GLOBAL */}
                  <td
                    className="px-4 py-3 text-right font-semibold"
                    style={isTop10Global ? { color: "#059669" } : undefined}
                  >
                    #{r.globalRank}/{r.globalTotal}
                  </td>

                  {/* COUNTRY */}
                  <td
                    className="px-4 py-3 text-right font-semibold"
                    style={isTop10Country ? { color: "#059669" } : undefined}
                  >
                    {r.countryRank
                      ? `#${r.countryRank}/${r.countryTotal}`
                      : "—"}
                  </td>

                  <td className="px-4 py-3 text-right font-semibold">
                    {r.mmr}
                  </td>

                  <td className="px-4 py-3 text-right text-gray-500">
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


      {/* =================================================
         REMAINING SUMMARY DETAILS (unchanged)
      ================================================= */}

      {s && (
        <>
          <Section title="Top 2 Race Peak MMRs (Last 3 Seasons)">
            {s.top2Peaks.length ? (
              s.top2Peaks.map((p) => (
                <div key={p.race} className="flex justify-between text-sm tabular-nums">
                  <span className="font-medium">{p.race}</span>
                  <span className="font-semibold">
                    {p.mmr}{" "}
                    <span className="text-xs font-normal">
                      (Season {p.season}, Game {p.game})
                    </span>
                  </span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-sm">No peak data available</div>
            )}
          </Section>

          <Section title="Largest MMR Gains">
            {s.gainGamesToShow.length ? (
              s.gainGamesToShow.map((g, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-x-3 rounded border p-2 text-sm tabular-nums">
                  <span>
                    <span className="font-semibold">{s.battletag}</span> ({myRace(g)} {g.myMMR}) vs{" "}
                    <span className="font-semibold">{g.oppName}</span> ({g.oppRace} {g.oppMMR})
                  </span>
                  <span className="text-emerald-600 font-medium">+{g.gain}</span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-sm">No significant gain games</div>
            )}
          </Section>

          <Section title="Largest MMR Gap Win">
            {s.largestGapWin ? (
              <div className="grid grid-cols-[1fr_auto] gap-x-3 rounded border p-3 text-sm tabular-nums">
                <span>
                  <span className="font-semibold">{s.battletag}</span> ({myRace(s.largestGapWin)} {s.largestGapWin.myMMR}) vs{" "}
                  <span className="font-semibold">{s.largestGapWin.oppName}</span> ({s.largestGapWin.oppRace} {s.largestGapWin.oppMMR})
                </span>
                <span className="text-emerald-600 font-medium">
                  +{s.largestGapWin.gap}
                </span>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No gap wins recorded</div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
