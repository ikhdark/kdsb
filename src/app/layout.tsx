import "@/css/satoshi.css";
import "@/css/style.css";

import { GoogleAnalytics } from "@next/third-parties/google";
import Script from "next/script";
import Sidebar from "@/components/Layouts/sidebar";
import Analytics from "@/components/Analytics";
import { Header } from "@/components/Layouts/header";
import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";
import Umami from "@/components/Umami";

export const metadata: Metadata = {
  title: {
    template: "%s | W3C Stats",
    default: "W3C Stats",
  },
  description: "Warcraft III W3Champions stats dashboard",
  openGraph: {
    title: "W3C Stats",
    siteName: "W3C Stats",
  },
  twitter: {
    title: "W3C Stats",
    card: "summary",
  },
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>

      <body>
        <Providers>
          <Analytics />

          <NextTopLoader color="#5750F1" showSpinner={false} />

          <div className="flex min-h-screen">
            <Sidebar />

            <div className="w-full bg-gray-2 dark:bg-[#020d1a]">
              <Header />

              <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 2xl:p-10 pb-safe">
                {children}
              </main>
            </div>
          </div>
        </Providers>

        {/* Google Analytics */}
        <GoogleAnalytics gaId="G-5QB5E0KBCL" />

        {/* Plausible */}
        <Script
          defer
          data-domain="w3cstats.com"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />

        {/* Umami (client-controlled loader) */}
        {process.env.NODE_ENV === "production" && <Umami />}
      </body>
    </html>
  );
}
