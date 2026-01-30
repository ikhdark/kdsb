const BASE_UI = ["Alerts", "Buttons"] as const;

export const UI_ELEMENTS = BASE_UI
  .slice()
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  .map((title) => ({
    title,
    url: `/ui-elements/${title.replace(/\s+/g, "-").toLowerCase()}`,
    isPro: false,
  }));
