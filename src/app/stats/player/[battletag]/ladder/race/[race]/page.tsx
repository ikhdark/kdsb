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

/* helpers */

function raceLabel(race: string) {
  const r = race.toLowerCase();
  if (r === "human") return "Human";
  if (r === "orc") return "Orc";
  if (r === "elf") return "Night Elf";
  if (r === "undead") return "Undead";
  if (r === "random") return "Random";
  return race;
}

/* page */

export default async function RaceLadderPage({
  params,
  searchParams,
}: PageProps) {
  // ✔ required by your project setup
  const { battletag, race: raceParam } = await params;
  const { page, highlight } = await searchParams;

  if (!battletag || !raceParam) {
    return <EmptyState message="Invalid player" />;
  }

  const race = raceParam.toLowerCase() as Race;

  if (!["human", "orc", "elf", "undead", "random"].includes(race)) {
    return <EmptyState message="Invalid race" />;
  }

  const rawPage = Math.max(1, Number(page) || 1);

  const data = await getPlayerRaceLadder(
    battletag,
    race,
    rawPage,
    PAGE_SIZE
  );

  if (!data || !data.full?.length) {
    return <EmptyState message="No ladder data available yet" />;
  }

  const {
    battletag: canonicalBt,
    full: rows,
    poolSize,
  } = data;

  const totalPages = Math.max(1, Math.ceil(poolSize / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, rawPage), totalPages);

  const base = `/stats/player/${encodeURIComponent(
    canonicalBt
  )}/ladder/race/${race}`;

  return (
    <LadderPageUI
      title={canonicalBt}
      subtitle={`${raceLabel(race)} Ladder · Season 24 · ${poolSize.toLocaleString()} players`}
      base={base}
      rows={rows}
      poolSize={poolSize}
      currentPage={currentPage}
      totalPages={totalPages}
      highlight={highlight}
      me={data.me}
    />
  );
}