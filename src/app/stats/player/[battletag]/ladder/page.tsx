import { notFound } from "next/navigation";
import Link from "next/link";

import { getPlayerLadder } from "@/services/playerLadder";
import { PlayerHeader, Section } from "@/components/PlayerUI";
import LadderSearch from "@/components/LadderSearch";

type PageProps = {
  params: { battletag: string };
  searchParams: {
    page?: string;
    highlight?: string;
  };
};

const PAGE_SIZE = 50;

/* =========================
   helpers
========================= */

function num(n: number | null | undefined, d = 0) {
  if (n == null) return "—";
  return n.toFixed(d);
}

/* =========================
   page
========================= */

export default async function LadderPage({
  params,
  searchParams,
}: PageProps) {
  const { battletag } = await params;
  const { page, highlight } = await searchParams;

  if (!battletag) notFound();

  const rawPage = Number(page) || 1;

  // service handles pagination + caching
  const data = await getPlayerLadder(battletag, rawPage, PAGE_SIZE);
  if (!data) notFound();

  const {
    battletag: canonicalBt,
    me,
    full: rows,
    poolSize,
    updatedAtUtc,
  } = data;

  const totalPages = Math.max(1, Math.ceil(poolSize / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, rawPage), totalPages);

  const base = `/stats/player/${encodeURIComponent(canonicalBt)}/ladder`;

  const highlightLower = highlight?.toLowerCase() ?? null;

  const updatedText = updatedAtUtc
    ? new Date(updatedAtUtc).toUTCString()
    : "—";

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <PlayerHeader
        battletag={canonicalBt}
        subtitle={`SoS Global Ladder · Season 24 · ${poolSize.toLocaleString()} players`}
      />

      <LadderSearch rows={rows} base={base} />

      <p className="text-xs text-gray-500 -mt-4">
        Ranked by <b>Score</b> (performance index) which = MMR and SoS (Strength of Schedule) and Activity.
      </p>

      <p className="text-xs text-gray-500 -mt-2">
        Updated last at: <b>{updatedText} UTC</b>
      </p>

      {me && (
        <Section title="Your Rank">
          <div className="text-sm">
            Rank <b>#{me.rank}</b> · Score <b>{num(me.score, 1)}</b> · MMR{" "}
            <b>{me.mmr}</b>
          </div>
        </Section>
      )}

      <Section title={`Page ${currentPage} / ${totalPages}`}>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm border-collapse font-mono tabular-nums">
            <thead className="text-xs uppercase text-gray-500">
              <tr className="border-b border-gray-300 dark:border-gray-700">
                <th className="text-left w-12">#</th>
                <th className="text-left w-44">Player</th>
                <th className="text-right w-20">Score</th>
                <th className="text-right w-20">MMR</th>
                <th className="text-right w-20">SoS</th>
                <th className="text-right w-16">W-L</th>
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
                      isHighlight
                        ? "bg-yellow-100 dark:bg-yellow-900/40"
                        : ""
                    }`}
                  >
                    <td className="py-1.5">#{p.rank}</td>

                    <td className="py-1.5 truncate font-sans">
                      {p.battletag}
                    </td>

                    <td className="py-1.5 text-right font-semibold">
                      {num(p.score, 1)}
                    </td>

                    <td className="py-1.5 text-right font-semibold">
                      {p.mmr}
                    </td>

                    <td className="py-1.5 text-right font-semibold">
                      {num(p.sos, 0)}
                    </td>

                    <td className="py-1.5 text-right">
                      {p.wins}-{p.losses}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-2 pt-4 text-sm">
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
              Math.max(0, currentPage - 3),
              Math.min(totalPages, currentPage + 2)
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
        </div>
      </Section>
    </div>
  );
}
