import * as Icons from "../icons";

export const NAV_DATA = [
  {
    label: "MAIN MENU",
    items: [
      {
        title: "Player Search",
        icon: Icons.HomeIcon,
        path: "", // handled as /stats/player
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
      },
      {
        title: "Rank Stats",
        icon: Icons.HomeIcon,
        path: "/rank",
      },
      {
        title: "Hero Stats",
        icon: Icons.HomeIcon,
        path: "/heroes",
      },
      {
        title: "Map Stats",
        icon: Icons.HomeIcon,
        path: "/maps",
      }, 
      {
        title: "Vs Country",
        icon: Icons.HomeIcon,
        path: "/vs-country",
      },
       {
        title: "Vs Player",
        icon: Icons.HomeIcon,
        path: "/vs-player",
      },
      
    ],
  },
];
