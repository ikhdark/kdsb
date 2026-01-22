import "@/css/satoshi.css";
import "@/css/style.css";

import { GoogleAnalytics } from "@next/third-parties/google";
import Sidebar from "@/components/Layouts/sidebar";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import { Header } from "@/components/Layouts/header";
import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";

import AnalyticsInit from "@/components/AnalyticsInit";

export const metadata: Metadata = {
  title: {
    template: "%s | KD's W3C Stats",
    default: "KD's W3C Stats",
  },
  description: "Warcraft III W3Champions stats dashboard",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>

          {/* Plausible tracker init (client-only) */}
          <AnalyticsInit />

          <NextTopLoader color="#5750F1" showSpinner={false} />

          <div className="flex min-h-screen">
            <Sidebar />

            <div className="w-full bg-gray-2 dark:bg-[#020d1a]">
              <Header />

              <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 2xl:p-10">
                {children}
              </main>
            </div>
          </div>
        </Providers>

        {/* Google Analytics (optional) */}
        <GoogleAnalytics gaId="G-5QB5E0KBCL" />
      </body>
    </html>
  );
}
