"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { pageview } from "@/lib/gtag"; // ← add this

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
  const statSegment = parts[4];

  const statType = STAT_MAP[statSegment as keyof typeof STAT_MAP];
  if (!statType) return;

  sendEvent("stat_page_view", { stat_type: statType });
}

export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url =
      pathname + (searchParams?.toString() ? `?${searchParams}` : "");

    // ✅ REQUIRED for GA page tracking
    pageview(url);

    // ✅ your custom stat event
    trackStatType(pathname);
  }, [pathname, searchParams]);

  return null;
}
