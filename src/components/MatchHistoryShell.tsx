"use client";

import { useEffect, useState } from "react";
import MatchHistoryTable from "@/components/MatchHistoryTable";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function MatchHistoryShell({
  player,
  vsFilter,
}: {
  player: string;
  vsFilter: string;
}) {
  const [matches, setMatches] = useState<any[]>([]);
  const [rankData, setRankData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      try {
        const [mRes, rRes] = await Promise.all([
          fetch(`/api/matches?player=${encodeURIComponent(player)}`),
          fetch(`/api/rank?player=${encodeURIComponent(player)}`),
        ]);

        const matchesJson = await mRes.json();
        const rankJson = await rRes.json();

        setMatches(Array.isArray(matchesJson) ? matchesJson : []);
        setRankData(rankJson ?? null);
      } catch {
        setMatches([]);
        setRankData(null);
      }

      setLoading(false);
    }

    load();
  }, [player]);

return (
  <>
    {loading && <LoadingSpinner />}

    {!loading && (
      <MatchHistoryTable
        player={player}
        matches={matches}
        rankData={rankData}
        vsFilter={vsFilter}
      />
    )}
  </>
);
}