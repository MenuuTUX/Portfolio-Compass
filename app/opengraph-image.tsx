import { ImageResponse } from "next/og";

export const alt =
  "Portfolio Compass — compare stocks and ETFs, build a portfolio locally.";
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
          background: "#0c0a09",
          color: "#f5f3ef",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              background: "#f0c868",
            }}
          />
          <div style={{ fontSize: 28, letterSpacing: 2, color: "#8a8782" }}>
            PORTFOLIO COMPASS
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, fontWeight: 700 }}>
            Compare stocks and ETFs.
          </div>
          <div style={{ fontSize: 76, lineHeight: 1.05, color: "#f0c868", fontWeight: 700 }}>
            Build a portfolio locally.
          </div>
        </div>

        <div style={{ fontSize: 30, color: "#b9b6b0" }}>
          No account. No server database. Your holdings stay in your browser.
        </div>
      </div>
    ),
    size,
  );
}
