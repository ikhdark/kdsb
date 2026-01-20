"use client";

import { NAV_DATA } from "./data";
import MenuItem from "./menu-item";
import { useParams, usePathname } from "next/navigation";

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
                // If the item is player-scoped, require battletag
                const href = battletag
                  ? `/stats/player/${battletag}${item.path}`
                  : "/stats/player";

                const isActive =
                  battletag &&
                  pathname === `/stats/player/${battletag}${item.path}`;

                return (
                  <MenuItem
                    key={item.title}
                    as="link"
                    href={href}
                    isActive={!!isActive}
                  >
                    <item.icon />
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
