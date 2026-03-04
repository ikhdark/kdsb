import MatchHistoryShell from "@/components/MatchHistoryShell";

export const revalidate = 300;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ battletag: string }>;
  searchParams: Promise<{ vs?: string }>;
}) {
  const { battletag } = await params;
  const { vs } = await searchParams;

  const player = decodeURIComponent(battletag);

  return (
    <MatchHistoryShell
      player={player}
      vsFilter={vs ?? ""}
    />
  );
}