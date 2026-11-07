import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { mockModule } from "@/tests/helpers/mock-module";
import Providers from "@/components/Providers";

// next/image resolves remote loader URLs, which happy-dom cannot parse
await mockModule("next/image", () => ({
  default: ({ alt }: any) => <img alt={alt} />,
}));

const { default: Home } = await import("@/app/page");

function mobileNav() {
  return within(screen.getByRole("navigation", { name: "Primary mobile" }));
}

function currentTab() {
  return mobileNav()
    .getAllByRole("button")
    .filter((el) => el.getAttribute("aria-current") === "page")
    .map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim());
}

describe("app view and tab follow the URL", () => {
  // happy-dom starts at about:blank, which cannot take relative history URLs.
  beforeAll(() => {
    (window as any).happyDOM.setURL("http://localhost/");
  });
  afterAll(() => {
    (window as any).happyDOM.setURL("about:blank");
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it("opens the tab named in a deep link", async () => {
    window.history.replaceState(null, "", "/?view=app&tab=etfs");
    render(<Providers><Home /></Providers>);

    await waitFor(() => expect(mobileNav().getByRole("button", { name: "ETFs" }).getAttribute("aria-current")).toBe("page"));
  });

  it("writes a tab change to the URL", async () => {
    window.history.replaceState(null, "", "/?view=app&tab=trending");
    render(<Providers><Home /></Providers>);
    await waitFor(() => expect(currentTab()).toEqual(["Markets"]));

    fireEvent.click(mobileNav().getByRole("button", { name: "Stocks" }));

    await waitFor(() => expect(window.location.search).toBe("?view=app&tab=stocks"));
    expect(currentTab()).toEqual(["Stocks"]);
  });

  it("returns to the previous tab on Back instead of leaving the app", async () => {
    window.history.replaceState(null, "", "/?view=app&tab=trending");
    render(<Providers><Home /></Providers>);
    await waitFor(() => expect(currentTab()).toEqual(["Markets"]));

    fireEvent.click(mobileNav().getByRole("button", { name: "Stocks" }));
    await waitFor(() => expect(window.location.search).toBe("?view=app&tab=stocks"));

    window.history.back();

    await waitFor(() => expect(window.location.search).toBe("?view=app&tab=trending"));
    await waitFor(() => expect(currentTab()).toEqual(["Markets"]));
  });

  it("Home returns to the landing address", async () => {
    window.history.replaceState(null, "", "/?view=app&tab=etfs");
    render(<Providers><Home /></Providers>);
    await waitFor(() => expect(currentTab()).toEqual(["ETFs"]));

    fireEvent.click(mobileNav().getByRole("button", { name: "Home" }));

    await waitFor(() => expect(window.location.search).toBe(""));
  });
});
