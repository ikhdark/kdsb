import { redirect, notFound } from "next/navigation";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

type PageProps = {
  params: { battletag: string };
};

export default async function PlayerIndex({ params }: PageProps) {
  const raw = decodeURIComponent(params.battletag).trim();
  if (!raw) notFound();

  const canonicalBattleTag = await resolveBattleTagViaSearch(raw);
  if (!canonicalBattleTag) notFound();

  redirect(`/stats/player/${encodeURIComponent(canonicalBattleTag)}/summary`);
}
