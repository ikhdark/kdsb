import LadderPageUI from "@/components/LadderPage";
import { getPlayerLadder } from "@/services/playerLadder";

const PAGE_SIZE = 50;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;

  const currentPage = Math.max(1, Number(page) || 1);

  const data = await getPlayerLadder(
    undefined,
    currentPage,
    PAGE_SIZE
  );

  if (!data) return null;

  const totalPages = Math.max(
    1,
    Math.ceil(data.poolSize / PAGE_SIZE)
  );

  return (
    <LadderPageUI
      title="Global Ladder"
      subtitle={`Season 24 · ${data.poolSize.toLocaleString()} players • Rank = 80% MMR + 15% SoS (game-scaled) + 5% activity`}
      base="/stats/ladder"
      rows={data.full}
      poolSize={data.poolSize}
      currentPage={currentPage}
      totalPages={totalPages}
    />
  );
}