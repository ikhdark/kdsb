// src/app/stats/player/[battletag]/summary/page.tsx
export const revalidate = 300;
import type { Metadata } from "next"; // ← ADD THIS
import { notFound } from "next/navigation";
import { getPlayerSummary } from "@/services/playerSummary";
import { displayMyRace } from "@/services/playerVsPlayer";
import { PlayerHeader, Section, StatCard } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

/* =========================
   SEO (required for Google indexing)
   This is the ONLY addition
========================= */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { battletag } = await params;
  const tag = decodeURIComponent(battletag);

  return {
    title: `${tag} W3Champions Ladder Stats – MMR, Heroes, Maps | W3C Stats`,
    description: `Live W3Champions ladder stats for ${tag}. Track MMR, win rates, heroes, maps, match history and performance trends.`,
    openGraph: {
      title: `${tag} W3Champions Ladder Stats – MMR, Heroes, Maps | W3C Stats`,
      description: `Full ladder stats and performance for ${tag}`,
      url: `https://www.w3cstats.com/stats/player/${encodeURIComponent(
        tag
      )}/summary`,
      siteName: "W3C Stats",
      type: "website",
    },
  };
}







export default async function SummaryPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) notFound();

  const decoded = decodeURIComponent(battletag);
  const data = await getPlayerSummary(decoded);
  if (!data || !data.summary) notFound();

  const s = data.summary;

  /* ================= helpers ================= */

  const myRace = (g: any) => g.myRace ?? displayMyRace(g) ?? "Unknown";

  const lastPlayedAny = s.lastPlayedLadder
    ? new Date(s.lastPlayedLadder).toLocaleDateString()
    : "N/A";

  const lastPlayedHighest =
    s.highestCurrentRace && s.lastPlayedRace[s.highestCurrentRace]
      ? `${s.highestCurrentRace} — ${new Date(
          s.lastPlayedRace[s.highestCurrentRace]
        ).toLocaleDateString()}`
      : "N/A";


      
  /* ================= render ================= */

  return (
    <div className="space-y-10 rounded-lg bg-white p-6 shadow dark:bg-gray-dark">
      {/* HEADER */}
      <PlayerHeader battletag={s.battletag} subtitle="Player Summary · Season 21-24 (All stat pages do not include games under 120 seconds)"  />

      {/* PRIMARY STATS */}
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Current Highest MMR Race"
          value={
            s.highestCurrentRace
              ? `${s.highestCurrentRace} — ${s.highestCurrentMMR}`
              : "N/A"
          }
        />
        <StatCard label="Most Played (Seasons 20-23)" value={s.mostPlayedAllTime || "N/A"} />
        <StatCard label="Most Played (Current Season)" value={s.mostPlayedThisSeason || "N/A"} />
      </section>

      {/* ACTIVITY */}
      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Last Ladder Game (Any Race)" value={lastPlayedAny} />
        <StatCard label="Last Ladder Game (Highest MMR Race)" value={lastPlayedHighest} />
      </section>

      {/* PEAK MMR */}
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

      {/* LARGEST MMR GAINS */}
      <Section title="Largest MMR Gains">
        {s.gainGamesToShow.length ? (
          s.gainGamesToShow.map((g, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto] gap-x-3 rounded border p-2 text-sm tabular-nums"
            >
              <span>
                <span className="font-semibold">{s.battletag}</span>{" "}
                ({myRace(g)} {g.myMMR}) vs{" "}
                <span className="font-semibold">{g.oppName}</span>{" "}
                ({g.oppRace} {g.oppMMR})
              </span>

              <span className="text-emerald-600 font-medium">
                +{g.gain}
              </span>
            </div>
          ))
        ) : (
          <div className="text-gray-500 text-sm">No significant gain games</div>
        )}
      </Section>

      {/* LARGEST GAP WIN */}
      <Section title="Largest MMR Gap Win">
        {s.largestGapWin ? (
          <div className="grid grid-cols-[1fr_auto] gap-x-3 rounded border p-3 text-sm tabular-nums">
            <span>
              <span className="font-semibold">{s.battletag}</span>{" "}
              ({myRace(s.largestGapWin)} {s.largestGapWin.myMMR}) vs{" "}
              <span className="font-semibold">{s.largestGapWin.oppName}</span>{" "}
              ({s.largestGapWin.oppRace} {s.largestGapWin.oppMMR})
            </span>

            <span className="text-emerald-600 font-medium">
              +{s.largestGapWin.gap}
            </span>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">No gap wins recorded</div>
        )}
      </Section>
    </div>
  );
}
