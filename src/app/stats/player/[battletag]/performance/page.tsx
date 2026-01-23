import { notFound } from "next/navigation";
import { getPlayerPerformance } from "@/services/playerPerformance";
import { PlayerHeader, Section, StatCard } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function VsPlayerPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) notFound();

  const data = await getPlayerPerformance(battletag);
  if (!data) notFound();

  const {
    battletag: canonicalBt,
    overall,
    higherMMR,
    lowerMMR,
    evenMMR,
    buckets,
  } = data;

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  /* ================= COLOR ================= */

  
const colorUnderdogNormal = (w: number) =>
  w >= 0.50
    ? "text-green-600 font-semibold"
    : w < 0.30
    ? "text-red-600 font-semibold"
    : "text-yellow-500 font-semibold";

const colorUnderdogExtreme = (w: number) =>
  w >= 0.20
    ? "text-green-600 font-semibold"
    : w < 0.10
    ? "text-red-600 font-semibold"
    : "text-yellow-500 font-semibold";

const colorFavoredNormal = (w: number) =>
  w >= 0.50
    ? "text-green-600 font-semibold"
    : w < 0.40
    ? "text-red-600 font-semibold"
    : "text-yellow-500 font-semibold";

const colorFavoredExtreme = (w: number) =>
  w >= 0.90
    ? "text-green-600 font-semibold"
    : w < 0.80
    ? "text-red-600 font-semibold"
    : "text-yellow-500 font-semibold";

  /* ================= SPLIT BUCKETS ================= */

  const favoredAll = buckets
    .filter((b) => b.min >= 0)
    .sort((a, b) => a.min - b.min);

  const underdogAll = buckets
    .filter((b) => b.min < 0)
    .sort((a, b) => b.min - a.min);

  // hard split at 150
  const favoredNormal = favoredAll.filter((b) => Math.abs(b.min) <= 149);
  const favoredLarge = favoredAll.filter((b) => Math.abs(b.min) > 149);

  const underdogNormal = underdogAll.filter((b) => Math.abs(b.min) <= 150);
  const underdogLarge = underdogAll.filter((b) => Math.abs(b.min) > 150);
  /* ================= LABEL ================= */

  const label = (b: typeof buckets[number]) => {
    const edge = Math.max(Math.abs(b.min), Math.abs(b.max ?? b.min));
    return `${edge}+`;
  };

  /* ================= TABLE ================= */

  const Table = ({
    rows,
    colorFn,
  }: {
    rows: typeof buckets;
    colorFn: (w: number) => string;
  }) => (
    <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr className="text-left">
            <th className="px-4 py-2">Gap</th>
            <th className="px-4 py-2">Games</th>
            <th className="px-4 py-2">W</th>
            <th className="px-4 py-2">L</th>
            <th className="px-4 py-2">Winrate</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((b) => (
            <tr key={b.min} className="border-t dark:border-gray-700">
              <td className="px-4 py-2 font-mono">{label(b)}</td>
              <td className="px-4 py-2">{b.games}</td>
              <td className="px-4 py-2">{b.wins}</td>
              <td className="px-4 py-2">{b.losses}</td>
              <td className={`px-4 py-2 ${colorFn(b.winrate)}`}>
                {pct(b.winrate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  /* ================= RENDER ================= */

  return (
    <div className="space-y-8">
      <PlayerHeader
        battletag={canonicalBt}
        subtitle="Performance Stats · Season 23"
      />

      {/* ================= OVERVIEW ================= */}

      <Section title="Overview">
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

    <StatCard
      label="Overall (Season 23)"
      value={pct(overall.winrate)}
      sub={`${overall.wins}-${overall.losses} · ${overall.games}`}
    />

    <StatCard
      label="Favored (Higher MMR)"
      value={pct(higherMMR.winrate)}
      sub={`${higherMMR.wins}-${higherMMR.losses} · ${higherMMR.games}`}
    />

    <StatCard
      label="Underdog (Lower MMR)"
      value={pct(lowerMMR.winrate)}
      sub={`${lowerMMR.wins}-${lowerMMR.losses} · ${lowerMMR.games}`}
    />

    <StatCard
      label="Even (±25)"
      value={pct(evenMMR.winrate)}
      sub={`${evenMMR.wins}-${evenMMR.losses} · ${evenMMR.games}`}
    />

  </div>
</Section>

      {/* ================= UNDERDOG ================= */}

      <Section title="Vs Higher MMR (Underdog)">
  <Table rows={underdogNormal} colorFn={colorUnderdogNormal} />
</Section>

<Section title="Extreme Gap (Underdog)">
  <Table rows={underdogLarge} colorFn={colorUnderdogExtreme} />
</Section>

<Section title="Vs Lower MMR (Favored)">
  <Table rows={favoredNormal} colorFn={colorFavoredNormal} />
</Section>

<Section title="Extreme Gap (Favored)">
  <Table rows={favoredLarge} colorFn={colorFavoredExtreme} />
</Section>
    </div>
  );
}
