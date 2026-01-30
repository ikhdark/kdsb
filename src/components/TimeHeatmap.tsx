"use client";

import React from "react";

type Cell = {
  day: number;
  bucket: number;
  games: number;
  wins: number;
  winrate: number | null;
  netMMR: number;
};

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const BUCKET_LABELS = ["0–8 UTC","8–16 UTC","16–24 UTC"];

function textColor(wr: number | null) {
  if (wr == null) return "text-gray-400";
  if (wr >= 50) return "text-green-600 font-semibold";
  if (wr >= 40) return "text-yellow-600 font-semibold";
  return "text-red-600 font-semibold";
}

export default function TimeHeatmap({ data }: { data: Cell[] }) {
  const safe = Array.isArray(data) ? data : [];

  const map = new Map<string, Cell>(
    safe.map(d => [`${d.day}-${d.bucket}`, d])
  );

  /* ================= totals ================= */

  const columnTotals = [0,1,2].map(bucket => {
    let games = 0, wins = 0;

    for (const c of safe) {
      if (c.bucket === bucket) {
        games += c.games;
        wins += c.wins;
      }
    }

    const losses = games - wins;

    return {
      games,
      wins,
      losses,
      winrate: games ? Math.round((wins/games)*100) : null
    };
  });

  const rowTotals = DAY_NAMES.map((_, day) => {
    let games = 0, wins = 0;

    for (const c of safe) {
      if (c.day === day) {
        games += c.games;
        wins += c.wins;
      }
    }

    const losses = games - wins;

    return {
      games,
      wins,
      losses,
      winrate: games ? Math.round((wins/games)*100) : null
    };
  });

  /* ================= grand ================= */

  const grandGames = columnTotals.reduce((n,c)=>n+c.games,0);
  const grandWins  = columnTotals.reduce((n,c)=>n+c.wins,0);
  const grandLoss  = grandGames - grandWins;
  const grandWR    = grandGames ? Math.round((grandWins/grandGames)*100) : null;

  /* ================= best ================= */

  const bestDayIndex = rowTotals.reduce(
    (best, cur, i) =>
      cur.winrate != null &&
      (best === -1 || cur.winrate > (rowTotals[best].winrate ?? -1))
        ? i
        : best,
    -1
  );

  const bestTimeIndex = columnTotals.reduce(
    (best, cur, i) =>
      cur.winrate != null &&
      (best === -1 || cur.winrate > (columnTotals[best].winrate ?? -1))
        ? i
        : best,
    -1
  );

  /* ================= render ================= */

  return (
    <div className="space-y-6">

      {/* TABLE */}
      <div className="grid grid-cols-5 gap-2 text-sm tabular-nums">

        {/* header */}
        <div />
        {BUCKET_LABELS.map(b => (
          <div key={b} className="text-center text-gray-500 font-semibold">
            {b}
          </div>
        ))}
        <div className="text-center text-gray-500 font-semibold">
          Total
        </div>

        {/* rows */}
        {DAY_NAMES.map((dayName, day) => {
          const rt = rowTotals[day];

          return (
            <React.Fragment key={day}>
              <div className="flex items-center text-gray-500 font-medium">
                {dayName}
              </div>

              {[0,1,2].map(bucket => {
                const cell = map.get(`${day}-${bucket}`);

                return (
                  <div
                    key={`${day}-${bucket}`}
                    className="h-10 rounded border border-gray-200 bg-white flex items-center justify-center"
                  >
                   {cell?.winrate != null ? (
  <span className={textColor(cell.winrate)}>
    {cell.winrate}% ({cell.wins}-{cell.games - cell.wins})
  </span>
) : "—"}
                  </div>
                );
              })}

              {/* row total */}
              <div className="h-10 rounded border border-gray-300 bg-gray-50 flex items-center justify-center font-semibold">
                {rt.winrate != null ? (
                  <span className={textColor(rt.winrate)}>
                    {rt.winrate}% ({rt.wins}-{rt.losses})
                  </span>
                ) : "—"}
              </div>
            </React.Fragment>
          );
        })}

        {/* column totals */}
        <div className="font-semibold text-gray-700 border-t pt-2">
          Total
        </div>

        {columnTotals.map((c, i) => (
          <div
            key={i}
            className="h-10 rounded border border-gray-300 bg-gray-50 flex items-center justify-center border-t font-semibold"
          >
            {c.winrate != null ? (
              <span className={textColor(c.winrate)}>
                {c.winrate}% ({c.wins}-{c.losses})
              </span>
            ) : "—"}
          </div>
        ))}

        {/* grand */}
        <div className="h-10 rounded border border-gray-300 bg-gray-50 flex items-center justify-center border-t font-semibold">
          {grandWR != null ? (
            <span className={textColor(grandWR)}>
              {grandWR}% ({grandWins}-{grandLoss})
            </span>
          ) : "—"}
        </div>
      </div>

      {/* BEST */}
      <div className="flex gap-10 text-sm">
        <div>
          <div className="text-gray-500">Best Day</div>
          <div className="font-semibold">
            {bestDayIndex >= 0 ? DAY_NAMES[bestDayIndex] : "—"}
          </div>
        </div>

        <div>
          <div className="text-gray-500">Best Time</div>
          <div className="font-semibold">
            {bestTimeIndex >= 0 ? BUCKET_LABELS[bestTimeIndex] : "—"}
          </div>
        </div>
      </div>

    </div>
  );
}
