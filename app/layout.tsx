import "./globals.css";
import React from "react";
import Providers from "@/components/Providers";
import { Inter, Space_Grotesk } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
});

export const metadata = {
  title: "PortfolioCompass",
  description: "Institutional Grade Portfolio Intelligence",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased bg-stone-950 text-stone-100">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
