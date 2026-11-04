import "./globals.css";
import React from "react";
import Providers from "@/components/Providers";
import { ThemeProvider } from "@/components/theme-provider";
import { Inter } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

// Inter is open source (SIL Open Font License); next/font self-hosts it at build time.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-app',
  display: 'swap',
});

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://portfolio-compass.vercel.app";

export const metadata = {
  title: "Portfolio Compass",
  description:
    "Compare ETFs and stocks, test portfolio allocations, and run assumption-based projections.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-canvas text-ink" suppressHydrationWarning>
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
