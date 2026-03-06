export const revalidate = 300;

import EmptyState from "@/components/EmptyState";
import { getW3CHeroStats } from "@/services/playerHeroes";
import { PlayerHeader, Section, StatRow } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

function Rows({ rows }: { rows: { label: string; wins: number; losses: number; winrate: number }[] }) {
  return (
    <>
      {rows.map((row) => (
        <StatRow
          key={row.label}
          label={row.label}
          value={`${row.wins}-${row.losses} (${row.winrate}%)`}
          winrate={row.winrate}
        />
      ))}
    </>
  );
}

export default async function HeroesPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) return <EmptyState message="Player not found" />;

  const tag = decodeURIComponent(battletag);

  const data = await getW3CHeroStats(tag);
  if (!data) {
    return <EmptyState message="Not enough data/recent games available" />;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-xs md:text-sm px-3 md:px-0">

      <PlayerHeader
        battletag={data.battletag}
        subtitle="Hero Stats (All races) · Season 24 (Games under 120 seconds excluded)"
      />

      <Section title="W/L by Hero Count">
        <Rows rows={data.byHeroCount} />
      </Section>

      <Section title="W/L vs Opponent Hero Count">
        <Rows rows={data.vsOppHeroCount} />
      </Section>

      <Section title="Best Matchups vs Opponent Opening Hero (Min 5 games)">
        <Rows rows={data.bestOpeners} />
      </Section>

      <Section title="Worst Matchups vs Opponent Opening Hero (Min 5 games)">
        <Rows rows={data.worstOpeners} />
      </Section>

      <Section title="Best Winrates vs Opponent Heroes Any Stage Of The Game (Min 5 games)">
        <Rows rows={data.bestOverall} />
      </Section>

      <Section title="Worst Winrates vs Opponent Heroes Any Stage Of The Game (Min 5 games)">
        <Rows rows={data.worstOverall} />
      </Section>

    </div>
  );
}