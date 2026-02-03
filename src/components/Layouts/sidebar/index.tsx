"use client";

import { useEffect } from "react";
import { usePathname, useParams } from "next/navigation";
import { NAV_DATA } from "./data";
import MenuItem from "./menu-item";
import { useSidebarContext } from "./sidebar-context";

export default function Sidebar() {
  const { isOpen, closeSidebar, isMobile } = useSidebarContext();

  const params = useParams<{ battletag?: string }>();
  const pathname = usePathname();
  const battletag = params?.battletag;

  /* =========================
     LOCK BODY SCROLL (mobile only)
  ========================== */
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

  function renderItem(item: any, depth = 0) {
    const isSearch = item.title === "Player Search";

    /* HARD DISABLE */
    if (item.disabled) {
      return (
        <div
          key={item.title}
          className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-gray-400 opacity-40 select-none"
        >
          {item.icon && <item.icon />}
          {item.title}
        </div>
      );
    }

    /* CONTEXT DISABLE */
   if (!battletag && !isSearch && !item.global) {
      return (
        <div
          key={item.title}
          className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-gray-400 opacity-40 select-none"
        >
          {item.icon && <item.icon />}
          {item.title}
        </div>
      );
    }

 const href = isSearch
  ? "/"
  : item.global
    ? `/stats/${item.path}`
    : `/stats/player/${battletag}/${item.path}`;

    const isActive = pathname.startsWith(href);

    return (
      <MenuItem
        key={item.title}
        as="link"
        href={href}
        isActive={isActive}
        onClick={closeSidebar}
        className={depth ? "ml-6 text-sm opacity-90" : ""}
      >
        {item.icon && depth === 0 && <item.icon />}
        {item.title}
      </MenuItem>
    );
  }

  return (
    <>
      {/* OVERLAY */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={closeSidebar}
        />
      )}

      {/* SIDEBAR */}
   <aside
  className={`
    fixed left-0 top-0 z-50 w-72
    h-[100dvh] overflow-y-auto
    pb-24
    transform bg-white border-r border-stroke
    transition-transform duration-200
    ${isOpen ? "translate-x-0" : "-translate-x-full"}

    md:static md:translate-x-0 md:flex
    dark:border-stroke-dark dark:bg-gray-dark
  `}
>
        <div className="w-full p-4">
          {NAV_DATA.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="mb-2 px-4 text-xs font-semibold uppercase text-gray-500">
                {group.label}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.title}>
                    {renderItem(item)}

                    {/* render submenu if exists */}
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
