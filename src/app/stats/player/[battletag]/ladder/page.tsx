import LadderPageUI from "@/components/LadderPage";
import { getPlayerLadder } from "@/services/playerLadder";

const PAGE_SIZE = 50;

type PageProps = {
  params: Promise<{ battletag: string }>;
  searchParams: Promise<{ page?: string }>;
};

export default async function Page({
  params,
  searchParams,
}: PageProps) {
  const { battletag } = await params;
  const { page } = await searchParams;

  const rawPage = Number(page) || 1;

  const data = await getPlayerLadder(
    battletag,
    rawPage,
    PAGE_SIZE
  );

  if (!data) return null;

  const totalPages = Math.max(
    1,
    Math.ceil(data.poolSize / PAGE_SIZE)
  );

  return (
    <LadderPageUI
      title={data.battletag}
      subtitle={`SoS Ladder · ${data.poolSize.toLocaleString()} players`}
      base={`/stats/player/${encodeURIComponent(
        data.battletag
      )}/ladder`}
      rows={data.full}
      poolSize={data.poolSize}
      currentPage={rawPage}
      totalPages={totalPages}
    />
  );
}