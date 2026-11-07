import { ImageResponse } from "next/og";

export const alt =
  "Portfolio Compass: compare stocks and ETFs, build a portfolio locally.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated at build time, so the social card never drifts from the copy below.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0d0d0d",
          color: "#ffffff",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="12.5" stroke="#f8f7f4" strokeWidth="1.5" />
            <path d="M21.8 10.2 18 18 14 14l7.8-3.8Z" fill="#24b77e" />
            <path d="M10.2 21.8 14 14l4 4-7.8 3.8Z" fill="#ef7469" />
          </svg>
          <div style={{ fontSize: 28, color: "#8c8c8c" }}>
            Portfolio Compass
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, fontWeight: 700, letterSpacing: -2 }}>
            Compare stocks and ETFs.
          </div>
          <div style={{ fontSize: 76, lineHeight: 1.05, color: "#8c8c8c", fontWeight: 700 }}>
            Build a portfolio locally.
          </div>
        </div>

        <div style={{ fontSize: 30, color: "#8c8c8c" }}>
          No account. No server database. Your holdings stay in your browser.
        </div>
      </div>
    ),
    size,
  );
}
