export const revalidate = 300;

import EmptyState from "@/components/EmptyState";
import { getW3CCountryStats } from "@/services/vsCountry";
import { PlayerHeader, Section, StatCard } from "@/components/PlayerUI";

type Props = {
  params: Promise<{ battletag: string }>;
  searchParams?: { bt?: string };
};

export default async function CountriesPage({ params, searchParams }: Props) {
  const { battletag: routeBt } = await params;

  const battletag = routeBt ?? searchParams?.bt;
  if (!battletag) return <EmptyState message="Invalid player" />;

  const tag = decodeURIComponent(battletag);

  const data = await getW3CCountryStats(tag);
  if (!data?.countries?.length) {
    return <EmptyState message="Not enough data/recent games available" />;
  }

  const { battletag: canonicalBt, countries, homeCountry, homeCountryLabel } = data;

  const sum = <T, K extends keyof T>(arr: T[], key: K) =>
    arr.reduce((a, b) => a + (Number(b[key]) || 0), 0);

  const countriesByGames = [...countries].sort((a, b) => b.games - a.games);
  const countriesByOppMmr = [...countries].sort(
    (a, b) => (b.avgOpponentMMR ?? 0) - (a.avgOpponentMMR ?? 0)
  );
  const countriesByTime = [...countries].sort(
    (a, b) => b.timePlayedSeconds - a.timePlayedSeconds
  );

  const home = countries.filter((c) => c.country === homeCountry);
  const foreign = countries.filter((c) => c.country !== homeCountry);

  const homeWins = sum(home, "wins");
  const homeLosses = sum(home, "losses");
  const foreignWins = sum(foreign, "wins");
  const foreignLosses = sum(foreign, "losses");

  const calcWR = (w: number, l: number) => {
    const g = w + l;
    return g ? (w / g) * 100 : null;
  };

  const homeWR = calcWR(homeWins, homeLosses);
  const foreignWR = calcWR(foreignWins, foreignLosses);

  const wrColor = (wr: number) => {
    if (wr >= 50) return "text-emerald-500 font-medium";
    if (wr >= 40) return "text-yellow-500 font-medium";
    return "text-rose-500 font-medium";
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-xs md:text-sm leading-relaxed px-3 md:px-0">

      <PlayerHeader
        battletag={canonicalBt}
        subtitle="Country Stats (All races) · Season 24 (Games under 120 seconds excluded)"
      />

      <Section title="Home vs Foreign">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <StatCard
            label={homeCountryLabel}
            value={`${homeWins}-${homeLosses}`}
            sub={
              homeWR !== null ? (
                <span className={wrColor(homeWR)}>
                  {homeWR.toFixed(1)}% WR
                </span>
              ) : "—"
            }
          />

          <StatCard
            label="Foreign"
            value={`${foreignWins}-${foreignLosses}`}
            sub={
              foreignWR !== null ? (
                <span className={wrColor(foreignWR)}>
                  {foreignWR.toFixed(1)}% WR
                </span>
              ) : "—"
            }
          />

        </div>
      </Section>

      <Section title="Record vs Countries">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 uppercase text-xs">
                <th className="px-2 md:px-4 py-2">Country</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">Games</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">Opponents</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">W</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">L</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">WR %</th>
              </tr>
            </thead>

            <tbody>
              {countriesByGames.map((c) => {
                const wr = c.winRate * 100;

                return (
                  <tr key={c.country} className="border-b">
                    <td className="px-2 md:px-4 py-2">{c.label}</td>
                    <td className="px-2 md:px-4 py-2 tabular-nums">{c.games}</td>
                    <td className="px-2 md:px-4 py-2 tabular-nums">{c.uniqueOpponents}</td>
                    <td className="px-2 md:px-4 py-2 tabular-nums text-emerald-600">{c.wins}</td>
                    <td className="px-2 md:px-4 py-2 tabular-nums text-rose-600">{c.losses}</td>
                    <td className={`px-2 md:px-4 py-2 tabular-nums ${wrColor(wr)}`}>
                      {wr.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Country × Race">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 uppercase text-xs">
                <th className="px-2 md:px-4 py-2">Country</th>
                <th className="px-2 md:px-4 py-2">Race</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">Games</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">W</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">L</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">WR %</th>
              </tr>
            </thead>

            <tbody>
              {countriesByGames.map((c) =>
                [...c.races]
                  .sort((a, b) => b.games - a.games)
                  .map((r, idx) => {
                    const wr = r.winRate * 100;

                    return (
                      <tr key={`${c.country}-${r.raceId}`} className="border-b">
                        <td className="px-2 md:px-4 py-2">{idx === 0 ? c.label : ""}</td>
                        <td className="px-2 md:px-4 py-2">{r.race}</td>
                        <td className="px-2 md:px-4 py-2 tabular-nums">{r.games}</td>
                        <td className="px-2 md:px-4 py-2 tabular-nums text-emerald-600">{r.wins}</td>
                        <td className="px-2 md:px-4 py-2 tabular-nums text-rose-600">{r.losses}</td>
                        <td className={`px-2 md:px-4 py-2 tabular-nums ${wrColor(wr)}`}>
                          {wr.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Avg Game Length">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 uppercase text-xs">
                <th className="px-2 md:px-4 py-2">Country</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">Avg (min)</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">Total (h)</th>
              </tr>
            </thead>

            <tbody>
              {countriesByTime.map((c) => {
                const avgMin = c.avgGameSeconds ? c.avgGameSeconds / 60 : null;
                const hours = c.timePlayedSeconds / 3600;

                return (
                  <tr key={c.country} className="border-b">
                    <td className="px-2 md:px-4 py-2">{c.label}</td>
                    <td className="px-2 md:px-4 py-2 tabular-nums">
                      {avgMin ? avgMin.toFixed(1) : "—"}
                    </td>
                    <td className="px-2 md:px-4 py-2 tabular-nums">
                      {hours.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Avg MMR Faced">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 uppercase text-xs">
                <th className="px-2 md:px-4 py-2">Country</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">Opp MMR</th>
                <th className="px-2 md:px-4 py-2 tabular-nums">Your MMR</th>
              </tr>
            </thead>

            <tbody>
              {countriesByOppMmr.map((c) => (
                <tr key={c.country} className="border-b">
                  <td className="px-2 md:px-4 py-2">{c.label}</td>
                  <td className="px-2 md:px-4 py-2 tabular-nums">
                    {c.avgOpponentMMR?.toFixed(0) ?? "—"}
                  </td>
                  <td className="px-2 md:px-4 py-2 tabular-nums">
                    {c.avgSelfMMR?.toFixed(0) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

    </div>
  );
}