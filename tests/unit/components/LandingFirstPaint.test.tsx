import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { mockModule } from "@/tests/helpers/mock-module";

const { default: Providers } = await import("@/components/Providers");
const { default: Home } = await import("@/app/page");
const { default: HeroCompare } = await import("@/components/landing/HeroCompare");

const HIDDEN = /opacity:\s*0[;"]|translateY\(110%\)/;

describe("landing first paint", () => {
  it("is visible in the server HTML, before any JavaScript runs", () => {
    const html = renderToString(<Providers><Home /></Providers>);

    const root = /<div[^>]*id="top"[^>]*>/.exec(html)?.[0] ?? "";
    const header = /<header[^>]*class="ws-nav"[^>]*>/.exec(html)?.[0] ?? "";
    const hero = html.slice(html.indexOf("<h1"), html.indexOf("For research and education"));

    expect(root).not.toBe("");
    expect(header).not.toBe("");
    expect(hero).toContain("You opened a TFSA.");
    expect(root).not.toMatch(HIDDEN);
    expect(header).not.toMatch(HIDDEN);
    expect(hero).not.toMatch(HIDDEN);
  });

  it("names each section once, the same way everywhere", () => {
    const html = renderToString(<Providers><Home /></Providers>);
    for (const id of ["compare", "portfolio", "simulate", "your-data"]) {
      expect(html).toContain(`id="${id}"`);
    }
    // The landing's projection band is a simulation; "Backtest" is the Lab's name in the app.
    expect(html).not.toMatch(/>(Backtest|Learn|Build|Test)</);
    expect(html).not.toMatch(/is better/);
  });

  it("ends on both ways in, with the privacy promise beside them", () => {
    const html = renderToString(<Providers><Home /></Providers>);
    const start = html.indexOf('id="start"');
    expect(start).toBeGreaterThan(-1);
    const closing = html.slice(start, html.indexOf("<footer"));
    expect(closing).toContain("Your holdings stay in this browser.");
    expect(closing).toContain("Get started");
    expect(closing).toContain("Browse market");
    expect(closing).not.toContain("Star on GitHub");
    expect(html.slice(html.indexOf("<footer"))).toContain("Star on GitHub");
  });
});

describe("hero comparison", () => {
  afterEach(cleanup);

  it("shows every fund's figures without ranking them", () => {
    render(<HeroCompare />);
    for (const ticker of ["VEQT", "XEQT", "XBB"]) {
      expect(screen.getByRole("columnheader", { name: new RegExp(ticker) })).toBeTruthy();
    }
    expect(screen.getByText(/checked Nov 18, 2026/)).toBeTruthy();
    expect(screen.queryByText(/best|winner|recommended/i)).toBeNull();
  });

  it("reveals what each figure assumes when the switch is turned on", () => {
    render(<HeroCompare />);
    const toggle = screen.getByRole("switch", { name: /what does this assume/i });
    const note = screen.getByText(/Vanguard and iShares work this out differently/);
    const row = note.closest("tr") as HTMLElement;
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(row.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(row.getAttribute("aria-hidden")).toBe("false");
  });
});
