"use client";

import { SearchIcon } from "@/assets/icons";
import { MenuIcon } from "./icons";
import { useSidebarContext } from "@/components/Layouts/sidebar/sidebar-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function normalizeBattleTagInput(value: string): string {
  return String(value).replace(/\+/g, " ").trim();
}

export function Header() {
  const { toggleSidebar } = useSidebarContext();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    const update = () =>
      setGeneratedAt(new Date().toLocaleTimeString());

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();

    const normalized = normalizeBattleTagInput(query);
    if (!normalized) return;

    router.push(`/stats/player/${encodeURIComponent(normalized)}/summary`);
  }

  return (
    <header
      className="
        sticky top-0 z-20
        flex items-center justify-between
        border-b border-stroke bg-white shadow-1
        px-3 py-3
        md:px-5 md:py-5
        dark:border-stroke-dark dark:bg-gray-dark
      "
    >
      {/* ===== SINGLE MOBILE HAMBURGER ===== */}
      <button
        onClick={toggleSidebar}
        className="rounded-lg border p-2 lg:hidden dark:border-stroke-dark"
      >
        <MenuIcon />
      </button>

      {/* ===== DESKTOP TITLE ===== */}
      <div className="hidden xl:block">
        <h1 className="text-heading-5 font-bold text-dark dark:text-white">
          KD&apos;S W3C STATS
        </h1>

        <p className="font-medium">Unlock your W3C stats</p>

        {generatedAt && (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Updated {generatedAt}
          </div>
        )}
      </div>

      {/* ===== SEARCH ===== */}
      <div className="flex flex-1 items-center justify-end">
        <form
          onSubmit={submitSearch}
          className="relative w-full max-w-[220px] md:max-w-[320px]"
        >
          <input
            type="search"
            autoComplete="off"
            placeholder="Search BattleTag"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="
              w-full rounded-full border bg-gray-2 outline-none

              h-10 text-sm pl-9 pr-3
              md:h-12 md:text-base md:pl-12 md:pr-5

              dark:border-dark-3 dark:bg-dark-2
              focus-visible:border-primary
            "
          />

          <SearchIcon
            className="
              pointer-events-none absolute top-1/2 -translate-y-1/2
              left-3 size-4 md:left-5 md:size-5
            "
          />

          <button type="submit" className="sr-only">
            Search
          </button>
        </form>
      </div>
    </header>
  );
}
