"use client";

import { useEffect, useState } from "react";

export type BattleTagResult = { battleTag: string };

export function useBattleTagAutocomplete(query: string) {
  const [results, setResults] = useState<BattleTagResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    /* clear cases */
    if (query.length < 3 || query.includes("#")) {
      setResults([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setLoading(true);

        const res = await fetch(
          `/api/battletag-search?q=${encodeURIComponent(query)}`
        );

        if (!res.ok) {
          setResults([]);
          return;
        }

        const json = await res.json();
        setResults(json ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [query]);

  return { results, loading, clear: () => setResults([]) };
}
