import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Portfolio API placeholder.
 *
 * Portfolio Compass is local-first: the browser stores holdings in
 * LocalStorage (`portfolio_compass_v1`) via hooks in `/hooks`.
 * There is no server-side user session or cloud portfolio sync yet.
 *
 * This endpoint exists so clients probing `/api/portfolio` get a clear
 * response instead of a half-wired auth gate with no login providers.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "Portfolio is local-first",
      message:
        "Holdings are stored in the browser. Cloud sync and login are not enabled.",
      localFirst: true,
    },
    { status: 501 },
  );
}
