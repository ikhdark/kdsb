export const GA_ID = "G-5QB5E0KBCL";

// Track page views
export const pageview = (url: string) => {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("config", GA_ID, { page_path: url });
};

// Track custom events
export const event = (action: string, params: Record<string, any>) => {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", action, params);
};
