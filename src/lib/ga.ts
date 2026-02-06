// src/lib/ga.ts

const GA_ID = "G-5QB5E0KBCL";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function pageview(url: string) {
  if (typeof window === "undefined" || !window.gtag) return;

  window.gtag("config", GA_ID, {
    page_path: url,
  });
}

export function event(
  action: string,
  params: Record<string, string | number | boolean>
) {
  if (typeof window === "undefined" || !window.gtag) return;

  window.gtag("event", action, params);
}