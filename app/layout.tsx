import "./globals.css";
import React from "react";
import Providers from "@/components/Providers";
import { ThemeProvider } from "@/components/theme-provider";
import localFont from 'next/font/local';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

const openaiSans = localFont({
  src: [
    { path: './fonts/OpenAISans-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/OpenAISans-Medium.ttf', weight: '500', style: 'normal' },
    { path: './fonts/OpenAISans-Semibold.ttf', weight: '600', style: 'normal' },
    { path: './fonts/OpenAISans-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-openai-sans',
  display: 'swap',
});

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://portfolio-compass.vercel.app";

export const metadata = {
  title: "PortfolioCompass",
  description:
    "Compare ETFs and stocks, test portfolio allocations, and run assumption-based projections.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${openaiSans.variable}`} suppressHydrationWarning>
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
