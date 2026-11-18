"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Reveal, { RevealGroup, RevealItem } from "./motion/Reveal";

const linkClass =
  "flex min-h-11 [@media(pointer:fine)]:min-h-8 items-center text-sm text-body transition-colors duration-[70ms] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass rounded";

export default function Footer() {
  const [shareStatus, setShareStatus] = useState("");

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Portfolio Compass", text: "Portfolio Compass: ETF comparison and portfolio tools", url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareStatus("Link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("Could not share the link. Copy the address from your browser.");
    }
  };

  return (
    <footer className="bg-canvas px-6 pt-24 pb-10 text-sm lg:px-10">
      <div className="mx-auto max-w-[88rem]">
        <div className="grid gap-16 md:grid-cols-[1fr_auto] md:gap-24">
          <Reveal>
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="" width={40} height={40} sizes="40px" className="h-10 w-10 rounded-xl" />
              <span className="font-display font-bold text-ink" style={{ fontSize: "clamp(32px, 5vw, 56px)", lineHeight: 1.1, letterSpacing: "0.005em" }}>
                Portfolio Compass
              </span>
            </div>
            <p className="mt-4 max-w-[40ch] text-pretty text-body">Compare funds, build a portfolio and simulate its range of outcomes in your browser.</p>
            <p className="mt-8 max-w-[40ch] text-pretty text-body">Open source under the MIT license. A star on GitHub helps other people find it.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="https://github.com/MenuuTUX/Portfolio-Compass" target="_blank" rel="noopener noreferrer" className="ws-btn-outline">
                Star on GitHub
              </a>
              <button type="button" onClick={share} className="ws-btn-outline">
                Share
              </button>
            </div>
            <p role="status" className="mt-3 min-h-5 text-body">{shareStatus}</p>
          </Reveal>

          <nav aria-label="Footer">
          <RevealGroup stagger={0.1} className="grid grid-cols-2 gap-x-16 gap-y-10 sm:grid-cols-3">
            <RevealItem>
              <p className="font-medium text-ink">Product</p>
              <ul className="mt-3 space-y-1">
                <li><Link href="/#compare" className={linkClass}>Compare</Link></li>
                <li><Link href="/#portfolio" className={linkClass}>Portfolio</Link></li>
                <li><Link href="/#simulate" className={linkClass}>Simulate</Link></li>
              </ul>
            </RevealItem>
            <RevealItem>
              <p className="font-medium text-ink">About</p>
              <ul className="mt-3 space-y-1">
                <li><Link href="/#your-data" className={linkClass}>Your data</Link></li>
                <li><Link href="/#your-data" className={linkClass}>Why this exists</Link></li>
              </ul>
            </RevealItem>
            <RevealItem>
              <p className="font-medium text-ink">Legal</p>
              <ul className="mt-3 space-y-1">
                <li><Link href="/privacy" className={linkClass}>Privacy</Link></li>
                <li><Link href="/terms" className={linkClass}>Terms</Link></li>
                <li><a href="https://github.com/MenuuTUX/Portfolio-Compass" className={linkClass}>Source</a></li>
                <li><a href="https://github.com/MenuuTUX/Portfolio-Compass/issues" className={linkClass}>Contact</a></li>
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
