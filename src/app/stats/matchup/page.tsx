import MatchupSearch from "@/components/MatchupSearch";
import MatchupView from "./MatchupView";
import { getVsPlayer } from "@/services/vsPlayer";
import EmptyState from "@/components/EmptyState";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;

  let stats = null;

  if (a && b) {
    stats = await getVsPlayer(a, b);
  }

  return (
    <div className="max-w-6xl mx-auto px-3 md:px-0 space-y-6">

      {/* ================= HEADER / INSTRUCTIONS ================= */}
      <div className="rounded-xl border bg-white dark:bg-gray-900 p-4 md:p-5">
        <h1 className="text-base md:text-lg font-semibold">
          Player vs Player Matchup
        </h1>

        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Compare two players across head-to-head games.
          Enter both battletags below to see overall results,
          race matchups, economy, army, hero stats, and maps.
        </p>
      </div>

      {/* ================= SEARCH ================= */}
      <div className="rounded-xl border bg-white dark:bg-gray-900 p-4 md:p-5">
        <MatchupSearch initialA={a} initialB={b} />
      </div>

      {/* ================= STATES ================= */}

      {/* nothing searched yet */}
      {!a || !b ? (
        <div className="rounded-xl border bg-white dark:bg-gray-900 p-6 text-center">
          <p className="text-sm text-gray-500">
            Select two players and press <span className="font-medium">Compare</span> to view matchup stats.
          </p>
        </div>
      ) : !stats ? (
        /* searched but no games */
        <EmptyState message="No head-to-head games found." />
      ) : (
        /* normal */
        <MatchupView stats={stats} />
      )}
    </div>
  );
}