import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-hairline px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Educational tool. Not investment advice, and not a recommendation to
          buy or sell anything.
        </p>
        <nav className="flex items-center gap-5" aria-label="Legal">
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-ink focus:outline-none focus:ring-2 focus:ring-signal-mint rounded"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="underline underline-offset-4 hover:text-ink focus:outline-none focus:ring-2 focus:ring-signal-mint rounded"
          >
            Terms
          </Link>
          <a
            href="https://github.com/MenuuTUX/Portfolio-Compass"
            className="underline underline-offset-4 hover:text-ink focus:outline-none focus:ring-2 focus:ring-signal-mint rounded"
          >
            Source
          </a>
        </nav>
      </div>
    </footer>
  );
}
