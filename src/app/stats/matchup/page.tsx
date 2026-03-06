import MatchupSearch from "@/components/MatchupSearch";
import MatchupView from "./MatchupView";
import { getVsPlayer } from "@/services/vsPlayer";
import EmptyState from "@/components/EmptyState";
import { Section } from "@/components/PlayerUI";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;

  const playerA = a?.trim();
  const playerB = b?.trim();

  const hasQuery = Boolean(playerA && playerB);

  const stats = hasQuery ? await getVsPlayer(playerA!, playerB!) : null;

  return (
    <div className="max-w-6xl mx-auto px-3 md:px-0 space-y-6">
      <Section title="Player vs Player Matchup">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Compare two players across head-to-head games. Enter both battletags
          below to see overall results, race matchups, economy, army, hero stats,
          and maps.
        </div>
      </Section>

      <Section title="Search">
        <MatchupSearch initialA={playerA} initialB={playerB} />
      </Section>

      {!hasQuery ? (
        <Section title="Ready">
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            Select two players and press{" "}
            <span className="font-medium">Compare</span> to view matchup stats.
          </div>
        </Section>
      ) : !stats ? (
        <EmptyState message="No head-to-head games found." />
      ) : (
        <MatchupView stats={stats} />
      )}
    </div>
  );
}