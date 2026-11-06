import { afterEach, describe, expect, it } from "bun:test";
import React, { useState } from "react";
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Providers from "@/components/Providers";
import Home from "@/app/page";
import GrowthScreen from "@/components/landing/GrowthScreen";

const HIDDEN = /opacity:\s*0[;"]|translateY\(110%\)/;

describe("landing first paint", () => {
  it("is visible in the server HTML, before any JavaScript runs", () => {
    const html = renderToString(<Providers><Home /></Providers>);

    const root = /<div[^>]*id="top"[^>]*>/.exec(html)?.[0] ?? "";
    const header = /<header[^>]*class="ws-nav"[^>]*>/.exec(html)?.[0] ?? "";
    const hero = html.slice(html.indexOf("<h1"), html.indexOf("For research and education"));

    expect(root).not.toBe("");
    expect(header).not.toBe("");
    expect(hero).toContain("Build a portfolio.");
    expect(root).not.toMatch(HIDDEN);
    expect(header).not.toMatch(HIDDEN);
    expect(hero).not.toMatch(HIDDEN);
  });
});

function Harness() {
  const [years, setYears] = useState(10);
  const [ret, setRet] = useState(7);
  return (
    <GrowthScreen idPrefix="t" years={years} annualReturn={ret} onYears={setYears} onReturn={setRet} />
  );
}

describe("hero sliders", () => {
  afterEach(cleanup);

  it("keep the same element and focus while the value changes", () => {
    render(<Harness />);
    const slider = screen.getByLabelText("Time horizon") as HTMLInputElement;
    slider.focus();

    fireEvent.change(slider, { target: { value: "20" } });

    const after = screen.getByLabelText("Time horizon") as HTMLInputElement;
    expect(after).toBe(slider);
    expect(document.activeElement).toBe(slider);
    expect(after.value).toBe("20");
  });

  it("follow a value changed by a preset chip", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /^30\s*yr$/ }));
    expect((screen.getByLabelText("Time horizon") as HTMLInputElement).value).toBe("30");
  });
});
