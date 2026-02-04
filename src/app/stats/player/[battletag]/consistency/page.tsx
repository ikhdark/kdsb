// src/app/stats/player/[battletag]/consistency/page.tsx

import { getPlayerConsistency } from "@/services/playerConsistency";
import { PlayerHeader, StatCard } from "@/components/PlayerUI";
import TimeHeatmap from "@/components/TimeHeatmap";
import EmptyState from "@/components/EmptyState";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function ConsistencyPage({ params }: PageProps) {
  const { battletag } = await params;

  /* ================= SAFE GUARDS ================= */

  if (!battletag) {
    return <EmptyState message="Player not found" />;
  }

  const data = await getPlayerConsistency(battletag);

  if (!data || !data.matches?.length) {
    return <EmptyState message="Not enough data/recent games available" />;
  }

  /* ================= BUILD CELLS FROM matches ================= */

  const map = new Map<string, { games: number; wins: number }>();

  for (const m of data.matches) {
    const d = new Date(m.startTime);

    // UTC buckets (consistent for NA/EU/ASIA)
    const day = d.getUTCDay();
    const hour = d.getUTCHours();

    const bucket =
      hour < 8 ? 0 :
      hour < 16 ? 1 :
      2;

    const key = `${day}-${bucket}`;

    const prev = map.get(key);

    map.set(key, {
      games: (prev?.games ?? 0) + 1,
      wins:  (prev?.wins  ?? 0) + (m.didWin ? 1 : 0),
    });
  }

  const cells = [];

  for (let day = 0; day < 7; day++) {
    for (let bucket = 0; bucket < 3; bucket++) {
      const key = `${day}-${bucket}`;
      const v = map.get(key);

      const games = v?.games ?? 0;
      const wins  = v?.wins ?? 0;

      cells.push({
        day,
        bucket,
        games,
        wins,
        winrate: games ? Math.round((wins / games) * 100) : null,
        netMMR: 0,
      });
    }
  }

  /* ================= RENDER ================= */

  return (
    <div className="space-y-10 max-w-6xl mx-auto text-sm leading-relaxed">

      <PlayerHeader
        battletag={data.battletag}
        subtitle="Consistency · Day/Time Performance (UTC) · Season 24 (All Races) (Games under 120 seconds excluded)"
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
