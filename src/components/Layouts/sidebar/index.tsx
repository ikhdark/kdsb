"use client";

import { useState } from "react";
import { usePathname, useParams } from "next/navigation";
import { NAV_DATA } from "./data";
import MenuItem from "./menu-item";

export default function Sidebar() {
  const params = useParams<{ battletag?: string }>();
  const pathname = usePathname();
  const battletag = params?.battletag;

  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ================= MOBILE HAMBURGER ================= */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg border bg-white p-2 shadow md:hidden"
      >
        ☰
      </button>

      {/* ================= OVERLAY ================= */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72
          transform bg-white border-r border-stroke
          transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"}

          md:static md:translate-x-0 md:flex
          dark:border-stroke-dark dark:bg-gray-dark
        `}
      >
        <div className="p-4 overflow-y-auto w-full">

          {/* Close button (mobile) */}
          <button
            onClick={() => setOpen(false)}
            className="mb-4 md:hidden text-sm text-gray-500"
          >
            Close ✕
          </button>

          {NAV_DATA.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="mb-2 px-4 text-xs font-semibold uppercase text-gray-500">
                {group.label}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const isSearch = item.title === "Player Search";

                  /* HARD DISABLE */
                  if (item.disabled) {
                    return (
                      <div
                        key={item.title}
                        className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-gray-400 opacity-40 cursor-not-allowed select-none"
                      >
                        {item.icon && <item.icon />}
                        {item.title}
                      </div>
                    );
                  }

                  /* CONTEXT DISABLE */
                  const disabledByContext = !battletag && !isSearch;

                  if (disabledByContext) {
                    return (
                      <div
                        key={item.title}
                        className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-gray-400 opacity-40 cursor-not-allowed select-none"
                      >
                        {item.icon && <item.icon />}
                        {item.title}
                      </div>
                    );
                  }

                  /* NORMAL LINK */
                  const href = isSearch
                    ? "/stats/player"
                    : `/stats/player/${battletag}${item.path}`;

                  const isActive = pathname === href;

                  return (
                    <MenuItem
                      key={item.title}
                      as="link"
                      href={href}
                      isActive={isActive}
                      onClick={() => setOpen(false)} // auto close mobile
                    >
                      {item.icon && <item.icon />}
                      {item.title}
                    </MenuItem>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
