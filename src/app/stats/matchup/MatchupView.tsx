import { Section } from "@/components/PlayerUI";

/* ========================================= */

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function mins(sec: number) {
  return `${(sec / 60).toFixed(1)}m`;
}

function num(v: number | null | undefined) {
  if (v == null) return "-";
  return Math.round(v);
}

/* ========================================= */

function Board({
  aLabel,
  bLabel,
  rows,
}: {
  aLabel: string;
  bLabel: string;
  rows: { label: string; a: number | string; b: number | string }[];
}) {
  return (
    <div className="rounded-xl border bg-white dark:bg-gray-900 overflow-hidden">
      <div className="grid grid-cols-3 text-xs font-semibold uppercase px-4 py-2 bg-gray-100 dark:bg-gray-800">
        <div className="text-left">{aLabel}</div>
        <div className="text-center text-gray-600 dark:text-gray-300">Stat</div>
        <div className="text-right">{bLabel}</div>
      </div>

      {rows.map((r) => (
        <div
          key={r.label}
          className="grid grid-cols-3 px-4 py-3 border-t text-sm items-center"
        >
          <div className="text-left font-medium">{r.a}</div>
          <div className="text-center text-xs uppercase text-gray-600 dark:text-gray-300">
            {r.label}
          </div>
          <div className="text-right font-medium">{r.b}</div>
        </div>
      ))}
    </div>
  );
}

/* ========================================= */

