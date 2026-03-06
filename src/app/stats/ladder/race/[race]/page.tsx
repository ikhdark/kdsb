import EmptyState from "@/components/EmptyState";
import LadderPageUI from "@/components/LadderPage";
import { getPlayerRaceLadder } from "@/services/playerRaceLadder";

type Race = "human" | "orc" | "elf" | "undead" | "random";

type PageProps = {
  params: Promise<{ race: string }>;
  searchParams: Promise<{
    page?: string;
    highlight?: string;
  }>;
};

const PAGE_SIZE = 50;

const RACE_LABEL: Record<Race, string> = {
  human: "Human",
  orc: "Orc",
  elf: "Night Elf",
  undead: "Undead",
  random: "Random",
};

export default async function RaceGlobalPage({
  params,
  searchParams,
}: PageProps) {
  const { race: raceParam } = await params;
  const { page, highlight } = await searchParams;

  const race = raceParam?.toLowerCase() as Race;

  if (!RACE_LABEL[race]) {
    return <EmptyState message="Invalid race" />;
  }

  const pageNum = Math.max(1, Number(page) || 1);

  const data = await getPlayerRaceLadder(
    undefined,
    race,
    pageNum,
    PAGE_SIZE
  );

  if (!data?.full?.length) {
    return <EmptyState message="No ladder data available yet" />;
  }

  const totalPages = Math.max(1, Math.ceil(data.poolSize / PAGE_SIZE));

  return (
    <LadderPageUI
      title={`Global ${RACE_LABEL[race]} Ladder`}
      subtitle={`Season 24 · ${data.poolSize.toLocaleString()} players · Rank = 80% MMR + 15% SoS (game-scaled) + 5% activity`}
      base={`/stats/ladder/race/${race}`}
      rows={data.full.map(r => ({
  ...r,
  sos: r.sos ?? 0,
}))}
      poolSize={data.poolSize}
      currentPage={Math.min(pageNum, totalPages)}
      totalPages={totalPages}
      highlight={highlight}
    />
  );
}