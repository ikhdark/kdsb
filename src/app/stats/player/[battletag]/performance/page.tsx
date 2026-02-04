export const revalidate = 300;
import EmptyState from "@/components/EmptyState";
import { getPlayerPerformance } from "@/services/playerPerformance";
import { PlayerHeader, Section, StatCard } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function VsPlayerPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) return <EmptyState message="Player not found" />;

  const data = await getPlayerPerformance(battletag);
  if (!data) return <EmptyState message="Not enough data available" />;

  const {
    battletag: canonicalBt,
    overall,
    higherMMR,
    lowerMMR,
    evenMMR,
    buckets,
  } = data;

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  /* ================= COLORS ================= */

  const colorUnderdogNormal = (w: number) =>
    w >= 0.5
      ? "text-green-600 font-semibold"
      : w < 0.3
      ? "text-red-600 font-semibold"
      : "text-yellow-500 font-semibold";

  const colorUnderdogExtreme = (w: number) =>
    w >= 0.2
      ? "text-green-600 font-semibold"
      : w < 0.1
      ? "text-red-600 font-semibold"
      : "text-yellow-500 font-semibold";

  const colorFavoredNormal = (w: number) =>
    w >= 0.5
      ? "text-green-600 font-semibold"
      : w < 0.4
      ? "text-red-600 font-semibold"
      : "text-yellow-500 font-semibold";

  const colorFavoredExtreme = (w: number) =>
    w >= 0.9
      ? "text-green-600 font-semibold"
      : w < 0.8
      ? "text-red-600 font-semibold"
      : "text-yellow-500 font-semibold";

  /* ================= SPLIT RAW BUCKETS ================= */

  const favoredBuckets = buckets
    .filter((b) => b.min >= 0)
    .sort((a, b) => a.min - b.min);

  const underdogBuckets = buckets
    .filter((b) => b.min < 0)
    .sort((a, b) => b.min - a.min);

  const SPLIT = 150;

  
  /* ================= EXTREME (CUMULATIVE THRESHOLDS) ================= */
  /* THIS IS THE IMPORTANT PART */

  const buildThresholds = (
    source: typeof buckets,
    thresholds: number[]
  ) => {
    return thresholds.map((edge) => {
      const slice = source.filter((b) => Math.abs(b.min) >= edge);

      const games = slice.reduce((a, x) => a + x.games, 0);
      const wins = slice.reduce((a, x) => a + x.wins, 0);
      const losses = slice.reduce((a, x) => a + x.losses, 0);

      return {
        min: edge,
        max: null,
        games,
        wins,
        losses,
        winrate: games ? wins / games : 0,
      };
    });
  };

 const favoredNormal = buildThresholds(favoredBuckets, [50, 100, 150]);
const favoredLarge  = buildThresholds(favoredBuckets, [200, 250, 300]);

  /* ================= LABEL ================= */

  const label = (b: typeof buckets[number]) => `${Math.abs(b.min)}+`;

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

  const underdogNormal = underdogBuckets.filter((b) => Math.abs(b.min) < 150);
const underdogLarge  = underdogBuckets.filter((b) => Math.abs(b.min) >= 150);
  /* ================= RENDER ================= */

  return (
    <div className="space-y-8">
      <PlayerHeader
        battletag={canonicalBt}
        subtitle="Performance Stats (All Races) · Season 24"
      />

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
