import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* =========================
   Header
========================= */

type PlayerHeaderProps = {
  battletag: string;
  subtitle: string;
  className?: string;
};

export function PlayerHeader({
  battletag,
  subtitle,
  className,
}: PlayerHeaderProps) {
  return (
    <header className={cn("space-y-1", className)}>
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-white">
        {battletag}
      </h1>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {subtitle}
      </p>
    </header>
  );
}

/* =========================
   Section wrapper
========================= */

type SectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function Section({ title, children, className }: SectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
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

type StatRowProps = {
  label: string;
  value: string;
  winrate?: number;
  className?: string;
};

export function StatRow({
  label,
  value,
  winrate,
  className,
}: StatRowProps) {
  const pct =
    typeof winrate === "number"
      ? Math.min(100, Math.max(0, winrate))
      : null;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-4">
        <span className="truncate text-gray-700 dark:text-gray-300">
          {label}
        </span>

        <span className="tabular-nums font-medium">
          {value}
        </span>
      </div>

      {pct !== null && (
        <div className="h-1.5 overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
          <div
            className={cn(
              "h-full transition-all",
              pct >= 55
                ? "bg-emerald-500"
                : pct >= 48
                ? "bg-yellow-500"
                : "bg-rose-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* =========================
   Stat card (summary tiles)
========================= */

type StatCardProps = {
  label: string;
  value: string;
  sub?: ReactNode;
  className?: string;
};

export function StatCard({
  label,
  value,
  sub,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900",
        className
      )}
    >
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold tabular-nums">
        {value}
      </div>

      {sub && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {sub}
        </div>
      )}
    </div>
  );
}
