import "./globals.css";
import React from "react";
import Providers from "@/components/Providers";
import { Inter, Libre_Caslon_Text } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Caslon-inspired serif for headlines (Wealthsimple-style display face)
const libreCaslon = Libre_Caslon_Text({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-caslon',
  display: 'swap',
});

export const metadata = {
  title: "PortfolioCompass",
  description: "Institutional Grade Portfolio Intelligence",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${libreCaslon.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-canvas text-ink" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
