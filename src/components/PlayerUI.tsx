import React, { ReactNode } from "react";

/* =========================
   Header
========================= */
export function PlayerHeader({
  battletag,
  subtitle,
}: {
  battletag: string;
  subtitle: string;
}) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-white">
        {battletag}
      </h1>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </header>
  );
}

/* =========================
   Section wrapper
========================= */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="border-b border-gray-300 pb-1 text-sm font-semibold uppercase tracking-wide text-black dark:border-gray-700 dark:text-white">
        {title}
      </h2>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  );
}

/* =========================
   Stat row
========================= */
export function StatRow({
  label,
  value,
  winrate,
}: {
  label: string;
  value: string;
  winrate?: number;
}) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_auto] gap-x-4 items-center">
        <span>{label}</span>
        <span className="tabular-nums font-medium">{value}</span>
      </div>

      {typeof winrate === "number" && (
        <div className="h-1.5 bg-gray-200 rounded overflow-hidden dark:bg-gray-700">
          <div
            className={
              winrate >= 55
                ? "bg-emerald-500 h-full"
                : winrate >= 48
                ? "bg-yellow-500 h-full"
                : "bg-rose-500 h-full"
            }
            style={{ width: `${Math.min(100, Math.max(0, winrate))}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* =========================
   Stat card (for Rank / Hero summary tiles)
   Updated to allow JSX in 'sub'
========================= */
export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: ReactNode; // <-- changed from 'string' to ReactNode
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-gray-dark">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
