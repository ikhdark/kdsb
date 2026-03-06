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
const BUCKET_LABELS = ["00–08","08–16","16–24"];

function textColor(wr: number | null) {
  if (wr == null) return "text-gray-400";
  if (wr >= 50) return "text-green-600 font-semibold";
  if (wr >= 40) return "text-yellow-600 font-semibold";
  return "text-red-600 font-semibold";
}

export default function TimeHeatmap({ data }: { data: Cell[] }) {
  const safe = Array.isArray(data) ? data : [];

  const map = new Map<string, Cell>();

  const columnTotals = [
    { games: 0, wins: 0 },
    { games: 0, wins: 0 },
    { games: 0, wins: 0 },
  ];

  const rowTotals = Array.from({ length: 7 }, () => ({
    games: 0,
    wins: 0,
  }));

  /* ===== single aggregation pass ===== */

  for (const c of safe) {
    map.set(`${c.day}-${c.bucket}`, c);

    columnTotals[c.bucket].games += c.games;
    columnTotals[c.bucket].wins += c.wins;

    rowTotals[c.day].games += c.games;
    rowTotals[c.day].wins += c.wins;
  }

  /* ===== finalize totals ===== */

  const colFinal = columnTotals.map((c) => {
    const losses = c.games - c.wins;

    return {
      games: c.games,
      wins: c.wins,
      losses,
      winrate: c.games ? Math.round((c.wins / c.games) * 100) : null,
    };
  });

  const rowFinal = rowTotals.map((r) => {
    const losses = r.games - r.wins;

    return {
      games: r.games,
      wins: r.wins,
      losses,
      winrate: r.games ? Math.round((r.wins / r.games) * 100) : null,
    };
  });

  /* ===== grand totals ===== */

  const grandGames = colFinal.reduce((n, c) => n + c.games, 0);
  const grandWins = colFinal.reduce((n, c) => n + c.wins, 0);
  const grandLoss = grandGames - grandWins;
  const grandWR = grandGames ? Math.round((grandWins / grandGames) * 100) : null;

  /* ===== best day/time ===== */

  const bestDayIndex = rowFinal.reduce(
    (best, cur, i) =>
      cur.winrate != null &&
      (best === -1 || cur.winrate > (rowFinal[best].winrate ?? -1))
        ? i
        : best,
    -1
  );

  const bestTimeIndex = colFinal.reduce(
    (best, cur, i) =>
      cur.winrate != null &&
      (best === -1 || cur.winrate > (colFinal[best].winrate ?? -1))
        ? i
        : best,
    -1
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[55px_repeat(4,1fr)] gap-2 text-xs tabular-nums">
        <div />

        {BUCKET_LABELS.map((b) => (
          <div key={b} className="text-center text-gray-500 font-semibold">
            {b}
          </div>
        ))}

        <div className="text-center text-gray-500 font-semibold">Total</div>

        {DAY_NAMES.map((dayName, day) => {
          const rt = rowFinal[day];

          return (
            <React.Fragment key={day}>
              <div className="flex items-center text-gray-500 font-medium">
                {dayName}
              </div>

              {[0, 1, 2].map((bucket) => {
                const cell = map.get(`${day}-${bucket}`);

                return (
                  <div
                    key={`${day}-${bucket}`}
                    className="h-10 px-2 rounded border border-gray-200 bg-white flex items-center justify-center whitespace-nowrap text-[11px] font-semibold"
                  >
                    {cell?.winrate != null ? (
                      <span className={textColor(cell.winrate)}>
                        {cell.winrate}% ({cell.wins}-{cell.games - cell.wins})
                      </span>
                    ) : "—"}
                  </div>
                );
              })}

              <div className="h-10 px-2 rounded border border-gray-300 bg-gray-50 flex items-center justify-center whitespace-nowrap text-[11px] font-semibold">
                {rt.winrate != null ? (
                  <span className={textColor(rt.winrate)}>
                    {rt.winrate}% ({rt.wins}-{rt.losses})
                  </span>
                ) : "—"}
              </div>
            </React.Fragment>
          );
        })}

        <div className="font-semibold text-gray-700 border-t pt-2">Total</div>

        {colFinal.map((c, i) => (
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

        <div className="h-10 rounded border border-gray-300 bg-gray-50 flex items-center justify-center border-t font-semibold">
          {grandWR != null ? (
            <span className={textColor(grandWR)}>
              {grandWR}% ({grandWins}-{grandLoss})
            </span>
          ) : "—"}
        </div>
      </div>

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