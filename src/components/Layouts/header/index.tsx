"use client";

import { SearchIcon } from "@/assets/icons";
import { useSidebarContext } from "@/components/Layouts/sidebar/sidebar-context";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

function normalizeBattleTagInput(value: string) {
  return value.trim();
}

export function Header() {
  const { toggleSidebar } = useSidebarContext();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitSearch(e: FormEvent) {
    e.preventDefault();

    if (loading) return;

    const normalized = normalizeBattleTagInput(query);
    if (!normalized) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/resolve-battletag?q=${encodeURIComponent(normalized)}`
      );

      if (!res.ok) {
        setError("Player not found");
        return;
      }

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
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stroke bg-white shadow-1 px-3 py-3 md:px-5 md:py-5 dark:border-stroke-dark dark:bg-gray-dark">

      {/* ================= MENU BUTTON ================= */}
      <button
        onClick={toggleSidebar}
        aria-label="Toggle menu"
        className="
          flex items-center gap-2
          px-3 py-2
          rounded-lg
          hover:bg-gray-100 dark:hover:bg-gray-800
          lg:hidden
        "
      >
        <img
          src="/assets/logos/Menu_Icon.png"
          alt=""
          className="w-6 h-6"
        />

        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
          Menu
        </span>
      </button>

      {/* ================= TITLE ================= */}
      <div className="hidden xl:block">
        <h1 className="text-heading-5 font-bold text-dark dark:text-white">
          KD W3C STATS
        </h1>
      </div>

      {/* ================= SEARCH ================= */}
      <div className="flex flex-1 items-center justify-end">
        <form
          onSubmit={submitSearch}
          className="relative w-full max-w-[220px] md:max-w-[320px]"
        >
          {/* Accessibility + Chrome autofill fix */}
          <label htmlFor="header-search" className="sr-only">
            BattleTag search
          </label>

          <input
            id="header-search"
            name="battletag"
            type="search"
            autoComplete="off"
            placeholder="Search BattleTag"
            value={query}
            disabled={loading}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            className="
              w-full rounded-full border
              bg-gray-100 dark:bg-dark-2
              outline-none
              h-10 text-sm
              pl-10 pr-3
              md:h-12 md:text-base md:pl-12 md:pr-5
              disabled:opacity-60 disabled:cursor-not-allowed
              dark:border-dark-3
              focus-visible:border-primary
            "
          />

          <SearchIcon
            className="
              pointer-events-none
              absolute top-1/2 -translate-y-1/2 left-3
              w-5 h-5
              text-gray-700 dark:text-gray-200
            "
          />

          {error && (
            <p className="absolute left-0 top-full mt-1 text-xs text-red-500">
              {error}
            </p>
          )}
        </form>
      </div>
    </header>
  );
}
