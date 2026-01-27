"use client";

import { useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import WhatsNew from "@/components/WhatsNew";

function normalizeBattleTagInput(value: string) {
  return value.trim();
}

export default function PlayerLandingPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const value = normalizeBattleTagInput(inputRef.current?.value || "");
      if (!value || loading) return;

      setError(null);
      setLoading(true);

      try {
        const res = await fetch(`/api/resolve-battletag?q=${encodeURIComponent(value)}`);
        const data = await res.json();

        if (!data?.ok) {
          setError("Player not found");
          return;
        }

        router.replace(`/stats/player/${encodeURIComponent(data.battleTag)}/summary`);
      } finally {
        setLoading(false);
      }
    },
    [router, loading]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 pt-20">
      <div className="mx-auto w-full max-w-md space-y-6 text-center">
        <h1 className="text-4xl font-semibold text-black dark:text-white">
          KD W3CSTATS, Added SoS Season 24 Ladder (Global + Race) 
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Search a BattleTag
        </p>

        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="Example: Moon#1234"
            className="
              flex-1 rounded-lg border border-gray-300 bg-white
              px-4 py-3 text-base text-black
              focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500
              dark:border-gray-700 dark:bg-gray-800 dark:text-white
            "
            disabled={loading}
            onChange={() => setError(null)}
          />

          <button
            type="submit"
            disabled={loading}
            className="
              rounded-lg bg-emerald-500 px-4 py-3 text-base font-semibold text-white
              hover:bg-emerald-600 disabled:opacity-60
            "
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

        {/* ✅ Now directly under search */}
        <WhatsNew />
      </div>
    </div>
  );
}
