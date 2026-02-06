"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { pageview, event } from "@/lib/ga";

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

export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    const url = pathname + window.location.search;

    pageview(url);

    if (pathname.startsWith("/stats/player/")) {
      const statSegment = pathname.split("/").at(4);
      const statType = STAT_MAP[statSegment as keyof typeof STAT_MAP];

      if (statType) {
        event("stat_page_view", { stat_type: statType });
      }
    }
  }, [pathname]);

  return null;
}