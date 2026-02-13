import * as Icons from "../icons";
import type { ComponentType } from "react";

/* ================= TYPES ================= */

type NavItem = {
  title: string;
  icon?: ComponentType<any>;
  path: string;
  as: "link";
  global?: boolean;
  disabled?: boolean;
  items?: NavItem[]; // nested items
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

/* ================= DATA ================= */

export const NAV_DATA: NavGroup[] = [
  /* =====================================================
     GLOBAL / NON-PLAYER PAGES
  ===================================================== */
{
  label: "MAIN MENU",
  items: [
    {
      title: "Player Search",
      icon: Icons.HomeIcon,
      path: "",
      as: "link",
    },
    {
      title: "Matchup",
      icon: Icons.HomeIcon,
      path: "matchup",
      as: "link",
      global: true,
    },
    {
      title: "Live 1v1",
      icon: Icons.HomeIcon,
      path: "live",
      as: "link",
      global: true,
    },
  ],
},

  /* =====================================================
     PLAYER PAGES
  ===================================================== */

  {
    label: "PLAYER PAGES",
    items: [
      {
        title: "Summary",
        icon: Icons.HomeIcon,
        path: "summary",
        as: "link",
      },
      {
        title: "Performance",
        icon: Icons.HomeIcon,
        path: "performance",
        as: "link",
      },
      {
        title: "Time Consistency",
        icon: Icons.HomeIcon,
        path: "consistency",
        as: "link",
      },
      {
        title: "Hero Stats",
        icon: Icons.HomeIcon,
        path: "heroes",
        as: "link",
      },
      {
        title: "Map Stats",
        icon: Icons.HomeIcon,
        path: "maps",
        as: "link",
      },
      {
        title: "Vs Country",
        icon: Icons.HomeIcon,
        path: "vs-country",
        as: "link",
      },
      {
        title: "Vs Player",
        icon: Icons.HomeIcon,
        path: "vs-player",
        as: "link",
      },
      /* ---------- SoS Ladder ---------- */

      {
        title: "SoS Ladder",
        icon: Icons.HomeIcon,
        path: "ladder",
        as: "link",
        items: [
          { title: "Global", path: "ladder", as: "link" },
          { title: "Random", path: "ladder/race/random", as: "link" },
          { title: "Undead", path: "ladder/race/undead", as: "link" },
          { title: "Orc", path: "ladder/race/orc", as: "link" },
          { title: "Human", path: "ladder/race/human", as: "link" },
          { title: "Night Elf", path: "ladder/race/elf", as: "link" },
        ],
      },
    ],
  },
];