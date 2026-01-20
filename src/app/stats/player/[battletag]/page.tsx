import { redirect } from "next/navigation";

export default function PlayerIndex({
  params,
}: {
  params: { battletag: string };
}) {
  redirect(`/stats/player/${params.battletag}/summary`);
}
