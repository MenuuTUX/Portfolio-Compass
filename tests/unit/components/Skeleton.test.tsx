import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { Skeleton } from "@/components/ui/skeleton";

afterEach(cleanup);

describe("Skeleton", () => {
  it("uses the CSS skeleton class instead of a framer animation", () => {
    const { container } = render(<Skeleton className="h-3 w-16" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("ws-skeleton");
    expect(el.className).toContain("h-3");
    expect(el.style.backgroundPosition).toBe("");
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });
});
