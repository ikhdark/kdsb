"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { NAV_DATA } from "./data";
import MenuItem from "./menu-item";

export default function Sidebar() {
  const params = useParams<{ battletag?: string }>();
  const pathname = usePathname();
  const battletag = params?.battletag;

  return (
    <aside className="flex w-72 flex-col border-r border-stroke bg-white dark:border-stroke-dark dark:bg-gray-dark">
      <div className="p-4">
        {NAV_DATA.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="mb-2 px-4 text-xs font-semibold uppercase text-gray-500">
              {group.label}
            </p>

            <div className="space-y-1">
              {group.items.map((item) => {
                // Disabled items render unclickable
                if (item.disabled) {
                  return (
                    <div
                      key={item.title}
                      className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
                    >
                      {item.icon && <item.icon />}
                      {item.title}
                    </div>
                  );
                }

                // Player Search always routes to /stats/player
                const href =
                  item.title === "Player Search"
                    ? "/stats/player"
                    : battletag
                    ? `/stats/player/${battletag}${item.path}`
                    : `/stats/player${item.path}`;

                const isActive = pathname === href;

                return (
                  <MenuItem
                    key={item.title}
                    as={item.as ?? "link"}
                    href={href}
                    isActive={isActive}
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
  );
}
