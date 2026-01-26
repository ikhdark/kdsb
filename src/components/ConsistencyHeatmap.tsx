"use client";

import React, { useMemo } from "react";
import { Section, StatCard } from "@/components/PlayerUI";

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const BUCKET_LABELS = ["0–8","8–16","16–24"];

function color(wr: number | null) {
  if (wr == null) return "text-gray-400";
  if (wr >= 60) return "text-emerald-600 font-semibold";
  if (wr >= 50) return "text-yellow-600 font-semibold";
  return "text-rose-600 font-semibold";
}

export default function ConsistencyHeatmap({
  matches,
}: {
  matches: { startTime: string; didWin: boolean }[];
}) {

  const {
    heat,
    rowTotals,
    columnTotals,
    bestDayIndex,
    bestTimeIndex,
  } = useMemo(() => {

    const map = new Map<number, { games: number; wins: number }>();

    for (const m of matches) {
      const d = new Date(m.startTime); // browser local time

      const day = d.getDay();
      const hour = d.getHours();

      const bucket =
        hour < 8 ? 0 :
        hour < 16 ? 1 :
        2;

      const idx = day * 3 + bucket;

      map.set(idx, {
        games: (map.get(idx)?.games ?? 0) + 1,
        wins:  (map.get(idx)?.wins  ?? 0) + (m.didWin ? 1 : 0),
      });
    }

    const toCell = (g: number, w: number) => ({
      games: g,
      wins: w,
      losses: g - w,
      winrate: g ? (w / g) * 100 : null,
    });

    const heat = new Map<number, ReturnType<typeof toCell>>();

    for (const [k, v] of map) {
      heat.set(k, toCell(v.games, v.wins));
    }

    const columnTotals = [0,1,2].map(bucket => {
      let g = 0, w = 0;
      for (const [idx, v] of map) {
        if (idx % 3 === bucket) {
          g += v.games;
          w += v.wins;
        }
      }
      return toCell(g, w);
    });

    const rowTotals = DAY_NAMES.map((_, day) => {
      let g = 0, w = 0;
      for (const [idx, v] of map) {
        if (Math.floor(idx / 3) === day) {
          g += v.games;
          w += v.wins;
        }
      }
      return toCell(g, w);
    });

    const bestDayIndex = rowTotals.reduce(
      (best, cur, i) =>
        cur.winrate != null &&
        (best === -1 || cur.winrate > rowTotals[best].winrate!)
          ? i
          : best,
      -1
    );

    const bestTimeIndex = columnTotals.reduce(
      (best, cur, i) =>
        cur.winrate != null &&
        (best === -1 || cur.winrate > columnTotals[best].winrate!)
          ? i
          : best,
      -1
    );

    return { heat, rowTotals, columnTotals, bestDayIndex, bestTimeIndex };

  }, [matches]);

  return (
    <>
      <Section title="Day × Time Performance">
        <div className="grid grid-cols-5 gap-y-3 gap-x-8 text-sm tabular-nums">

          <div />

          {BUCKET_LABELS.map(b => (
            <div key={b} className="text-center text-gray-500 font-medium">{b}</div>
          ))}

          <div className="text-center text-gray-500 font-medium">Total</div>

          {DAY_NAMES.map((d, day) => (
            <React.Fragment key={day}>
              <div className="font-medium text-gray-500">{d}</div>

              {[0,1,2].map(bucket => {
                const c = heat.get(day * 3 + bucket);
                if (!c || c.winrate == null)
                  return <div key={bucket} className="text-center text-gray-300">—</div>;

                return (
                  <div key={bucket} className={`text-center ${color(c.winrate)}`}>
                    {Math.round(c.winrate)}% ({c.wins}-{c.losses})
                  </div>
                );
              })}

              {(() => {
                const c = rowTotals[day];
                if (!c.winrate)
                  return <div className="text-center text-gray-300">—</div>;

                return (
                  <div className={`text-center font-semibold ${color(c.winrate)}`}>
                    {Math.round(c.winrate)}% ({c.wins}-{c.losses})
                  </div>
                );
              })()}
            </React.Fragment>
          ))}

        </div>
      </Section>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Best Day"
          value={bestDayIndex >= 0 ? DAY_NAMES[bestDayIndex] : "—"}
        />
        <StatCard
          label="Best Time"
          value={bestTimeIndex >= 0 ? BUCKET_LABELS[bestTimeIndex] : "—"}
        />
      </section>
    </>
  );
}
