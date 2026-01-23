export const GA_ID = "G-5QB5E0KBCL";

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

export const pageview = (url: string) => {
  window.gtag?.("config", GA_ID, {
    page_path: url,
  });
};
