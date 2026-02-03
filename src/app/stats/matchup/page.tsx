import MatchupSearch from "@/components/MatchupSearch";
import MatchupView from "./MatchupView";
import { getVsPlayer } from "@/services/vsPlayer";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  /* NEXT 15+ — searchParams is async */
  const { a, b } = await searchParams;

  let stats = null;

  if (a && b) {
    stats = await getVsPlayer(a, b);
  }

  return (
    <div className="space-y-6">
      <MatchupSearch initialA={a} initialB={b} />

      {stats && <MatchupView stats={stats} />}
    </div>
  );
}