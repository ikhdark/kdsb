import { redirect, notFound } from "next/navigation";
import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function PlayerIndex({ params }: PageProps) {
  const { battletag } = await params;

  const input = decodeURIComponent(battletag).trim();
  if (!input) notFound();

  const canonical = await resolveBattleTagViaSearch(input);
  if (!canonical) notFound();

  redirect(`/stats/player/${encodeURIComponent(canonical)}/summary`);
}