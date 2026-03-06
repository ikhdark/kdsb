import EmptyState from "@/components/EmptyState";
import Link from "next/link";
import { PlayerHeader, Section } from "@/components/PlayerUI";
import LadderSearch from "@/components/LadderSearch";
import { PLAYER_LABELS } from "@/lib/playerLabels";

type Row = {
  battletag: string;
  rank: number;
  score: number;
  mmr: number;
  sos: number;
  wins: number;
  losses: number;
};

type Props = {
  title: string;
  subtitle: string;
  base: string;
  rows: Row[];
  poolSize: number;
  currentPage: number;
  totalPages: number;
  highlight?: string;
};

function num(n?: number | null, d = 0) {
  return n == null ? "—" : n.toFixed(d);
}

function playerLabel(tag: string) {
  const label = PLAYER_LABELS[tag];
  return label ? `${tag} (${label})` : tag;
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

      <PlayerHeader battletag={title} subtitle={subtitle} />

      <LadderSearch rows={rows} base={base} />

      <Section title={`Page ${currentPage} / ${totalPages}`}>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">

          <table className="w-full border-collapse text-sm">

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

            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((p) => (
                <tr
                  key={p.battletag}
                  className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <td className="px-3 py-2.5 text-zinc-500 font-medium tabular-nums">
                    #{p.rank}
                  </td>

                  <td className="px-3 py-2.5 truncate font-medium text-zinc-900 dark:text-zinc-100">
                    <Link
                      href={`/stats/player/${encodeURIComponent(p.battletag)}/summary`}
                      className="hover:underline"
                    >
                      {playerLabel(p.battletag)}
                    </Link>
                  </td>

                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums tracking-tight text-zinc-700 dark:text-zinc-300">
                    {num(p.score, 1)}
                  </td>

                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums tracking-tight text-zinc-700 dark:text-zinc-300">
                    {p.mmr}
                  </td>

                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums tracking-tight text-zinc-700 dark:text-zinc-300">
                    {num(p.sos)}
                  </td>

                  <td className="px-3 py-2.5 text-right tabular-nums tracking-tight text-zinc-700 dark:text-zinc-300">
                    {p.wins}-{p.losses}
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>

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