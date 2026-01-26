// src/global.d.ts
export {}; // marks this file as a module

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}
