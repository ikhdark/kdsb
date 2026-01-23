import * as Icons from "../icons";

export const NAV_DATA = [
  {
    label: "MAIN MENU",
    items: [
      {
        title: "Player Search",
        icon: Icons.HomeIcon,
        path: "/", // root landing page
        as: "link",
      },
    ],
  },
  {
    label: "PLAYER PAGES",
    items: [
      {
        title: "Summary",
        icon: Icons.HomeIcon,
        path: "/summary",
        as: "link",
      },
      {
        title: "Rank Stats",
        icon: Icons.HomeIcon,
        path: "/rank",
        as: "link",
      },

      // ✅ ADD THIS (Performance page)
      {
        title: "Performance",
        icon: Icons.HomeIcon,
        path: "/performance",
        as: "link",
      },

      {
        title: "Hero Stats",
        icon: Icons.HomeIcon,
        path: "/heroes",
        as: "link",
      },
      {
        title: "Map Stats",
        icon: Icons.HomeIcon,
        path: "/maps",
        as: "link",
      },
      {
        title: "Vs Country",
        icon: Icons.HomeIcon,
        path: "/vs-country",
        as: "link",
      },
      {
        title: "Vs Player",
        icon: Icons.HomeIcon,
        path: "/vs-player",
        as: "link",
      },
      {
        title: "More Coming Soon!",
        icon: Icons.HomeIcon,
        path: null,
        disabled: true,
      },
    ],
  },
];
