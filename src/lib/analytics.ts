"use client";

import { init, track } from "@plausible-analytics/tracker";

export function initAnalytics() {
  init({
    domain: "w3cstats.com",
    endpoint: "/api/event",
    autoCapturePageviews: true,
    outboundLinks: true,
    fileDownloads: true,
    formSubmissions: true,
    captureOnLocalhost: false,
  });
}

export { track };