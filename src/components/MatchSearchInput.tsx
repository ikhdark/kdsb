"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BattleTagInput from "@/components/BattleTagInput";
import { Section, StatRow } from "@/components/PlayerUI";

const RECENT_KEY = "w3c_recent_searches";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeRecent(tag: string): string[] {
  try {
    const prev = readRecent();
    const next = [tag, ...prev.filter((t) => t !== tag)].slice(0, 3);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

function normalizeBattleTagInput(value: string) {
  return value.trim();
}

export default function MatchSearchInput({ error }: { error?: string }) {
  const [value, setValue] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  const go = useCallback(
    (tag: string) => {
      const updated = writeRecent(tag);
      setRecent(updated);
      router.push(`/stats/matches?player=${encodeURIComponent(tag)}`);
    },
    [router]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = normalizeBattleTagInput(value);
    if (!v) return;
    go(v);
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Section title="Match History" className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <BattleTagInput
            value={value}
            onChange={setValue}
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
                  onClick={() => go(tag)}
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