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

      (window as any).gtag?.("event", "battleTag_search");

      router.push(`/stats/player/${encodeURIComponent(value)}`);
    },
    [router]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <h1 className="text-4xl font-semibold text-black dark:text-white">
          W3Champions
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Search a BattleTag (stats may take up to 10 seconds on first load)
        </p>

        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="Example: kuhhhdark#1976"
            className="
              flex-1 rounded-lg border border-gray-300 bg-white
              px-4 py-3 text-base text-black
              focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500
              dark:border-gray-700 dark:bg-gray-800 dark:text-white
            "
          />

          <button
            type="submit"
            className="
              rounded-lg bg-emerald-500 px-4 py-3 text-base font-semibold text-white
              hover:bg-emerald-600
            "
          >
            Search
          </button>
        </form>
      </div>
    </div>
  );
}
