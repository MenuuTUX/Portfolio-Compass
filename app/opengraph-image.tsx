import { ImageResponse } from "next/og";

export const alt =
  "PortfolioCompass: compare stocks and ETFs, build a portfolio locally.";
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
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              background: "#ffffff",
            }}
          />
          <div style={{ fontSize: 28, color: "#8c8c8c" }}>
            PortfolioCompass
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
