import { event } from "@/lib/gtag";

export function trackNavClick(title: string, href: string) {
  event("nav_click", {
    nav_label: title,
    nav_href: href,
    nav_area: "sidebar",
  });
}
