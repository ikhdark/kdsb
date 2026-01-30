"use client";

import Link from "next/link";
import type { LadderRow } from "@/lib/ladderEngine";

type Props = {
  rows: LadderRow[];
  base: string;
  currentPage: number;
  totalPages: number;
  highlight?: string;
};

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function num(n: number | null | undefined, d = 0) {
  if (n == null) return "—";
  return n.toFixed(d);
}

export default function LadderTable({
  rows,
  base,
  currentPage,
  totalPages,
  highlight,
}: Props) {
  const highlightLower = highlight?.toLowerCase() ?? null;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse font-mono tabular-nums">
          {/* fixed column widths */}
          <colgroup>
            <col className="w-12" />
            <col className="w-44" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-24" />
            <col className="w-20" />
            <col className="w-24" />
          </colgroup>

          <thead className="text-xs uppercase text-gray-500 whitespace-nowrap">
            <tr className="border-b border-gray-300 dark:border-gray-700">
              <th className="text-left">#</th>
              <th className="text-left">Player</th>
              <th className="text-right">Score</th>
              <th className="text-right">MMR</th>
              <th className="text-right">SoS</th>
              <th className="text-right">W-L</th>
              <th className="text-right">WR</th>
              <th className="text-right">Decay</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((p) => {
              const isHighlight =
                highlightLower &&
                p.battletag.toLowerCase().includes(highlightLower);

              const penalty = p.decay ?? 0;

              return (
                <tr
                  key={`${p.battletag}-${p.rank}`}
                  className={`border-b border-gray-200 dark:border-gray-800 ${
                    isHighlight
                      ? "bg-yellow-100 dark:bg-yellow-900/40"
                      : ""
                  }`}
                >
                  <td className="py-1.5 whitespace-nowrap">#{p.rank}</td>

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

                  <td className="py-1.5 text-right">
                    {pct(p.winrate)}
                  </td>

                  <td className="py-1.5 text-right font-semibold">
                    {penalty > 0 ? (
                      <span className="text-red-500">-{penalty}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* pagination */}
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
    </>
  );
}
