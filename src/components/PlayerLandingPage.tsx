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
    <div className="flex justify-center py-24">
      <div className="w-full max-w-xl text-center space-y-6">

        <h1 className="text-5xl font-semibold text-black dark:text-white">
          W3Champions
        </h1>

        <p className="text-gray-500 dark:text-gray-400">
          Search a BattleTag
        </p>

        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="Example: kuhhhdark#1976"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2
                       dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />

          <button
            type="submit"
            className="rounded-lg bg-emerald-500 px-5 py-2 font-semibold text-white
                       hover:bg-emerald-600"
          >
            Search
          </button>
        </form>
      </div>
    </div>
  );
}
