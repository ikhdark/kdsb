"use client";

import { useEffect } from "react";
import { useParams, usePathname } from "next/navigation";

import { NAV_DATA } from "./data";
import MenuItem from "./menu-item";
import { useSidebarContext } from "./sidebar-context";

export default function Sidebar() {
  const { isOpen, closeSidebar, isMobile } = useSidebarContext();

  const pathname = usePathname();
  const params = useParams<{ battletag?: string }>();
  const battletag = params?.battletag;

  /* ================= LOCK SCROLL (mobile) ================= */

  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, isMobile]);

  /* ================= RENDER ITEM ================= */

  function renderItem(item: any, depth = 0) {
    const isSearch = item.title === "Player Search";
    const requiresPlayer = !item.global && !isSearch;
    const isDisabled = requiresPlayer && !battletag;

const href = isSearch
  ? "/"
 : item.global
? `/stats/${item.path}`
  : battletag
  ? `/stats/player/${battletag}/${item.path}`
  : "#";
    let isActive: boolean;

    if (href === "/") {
      isActive = pathname === "/";
    } else {
      isActive = pathname === href || pathname.startsWith(href + "/");
    }

    return (
      <MenuItem
        key={item.title}
        as="link"
        href={href}
        isActive={!isDisabled && isActive}
        onClick={isDisabled ? undefined : closeSidebar}
        className={`${depth ? "ml-5 text-sm" : ""} ${
          isDisabled ? "opacity-40 pointer-events-none" : ""
        }`}
      >
        {item.icon && depth === 0 && <item.icon className="w-4 h-4" />}
        {item.title}
      </MenuItem>
    );
  }

  /* ================= UI ================= */

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50
          w-72 h-[100dvh]
          overflow-y-auto
          bg-white border-r
          dark:bg-gray-900
          transform transition-transform duration-200
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:translate-x-0
        `}
      >
        <div className="p-4 space-y-6">
          {NAV_DATA.map((group) => (
            <div key={group.label}>
              <p className="px-4 mb-2 text-xs font-semibold uppercase text-gray-500">
                {group.label}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.title}>
                    {renderItem(item)}
                    {item.items?.map((sub: any) =>
                      renderItem(sub, 1)
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}