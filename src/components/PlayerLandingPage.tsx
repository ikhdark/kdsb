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

  /* ================= SEARCH ================= */

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const value = normalizeBattleTagInput(inputRef.current?.value || "");
      if (!value || loading) return;

      setError(null);
      setLoading(true);

      try {
        const res = await fetch(
          `/api/resolve-battletag?q=${encodeURIComponent(value)}`
        );

        const data = await res.json();

        if (!data?.ok) {
          setError("Player not found");
          return;
        }

        router.replace(
          `/stats/player/${encodeURIComponent(data.battleTag)}/summary`
        );
      } finally {
        setLoading(false);
      }
    },
    [router, loading]
  );

  function quickGo(tag: string) {
    router.replace(`/stats/player/${encodeURIComponent(tag)}/summary`);
  }

  async function bookmark() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "KD's W3Champions Stats",
          url: window.location.href,
        });
        return;
      } catch {}
    }

    alert("Press Ctrl + D (Cmd + D on Mac) to bookmark this site.");
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-900 px-4 pt-14 flex justify-center">
      <div className="w-full max-w-xl space-y-6 text-center">

        {/* TEXT WRAPPER (prevents ugly wrapping) */}
        <div className="max-w-md mx-auto space-y-3">

          <h1 className="text-3xl font-bold text-black dark:text-white">
            KD's W3Champions Stats
          </h1>

          <p className="text-sm font-semibold text-black dark:text-white">
            Strength of Schedule Ladder • 8 Detailed Stat Reports
          </p>

          <p className="text-xs text-gray-500">
            4v4 support is being added over the next few weeks
          </p>

          <p className="text-sm text-gray-500">
            Search any BattleTag to get started
          </p>

        </div>

        {/* SEARCH */}
        <form onSubmit={onSubmit} className="flex flex-col gap-3 w-full">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="Moon#1234"
            disabled={loading}
            onChange={() => setError(null)}
            className="
              w-full rounded-xl border border-gray-300 bg-white
              px-5 py-4 text-lg
              focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500
              dark:border-gray-700 dark:bg-gray-800 dark:text-white
            "
          />

          <button
            type="submit"
            disabled={loading}
            className="
              w-full rounded-xl bg-emerald-500 py-4 text-lg font-semibold text-white
              hover:bg-emerald-600 disabled:opacity-60
            "
          >
            {loading ? "Searching..." : "Search Player"}
          </button>
        </form>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* EXAMPLES */}
        <div className="text-xs text-gray-500">
          Try:{" "}
          <button onClick={() => quickGo("Grubby#1278")} className="underline">
            Grubby#1278
          </button>{" • "}
          <button onClick={() => quickGo("KAHO#31819")} className="underline">
            KAHO#31819
          </button>{" • "}
          <button onClick={() => quickGo("StarBuck#2732")} className="underline">
            StarBuck#2732
          </button>
        </div>

        {/* BOOKMARK */}
        <button
          onClick={bookmark}
          className="
            w-full rounded-xl border border-gray-300 py-3 text-sm
            hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800
          "
        >
          ⭐ Bookmark this site
        </button>

        {/* WHATS NEW */}
        <WhatsNew />

      </div>
    </div>
  );
}
