"use client";

import { useSidebarContext } from "@/components/Layouts/sidebar/sidebar-context";

export function Header() {
  const { toggleSidebar } = useSidebarContext();

  return (
    <header
      className="
        sticky top-0 z-20
        flex items-center justify-between
        border-b border-stroke
        bg-white shadow-1
        px-3 py-3 md:px-5 md:py-5
        dark:border-stroke-dark dark:bg-gray-dark
      "
    >
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
      <div className="w-full text-center">
        <h1 className="text-heading-5 font-bold text-dark dark:text-white">
          KD W3C STATS
        </h1>
      </div>
    </header>
  );
}
