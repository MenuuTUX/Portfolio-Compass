import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Terms of use for Portfolio Compass, including what its projections are and are not.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" lastUpdated="12 September 2026">
      <Section heading="Not investment advice">
        <p>
          Portfolio Compass is an educational calculator. Nothing it displays is
          a recommendation to buy, sell, or hold any security, and nothing here
          is tailored to your circumstances. We are not a broker, dealer,
          investment adviser, or financial planner, and no advisory relationship
          is created by using this site.
        </p>
        <p>
          Decide with a licensed professional who knows your situation. You act
          on your own judgement and at your own risk.
        </p>
      </Section>

      <Section heading="What the numbers actually are">
        <p>
          The allocator is a greedy whole-share heuristic, not a mean-variance
          optimiser. It uses dividend yield plus a beta-based return proxy and a
          diagonal beta-based variance proxy, and it ignores cross-asset
          correlation. It does not find an optimal portfolio and does not claim
          to.
        </p>
        <p>
          Projections and Monte Carlo paths apply geometric Brownian motion to
          historical estimates. They describe a model, not the future. Past
          performance does not predict future results, and simulated results
          carry limitations that real trading does not.
        </p>
      </Section>

      <Section heading="Market data">
        <p>
          Quotes, fundamentals, and fund details come from third-party sources
          including Yahoo Finance, stockanalysis.com, etf.com, and CNN. Data may
          be delayed, incomplete, mis-scraped, or simply wrong, particularly for
          thinly traded and non-US listings. We do not verify it and provide no
          warranty as to accuracy or timeliness. Confirm anything that matters
          against your broker or the fund issuer before acting on it.
        </p>
      </Section>

      <Section heading="Your data is your responsibility">
        <p>
          Your portfolio is stored in your browser and nowhere else. We hold no
          backup. Clearing site data, switching browsers, or using private
          browsing will lose it, and we cannot restore it. Export a backup if the
          data matters to you.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>
          Do not use the site to overload or scrape the upstream data providers,
          to route automated traffic through the API routes, or to break any law
          that applies to you. Access may be rate-limited or withdrawn.
        </p>
      </Section>

      <Section heading="Availability and warranty">
        <p>
          The site is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, without warranty of any kind, express or implied,
          including merchantability and fitness for a particular purpose. It may
          go offline, break, or lose features at any time, without notice.
        </p>
      </Section>

      <Section heading="Limitation of liability">
        <p>
          To the fullest extent the law allows, the authors and contributors are
          not liable for any trading loss, lost profit, lost data, or any
          indirect or consequential damages arising from use of this site.
          Nothing here excludes liability that cannot lawfully be excluded.
        </p>
      </Section>

      <Section heading="Licence">
        <p>
          The source code is MIT licensed and available on{" "}
          <a
            className="underline underline-offset-4 hover:text-ink"
            href="https://github.com/MenuuTUX/Portfolio-Compass"
          >
            GitHub
          </a>
          . The MIT licence covers the code; it does not warrant the data the app
          displays.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          These terms may change, and the date at the top of this page will say
          when. Continuing to use the site after a change means you accept the
          revised terms.
        </p>
      </Section>
    </LegalPage>
  );
}
