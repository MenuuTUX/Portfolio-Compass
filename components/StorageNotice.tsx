"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";

const DISMISS_KEY = "storage_notice_dismissed_v1";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keep other tabs in sync when the notice is dismissed in one of them.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) !== null;
  } catch {
    // Private mode or blocked site data. Nothing is stored, so nothing to
    // disclose; treat it as dismissed rather than nagging on every load.
    return true;
  }
}

// The server cannot read the visitor's storage. Reporting "dismissed" keeps the
// markup identical on both sides, so the notice fades in after hydration
// instead of flashing and disappearing for people who already dismissed it.
const serverSnapshot = () => true;

/**
 * First-run storage notice.
 *
 * Deliberately a notice and not a consent gate. Portfolio Compass sets no
 * cookies, runs no advertising or cross-site tracking, and uses cookieless
 * analytics. The only client-side storage is the portfolio, recent tickers,
 * and theme — functional storage for a service the visitor explicitly asked
 * for, which is the ePrivacy Art 5(3) exemption. Asking consent to store the
 * portfolio the user just built would be theatre, and a "Reject" button that
 * changes nothing is worse than no banner at all.
 *
 * If the app ever adds advertising, cross-site analytics, or any non-essential
 * storage, this must become a real opt-in gate that blocks those scripts until
 * the visitor agrees.
 */
export default function StorageNotice() {
  const dismissed = useSyncExternalStore(
    subscribe,
    isDismissed,
    serverSnapshot,
  );

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Dismissal simply will not persist.
    }
    for (const listener of listeners) listener();
  }, []);

  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Data storage notice"
      className="app-bottom-safe fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-surface-card/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-body">
          Your portfolio is saved in this browser only. No account, no cookies,
          no cross-site tracking.{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-ink"
          >
            How this works
          </Link>
          .
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-full bg-ink px-5 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-signal-mint focus:ring-offset-2 focus:ring-offset-surface-card"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
