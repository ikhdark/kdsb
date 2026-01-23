"use client";

import { useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function PlayerLandingPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const value = inputRef.current?.value.trim();
      if (!value) return;

      // ✅ Correct for GA4 (NOT dataLayer)
      (window as any).gtag?.("event", "battleTag_search");

      router.push(`/stats/player/${encodeURIComponent(value)}`);
    },
    [router]
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="w-full max-w-md text-center space-y-4 sm:space-y-6 px-4">
        <h1 className="text-4xl sm:text-5xl font-semibold text-black dark:text-white leading-snug">
          W3Champions
        </h1>

        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
          Search a BattleTag (Please be patient stats loading might take up to 10 seconds, this will improve in BETA 1.1)
        </p>

        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 w-full">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="Example: kuhhhdark#1976"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm sm:text-base text-black placeholder-gray-400
                       focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500
                       dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 box-border"
          />

          <button
            type="submit"
            className="w-full sm:w-auto rounded-lg bg-emerald-500 px-4 py-2 text-sm sm:text-base font-semibold text-white
                       hover:bg-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            Search
          </button>
        </form>
      </div>
    </div>
  );
}
