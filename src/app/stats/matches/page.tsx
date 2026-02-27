import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import MatchHistoryShell from "@/components/MatchHistoryShell";
import MatchSearchInput from "@/components/MatchSearchInput";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ player?: string; vs?: string }>;
}) {
  const { player, vs } = await searchParams;

  if (!player) {
    return <MatchSearchInput />;
  }

  const canonical = await resolveBattleTagViaSearch(player);
  if (!canonical) {
    return <div>Resolver failed for: {player}</div>;
  }

  return (
    <MatchHistoryShell
      player={canonical}
      vsFilter={vs ?? ""}
    />
  );
}