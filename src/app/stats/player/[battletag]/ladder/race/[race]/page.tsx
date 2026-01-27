export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
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

/* =========================
   helpers
========================= */

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

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

/* =========================
   page
========================= */

export default async function RaceLadderPage({
  params,
  searchParams,
}: PageProps) {
  const { battletag, race: raceParam } = await params;
  const { page, highlight } = await searchParams;

  const race = raceParam.toLowerCase() as Race;

  if (!battletag || !race) notFound();

  const data = await getPlayerRaceLadder(battletag, race);
  if (!data) notFound();

  const { battletag: canonicalBt, me, full } = data;

  const base = `/stats/player/${encodeURIComponent(
    canonicalBt
  )}/ladder/race/${race}`;

  /* =========================
     pagination
  ========================= */

  const rawPage = Number(page) || 1;

  const poolSize = full.length;
  const totalPages = Math.max(1, Math.ceil(poolSize / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, rawPage), totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  const rows = full.slice(start, end);

  const windowSize = 2;
  const pages: number[] = [];

  for (
    let p = Math.max(1, currentPage - windowSize);
    p <= Math.min(totalPages, currentPage + windowSize);
    p++
  ) {
    pages.push(p);
  }

  /* =========================
     render
  ========================= */

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <PlayerHeader
        battletag={canonicalBt}
        subtitle={`${raceLabel(race)} Ladder · Season 24 · ${poolSize.toLocaleString()} players`}
      />

      <LadderSearch rows={full} base={base} />
{/* =========================
         ranking description (header)
      ========================= */}
      <p className="text-xs text-gray-500 -mt-4">
        Ranked by <b>Score</b> (performance index) which = MMR, SoS (Strength of Schedule), Winrate. There is also a decay metric applied to inactive players.
      </p>
      {/* ✅ Your Rank (same as global ladder) */}
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
          <table className="w-full text-sm border-collapse font-mono tabular-nums tracking-tight">
            <thead className="text-xs uppercase text-gray-500">
              <tr className="border-b border-gray-300 dark:border-gray-700">
                <th className="py-2 text-left w-12">#</th>
                <th className="py-2 text-left">Player</th>
                <th className="py-2 text-right font-semibold w-20">Score</th>
                <th className="py-2 text-right w-16">W-L</th>
                <th className="py-2 text-right w-16">WR</th>
                <th className="py-2 text-right w-20">MMR</th>
                <th className="py-2 text-right w-20">SoS</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((p) => {
                const isHighlight =
                  highlight &&
                  p.battletag
                    .toLowerCase()
                    .includes(highlight.toLowerCase());

                return (
                  <tr
                    key={`${p.battletag}-${p.rank}`}
                    className={`border-b border-gray-200 dark:border-gray-800 ${
                      isHighlight
                        ? "bg-yellow-200/60 dark:bg-yellow-500/20 font-semibold"
                        : ""
                    }`}
                  >
                    <td className="py-1.5">#{p.rank}</td>
                    <td className="py-1.5 font-sans truncate">
                      {p.battletag}
                    </td>
                    <td className="py-1.5 text-right font-semibold">
                      {num(p.score, 1)}
                    </td>
                    <td className="py-1.5 text-right">
                      {p.wins}-{p.losses}
                    </td>
                    <td className="py-1.5 text-right">
                      {pct(p.winrate)}
                    </td>
                    <td className="py-1.5 text-right">{p.mmr}</td>
                    <td className="py-1.5 text-right">{num(p.sos, 0)}</td>
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

          {pages.map((p) => (
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
