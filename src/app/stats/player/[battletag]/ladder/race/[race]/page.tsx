import EmptyState from "@/components/EmptyState";
import Link from "next/link";

import { getPlayerRaceLadder } from "@/services/playerRaceLadder";
import { PlayerHeader, Section } from "@/components/PlayerUI";
import LadderSearch from "@/components/LadderSearch";

type Race = "human" | "orc" | "elf" | "undead" | "random";

type PageProps = {
  params: Promise<{ battletag: string; race: string }>;
  searchParams: Promise<{ page?: string; highlight?: string }>;
};

const PAGE_SIZE = 50;

/* helpers */

function num(n: number | null | undefined, d = 0) {
  if (n == null) return "—";
  return n.toFixed(d);
}

function raceLabel(race: string) {
  const r = race.toLowerCase();
  if (r === "human") return "Human";
  if (r === "orc") return "Orc";
  if (r === "elf") return "Night Elf";
  if (r === "undead") return "Undead";
  if (r === "random") return "Random";
  return race;
}

/* page */

export default async function RaceLadderPage({
  params,
  searchParams,
}: PageProps) {
  const { battletag, race: raceParam } = await params;
  const { page, highlight } = await searchParams;

if (!battletag || !raceParam) {
  return <EmptyState message="Invalid player" />;
}

const race = raceParam.toLowerCase() as Race;

if (!["human","orc","elf","undead","random"].includes(race)) {
  return <EmptyState message="Invalid race" />;
}
  const rawPage = Math.max(1, Number(page) || 1);

  // service handles caching + pagination
  const data = await getPlayerRaceLadder(
    battletag,
    race,
    rawPage,
    PAGE_SIZE
  );

if (!data || !data.full?.length) {
  return <EmptyState message="No ladder data available yet" />;
}

  const {
    battletag: canonicalBt,
    me,
    full: rows,
    poolSize,
  } = data;

  const totalPages = Math.max(1, Math.ceil(poolSize / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, rawPage), totalPages);

  const base = `/stats/player/${encodeURIComponent(
    canonicalBt
  )}/ladder/race/${race}`;

  const highlightLower = highlight?.toLowerCase() ?? null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-xs md:text-sm px-3 md:px-0">

      <PlayerHeader
        battletag={canonicalBt}
        subtitle={`${raceLabel(race)} Ladder · Season 24 · ${poolSize.toLocaleString()} players`}
      />

      <LadderSearch rows={rows} base={base} />

      <p className="text-xs text-gray-500 -mt-4">
        Ranked by <b>Score</b> (performance index) which = MMR and SoS (Strength of Schedule) and Activity.
      </p>

      {me && (
        <Section title="Your Rank">
          <div className="text-xs md:text-sm">
            Rank <b>#{me.rank}</b> · Score <b>{num(me.score, 1)}</b> · MMR{" "}
            <b>{me.mmr}</b>
          </div>
        </Section>
      )}

      <Section title={`Page ${currentPage} / ${totalPages}`}>
     <div className="overflow-x-auto">
  <table className="w-full text-sm border-collapse font-mono tabular-nums">

    <thead className="text-[11px] uppercase text-gray-500 tracking-wide">
      <tr className="border-b border-gray-300 dark:border-gray-700">
        <th className="text-left w-14 px-3 py-2">#</th>
        <th className="text-left min-w-[180px] px-3 py-2">Player</th>
        <th className="text-right w-24 px-3 py-2">Score</th>
        <th className="text-right w-20 px-3 py-2">MMR</th>
        <th className="text-right w-20 px-3 py-2">SoS</th>
        <th className="text-right w-20 px-3 py-2">W-L</th>
      </tr>
    </thead>

    <tbody>
      {rows.map((p) => {
        const isHighlight =
          highlightLower &&
          p.battletag.toLowerCase().includes(highlightLower);

        return (
          <tr
            key={`${p.battletag}-${p.rank}`}
            className={`border-b border-gray-200 dark:border-gray-800 ${
              isHighlight ? "bg-yellow-100 dark:bg-yellow-900/40" : ""
            } hover:bg-gray-50 dark:hover:bg-gray-800/40`}
          >
            <td className="px-3 py-2 text-gray-600">#{p.rank}</td>

            {/* keep mono here too for alignment consistency */}
            <td className="px-3 py-2 font-mono truncate">
              {p.battletag}
            </td>

            <td className="px-3 py-2 text-right font-semibold">
              {num(p.score, 1)}
            </td>

            <td className="px-3 py-2 text-right font-semibold">
              {p.mmr}
            </td>

            <td className="px-3 py-2 text-right font-semibold">
              {num(p.sos, 0)}
            </td>

            <td className="px-3 py-2 text-right">
              {p.wins}-{p.losses}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>

        <div className="flex items-center justify-center gap-2 pt-4 text-xs md:text-sm">
          {currentPage > 1 && (
            <Link
              href={`${base}?page=${currentPage - 1}`}
              className="px-3 py-1 border rounded"
            >
              Prev
            </Link>
          )}

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(
              Math.max(0, currentPage - 2),
              Math.min(totalPages, currentPage + 1)
            )
            .map((p) => (
              <Link
                key={p}
                href={`${base}?page=${p}`}
                className={`px-3 py-1 border rounded ${
                  p === currentPage
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : ""
                }`}
              >
                {p}
              </Link>
            ))}

          {currentPage < totalPages && (
            <Link
              href={`${base}?page=${currentPage + 1}`}
              className="px-3 py-1 border rounded"
            >
              Next
            </Link>
          )}
        </div>
      </Section>
    </div>
  );
}
