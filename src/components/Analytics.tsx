"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

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

function sendEvent(name: string, params: Record<string, any>) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", name, params);
  }
}

function trackStatType(pathname: string) {
  if (!pathname.startsWith("/stats/player/")) return;

  const parts = pathname.split("/");
  const statSegment = parts[4]; // /stats/player/<battletag>/<stat>
  if (!statSegment) return;

  const statType = STAT_MAP[statSegment as keyof typeof STAT_MAP];
  if (!statType) return;

  sendEvent("stat_page_view", { stat_type: statType });
}

export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    trackStatType(pathname);
  }, [pathname]);

  return null;
}
