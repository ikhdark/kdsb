// src/app/stats/player/[battletag]/rank/page.tsx

import { notFound } from "next/navigation";
import { getW3CRank } from "@/services/playerRank";

type PageProps = {
  params: Promise<{
    battletag: string;
  }>;
};

export default async function RankPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) notFound();

  const decoded = decodeURIComponent(battletag);
  const data = await getW3CRank(decoded);
  if (!data) notFound();

  // ---------- UI parsing ONLY ----------
  const lines = data.result
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const headerLines = lines.filter(
  l =>
    !l.includes("globally") &&
    !l.includes("MMR") &&
    !l.match(/^\w+\s—/)
);
  const raceLines = lines.filter(
    l => l.includes("globally") && l.includes("MMR")
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-200 dark:bg-gray-dark dark:ring-gray-700">
  <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
    Rank Statistics
  </h1>

  <div className="mt-6 text-lg font-medium text-gray-900 dark:text-gray-400">
    {decoded} · Season 23 · 1v1
  </div>

  <div className="mt-6 space-y-2 text-base text-gray-900 dark:text-gray-500">
    <div className="font-medium">— Min 25 Games —</div>
    <div>As of: {new Date().toLocaleString()}</div>
  </div>
</div>

      {/* Race Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {raceLines.map((line, i) => {
          // Example:
          // Random — #31/446 globally | #3 in US (of 52) — 1921 MMR, 271 games

          const race = line.split("—")[0].trim();

          const mmr = line.match(/(\d+)\sMMR/i)?.[1] ?? null;
          const games = line.match(/(\d+)\sgames/i)?.[1] ?? null;

          const rankText = line
            .replace(/^.*?—\s*/, "")
            .replace(/—\s*\d+\sMMR,\s*\d+\sgames/i, "")
            .trim();

          return (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/40"
            >
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {race}
              </div>

              <div className="mt-2 text-base text-gray-600 dark:text-gray-300">
                {rankText}
              </div>

              <div className="mt-6 flex items-end justify-between">
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {mmr ?? "—"}
                  <span className="ml-2 text-sm font-medium text-gray-500">
                    MMR
                  </span>
                </div>

                <div className="text-sm text-gray-500">
                  {games ? `${games} games` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
