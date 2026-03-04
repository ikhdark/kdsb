"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import WhatsNew from "@/components/WhatsNew";
import LandingPoll from "@/components/LandingPoll";
import { useBattleTagAutocomplete } from "@/hooks/useBattleTagAutocomplete";

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

export default function PlayerLandingPage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [recent, setRecent] = useState<string[]>([]);

  /* ✅ shared autocomplete hook */
  const { results, clear } = useBattleTagAutocomplete(query);

  /* ================= PWA INSTALL SUPPORT ================= */

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    function handler(e: any) {
      e.preventDefault();
      setDeferredPrompt(e);
    }

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  /* ================= INIT ================= */

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  /* ================= SUBMIT ================= */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const value = normalizeBattleTagInput(query);

    if (!value) {
      setError("Enter a BattleTag");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/resolve-battletag?q=${encodeURIComponent(value)}`
      );

      if (!res.ok) throw new Error();

      const data = await res.json();

      if (!data?.battleTag) throw new Error();

      writeRecent(data.battleTag);
      setRecent(readRecent());

      router.replace(
        `/stats/player/${encodeURIComponent(data.battleTag)}/summary`
      );
    } catch {
      setError("Player not found");
      setLoading(false);
    }
  }

  function quickGo(tag: string) {
    writeRecent(tag);
    setRecent(readRecent());

    router.replace(`/stats/player/${encodeURIComponent(tag)}/summary`);
  }

  /* ================= BOOKMARK / INSTALL ================= */

  async function bookmark() {
    /* real install button if supported */
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }

    /* desktop fallback */
    const isMac = navigator.platform.toUpperCase().includes("MAC");

    alert(
      isMac
        ? "Press ⌘ + D to bookmark this page."
        : "Press Ctrl + D to bookmark this page."
    );
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center px-6 pt-16 pb-32">
      <div className="w-full max-w-xl space-y-10 text-center">

        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-black dark:text-white">
            KD's W3Champions Stats
          </h1>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Strength of Schedule Ladder<br />
            Detailed Player Stats
          </p>
        </div>

        <div className="space-y-6 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-md p-6">

          <form onSubmit={onSubmit} className="space-y-4">

            <div className="relative">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setError(null);
                }}
                disabled={loading}
                placeholder="Search any BattleTag (e.g. Moon#1234)"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-5 py-4 text-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />

              {results.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow text-left">
                  {results.slice(0, 6).map((r) => (
                    <button
                      key={r.battleTag}
                      type="button"
                      onClick={() => {
                        setQuery(r.battleTag);
                        clear();
                      }}
                      className="block w-full px-4 py-2 hover:bg-gray-100 text-sm"
                    >
                      {r.battleTag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-rose-500 text-left -mt-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="w-full rounded-lg bg-emerald-500 text-white py-3 text-base font-semibold shadow-sm hover:bg-emerald-600 hover:shadow-md active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Searching…" : "Search Player"}
            </button>
          </form>

          {recent.length > 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400 space-x-3">
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

          <button
            onClick={bookmark}
            className="mx-auto flex items-center justify-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition"
          >
            ⭐ Install / Bookmark W3CStats
          </button>
        </div>

        <LandingPoll />

        <WhatsNew />
      </div>
    </div>
  );
}