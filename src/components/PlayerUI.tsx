import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { PLAYER_LABELS } from "@/lib/playerLabels";
/* =========================================
   shared base styles (avoid re-allocations)
========================================= */

const CARD_BASE =
  "rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-md overflow-hidden";

const SECTION_BASE = `${CARD_BASE} p-5 space-y-4`;

const STATCARD_BASE =
  `${CARD_BASE} transition-shadow hover:shadow-lg`;

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
  return (
    <header
      className={className ? cn("space-y-2", className) : "space-y-2"}
      {...props}
    >
     <h1 className="truncate text-3xl font-semibold tracking-tight text-black dark:text-white whitespace-pre-line">
   {PLAYER_LABELS[battletag]
    ? `${battletag} (${PLAYER_LABELS[battletag]})`
    : battletag}
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
    <section
      className={className ? cn(SECTION_BASE, className) : SECTION_BASE}
      {...props}
    >
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

  const textColor =
    pct == null
      ? ""
      : pct >= 55
      ? "text-emerald-600 dark:text-emerald-400"
      : pct >= 48
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-rose-600 dark:text-rose-400";

  return (
    <div
      className={className ? cn("space-y-1", className) : "space-y-1"}
      {...props}
    >
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
            className={
              pct >= 55
                ? "h-full transition-all bg-emerald-500"
                : pct >= 48
                ? "h-full transition-all bg-yellow-500"
                : "h-full transition-all bg-rose-500"
            }
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
      className={
        className
          ? cn(STATCARD_BASE, compact ? "p-3" : "p-5", className)
          : `${STATCARD_BASE} ${compact ? "p-3" : "p-5"}`
      }
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