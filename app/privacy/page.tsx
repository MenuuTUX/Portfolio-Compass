import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Portfolio Compass stores, what it sends to its own server, and which third parties see your requests.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" lastUpdated="26 September 2026">
      <Section heading="The short version">
        <p>
          There is no account system or user database. Your portfolio lives in
          your browser, so Portfolio Compass cannot recover it for you. Our host
          may still keep standard request logs, as described below.
        </p>
        <p>
          Ticker symbols you look at leave your device. The app sends them to
          its server to fetch quotes. For mixed-currency portfolios, your
          browser also requests a USD/CAD exchange rate directly from the Bank
          of Canada; that request does not include your holdings.
        </p>
      </Section>

      <Section heading="What stays on your device">
        <p>
          Portfolio Compass writes to your browser&rsquo;s LocalStorage under
          these keys:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <code>portfolio_compass_v1</code> — your holdings: ticker, weight,
            and share count.
          </li>
          <li>
            <code>recent_tickers</code> — tickers you recently searched, used to
            populate the search box.
          </li>
          <li>
            <code>theme</code> — your light/dark preference.
          </li>
        </ul>
        <p>
          Share counts and target weights stay on your device. The app sends
          ticker symbols to its server to retrieve market data, as described
          below. Clearing your browser&rsquo;s site data deletes the stored
          portfolio, and we hold no copy to restore from.
        </p>
      </Section>

      <Section heading="What is sent to our server">
        <p>
          To display a price, chart, or fund breakdown, the app calls its own API
          routes with the ticker symbols concerned — for example{" "}
          <code>/api/market/snapshot?tickers=AAPL,VOO</code>. Those requests
          carry the symbols you are viewing.
        </p>
        <p>
          They do not carry your weights, share counts, or portfolio value.
          Server-side, quotes are held in a short-lived in-memory cache keyed by
          ticker, not by visitor. Nothing is written to a database, because there
          is no database.
        </p>
        <p>
          As with any website, our host records standard request logs, which
          include your IP address and user agent. We do not use those logs to
          build a profile of you.
        </p>
      </Section>

      <Section heading="Third parties that see your requests">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Vercel</strong> — hosting. Serves the site and keeps request
            logs.
          </li>
          <li>
            <strong>Vercel Analytics and Speed Insights</strong> — aggregate page
            view and performance measurement. Both are cookieless and do not
            track you across other sites.
          </li>
          <li>
            <strong>Yahoo Finance</strong> — quotes, charts, and fund data,
            requested by our server on your behalf.
          </li>
          <li>
            <strong>stockanalysis.com</strong> and <strong>etf.com</strong> —
            fund details Yahoo does not cover, requested by our server.
          </li>
          <li>
            <strong>CNN</strong> — the Fear &amp; Greed index.
          </li>
          <li>
            <strong>Bank of Canada</strong> — your browser requests its public
            USD/CAD daily exchange rate when the portfolio view is open. The
            request contains no tickers, shares, or portfolio value, but the
            Bank of Canada can see your IP address as the recipient.
          </li>
          <li>
            <strong>Google Fonts</strong> — typefaces, self-hosted at build time
            by Next.js, so your browser does not call Google.
          </li>
        </ul>
        <p>
          Quote and fund-data providers receive requests from our server, so
          they do not see your browser IP address from those requests. The Bank
          of Canada receives the exchange-rate request directly from your
          browser. Fund provider logos are served from this site. Individual
          company logos still load directly from a CDN, which sees your IP
          address as any image host would.
        </p>
      </Section>

      <Section heading="Cookies">
        <p>
          Portfolio Compass sets no cookies of its own and runs no advertising or
          cross-site tracking. The LocalStorage keys listed above are functional:
          they exist only to remember the portfolio and preferences you entered.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          You already hold your own data, so you can inspect, edit, or erase it
          at any time from your browser&rsquo;s settings without asking us.
          Clearing browser data does not erase standard request logs kept by
          the hosting provider.
        </p>
      </Section>

      <Section heading="Children">
        <p>
          Portfolio Compass is not directed at children and is not intended for
          anyone under 13.
        </p>
      </Section>

      <Section heading="Changes and contact">
        <p>
          Material changes will be reflected in the date at the top of this page.
          Questions and corrections belong in the{" "}
          <a
            className="underline underline-offset-4 hover:text-ink"
            href="https://github.com/MenuuTUX/Portfolio-Compass/issues"
          >
            project issue tracker
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
