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
    <div>
      <LadderPageUI
        title="Global Ladder"
        subtitle={`Season 24 · ${data.poolSize.toLocaleString()} players · Score = 0.80·MMR + 0.15·SoS + 0.05·Activity − Decay`}
        base="/stats/ladder"
        rows={data.full.map((r) => ({
          ...r,
          sos: r.sos ?? 0,
        }))}
        poolSize={data.poolSize}
        currentPage={currentPage}
        totalPages={totalPages}
      />

      <div className="mt-3 text-xs text-gray-500 space-y-1">
        <div>MMR — player rating</div>
        <div>SoS — strength of schedule</div>
        <div>Activity — games played normalization</div>
        <div>Decay — penalty for very low game counts</div>
      </div>
    </div>
  );
}