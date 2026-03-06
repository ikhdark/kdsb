import EmptyState from "@/components/EmptyState";
import LadderPageUI from "@/components/LadderPage";

import { getPlayerRaceLadder } from "@/services/playerRaceLadder";

type Race = "human" | "orc" | "elf" | "undead" | "random";

type PageProps = {
  params: Promise<{
    battletag: string;
    race: string;
  }>;
  searchParams: Promise<{
    page?: string;
    highlight?: string;
  }>;
};

const PAGE_SIZE = 50;

const VALID_RACES: Race[] = ["human", "orc", "elf", "undead", "random"];

function raceLabel(race: Race) {
  if (race === "human") return "Human";
  if (race === "orc") return "Orc";
  if (race === "elf") return "Night Elf";
  if (race === "undead") return "Undead";
  return "Random";
}

export default async function RaceLadderPage({
  params,
  searchParams,
}: PageProps) {
  const { battletag, race: raceParam } = await params;
  const { page, highlight } = await searchParams;

  if (!battletag || !raceParam) {
    return <EmptyState message="Invalid player" />;
  }

  const tag = decodeURIComponent(battletag);
  const race = raceParam.toLowerCase() as Race;

  if (!VALID_RACES.includes(race)) {
    return <EmptyState message="Invalid race" />;
  }

  const rawPage = Math.max(1, Number(page) || 1);

  const data = await getPlayerRaceLadder(
    tag,
    race,
    rawPage,
    PAGE_SIZE
  );

  if (!data?.full?.length) {
    return <EmptyState message="No ladder data available yet" />;
  }

  const { battletag: canonicalBt, full: rows, poolSize } = data;

  const totalPages = Math.max(1, Math.ceil(poolSize / PAGE_SIZE));
  const currentPage = Math.min(rawPage, totalPages);

  const base = `/stats/player/${encodeURIComponent(
    canonicalBt
  )}/ladder/race/${race}`;

  return (
    <LadderPageUI
      title={canonicalBt}
      subtitle={`${raceLabel(race)} Ladder · Season 24 · ${poolSize.toLocaleString()} players`}
      base={base}
      rows={data.full.map(r => ({
  ...r,
  sos: r.sos ?? 0,
}))}
      poolSize={poolSize}
      currentPage={currentPage}
      totalPages={totalPages}
      highlight={highlight}
    />
  );
}