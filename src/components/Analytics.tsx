"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { pageview, event } from "@/lib/ga";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

const STAT_MAP = {
  summary: "Summary",
  performance: "Performance",
  consistency: "Time Consistency",
  heroes: "Hero Stats",
  maps: "Map Stats",
  "vs-country": "Vs Country",
  "vs-player": "Vs Player",
} as const;

export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    const url = pathname + window.location.search;

    pageview(url);

    if (!pathname.startsWith("/stats/player/")) return;

    const parts = pathname.split("/");
    const statSegment = parts[4];

    if (!statSegment) return;

    const statType = STAT_MAP[statSegment as keyof typeof STAT_MAP];

    if (statType) {
      event("stat_page_view", { stat_type: statType });
    }
  }, [pathname]);

  return <VercelAnalytics />;
}