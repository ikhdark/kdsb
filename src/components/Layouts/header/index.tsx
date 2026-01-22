"use client";

import { SearchIcon } from "@/assets/icons";
import Image from "next/image";
import Link from "next/link";
import { useSidebarContext } from "@/components/Layouts/sidebar/sidebar-context";
import { MenuIcon } from "./icons";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function normalizeBattleTagInput(value: string): string {
  return String(value)
    .replace(/\+/g, " ")
    .trim();
}

export function Header() {
  const { toggleSidebar, isMobile } = useSidebarContext();
  const router = useRouter();

  const [query, setQuery] = useState("");

  // ✅ START EMPTY (critical)
  const [generatedAt, setGeneratedAt] = useState<string>("");

  // ✅ client-only clock
  useEffect(() => {
    const update = () =>
      setGeneratedAt(new Date().toLocaleTimeString());

    update(); // first render after mount

    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();

    const normalized = normalizeBattleTagInput(query);
    if (!normalized) return;

    const encoded = encodeURIComponent(normalized);
    router.push(`/stats/player/${encoded}/summary`);
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stroke bg-white px-4 py-5 shadow-1 dark:border-stroke-dark dark:bg-gray-dark md:px-5 2xl:px-10">
      <button
        onClick={toggleSidebar}
        className="rounded-lg border px-1.5 py-1 dark:border-stroke-dark dark:bg-[#020D1A] hover:dark:bg-[#FFFFFF1A] lg:hidden"
      >
        <MenuIcon />
        <span className="sr-only">Toggle Sidebar</span>
      </button>

      {isMobile && (
        <Link href="/" className="ml-2 max-[430px]:hidden min-[375px]:ml-4">
          <Image
            src="/images/logo/logo-icon.svg"
            width={32}
            height={32}
            alt=""
            role="presentation"
          />
        </Link>
      )}

      <div className="max-xl:hidden">
        <h1 className="mb-0.5 text-heading-5 font-bold text-dark dark:text-white">
          KD&apos;S W3C STATS (Currently in BETA 1.0)
        </h1>

        <p className="font-medium">
          A site that unlocks your W3C stats
        </p>

        {generatedAt && (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Updated {generatedAt}
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 min-[375px]:gap-4">
        <form onSubmit={submitSearch} className="relative w-full max-w-[300px]">
          <input
            type="search"
            name="battletag"
            autoComplete="off"
            placeholder="Search BattleTag (e.g. kuhhhdark#1976)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex w-full items-center gap-3.5 rounded-full border bg-gray-2 py-3 pl-[53px] pr-5 outline-none transition-colors focus-visible:border-primary dark:border-dark-3 dark:bg-dark-2 dark:hover:border-dark-4 dark:hover:bg-dark-3 dark:hover:text-dark-6 dark:focus-visible:border-primary"
          />

          <button type="submit" className="sr-only">
            Search
          </button>

          <SearchIcon className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 max-[1015px]:size-5" />
        </form>
      </div>
    </header>
  );
}
