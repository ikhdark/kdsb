import LadderPageUI from "@/components/LadderPage";
import { getPlayerLadder } from "@/services/playerLadder";

const PAGE_SIZE = 50;

export default async function Page({ searchParams }: any) {
  const page = Number(searchParams?.page) || 1;

  const data = await getPlayerLadder(undefined, page, PAGE_SIZE);

  if (!data) return null;

  const totalPages = Math.max(
    1,
    Math.ceil(data.poolSize / PAGE_SIZE)
  );

  return (
    <LadderPageUI
      title="Global Ladder"
      subtitle={`Season 24 · ${data.poolSize.toLocaleString()} players`}
      base="/stats/ladder"
      rows={data.full}
      poolSize={data.poolSize}
      currentPage={page}
      totalPages={totalPages}
    />
  );
}