export default function MatchupView({ stats }: { stats: any }) {
  if (!stats) {
  return (
    <div className="text-center text-sm text-gray-500 py-10">
      No head-to-head games found.
    </div>
  );
}
  const aGain = stats.statsA.mmr.totalMmrGain;
  const bGain = stats.statsB.mmr.totalMmrGain;

  const winner = aGain >= bGain ? stats.playerA : stats.playerB;
  const value = Math.max(aGain, bGain);

  return (
    <>
      {/* ========================================= */}
      {/* Overview */}
      {/* ========================================= */}

<Section title="Overview">
  {(() => {
    const RACE_LABEL: Record<string, string> = {
      "0": "Human",
      "1": "Undead",
      "2": "Random",
      "3": "Night Elf",
      "4": "Orc",
    };

    const raceRows = Object.entries(stats.raceBreakdown ?? {}).map(
      ([race, r]: any) => ({
        label: RACE_LABEL[race] ?? race, // ← map number → name
        a: `${r.aWins}-${r.aLosses} (${pct(r.aWinrate)})`,
        b: `${r.bWins}-${r.bLosses} (${pct(r.bWinrate)})`,
      })
    );

    return (
      <>
        <Board
          aLabel={stats.playerA}
          bLabel={stats.playerB}
          rows={[
            {
              label: "Record",
              a: `${stats.statsA.overall.wins}-${stats.statsA.overall.losses}`,
              b: `${stats.statsB.overall.wins}-${stats.statsB.overall.losses}`,
            },
            {
              label: "Winrate",
              a: pct(stats.statsA.overall.winrate),
              b: pct(stats.statsB.overall.winrate),
            },

            // race rows
            ...raceRows,
          ]}
        />

        <div className="rounded-xl border bg-white dark:bg-gray-900 px-4 py-3 text-center font-medium mt-4">
          Avg Duration • {mins(stats.statsA.avgDurationSec)}
        </div>
      </>
    );
  })()}
</Section>

      {/* ========================================= */}
      {/* Rating Edge */}
      {/* ========================================= */}

      <Section title="Player with the higher total MMR Change From Games vs Each Other">
        <div className="rounded-xl border bg-white dark:bg-gray-900 px-4 py-4 text-center font-semibold">
          {winner} +{num(value)}
        </div>
      </Section>

      {/* ========================================= */}
      {/* Economy */}
      {/* ========================================= */}

      <Section title="Economy">
        <Board
          aLabel={stats.playerA}
          bLabel={stats.playerB}
          rows={[
            {
              label: "Avg Gold",
              a: num(stats.statsA.economy.avgGold),
              b: num(stats.statsB.economy.avgGold),
            },
            {
              label: "Avg Lumber",
              a: num(stats.statsA.economy.avgLumber),
              b: num(stats.statsB.economy.avgLumber),
            },
            {
              label: "Avg Upkeep Lost",
              a: num(stats.statsA.economy.avgUpkeepLoss),
              b: num(stats.statsB.economy.avgUpkeepLoss),
            },
          ]}
        />
      </Section>

      {/* ========================================= */}
      {/* Army */}
      {/* ========================================= */}

      <Section title="Army">
        <Board
          aLabel={stats.playerA}
          bLabel={stats.playerB}
          rows={[
            {
              label: "Avg Units Produced",
              a: num(stats.statsA.units.avgUnitsProduced),
              b: num(stats.statsB.units.avgUnitsProduced),
            },
            {
              label: "Avg Units Killed",
              a: num(stats.statsA.units.avgUnitsKilled),
              b: num(stats.statsB.units.avgUnitsKilled),
            },
            {
              label: "Avg Largest Army",
              a: num(stats.statsA.units.avgLargestArmy),
              b: num(stats.statsB.units.avgLargestArmy),
            },
          ]}
        />
      </Section>

      {/* ========================================= */}
      {/* Heroes */}
      {/* ========================================= */}

      <Section title="Heroes">
        <Board
          aLabel={stats.playerA}
          bLabel={stats.playerB}
          rows={[
            {
              label: "Avg XP Gained",
              a: num(stats.statsA.hero.avgXP),
              b: num(stats.statsB.hero.avgXP),
            },
            {
              label: "Avg Heroes Killed",
              a: num(stats.statsA.hero.avgHeroesKilled),
              b: num(stats.statsB.hero.avgHeroesKilled),
            },
            {
              label: "Avg Items Obtained",
              a: num(stats.statsA.hero.avgItemsObtained),
              b: num(stats.statsB.hero.avgItemsObtained),
            },
            {
              label: "Avg Mercs Hired",
              a: num(stats.statsA.hero.avgMercsHired),
              b: num(stats.statsB.hero.avgMercsHired),
            },
          ]}
        />
      </Section>

<Section title="Hero Usage, Record & Winrate">
  <div className="grid grid-cols-2 gap-4">

    {/* Player A */}
    <div className="rounded-xl border bg-white dark:bg-gray-900 p-4">
      <div className="font-semibold mb-3">{stats.playerA}</div>

      {/* header */}
      <div className="grid grid-cols-4 text-xs uppercase text-gray-500 mb-2">
        <span>Hero</span>
        <span className="text-center">Use</span>
        <span className="text-center">W-L</span>
        <span className="text-right">WR</span>
      </div>

      {Object.entries(stats.statsA.heroUsage as Record<string, { games: number; wins: number }>)
        .map(([hero, v]) => {
          const usage = v.games / stats.statsA.overall.games;
          const losses = v.games - v.wins;
          const wr = v.games ? v.wins / v.games : 0;

          return { hero, usage, wins: v.wins, losses, wr };
        })
        .filter(h => h.usage > 0)
        .sort((a, b) => b.usage - a.usage)
        .map(h => (
          <div key={h.hero} className="grid grid-cols-4 text-sm py-1">
            <span>{h.hero}</span>
            <span className="text-center">{pct(h.usage)}</span>
            <span className="text-center">{h.wins}-{h.losses}</span>
            <span className="text-right text-gray-500">{pct(h.wr)}</span>
          </div>
        ))}
    </div>

    {/* Player B */}
    <div className="rounded-xl border bg-white dark:bg-gray-900 p-4">
      <div className="font-semibold mb-3">{stats.playerB}</div>

      {/* header */}
      <div className="grid grid-cols-4 text-xs uppercase text-gray-500 mb-2">
        <span>Hero</span>
        <span className="text-center">Use</span>
        <span className="text-center">W-L</span>
        <span className="text-right">WR</span>
      </div>

      {Object.entries(stats.statsB.heroUsage as Record<string, { games: number; wins: number }>)
        .map(([hero, v]) => {
          const usage = v.games / stats.statsB.overall.games;
          const losses = v.games - v.wins;
          const wr = v.games ? v.wins / v.games : 0;

          return { hero, usage, wins: v.wins, losses, wr };
        })
        .filter(h => h.usage > 0)
        .sort((a, b) => b.usage - a.usage)
        .map(h => (
          <div key={h.hero} className="grid grid-cols-4 text-sm py-1">
            <span>{h.hero}</span>
            <span className="text-center">{pct(h.usage)}</span>
            <span className="text-center">{h.wins}-{h.losses}</span>
            <span className="text-right text-gray-500">{pct(h.wr)}</span>
          </div>
        ))}
    </div>

  </div>
</Section>


<Section title="Map Winrates">
  <Board
    aLabel={stats.playerA}
    bLabel={stats.playerB}
    rows={stats.maps
      .sort((a: typeof stats.maps[number], b: typeof stats.maps[number]) => b.games - a.games)
      .map((m: typeof stats.maps[number]) => ({
        label: `${m.map} (${m.games})`,
        a: pct(m.winrateA),
        b: pct(m.winrateB),
      }))}
  />
</Section>

      {/* ========================================= */}
      {/* Network */}
      {/* ========================================= */}

      <Section title="Network">
        <Board
          aLabel={stats.playerA}
          bLabel={stats.playerB}
          rows={[
            {
              label: "Avg Ping",
              a: num(stats.statsA.network.avgPing),
              b: num(stats.statsB.network.avgPing),
            },
          ]}
        />
      </Section>
    </>
  );
}
