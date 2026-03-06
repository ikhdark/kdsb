import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { PLAYER_LABELS } from "@/lib/playerLabels";

/* =========================================
   shared base styles
========================================= */

const CARD_BASE =
  "rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-md overflow-hidden";

const SECTION_BASE = `${CARD_BASE} p-5 space-y-4`;

const STATCARD_BASE = `${CARD_BASE} transition-shadow hover:shadow-lg`;

/* =========================
   Header
========================= */

type PlayerHeaderProps = HTMLAttributes<HTMLElement> & {
  battletag: string;
  subtitle: string;
};

export function PlayerHeader({
  battletag,
  subtitle,
  className,
  ...props
}: PlayerHeaderProps) {
  const label = PLAYER_LABELS[battletag];

  return (
    <header className={cn("space-y-2", className)} {...props}>
      <h1 className="truncate text-3xl font-semibold tracking-tight text-black dark:text-white whitespace-pre-line">
        {label ? `${battletag} (${label})` : battletag}
      </h1>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {subtitle}
      </p>
    </header>
  );
}

/* =========================
   Section
========================= */

type SectionProps = HTMLAttributes<HTMLElement> & {
  title: string;
  children: ReactNode;
};

export function Section({
  title,
  children,
  className,
  ...props
}: SectionProps) {
  return (
    <section className={cn(SECTION_BASE, className)} {...props}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title}
      </h2>

      <div className="space-y-4 text-sm">{children}</div>
    </section>
  );
}

/* =========================
   Stat Row
========================= */

type StatRowProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string | number;
  winrate?: number;
};

export function StatRow({
  label,
  value,
  winrate,
  className,
  ...props
}: StatRowProps) {
  const pct =
    typeof winrate === "number"
      ? Math.min(100, Math.max(0, winrate))
      : null;

  let textColor = "";
  let barColor = "";

  if (pct !== null) {
    if (pct >= 55) {
      textColor = "text-emerald-600 dark:text-emerald-400";
      barColor = "bg-emerald-500";
    } else if (pct >= 48) {
      textColor = "text-yellow-600 dark:text-yellow-400";
      barColor = "bg-yellow-500";
    } else {
      textColor = "text-rose-600 dark:text-rose-400";
      barColor = "bg-rose-500";
    }
  }

  return (
    <div className={cn("space-y-1", className)} {...props}>
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-4">
        <span className="truncate text-gray-700 dark:text-gray-300">
          {label}
        </span>

        <span className={cn("tabular-nums font-semibold", textColor)}>
          {value}
        </span>
      </div>

      {pct !== null && (
        <div className="h-1.5 overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
          <div
            className={cn("h-full transition-all", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* =========================
   Stat Card
========================= */

type StatCardProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string | number;
  sub?: ReactNode;
  compact?: boolean;
};

export function StatCard({
  label,
  value,
  sub,
  compact,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(STATCARD_BASE, compact ? "p-3" : "p-5", className)}
      {...props}
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