// src/app/stats/player/[battletag]/vs-country/page.tsx
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
  const battletag = routeBt || searchParams?.bt;
  if (!battletag) {
  return <EmptyState message="Invalid player" />;
}

  const data = await getW3CCountryStats(battletag);
 if (!data || !data.countries?.length) {
  return <EmptyState message="No country data available" />;
}

  const {
    battletag: canonicalBt,
    countries,
    homeCountry,
    homeCountryLabel,
  } = data;

  /* ================= helpers ================= */

  const sum = (arr: any[], key: string) =>
    arr.reduce((a, b) => a + (b[key] || 0), 0);

  const countriesByGames = countries.slice().sort((a, b) => b.games - a.games);

  const countriesByOppMmr = countries
    .slice()
    .sort((a, b) => (b.avgOpponentMMR ?? 0) - (a.avgOpponentMMR ?? 0));

  // NEW — sort by total time played
  const countriesByTime = countries
    .slice()
    .sort((a, b) => b.timePlayedSeconds - a.timePlayedSeconds);

  const home = countries.filter((c) => c.country === homeCountry);
  const foreign = countries.filter((c) => c.country !== homeCountry);

  const homeWins = sum(home, "wins");
  const homeLosses = sum(home, "losses");
  const foreignWins = sum(foreign, "wins");
  const foreignLosses = sum(foreign, "losses");

  const wrColor = (wr: number) => {
    if (wr >= 50) return "text-emerald-500 font-medium";
    if (wr >= 40) return "text-yellow-500 font-medium";
    return "text-rose-500 font-medium";
  };

  /* ================= render ================= */

  return (
    <div className="space-y-10 max-w-6xl mx-auto text-sm leading-relaxed">

      {/* HEADER */}
      <PlayerHeader
        battletag={canonicalBt}
        subtitle="Country Stats (All races) · Season 24 (Games under 120 seconds excluded)"
      />

      {/* ================= HOME VS FOREIGN ================= */}
      <Section title="Home vs Foreign">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label={homeCountryLabel}
            value={`${homeWins}-${homeLosses}`}
            sub={
              homeWins + homeLosses ? (
                <span
                  className={wrColor(
                    (homeWins / (homeWins + homeLosses)) * 100
                  )}
                >
                  {((homeWins / (homeWins + homeLosses)) * 100).toFixed(1)}% WR
                </span>
              ) : (
                "—"
              )
            }
          />

          <StatCard
            label="Foreign"
            value={`${foreignWins}-${foreignLosses}`}
            sub={
              foreignWins + foreignLosses ? (
                <span
                  className={wrColor(
                    (foreignWins / (foreignWins + foreignLosses)) * 100
                  )}
                >
                  {((foreignWins / (foreignWins + foreignLosses)) * 100).toFixed(1)}% WR
                </span>
              ) : (
                "—"
              )
            }
          />
        </div>
      </Section>

      {/* ================= RECORD VS COUNTRIES ================= */}
      <Section title="Record vs Countries">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 uppercase text-xs">
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2 tabular-nums">Games</th>
                <th className="px-4 py-2 tabular-nums">Opponents</th>
                <th className="px-4 py-2 tabular-nums">W</th>
                <th className="px-4 py-2 tabular-nums">L</th>
                <th className="px-4 py-2 tabular-nums">WR %</th>
              </tr>
            </thead>

            <tbody>
              {countriesByGames.map((c) => {
                const wrPercent = c.winRate * 100;

                return (
                  <tr key={c.country} className="border-b">
                    <td className="px-4 py-2">{c.label}</td>
                    <td className="px-4 py-2 tabular-nums">{c.games}</td>
                    <td className="px-4 py-2 tabular-nums">{c.uniqueOpponents}</td>
                    <td className="px-4 py-2 tabular-nums text-emerald-600">{c.wins}</td>
                    <td className="px-4 py-2 tabular-nums text-rose-600">{c.losses}</td>
                    <td className={`px-4 py-2 tabular-nums ${wrColor(wrPercent)}`}>
                      {wrPercent.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ================= COUNTRY × RACE ================= */}
      <Section title="Country × Race">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 uppercase text-xs">
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2">Race</th>
                <th className="px-4 py-2 tabular-nums">Games</th>
                <th className="px-4 py-2 tabular-nums">W</th>
                <th className="px-4 py-2 tabular-nums">L</th>
                <th className="px-4 py-2 tabular-nums">WR %</th>
              </tr>
            </thead>

            <tbody>
              {countriesByGames.map((c) =>
                [...c.races]
                  .sort((a, b) => b.games - a.games)
                  .map((r, idx) => {
                    const wrPercent = r.winRate * 100;

                    return (
                      <tr key={`${c.country}-${r.raceId}`} className="border-b">
                        <td className="px-4 py-2">{idx === 0 ? c.label : ""}</td>
                        <td className="px-4 py-2">{r.race}</td>
                        <td className="px-4 py-2 tabular-nums">{r.games}</td>
                        <td className="px-4 py-2 tabular-nums text-emerald-600">{r.wins}</td>
                        <td className="px-4 py-2 tabular-nums text-rose-600">{r.losses}</td>
                        <td className={`px-4 py-2 tabular-nums ${wrColor(wrPercent)}`}>
                          {wrPercent.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ================= AVG GAME LENGTH (SORTED BY TIME) ================= */}
      <Section title="Avg Game Length">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 uppercase text-xs">
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2 tabular-nums">Avg (min)</th>
                <th className="px-4 py-2 tabular-nums">Total (h)</th>
                
              </tr>
            </thead>

            <tbody>
              {countriesByTime.map((c) => {
                const avgMin = c.avgGameSeconds
                  ? c.avgGameSeconds / 60
                  : null;

                const hours = c.timePlayedSeconds / 3600;

                return (
                  <tr key={c.country} className="border-b">
                    <td className="px-4 py-2">{c.label}</td>

                    <td className="px-4 py-2 tabular-nums">
                      {avgMin ? avgMin.toFixed(1) : "—"}
                    </td>

                    <td className="px-4 py-2 tabular-nums">
                      {hours.toFixed(1)}
                  
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ================= AVG MMR FACED ================= */}
      <Section title="Avg MMR Faced">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 uppercase text-xs">
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2 tabular-nums">Opp MMR</th>
                <th className="px-4 py-2 tabular-nums">Your MMR</th>
              </tr>
            </thead>
            <tbody>
              {countriesByOppMmr.map((c) => (
                <tr key={c.country} className="border-b">
                  <td className="px-4 py-2">{c.label}</td>
                  <td className="px-4 py-2 tabular-nums">{c.avgOpponentMMR?.toFixed(0) ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums">{c.avgSelfMMR?.toFixed(0) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

    </div>
  );
}
