"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { pageview } from "@/lib/gtag";

/* =========================
   Stat page mapping
========================= */

const STAT_MAP = {
  summary: "Summary",
  rank: "Rank Stats",
  performance: "Performance",
  consistency: "Time Consistency",
  heroes: "Hero Stats",
  maps: "Map Stats",
  "vs-country": "Vs Country",
  "vs-player": "Vs Player",
} as const;

/* =========================
   Stat tracking
========================= */

function trackStatType(pathname: string) {
  if (!window.gtag) return;

  // Only care about /stats/player/*
  if (!pathname.startsWith("/stats/player/")) return;

  // /stats/player/<tag>/<stat>
  const parts = pathname.split("/");
  const statSegment = parts[4];
  if (!statSegment) return;

  const statType = STAT_MAP[statSegment as keyof typeof STAT_MAP];
  if (!statType) return;

  window.gtag("event", "stat_page_view", {
    stat_type: statType,
  });
}

/* =========================
   Global analytics listener
========================= */

export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;

    // Standard pageview
    pageview(url);

    // Stat usage tracking
    trackStatType(pathname);

  }, [pathname, searchParams]);

  return null;
}
