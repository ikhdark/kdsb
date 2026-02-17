import EmptyState from "@/components/EmptyState";
import LadderPageUI from "@/components/LadderPage";

import { getPlayerRaceLadder } from "@/services/playerRaceLadder";

type Race = "human" | "orc" | "elf" | "undead" | "random";

type PageProps = {
  params: Promise<{ race: string }>;
  searchParams: Promise<{ page?: string; highlight?: string }>;
};

const PAGE_SIZE = 50;

function raceLabel(race: string) {
  const r = race.toLowerCase();
  if (r === "human") return "Human";
  if (r === "orc") return "Orc";
  if (r === "elf") return "Night Elf";
  if (r === "undead") return "Undead";
  if (r === "random") return "Random";
  return race;
}

export default async function RaceGlobalPage({
  params,
  searchParams,
}: PageProps) {
  const { race: raceParam } = await params;
  const { page, highlight } = await searchParams;

  const race = raceParam.toLowerCase() as Race;

  if (!["human", "orc", "elf", "undead", "random"].includes(race)) {
    return <EmptyState message="Invalid race" />;
  }

  const rawPage = Math.max(1, Number(page) || 1);

  const data = await getPlayerRaceLadder(
    undefined,
    race,
    rawPage,
    PAGE_SIZE
  );

  if (!data || !data.full?.length) {
    return <EmptyState message="No ladder data available yet" />;
  }

  const { full: rows, poolSize } = data;

  const totalPages = Math.max(1, Math.ceil(poolSize / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, rawPage), totalPages);

  const base = `/stats/ladder/race/${race}`;

  return (
    <LadderPageUI
      title={`Global ${raceLabel(race)} Ladder`}
      subtitle={`Season 24 · ${poolSize.toLocaleString()} players`}
      base={base}
      rows={rows}
      poolSize={poolSize}
      currentPage={currentPage}
      totalPages={totalPages}
      highlight={highlight}
    />
  );
}