import "./globals.css";
import React from "react";
import type { Viewport } from "next";
import Providers from "@/components/Providers";
import { ThemeProvider } from "@/components/theme-provider";
import Script from 'next/script';
import { Atkinson_Hyperlegible_Next } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { siteUrl } from '@/lib/site';

// Atkinson Hyperlegible Next (Braille Institute, SIL Open Font License) keeps 0/O, 1/l/I and 8/B apart,
// which matters when tickers and figures are the content. next/font self-hosts it at build time.
const appFont = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  variable: '--font-app',
  display: 'swap',
});

export const viewport: Viewport = {
  viewportFit: "cover",
};

const description =
  "Compare ETFs and stocks, test portfolio allocations, and run assumption-based projections.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: "Portfolio Compass",
  description,
  // Pages under this layout set their own canonical; this one covers the home page.
  alternates: { canonical: "/" },
};

const REPO = "https://github.com/MenuuTUX/Portfolio-Compass";

// Structured data for search engines and AI assistants. Only facts the repo states: no invented company details.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#app`,
      name: "Portfolio Compass",
      url: siteUrl,
      description,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any (web browser)",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://opensource.org/licenses/MIT",
      codeRepository: REPO,
      author: { "@id": `${siteUrl}/#author` },
    },
    {
      "@type": "Person",
      "@id": `${siteUrl}/#author`,
      name: "MenuuTUX",
      url: "https://github.com/MenuuTUX",
      sameAs: ["https://github.com/MenuuTUX"],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "Portfolio Compass",
      url: siteUrl,
      publisher: { "@id": `${siteUrl}/#author` },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={appFont.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-canvas text-ink" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
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
