"use client";

import Link from "next/link";
import Reveal, { RevealGroup, RevealItem } from "./motion/Reveal";

const linkClass =
  "inline-flex min-h-8 items-center text-sm text-body transition-colors duration-[70ms] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass rounded";

export default function Footer() {
  return (
    <footer className="bg-canvas px-6 pt-24 pb-10 text-sm lg:px-10">
      <div className="mx-auto max-w-[88rem]">
        <div className="grid gap-16 md:grid-cols-[1fr_auto] md:gap-24">
          <Reveal>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
              <span className="font-display font-bold text-ink" style={{ fontSize: "clamp(32px, 5vw, 56px)", lineHeight: 1.1, letterSpacing: "0.005em" }}>
                PortfolioCompass
              </span>
            </div>
            <p className="mt-4 max-w-[40ch] text-body">Compare funds, build an allocation and test its assumptions in your browser.</p>
          </Reveal>

          <nav aria-label="Footer">
          <RevealGroup stagger={0.1} className="grid grid-cols-2 gap-x-16 gap-y-10 sm:grid-cols-3">
            <RevealItem>
              <p className="font-medium text-ink">Product</p>
              <ul className="mt-3 space-y-1">
                <li><Link href="/#compare" className={linkClass}>Compare</Link></li>
                <li><Link href="/#build" className={linkClass}>Build</Link></li>
                <li><Link href="/#test" className={linkClass}>Test</Link></li>
              </ul>
            </RevealItem>
            <RevealItem>
              <p className="font-medium text-ink">Learn</p>
              <ul className="mt-3 space-y-1">
                <li><Link href="/#learn" className={linkClass}>Why this exists</Link></li>
                <li><Link href="/#learn" className={linkClass}>Local-first</Link></li>
              </ul>
            </RevealItem>
            <RevealItem>
              <p className="font-medium text-ink">Legal</p>
              <ul className="mt-3 space-y-1">
                <li><Link href="/privacy" className={linkClass}>Privacy</Link></li>
                <li><Link href="/terms" className={linkClass}>Terms</Link></li>
                <li><a href="https://github.com/MenuuTUX/Portfolio-Compass" className={linkClass}>Source</a></li>
              </ul>
            </RevealItem>
          </RevealGroup>
          </nav>
        </div>

        <Reveal y={12}><p className="mt-20 border-t border-hairline pt-6 text-muted">For research and education, not financial advice.</p></Reveal>
      </div>
    </footer>
  );
}
