"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BattleTagInput from "@/components/BattleTagInput";

const RECENT_KEY = "w3c_recent_searches";

/* ================= STORAGE HELPERS ================= */

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeRecent(tag: string) {
  try {
    const prev = readRecent();
    const next = [tag, ...prev.filter((t) => t !== tag)].slice(0, 3);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

function normalizeBattleTagInput(value: string) {
  return value.trim();
}

/* ================================================== */

export default function MatchSearchInput({ error }: { error?: string }) {
  const [value, setValue] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = normalizeBattleTagInput(value);
    if (!v) return;

    // keep exact user casing here; server page resolves canonical later
    writeRecent(v);
    setRecent(readRecent());

    router.push(`/stats/matches?player=${encodeURIComponent(v)}`);
  }

  function quickGo(tag: string) {
    writeRecent(tag);
    setRecent(readRecent());
    router.push(`/stats/matches?player=${encodeURIComponent(tag)}`);
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-center">
          Match History
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <BattleTagInput
            value={value}
            onChange={setValue}
            placeholder="BattleTag#1234"
          />

          <button
            type="submit"
            className="w-full rounded border py-2.5 text-sm sm:text-base hover:bg-gray-100 active:scale-[0.99] transition"
          >
            Search
          </button>
        </form>

        {recent.length > 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400 space-x-3 text-center">
            <span>Last 3 Battletags Searched:</span>
            {recent.map((tag) => (
              <button
                key={tag}
                onClick={() => quickGo(tag)}
                className="underline hover:text-black dark:hover:text-white"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm text-center">{error}</div>
        )}
      </div>
    </div>
  );
}