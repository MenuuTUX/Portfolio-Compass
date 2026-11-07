import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, cleanup, render } from "@testing-library/react";
import { mockModule } from "@/tests/helpers/mock-module";

// next/image needs a browser origin; the logo is a same-origin path, so a plain img is enough here.
await mockModule("next/image", () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));
const { default: Hero } = await import("@/components/Hero");

type MqStub = { matches: boolean; addEventListener: () => void; removeEventListener: () => void };
const original = window.matchMedia;

function stubWidth(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("900px") ? wide : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as MqStub & typeof window.matchMedia;
}

function mountInsideScroller() {
  const scroller = document.createElement("div");
  scroller.id = "top";
  document.body.appendChild(scroller);
  const host = document.createElement("div");
  scroller.appendChild(host);
  return { scroller, host };
}

beforeEach(() => {
  stubWidth(true);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  window.matchMedia = original;
});

describe("Hero header on the landing scroller", () => {
  it("gets its solid background once #top scrolls past the threshold", () => {
    const { scroller, host } = mountInsideScroller();
    const { container } = render(<Hero />, { container: host });
    const header = container.querySelector("header") as HTMLElement;
    expect(header.style.backgroundColor).toBe("");

    scroller.scrollTop = 120;
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(header.style.backgroundColor).toContain("surface-card");
  });

  it("stops listening to #top after unmount", () => {
    const { scroller, host } = mountInsideScroller();
    const { unmount, container } = render(<Hero />, { container: host });
    const header = container.querySelector("header") as HTMLElement;
    unmount();
    scroller.scrollTop = 200;
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(header.style.backgroundColor).toBe("");
  });
});

describe("Hero art on phones and desktops", () => {
  it("mounts only the desktop art on wide screens", () => {
    stubWidth(true);
    render(<Hero />);
    expect(document.getElementById("growth-wide-title")).not.toBeNull();
    expect(document.getElementById("growth-sm-title")).toBeNull();
  });

  it("mounts only the phone copy on narrow screens", () => {
    stubWidth(false);
    render(<Hero />);
    expect(document.getElementById("growth-wide-title")).toBeNull();
    expect(document.getElementById("growth-sm-title")).not.toBeNull();
  });
});
