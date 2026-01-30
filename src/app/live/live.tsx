"use client";

import { useEffect, useState } from "react";

/* =========================
   telemetry hook
========================= */

function useTelemetry() {
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:6119/state"); // change port
        setState(await res.json());
      } catch {}
    }, 400);

    return () => clearInterval(t);
  }, []);

  return state;
}

/* =========================
   page
========================= */

export default function OverlayLive() {
  const data = useTelemetry();
  const [showPanels, setShowPanels] = useState(false);

  /* hotkey toggle */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") setShowPanels(v => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!data) return null;

  const p1 = data.players?.[0];
  const p2 = data.players?.[1];

  return (
    <div className="fixed inset-0 text-white font-semibold pointer-events-none">

      {/* TOP BAR */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2
        bg-black/80 backdrop-blur px-6 py-2 rounded-xl
        flex items-center gap-6 text-sm shadow-lg">

        <PlayerSummary p={p1} left />

        <div className="text-lg tracking-wider tabular-nums opacity-90">
          {data.time}
        </div>

        <PlayerSummary p={p2} />
      </div>

      {/* SIDE PANELS */}
      {showPanels && (
        <>
          <SidePanel p={p1} left />
          <SidePanel p={p2} />
        </>
      )}

      {/* BOTTOM TICKER */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2
        bg-black/60 backdrop-blur px-5 py-1 rounded-lg
        text-xs opacity-80">

        Win Prob 61% • H2H 13–7 • Last 10: 7–3
      </div>
    </div>
  );
}

/* =========================
   components
========================= */

function PlayerSummary({ p, left = false }: any) {
  if (!p) return null;

  return (
    <div className={`flex items-center gap-3 ${left ? "" : "flex-row-reverse"}`}>
      <div className="font-bold">{p.name}</div>

      <div className="tabular-nums opacity-90">
        {p.gold}g
      </div>

      <div className="tabular-nums opacity-80">
        {p.lumber}w
      </div>

      <div className="tabular-nums bg-white/10 px-2 py-0.5 rounded">
        {p.foodUsed}/{p.foodMax}
      </div>

      <div className="flex gap-1">
        {p.heroes?.map((h: any, i: number) => (
          <div key={i} className="w-7 h-7 bg-black/70 rounded text-[10px]
            flex items-center justify-center">
            {h.level}
          </div>
        ))}
      </div>
    </div>
  );
}

function SidePanel({ p, left = false }: any) {
  if (!p) return null;

  return (
    <div
      className={`absolute top-24 ${left ? "left-3" : "right-3"}
        w-56 bg-black/80 backdrop-blur rounded-xl p-4
        text-xs space-y-2 shadow-lg`}
    >
      <Row label="Army" value={p.armyValue} />
      <Row label="Workers" value={p.workers} />
      <Row label="Upgrades" value={p.upgrades} />
      <Row label="APM" value={p.apm} />
    </div>
  );
}

function Row({ label, value }: any) {
  return (
    <div className="flex justify-between tabular-nums">
      <span className="opacity-70">{label}</span>
      <span>{value ?? "—"}</span>
    </div>
  );
}
