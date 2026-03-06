export const revalidate = 300;

import { getPlayerConsistency } from "@/services/playerConsistency";
import { PlayerHeader, StatCard } from "@/components/PlayerUI";
import TimeHeatmap from "@/components/TimeHeatmap";
import EmptyState from "@/components/EmptyState";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function ConsistencyPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) {
    return <EmptyState message="Player not found" />;
  }

  const tag = decodeURIComponent(battletag);

  const data = await getPlayerConsistency(tag);
  if (!data?.matches?.length) {
    return <EmptyState message="Not enough data/recent games available" />;
  }

  const map = new Map<string, { games: number; wins: number }>();

  for (const m of data.matches) {
    const d = new Date(m.startTime);

    const day = d.getDay();
    const hour = d.getHours();

    const bucket = hour < 8 ? 0 : hour < 16 ? 1 : 2;

    const key = day + "-" + bucket;

    const prev = map.get(key);

    if (prev) {
      prev.games++;
      if (m.didWin) prev.wins++;
    } else {
      map.set(key, {
        games: 1,
        wins: m.didWin ? 1 : 0,
      });
    }
  }

  const cells = new Array(21);
  let idx = 0;

  for (let day = 0; day < 7; day++) {
    for (let bucket = 0; bucket < 3; bucket++) {
      const key = day + "-" + bucket;
      const v = map.get(key);

      const games = v?.games ?? 0;
      const wins = v?.wins ?? 0;

      cells[idx++] = {
        day,
        bucket,
        games,
        wins,
        winrate: games ? Math.round((wins / games) * 100) : null,
        netMMR: 0,
      };
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-xs md:text-sm px-3 md:px-0">

      <PlayerHeader
        battletag={data.battletag}
        subtitle="Consistency · Day/Time Performance (Local Time) · Season 24 (All Races) (Games under 120 seconds excluded)"
      />

      <section className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Games" value={String(data.totals.games)} />
        <StatCard label="Winrate" value={`${Math.round(data.totals.winrate ?? 0)}%`} />
        <StatCard label="Longest Win Streak" value={String(data.streaks.longestWin)} />
        <StatCard label="Current Streak" value={String(data.streaks.current)} />
      </section>

      <TimeHeatmap data={cells} />

    </div>
  );
}