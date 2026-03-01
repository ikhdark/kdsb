"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BattleTagInput from "@/components/BattleTagInput";
import { Section, StatRow } from "@/components/PlayerUI";

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
      <Section title="Match History" className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <BattleTagInput
            value={value}
            onChange={(v) => setValue(v)}
            placeholder="BattleTag#1234"
          />

          <button
            type="submit"
            className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 text-sm sm:text-base hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-[0.99] transition"
          >
            Search
          </button>
        </form>

        {recent.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Last 3 searched
            </div>

            <div className="flex flex-wrap gap-2">
              {recent.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => quickGo(tag)}
                  className="rounded-md border border-gray-300 dark:border-gray-700 px-2.5 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <StatRow label="Error" value={error} />}
      </Section>
    </div>
  );
}