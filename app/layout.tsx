import "./globals.css";
import React from "react";
import type { Viewport } from "next";
import Providers from "@/components/Providers";
import { ThemeProvider } from "@/components/theme-provider";
import Script from 'next/script';
import { Inter } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

// Inter is open source (SIL Open Font License); next/font self-hosts it at build time.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-app',
  display: 'swap',
});

export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata = {
  title: "Portfolio Compass",
  description:
    "Compare ETFs and stocks, test portfolio allocations, and run assumption-based projections.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-canvas text-ink" suppressHydrationWarning>
        {/* A deep link into the app (?view=app) would flash the landing page until the app hydrates; mark it before first paint so CSS can hide the landing. */}
        <Script
          id="deeplink-marker"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: "try{if(/[?&]view=(app|quiz)\\b/.test(location.search))document.documentElement.setAttribute('data-deeplink','1')}catch(e){}",
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme-system-only">
          <Providers>
            {children}
          </Providers>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
