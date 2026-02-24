import EmptyState from "@/components/EmptyState";
import Link from "next/link";
import { PlayerHeader, Section } from "@/components/PlayerUI";
import LadderSearch from "@/components/LadderSearch";
import { PLAYER_LABELS } from "@/lib/playerLabels";

type Props = {
  title: string;
  subtitle: string;
  base: string;
  rows: any[];
  poolSize: number;
  currentPage: number;
  totalPages: number;
  highlight?: string;
  me?: any;
};

function num(n: number | null | undefined, d = 0) {
  if (n == null) return "—";
  return n.toFixed(d);
}

export default function LadderPage({
  title,
  subtitle,
  base,
  rows,
  currentPage,
  totalPages,
}: Props) {
  if (!rows?.length) {
    return <EmptyState message="No ladder data available" />;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-3 md:px-0">

      <PlayerHeader
        battletag={title}
        subtitle={subtitle}
      />

      <LadderSearch rows={rows} base={base} />

      <Section title={`Page ${currentPage} / ${totalPages}`}>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">

          <table className="w-full border-collapse text-sm">

            {/* HEADER */}
            <thead className="sticky top-0 bg-white dark:bg-zinc-900 z-10 text-xs uppercase tracking-wide text-zinc-500 font-semibold">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="w-14 text-left px-3 py-3">#</th>
                <th className="text-left px-3 py-3">Player</th>
                <th className="w-24 text-right px-3 py-3">Score</th>
                <th className="w-20 text-right px-3 py-3">MMR</th>
                <th className="w-20 text-right px-3 py-3">SoS</th>
                <th className="w-20 text-right px-3 py-3">W-L</th>
              </tr>
            </thead>

            {/* BODY */}
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((p) => (
                <tr
                  key={`${p.battletag}-${p.rank}`}
                  className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  {/* rank */}
                  <td className="px-3 py-2.5 text-zinc-500 font-medium tabular-nums">
                    #{p.rank}
                  </td>

                  {/* player */}
                 <td className="px-3 py-2.5 truncate font-medium text-zinc-900 dark:text-zinc-100">
  <Link
    href={`/stats/player/${encodeURIComponent(p.battletag)}/summary`}
    className="hover:underline"
  >
    {PLAYER_LABELS[p.battletag] 
      ? `${p.battletag} (${PLAYER_LABELS[p.battletag]})`
      : p.battletag}
  </Link>
</td>

                  {/* score */}
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums tracking-tight text-zinc-700 dark:text-zinc-300">
                    {num(p.score, 1)}
                  </td>

                  {/* mmr */}
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums tracking-tight text-zinc-700 dark:text-zinc-300">
                    {p.mmr}
                  </td>

                  {/* sos */}
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums tracking-tight text-zinc-700 dark:text-zinc-300">
                    {num(p.sos, 0)}
                  </td>

                  {/* win-loss */}
                  <td className="px-3 py-2.5 text-right tabular-nums tracking-tight text-zinc-700 dark:text-zinc-300">
                    {p.wins}-{p.losses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div className="flex justify-center gap-4 pt-4 text-sm font-medium">
          {currentPage > 1 && (
            <Link
              href={`${base}?page=${currentPage - 1}`}
              className="hover:underline"
            >
              Prev
            </Link>
          )}

          {currentPage < totalPages && (
            <Link
              href={`${base}?page=${currentPage + 1}`}
              className="hover:underline"
            >
              Next
            </Link>
          )}
        </div>

      </Section>
    </div>
  );
}