// src/app/stats/player/[battletag]/vs-country/page.tsx

import "./countries.css";
import { getW3CCountryStats } from "@/services/vsCountry";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{
    battletag: string;
  }>;
  searchParams?: {
    bt?: string;
  };
};

export default async function CountriesPage({
  params,
  searchParams,
}: Props) {
  const resolvedParams = await params;

  const battletag =
    resolvedParams?.battletag
      ? decodeURIComponent(resolvedParams.battletag)
      : searchParams?.bt;

  if (!battletag) notFound();

  const data = await getW3CCountryStats(battletag);
  if (!data || !data.countries?.length) {
    return <pre>No country data available</pre>;
  }

  const {
    battletag: canonicalBt,
    countries,
    homeCountry,
    homeCountryLabel,
  } = data;

  /* ---------------- HELPERS ---------------- */

  const sum = (arr: any[], key: string) =>
    arr.reduce((a, b) => a + (b[key] || 0), 0);

  /* ---------------- SORTED VIEWS ---------------- */

  const countriesByGames = countries
    .slice()
    .sort((a, b) => b.games - a.games);

  const countriesByOppMmr = countries
    .slice()
    .sort((a, b) => (b.avgOpponentMMR ?? 0) - (a.avgOpponentMMR ?? 0));

  const countriesByTime = countries
    .slice()
    .sort((a, b) => b.timePlayedSeconds - a.timePlayedSeconds);

  /* ---------------- HOME VS FOREIGN ---------------- */

  const home = countries.filter(c => c.country === homeCountry);
  const foreign = countries.filter(c => c.country !== homeCountry);

  const homeWins = sum(home, "wins");
  const homeLosses = sum(home, "losses");
  const foreignWins = sum(foreign, "wins");
  const foreignLosses = sum(foreign, "losses");

  /* ---------------- RENDER ---------------- */

  return (
    <div className="countries-page">
      <h1>Country Stats — {canonicalBt}</h1>

      {/* 1. Home vs Foreign */}
      <section>
        <h2>Home vs Foreign</h2>
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th className="num">W</th>
              <th className="num">L</th>
              <th className="num">WR %</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{homeCountryLabel}</td>
              <td className="num">{homeWins}</td>
              <td className="num">{homeLosses}</td>
              <td className="num">
                {homeWins + homeLosses
                  ? ((homeWins / (homeWins + homeLosses)) * 100).toFixed(1)
                  : "—"}
              </td>
            </tr>
            <tr>
              <td>Foreign</td>
              <td className="num">{foreignWins}</td>
              <td className="num">{foreignLosses}</td>
              <td className="num">
                {foreignWins + foreignLosses
                  ? (
                      (foreignWins / (foreignWins + foreignLosses)) *
                      100
                    ).toFixed(1)
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 2. Record vs Countries */}
      <section>
        <h2>Record vs Countries</h2>
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th className="num">Games</th>
              <th className="num">Unique opponents</th>
              <th className="num">W</th>
              <th className="num">L</th>
              <th className="num">WR %</th>
            </tr>
          </thead>
          <tbody>
            {countriesByGames.map(c => (
              <tr key={c.country}>
                <td>{c.label}</td>
                <td className="num">{c.games}</td>
                <td className="num">{c.uniqueOpponents}</td>
                <td className="num">{c.wins}</td>
                <td className="num">{c.losses}</td>
                <td className="num">
                  {(c.winRate * 100).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 3. Country × Race */}
      <section>
        <h2>Country × Race</h2>
        {countriesByGames.map(c => (
          <div key={c.country} className="country-block">
            <h3>
              {c.label} ({c.games} games)
            </h3>

            {c.races?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Race</th>
                    <th className="num">Games</th>
                    <th className="num">W</th>
                    <th className="num">L</th>
                    <th className="num">WR %</th>
                  </tr>
                </thead>
                <tbody>
                  {[...c.races]
                    .sort((a, b) => b.games - a.games)
                    .map(r => (
                      <tr key={r.raceId}>
                        <td>{r.race}</td>
                        <td className="num">{r.games}</td>
                        <td className="num">{r.wins}</td>
                        <td className="num">{r.losses}</td>
                        <td className="num">
                          {(r.winRate * 100).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p>No race rows ≥ threshold</p>
            )}
          </div>
        ))}
      </section>

      {/* 4. Rematch Density */}
      <section>
        <h2>Rematch Density</h2>
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th className="num">Games</th>
              <th className="num">Opponents</th>
              <th className="num">Games / Opp</th>
            </tr>
          </thead>
          <tbody>
            {countriesByGames.map(c => (
              <tr key={c.country}>
                <td>{c.label}</td>
                <td className="num">{c.games}</td>
                <td className="num">{c.uniqueOpponents}</td>
                <td className="num">
                  {c.avgGamesPerOpponent.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 5. Avg MMR Faced */}
      <section>
        <h2>Avg MMR Faced</h2>
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th className="num">Opp MMR</th>
              <th className="num">Your MMR</th>
            </tr>
          </thead>
          <tbody>
            {countriesByOppMmr.map(c => (
              <tr key={c.country}>
                <td>{c.label}</td>
                <td className="num">
                  {c.avgOpponentMMR == null
                    ? "—"
                    : c.avgOpponentMMR.toFixed(0)}
                </td>
                <td className="num">
                  {c.avgSelfMMR == null
                    ? "—"
                    : c.avgSelfMMR.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 6. Time Played vs Country */}
      <section>
        <h2>Time Played vs Country</h2>
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th className="num">Hours</th>
              <th className="num">% Total</th>
              <th className="num">Avg Game (min)</th>
            </tr>
          </thead>
          <tbody>
            {countriesByTime.map(c => (
              <tr key={c.country}>
                <td>{c.label}</td>
                <td className="num">
                  {(c.timePlayedSeconds / 3600).toFixed(1)}
                </td>
                <td className="num">
                  {(c.timeShare * 100).toFixed(1)}
                </td>
                <td className="num">
                  {c.avgGameSeconds
                    ? (c.avgGameSeconds / 60).toFixed(1)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
