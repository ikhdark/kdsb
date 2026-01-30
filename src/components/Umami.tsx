"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

export default function Umami() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // only enable if user didn't opt-out
    if (!localStorage.getItem("umami-disable")) {
      setEnabled(true);
    }
  }, []);

  if (!enabled) return null;

  return (
    <Script
      defer
      src="https://cloud.umami.is/script.js"
      data-website-id="cc10a965-1b3f-4f62-b910-d351ab9548a3"
      strategy="afterInteractive"
    />
  );
}
