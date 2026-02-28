export const revalidate = 300;

import EmptyState from "@/components/EmptyState";
import { getW3CHeroStats } from "@/services/playerHeroes";
import { PlayerHeader, Section, StatRow } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function HeroesPage({ params }: PageProps) {
  const { battletag } = await params;

  if (!battletag)
    return <EmptyState message="Player not found" />;

  const data = await getW3CHeroStats(battletag);

  if (!data)
    return (
      <EmptyState message="Not enough data/recent games available" />
    );

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-xs md:text-sm px-3 md:px-0">

      <PlayerHeader
        battletag={data.battletag}
        subtitle="Hero Stats (All races) · Season 24 (Games under 120 seconds excluded)"
      />

      {/* ================= HERO COUNT ================= */}
      <Section title="W/L by Hero Count">
        {data.byHeroCount.map((row) => (
          <StatRow
            key={row.label}
            label={row.label}
            value={`${row.wins}-${row.losses} (${row.winrate}%)`}
            winrate={row.winrate}
          />
        ))}
      </Section>

      {/* ================= VS OPP HERO COUNT ================= */}
      <Section title="W/L vs Opponent Hero Count">
        {data.vsOppHeroCount.map((row) => (
          <StatRow
            key={row.label}
            label={row.label}
            value={`${row.wins}-${row.losses} (${row.winrate}%)`}
            winrate={row.winrate}
          />
        ))}
      </Section>

      {/* ================= BEST OPENERS ================= */}
      <Section title="Best Matchups vs Opponent Opening Hero (Min 5 games)">
        {data.bestOpeners.map((row) => (
          <StatRow
            key={row.label}
            label={row.label}
            value={`${row.wins}-${row.losses} (${row.winrate}%)`}
            winrate={row.winrate}
          />
        ))}
      </Section>

      {/* ================= WORST OPENERS ================= */}
      <Section title="Worst Matchups vs Opponent Opening Hero (Min 5 games)">
        {data.worstOpeners.map((row) => (
          <StatRow
            key={row.label}
            label={row.label}
            value={`${row.wins}-${row.losses} (${row.winrate}%)`}
            winrate={row.winrate}
          />
        ))}
      </Section>

      {/* ================= BEST OVERALL ================= */}
      <Section title="Best Winrates vs Opponent Heroes Any Stage Of The Game (Min 5 games)">
        {data.bestOverall.map((row) => (
          <StatRow
            key={row.label}
            label={row.label}
            value={`${row.wins}-${row.losses} (${row.winrate}%)`}
            winrate={row.winrate}
          />
        ))}
      </Section>

      {/* ================= WORST OVERALL ================= */}
      <Section title="Best Winrates vs Opponent Heroes Any Stage Of The Game (Min 5 games)">
        {data.worstOverall.map((row) => (
          <StatRow
            key={row.label}
            label={row.label}
            value={`${row.wins}-${row.losses} (${row.winrate}%)`}
            winrate={row.winrate}
          />
        ))}
      </Section>

    </div>
  );
}